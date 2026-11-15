import Foundation
import Speech
import AVFoundation

/// On-device speech recognition for "Hey, take me to…" style one-sentence commands.
final class SpeechEngine {
  private let recognizer = SFSpeechRecognizer(locale: Locale.current) ?? SFSpeechRecognizer(locale: Locale(identifier: "en-US"))
  private let audioEngine = AVAudioEngine()
  private var request: SFSpeechAudioBufferRecognitionRequest?
  private var task: SFSpeechRecognitionTask?
  private var silenceTimer: Timer?
  private var lastTranscript = ""

  func start(completion: @escaping (String?) -> Void) {
    SFSpeechRecognizer.requestAuthorization { status in
      DispatchQueue.main.async {
        guard status == .authorized else {
          completion("Speech recognition is turned off. Enable it in iPhone Settings › ParkCast.")
          return
        }
        AVAudioSession.sharedInstance().requestRecordPermission { granted in
          DispatchQueue.main.async {
            guard granted else {
              completion("Microphone access is turned off. Enable it in iPhone Settings › ParkCast.")
              return
            }
            do {
              try self.begin()
              completion(nil)
            } catch {
              completion(error.localizedDescription)
            }
          }
        }
      }
    }
  }

  private func begin() throws {
    stop(emitFinal: false)
    guard let recognizer = recognizer, recognizer.isAvailable else {
      throw NSError(domain: "ParkCast", code: 1, userInfo: [NSLocalizedDescriptionKey: "Speech recognition isn't available right now."])
    }
    let session = AVAudioSession.sharedInstance()
    try session.setCategory(.playAndRecord, mode: .measurement, options: [.duckOthers, .defaultToSpeaker, .allowBluetooth])
    try session.setActive(true, options: .notifyOthersOnDeactivation)

    let newRequest = SFSpeechAudioBufferRecognitionRequest()
    newRequest.shouldReportPartialResults = true
    if recognizer.supportsOnDeviceRecognition {
      newRequest.requiresOnDeviceRecognition = true
    }
    request = newRequest
    lastTranscript = ""

    let input = audioEngine.inputNode
    let format = input.outputFormat(forBus: 0)
    input.removeTap(onBus: 0)
    input.installTap(onBus: 0, bufferSize: 1024, format: format) { [weak self] buffer, _ in
      self?.request?.append(buffer)
    }
    audioEngine.prepare()
    try audioEngine.start()

    task = recognizer.recognitionTask(with: newRequest) { [weak self] result, error in
      DispatchQueue.main.async {
        guard let self = self, self.request === newRequest else { return }
        if let result = result {
          self.lastTranscript = result.bestTranscription.formattedString
          CarSessionStore.shared.emit("onSpeech", ["transcript": self.lastTranscript, "final": result.isFinal])
          if result.isFinal {
            self.stop(emitFinal: false)
          } else {
            self.armSilenceTimer(seconds: 1.6)
          }
        } else if error != nil {
          self.stop(emitFinal: true)
        }
      }
    }
    armSilenceTimer(seconds: 6)
  }

  private func armSilenceTimer(seconds: TimeInterval) {
    silenceTimer?.invalidate()
    silenceTimer = Timer.scheduledTimer(withTimeInterval: seconds, repeats: false) { [weak self] _ in
      self?.stop(emitFinal: true)
    }
  }

  func stop(emitFinal: Bool) {
    silenceTimer?.invalidate()
    silenceTimer = nil
    guard request != nil || task != nil else { return }
    let currentRequest = request
    let currentTask = task
    request = nil
    task = nil
    if audioEngine.isRunning {
      audioEngine.stop()
    }
    audioEngine.inputNode.removeTap(onBus: 0)
    currentRequest?.endAudio()
    currentTask?.cancel()
    try? AVAudioSession.sharedInstance().setCategory(.playback, mode: .moviePlayback, options: [])
    if emitFinal {
      CarSessionStore.shared.emit("onSpeech", ["transcript": lastTranscript, "final": true])
    }
  }
}
