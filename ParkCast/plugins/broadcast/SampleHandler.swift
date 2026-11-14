import ReplayKit
import VideoToolbox
import CoreMedia
import Network
import QuartzCore

/// ReplayKit broadcast upload extension. Encodes the iPhone screen to H.264 and streams it to the
/// ParkCast app over a loopback-only socket, where the CarPlay screen decodes and shows it.
class SampleHandler: RPBroadcastSampleHandler {
  private let queue = DispatchQueue(label: "app.parkcast.broadcast.sender")
  private var connection: NWConnection?
  private var isReady = false
  private var stopped = false
  private var encoder: VTCompressionSession?
  private var sourceWidth = 0
  private var sourceHeight = 0
  /// 0 = basic (free, 480p 24fps), 1 = standard (30fps), 2 = HD (60fps).
  private var level: UInt8 = 0
  private var needsKeyFrame = true
  private var lastEncodeTime: CFTimeInterval = 0
  private var inFlight = 0
  private var orientation: UInt8 = 1

  private var port: NWEndpoint.Port? {
    let raw = Bundle.main.object(forInfoDictionaryKey: "ParkCastMirrorPort")
    if let number = raw as? NSNumber { return NWEndpoint.Port(rawValue: number.uint16Value) }
    if let text = raw as? String, let value = UInt16(text) { return NWEndpoint.Port(rawValue: value) }
    return nil
  }

  override func broadcastStarted(withSetupInfo setupInfo: [String: NSObject]?) {
    queue.async { self.connect() }
  }

  override func broadcastFinished() {
    queue.sync {
      self.stopped = true
      self.connection?.cancel()
      self.connection = nil
      self.teardownEncoder()
    }
  }

  override func processSampleBuffer(_ sampleBuffer: CMSampleBuffer, with sampleBufferType: RPSampleBufferType) {
    guard sampleBufferType == .video else { return }
    queue.sync { self.encode(sampleBuffer) }
  }

  // MARK: Connection

  private func connect() {
    guard !stopped, let port = port else { return }
    let params = NWParameters.tcp
    params.requiredInterfaceType = .loopback
    let conn = NWConnection(host: "127.0.0.1", port: port, using: params)
    conn.stateUpdateHandler = { [weak self, weak conn] state in
      guard let self = self, let conn = conn else { return }
      switch state {
      case .ready:
        self.isReady = true
        self.needsKeyFrame = true
        self.inFlight = 0
        self.receiveConfig(conn)
      case .waiting, .failed:
        conn.cancel()
      case .cancelled:
        if conn === self.connection {
          self.isReady = false
          self.connection = nil
          if !self.stopped {
            self.queue.asyncAfter(deadline: .now() + 1) { self.connect() }
          }
        }
      default:
        break
      }
    }
    connection = conn
    conn.start(queue: queue)
  }

  private func receiveConfig(_ conn: NWConnection) {
    conn.receive(minimumIncompleteLength: 1, maximumLength: 64) { [weak self, weak conn] data, _, isComplete, error in
      guard let self = self, let conn = conn else { return }
      if let data = data {
        let bytes = [UInt8](data)
        var index = 0
        while index + 1 < bytes.count {
          if bytes[index] == 0x10 {
            let requested = min(bytes[index + 1], 2)
            if requested != self.level {
              self.level = requested
              self.teardownEncoder()
            }
          }
          index += 2
        }
      }
      if isComplete || error != nil {
        conn.cancel()
        return
      }
      self.receiveConfig(conn)
    }
  }

  // MARK: Encoding

  private func encode(_ sampleBuffer: CMSampleBuffer) {
    guard isReady, let pixelBuffer = CMSampleBufferGetImageBuffer(sampleBuffer) else { return }
    let now = CACurrentMediaTime()
    let fps = Double(frameRate)
    guard now - lastEncodeTime >= (1.0 / fps) * 0.9 else { return }
    if inFlight > 4 && !needsKeyFrame { return }
    lastEncodeTime = now

    if let value = CMGetAttachment(sampleBuffer, key: RPVideoSampleOrientationKey as CFString, attachmentModeOut: nil) as? NSNumber {
      orientation = value.uint8Value
    }

    let width = CVPixelBufferGetWidth(pixelBuffer)
    let height = CVPixelBufferGetHeight(pixelBuffer)
    if encoder == nil || width != sourceWidth || height != sourceHeight {
      setupEncoder(width: width, height: height)
    }
    guard let session = encoder else { return }

    var frameProperties: CFDictionary?
    if needsKeyFrame {
      frameProperties = [kVTEncodeFrameOptionKey_ForceKeyFrame as String: true] as CFDictionary
      needsKeyFrame = false
    }
    let timestamp = CMSampleBufferGetPresentationTimeStamp(sampleBuffer)
    _ = VTCompressionSessionEncodeFrame(
      session,
      imageBuffer: pixelBuffer,
      presentationTimeStamp: timestamp,
      duration: .invalid,
      frameProperties: frameProperties,
      infoFlagsOut: nil
    ) { [weak self] status, _, sample in
      guard status == noErr, let sample = sample, let self = self else { return }
      self.queue.async { self.send(sample) }
    }
  }

  private var frameRate: Int { [24, 30, 60][Int(level)] }
  private var bitRate: Int { [1_200_000, 3_000_000, 8_000_000][Int(level)] }

  private func setupEncoder(width: Int, height: Int) {
    teardownEncoder()
    var created: VTCompressionSession?
    // VideoToolbox scales each frame down to the session size.
    let scale = level == 0 ? min(1, 480 / Double(min(width, height))) : 1
    let status = VTCompressionSessionCreate(
      allocator: kCFAllocatorDefault,
      width: Int32(Int(Double(width) * scale) & ~1),
      height: Int32(Int(Double(height) * scale) & ~1),
      codecType: kCMVideoCodecType_H264,
      encoderSpecification: nil,
      imageBufferAttributes: nil,
      compressedDataAllocator: nil,
      outputCallback: nil,
      refcon: nil,
      compressionSessionOut: &created
    )
    guard status == noErr, let session = created else { return }
    VTSessionSetProperty(session, key: kVTCompressionPropertyKey_RealTime, value: kCFBooleanTrue)
    VTSessionSetProperty(session, key: kVTCompressionPropertyKey_ProfileLevel, value: kVTProfileLevel_H264_High_AutoLevel)
    VTSessionSetProperty(session, key: kVTCompressionPropertyKey_AllowFrameReordering, value: kCFBooleanFalse)
    VTSessionSetProperty(session, key: kVTCompressionPropertyKey_MaxKeyFrameInterval, value: NSNumber(value: frameRate * 2))
    VTSessionSetProperty(session, key: kVTCompressionPropertyKey_ExpectedFrameRate, value: NSNumber(value: frameRate))
    VTSessionSetProperty(session, key: kVTCompressionPropertyKey_AverageBitRate, value: NSNumber(value: bitRate))
    VTCompressionSessionPrepareToEncodeFrames(session)
    encoder = session
    sourceWidth = width
    sourceHeight = height
    needsKeyFrame = true
  }

  private func teardownEncoder() {
    if let session = encoder {
      VTCompressionSessionInvalidate(session)
    }
    encoder = nil
    sourceWidth = 0
    sourceHeight = 0
  }

  // MARK: Sending

  private static func packet(type: UInt8, payload: Data) -> Data {
    var data = Data(capacity: payload.count + 5)
    let length = UInt32(payload.count)
    data.append(type)
    data.append(UInt8((length >> 24) & 0xff))
    data.append(UInt8((length >> 16) & 0xff))
    data.append(UInt8((length >> 8) & 0xff))
    data.append(UInt8(length & 0xff))
    data.append(payload)
    return data
  }

  private func send(_ sample: CMSampleBuffer) {
    guard isReady, let conn = connection else { return }
    var output = Data()

    let attachments = CMSampleBufferGetSampleAttachmentsArray(sample, createIfNecessary: false) as? [[String: Any]]
    let notSync = attachments?.first?[kCMSampleAttachmentKey_NotSync as String] as? Bool ?? false
    if !notSync, let description = CMSampleBufferGetFormatDescription(sample) {
      var spsPointer: UnsafePointer<UInt8>?
      var spsLength = 0
      var ppsPointer: UnsafePointer<UInt8>?
      var ppsLength = 0
      let spsStatus = CMVideoFormatDescriptionGetH264ParameterSetAtIndex(
        description, parameterSetIndex: 0, parameterSetPointerOut: &spsPointer,
        parameterSetSizeOut: &spsLength, parameterSetCountOut: nil, nalUnitHeaderLengthOut: nil
      )
      let ppsStatus = CMVideoFormatDescriptionGetH264ParameterSetAtIndex(
        description, parameterSetIndex: 1, parameterSetPointerOut: &ppsPointer,
        parameterSetSizeOut: &ppsLength, parameterSetCountOut: nil, nalUnitHeaderLengthOut: nil
      )
      if spsStatus == noErr, ppsStatus == noErr, let sps = spsPointer, let pps = ppsPointer {
        var payload = Data()
        payload.append(UInt8((spsLength >> 8) & 0xff))
        payload.append(UInt8(spsLength & 0xff))
        payload.append(sps, count: spsLength)
        payload.append(UInt8((ppsLength >> 8) & 0xff))
        payload.append(UInt8(ppsLength & 0xff))
        payload.append(pps, count: ppsLength)
        output.append(SampleHandler.packet(type: 1, payload: payload))
      }
    }

    guard let block = CMSampleBufferGetDataBuffer(sample) else { return }
    let total = CMBlockBufferGetDataLength(block)
    guard total > 0 else { return }
    var frame = Data(count: total)
    let copyStatus = frame.withUnsafeMutableBytes { raw -> OSStatus in
      guard let base = raw.baseAddress else { return -1 }
      return CMBlockBufferCopyDataBytes(block, atOffset: 0, dataLength: total, destination: base)
    }
    guard copyStatus == kCMBlockBufferNoErr else { return }
    var payload = Data([orientation])
    payload.append(frame)
    output.append(SampleHandler.packet(type: 2, payload: payload))

    inFlight += 1
    conn.send(content: output, completion: .contentProcessed { [weak self] _ in
      self?.inFlight -= 1
    })
  }
}
