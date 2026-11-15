import Foundation
import Network
import VideoToolbox
import CoreMedia
import CoreImage
import UIKit

/// Receives the H.264 stream produced by the ParkCastBroadcast ReplayKit extension over a loopback-only
/// socket, decodes it with VideoToolbox and hands upright CGImages to the CarPlay screen.
///
/// Wire format (big endian): [type: UInt8][length: UInt32][payload]
///   type 1 = parameter sets: [spsLen: UInt16][sps][ppsLen: UInt16][pps]
///   type 2 = frame: [orientation: UInt8 (CGImagePropertyOrientation)][AVCC NAL units]
/// The receiver replies with [0x10][quality] where quality 0 = basic 480p, 1 = High 1080p30, 2 = Ultra 1080p60.
final class MirrorReceiver {
  private let queue = DispatchQueue(label: "app.parkcast.mirror.receiver")
  private var listener: NWListener?
  private var connection: NWConnection?
  private var buffer = Data()
  private var formatDescription: CMVideoFormatDescription?
  private var decoder: VTDecompressionSession?
  private var orientation: CGImagePropertyOrientation = .up
  private let ciContext = CIContext()
  private var quality: UInt8 = 0

  private(set) var isActive = false
  private(set) var isListening = false
  private(set) var framesReceived = 0
  var onFrame: ((CGImage) -> Void)?

  static var port: UInt16? {
    let raw = Bundle.main.object(forInfoDictionaryKey: "ParkCastMirrorPort")
    if let number = raw as? NSNumber { return number.uint16Value }
    if let text = raw as? String { return UInt16(text) }
    return nil
  }

  func start() {
    queue.async { self.startListener() }
  }

  private func startListener() {
    guard listener == nil else { return }
    guard let value = MirrorReceiver.port, let port = NWEndpoint.Port(rawValue: value) else {
      DiagnosticsLog.shared.record("mirror: no ParkCastMirrorPort in Info.plist, receiver not started")
      return
    }
    let params = NWParameters.tcp
    params.requiredInterfaceType = .loopback
    params.allowLocalEndpointReuse = true
    let newListener: NWListener
    do {
      newListener = try NWListener(using: params, on: port)
    } catch {
      DiagnosticsLog.shared.record("mirror: listener on port \(value) failed to open: \(error.localizedDescription)")
      queue.asyncAfter(deadline: .now() + 5) { self.startListener() }
      return
    }
    newListener.newConnectionHandler = { [weak self] connection in
      DiagnosticsLog.shared.record("mirror: broadcast extension connected")
      self?.accept(connection)
    }
    newListener.stateUpdateHandler = { [weak self] state in
      guard let self = self else { return }
      switch state {
      case .ready:
        self.isListening = true
        DiagnosticsLog.shared.record("mirror: listening on 127.0.0.1:\(value)")
      case .failed(let error):
        self.isListening = false
        DiagnosticsLog.shared.record("mirror: listener failed: \(error.localizedDescription), retrying")
        self.listener?.cancel()
        self.listener = nil
        self.queue.asyncAfter(deadline: .now() + 2) { self.startListener() }
      case .cancelled:
        self.isListening = false
      default:
        break
      }
    }
    listener = newListener
    newListener.start(queue: queue)
  }

  func setQuality(_ value: UInt8) {
    queue.async {
      guard value != self.quality else { return }
      self.quality = value
      self.sendConfig()
    }
  }

  private func sendConfig() {
    connection?.send(content: Data([0x10, quality]), completion: .idempotent)
  }

  private func accept(_ newConnection: NWConnection) {
    connection?.cancel()
    connection = newConnection
    buffer.removeAll()
    resetDecoder()
    newConnection.stateUpdateHandler = { [weak self, weak newConnection] state in
      guard let self = self, let conn = newConnection else { return }
      switch state {
      case .ready:
        self.sendConfig()
      case .failed, .cancelled:
        if conn === self.connection {
          self.connection = nil
          self.connectionEnded()
        }
      default:
        break
      }
    }
    newConnection.start(queue: queue)
    receive(on: newConnection)
  }

  private func receive(on conn: NWConnection) {
    conn.receive(minimumIncompleteLength: 1, maximumLength: 1 << 20) { [weak self, weak conn] data, _, isComplete, error in
      guard let self = self, let conn = conn else { return }
      if let data = data, !data.isEmpty, conn === self.connection {
        self.buffer.append(data)
        self.parse()
      }
      if isComplete || error != nil {
        conn.cancel()
        return
      }
      self.receive(on: conn)
    }
  }

  private func parse() {
    while buffer.count >= 5 {
      let start = buffer.startIndex
      let type = buffer[start]
      let length = Int(buffer[start + 1]) << 24 | Int(buffer[start + 2]) << 16 | Int(buffer[start + 3]) << 8 | Int(buffer[start + 4])
      let total = 5 + length
      guard length >= 0, length < 16 << 20 else {
        buffer.removeAll()
        return
      }
      guard buffer.count >= total else { return }
      let payload = buffer.subdata(in: (start + 5)..<(start + total))
      buffer = buffer.subdata(in: (start + total)..<buffer.endIndex)
      switch type {
      case 1: setParameterSets(payload)
      case 2: decodeFrame(payload)
      default: break
      }
    }
  }

  private func setParameterSets(_ payload: Data) {
    let bytes = [UInt8](payload)
    guard bytes.count > 4 else { return }
    let spsLength = Int(bytes[0]) << 8 | Int(bytes[1])
    let ppsHeader = 2 + spsLength
    guard bytes.count >= ppsHeader + 2 else { return }
    let ppsLength = Int(bytes[ppsHeader]) << 8 | Int(bytes[ppsHeader + 1])
    guard bytes.count >= ppsHeader + 2 + ppsLength, spsLength > 0, ppsLength > 0 else { return }
    let sps = Array(bytes[2..<ppsHeader])
    let pps = Array(bytes[(ppsHeader + 2)..<(ppsHeader + 2 + ppsLength)])

    var newDescription: CMVideoFormatDescription?
    let status: OSStatus = sps.withUnsafeBufferPointer { spsBuffer in
      pps.withUnsafeBufferPointer { ppsBuffer in
        guard let spsBase = spsBuffer.baseAddress, let ppsBase = ppsBuffer.baseAddress else { return -1 }
        let pointers: [UnsafePointer<UInt8>] = [spsBase, ppsBase]
        let sizes: [Int] = [sps.count, pps.count]
        return CMVideoFormatDescriptionCreateFromH264ParameterSets(
          allocator: kCFAllocatorDefault,
          parameterSetCount: 2,
          parameterSetPointers: pointers,
          parameterSetSizes: sizes,
          nalUnitHeaderLength: 4,
          formatDescriptionOut: &newDescription
        )
      }
    }
    guard status == noErr, let description = newDescription else {
      DiagnosticsLog.shared.record("mirror: bad H.264 parameter sets (status \(status))")
      return
    }
    if let current = formatDescription, decoder != nil, CMFormatDescriptionEqual(current, otherFormatDescription: description) {
      return
    }
    formatDescription = description
    createDecoder()
  }

  private func createDecoder() {
    if let existing = decoder {
      VTDecompressionSessionInvalidate(existing)
      decoder = nil
    }
    guard let description = formatDescription else { return }
    let attributes: [CFString: Any] = [
      kCVPixelBufferPixelFormatTypeKey: kCVPixelFormatType_32BGRA,
      kCVPixelBufferIOSurfacePropertiesKey: [String: Any](),
    ]
    var session: VTDecompressionSession?
    let status = VTDecompressionSessionCreate(
      allocator: kCFAllocatorDefault,
      formatDescription: description,
      decoderSpecification: nil,
      imageBufferAttributes: attributes as CFDictionary,
      outputCallback: nil,
      decompressionSessionOut: &session
    )
    if status == noErr {
      decoder = session
      let size = CMVideoFormatDescriptionGetDimensions(description)
      DiagnosticsLog.shared.record("mirror: decoder ready \(size.width)x\(size.height)")
    } else {
      DiagnosticsLog.shared.record("mirror: decoder failed to start (status \(status))")
    }
  }

  private func decodeFrame(_ payload: Data) {
    guard payload.count > 1, let description = formatDescription, let session = decoder else { return }
    if let value = CGImagePropertyOrientation(rawValue: UInt32(payload[payload.startIndex])) {
      orientation = value
    }
    let frame = payload.subdata(in: (payload.startIndex + 1)..<payload.endIndex)
    let count = frame.count

    var blockBuffer: CMBlockBuffer?
    var status = CMBlockBufferCreateWithMemoryBlock(
      allocator: kCFAllocatorDefault,
      memoryBlock: nil,
      blockLength: count,
      blockAllocator: kCFAllocatorDefault,
      customBlockSource: nil,
      offsetToData: 0,
      dataLength: count,
      flags: 0,
      blockBufferOut: &blockBuffer
    )
    guard status == kCMBlockBufferNoErr, let block = blockBuffer else { return }
    status = frame.withUnsafeBytes { raw -> OSStatus in
      guard let base = raw.baseAddress else { return -1 }
      return CMBlockBufferReplaceDataBytes(with: base, blockBuffer: block, offsetIntoDestination: 0, dataLength: count)
    }
    guard status == kCMBlockBufferNoErr else { return }

    var sampleBuffer: CMSampleBuffer?
    var sampleSize = count
    status = CMSampleBufferCreateReady(
      allocator: kCFAllocatorDefault,
      dataBuffer: block,
      formatDescription: description,
      sampleCount: 1,
      sampleTimingEntryCount: 0,
      sampleTimingArray: nil,
      sampleSizeEntryCount: 1,
      sampleSizeArray: &sampleSize,
      sampleBufferOut: &sampleBuffer
    )
    guard status == noErr, let sample = sampleBuffer else { return }

    let frameOrientation = orientation
    _ = VTDecompressionSessionDecodeFrame(session, sampleBuffer: sample, flags: [], infoFlagsOut: nil) { [weak self] decodeStatus, _, imageBuffer, _, _ in
      guard decodeStatus == noErr, let pixelBuffer = imageBuffer, let self = self else { return }
      self.render(pixelBuffer, orientation: frameOrientation)
    }
  }

  private func render(_ pixelBuffer: CVPixelBuffer, orientation: CGImagePropertyOrientation) {
    let image = CIImage(cvPixelBuffer: pixelBuffer).oriented(orientation)
    guard let cgImage = ciContext.createCGImage(image, from: image.extent) else { return }
    DispatchQueue.main.async {
      self.framesReceived += 1
      if !self.isActive {
        self.isActive = true
        DiagnosticsLog.shared.record("mirror: first frame shown")
        CarSessionStore.shared.mirrorStateChanged(true)
      }
      self.onFrame?(cgImage)
    }
  }

  private func connectionEnded() {
    resetDecoder()
    DiagnosticsLog.shared.record("mirror: broadcast ended")
    DispatchQueue.main.async {
      if self.isActive {
        self.isActive = false
        CarSessionStore.shared.mirrorStateChanged(false)
      }
    }
  }

  private func resetDecoder() {
    if let existing = decoder {
      VTDecompressionSessionInvalidate(existing)
    }
    decoder = nil
    formatDescription = nil
  }
}
