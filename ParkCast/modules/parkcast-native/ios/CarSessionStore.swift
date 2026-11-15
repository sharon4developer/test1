import Foundation
import UIKit

/// Single in-process hub shared by the phone UI (through the Expo module) and the CarPlay scene.
/// Both run inside the same app process, so state moves between them in memory with no network hop.
final class CarSessionStore {
  static let shared = CarSessionStore()

  var eventSink: ((String, [String: Any?]) -> Void)?
  weak var carController: ParkCastCarViewController?

  let navigation = NavigationEngine()
  let mirror = MirrorReceiver()
  let speech = SpeechEngine()

  private(set) var state: [String: Any] = [:]
  private(set) var isCarConnected = false
  private var started = false

  private init() {}

  var settings: [String: Any] { state["settings"] as? [String: Any] ?? [:] }

  var usesMetric: Bool {
    if let units = settings["units"] as? String { return units != "mph" }
    return Locale.current.usesMetricSystem
  }

  func start() {
    guard !started else { return }
    started = true
    let info = Bundle.main.infoDictionary ?? [:]
    DiagnosticsLog.shared.record(
      "app: ParkCast \(info["CFBundleShortVersionString"] as? String ?? "?") (\(info["CFBundleVersion"] as? String ?? "?")), iOS \(UIDevice.current.systemVersion), CarPlay scene \(DiagnosticsLog.carPlaySceneDeclared ? "declared" : "MISSING"), broadcast extension \(DiagnosticsLog.broadcastExtensionInstalled ? "installed" : "MISSING")"
    )
    navigation.start()
    mirror.start()
  }

  func apply(_ newState: [String: Any]) {
    state = newState
    let level: UInt8
    switch settings["mirrorQuality"] as? String {
    case "hd": level = 2
    case "standard": level = 1
    default: level = 0
    }
    mirror.setQuality(level)
    carController?.apply(state: newState)
  }

  func setCarConnected(_ connected: Bool) {
    isCarConnected = connected
    DiagnosticsLog.shared.record(connected ? "carplay: connected" : "carplay: disconnected")
    emit("onCarPlayStatus", ["connected": connected])
  }

  func mirrorStateChanged(_ active: Bool) {
    emit("onMirrorStatus", ["active": active])
    carController?.mirrorStateChanged(active: active)
  }

  func emit(_ name: String, _ body: [String: Any?]) {
    if Thread.isMainThread {
      eventSink?(name, body)
    } else {
      DispatchQueue.main.async { self.eventSink?(name, body) }
    }
  }
}
