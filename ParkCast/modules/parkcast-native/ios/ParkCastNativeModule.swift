import ExpoModulesCore
import UIKit
import ReplayKit
import WebKit
import UserNotifications

public class ParkCastNativeModule: Module {
  public func definition() -> ModuleDefinition {
    Name("ParkCastNative")

    Events(
      "onCarPlayStatus",
      "onCarCommand",
      "onPlayerProgress",
      "onParkState",
      "onRouteProgress",
      "onSpeech",
      "onMirrorStatus",
      "onParkedCar"
    )

    OnCreate {
      CarSessionStore.shared.eventSink = { [weak self] name, body in
        self?.sendEvent(name, body)
      }
      DispatchQueue.main.async {
        CarSessionStore.shared.start()
      }
    }

    Function("getStatus") { () -> [String: Any] in
      let store = CarSessionStore.shared
      return [
        "carConnected": store.isCarConnected,
        "mirroring": store.mirror.isActive,
        "mirrorAvailable": MirrorReceiver.port != nil,
        "moving": store.navigation.isMoving,
        "usesMetric": Locale.current.usesMetricSystem,
      ]
    }

    Function("getDiagnostics") { () -> [String: Any] in
      DiagnosticsLog.snapshot()
    }

    Function("getDiagnosticsLog") { () -> String in
      DiagnosticsLog.shared.text()
    }

    Function("clearDiagnosticsLog") {
      DiagnosticsLog.shared.clear()
    }

    Function("logEvent") { (event: String) in
      DiagnosticsLog.shared.record("phone: \(event)")
    }

    Function("sendCarState") { (state: [String: Any]) in
      DispatchQueue.main.async {
        CarSessionStore.shared.apply(state)
      }
    }

    Function("control") { (action: String, value: Double) in
      DispatchQueue.main.async {
        CarSessionStore.shared.carController?.control(action: action, value: value)
      }
    }

    AsyncFunction("searchPlaces") { (query: String, promise: Promise) in
      DispatchQueue.main.async {
        CarSessionStore.shared.navigation.searchPlaces(query) { results in
          promise.resolve(results as Any)
        }
      }
    }

    Function("carWebPointer") { (action: String, x: Double, y: Double) in
      DispatchQueue.main.async {
        CarSessionStore.shared.carController?.webPointer(action: action, x: x, y: y)
      }
    }

    Function("carWebType") { (text: String, submit: Bool) in
      DispatchQueue.main.async {
        CarSessionStore.shared.carController?.webType(text: text, submit: submit)
      }
    }

    Function("carWebNavigate") { (action: String) in
      DispatchQueue.main.async {
        CarSessionStore.shared.carController?.webNavigate(action: action)
      }
    }

    AsyncFunction("suggestPlaces") { (query: String, promise: Promise) in
      DispatchQueue.main.async {
        CarSessionStore.shared.navigation.suggest(query) { results in
          promise.resolve(results as Any)
        }
      }
    }

    AsyncFunction("resolveSuggestion") { (id: String, promise: Promise) in
      DispatchQueue.main.async {
        CarSessionStore.shared.navigation.resolveSuggestion(id) { results, error in
          if let results = results {
            promise.resolve(results as Any)
          } else {
            promise.reject("ERR_SUGGESTION", error ?? "No place found.")
          }
        }
      }
    }

    AsyncFunction("searchNearby") { (category: String, promise: Promise) in
      DispatchQueue.main.async {
        CarSessionStore.shared.navigation.searchNearby(category) { results, error in
          if let results = results {
            promise.resolve(results as Any)
          } else {
            promise.reject("ERR_NEARBY", error ?? "Search failed.")
          }
        }
      }
    }

    Function("getParkedCar") { () -> [String: Any]? in
      CarSessionStore.shared.navigation.parkedCar
    }

    AsyncFunction("saveParkedCarHere") { (promise: Promise) in
      DispatchQueue.main.async {
        promise.resolve(CarSessionStore.shared.navigation.saveParkedCarHere() as Any)
      }
    }

    Function("clearParkedCar") {
      DispatchQueue.main.async {
        CarSessionStore.shared.navigation.clearParkedCar()
      }
    }

    AsyncFunction("scheduleReminder") { (seconds: Double, title: String, body: String, promise: Promise) in
      let center = UNUserNotificationCenter.current()
      center.requestAuthorization(options: [.alert, .sound]) { granted, _ in
        guard granted else {
          promise.resolve(false as Any)
          return
        }
        let content = UNMutableNotificationContent()
        content.title = title
        content.body = body
        content.sound = .default
        let trigger = UNTimeIntervalNotificationTrigger(timeInterval: max(60, seconds), repeats: false)
        center.removePendingNotificationRequests(withIdentifiers: [ReminderIds.meter])
        center.add(UNNotificationRequest(identifier: ReminderIds.meter, content: content, trigger: trigger)) { error in
          promise.resolve((error == nil) as Any)
        }
      }
    }

    Function("cancelReminder") {
      UNUserNotificationCenter.current().removePendingNotificationRequests(withIdentifiers: [ReminderIds.meter])
    }

    AsyncFunction("getRoutes") { (latitude: Double, longitude: Double, name: String, promise: Promise) in
      DispatchQueue.main.async {
        CarSessionStore.shared.navigation.getRoutes(latitude: latitude, longitude: longitude, name: name) { routes, error in
          if let routes = routes {
            promise.resolve(routes as Any)
          } else {
            promise.reject("ERR_NO_ROUTE", error ?? "No driving route found.")
          }
        }
      }
    }

    AsyncFunction("startNavigation") { (index: Int, promise: Promise) in
      DispatchQueue.main.async {
        promise.resolve(CarSessionStore.shared.navigation.startNavigation(index: index) as Any)
      }
    }

    AsyncFunction("stopNavigation") { (promise: Promise) in
      DispatchQueue.main.async {
        CarSessionStore.shared.navigation.stopNavigation(arrived: false)
        promise.resolve()
      }
    }

    AsyncFunction("startListening") { (promise: Promise) in
      DispatchQueue.main.async {
        CarSessionStore.shared.speech.start { error in
          if let error = error {
            promise.reject("ERR_SPEECH", error)
          } else {
            promise.resolve()
          }
        }
      }
    }

    Function("stopListening") {
      DispatchQueue.main.async {
        CarSessionStore.shared.speech.stop(emitFinal: true)
      }
    }

    AsyncFunction("clearWebData") { (promise: Promise) in
      DispatchQueue.main.async {
        let store = WKWebsiteDataStore.default()
        store.removeData(ofTypes: WKWebsiteDataStore.allWebsiteDataTypes(), modifiedSince: Date.distantPast) {
          promise.resolve()
        }
      }
    }

    AsyncFunction("showBroadcastPicker") { (promise: Promise) in
      DispatchQueue.main.async {
        BroadcastPicker.show()
        promise.resolve()
      }
    }
  }
}

enum ReminderIds {
  static let meter = "parkcast.meter"
}

enum BroadcastPicker {
  static func show() {
    let picker = RPSystemBroadcastPickerView(frame: CGRect(x: 0, y: 0, width: 44, height: 44))
    picker.showsMicrophoneButton = false
    if let bundleId = Bundle.main.bundleIdentifier {
      picker.preferredExtension = bundleId + ".broadcast"
    }
    let windows = UIApplication.shared.connectedScenes
      .compactMap { $0 as? UIWindowScene }
      .filter { $0.session.role == .windowApplication }
      .flatMap { $0.windows }
    let window = windows.first { $0.isKeyWindow } ?? windows.first { !$0.isHidden } ?? windows.first
    guard let hostWindow = window else {
      DiagnosticsLog.shared.record("mirror: no key window to show the broadcast picker")
      return
    }
    picker.alpha = 0.01
    hostWindow.addSubview(picker)
    let buttons = picker.subviews.compactMap { $0 as? UIButton }
    DiagnosticsLog.shared.record("mirror: opening broadcast picker for \(picker.preferredExtension ?? "?") (extension \(DiagnosticsLog.broadcastExtensionInstalled ? "installed" : "MISSING"))")
    if buttons.isEmpty {
      DiagnosticsLog.shared.record("mirror: broadcast picker has no button on this iOS version")
    }
    for button in buttons {
      button.sendActions(for: .allTouchEvents)
    }
    DispatchQueue.main.asyncAfter(deadline: .now() + 3) {
      picker.removeFromSuperview()
    }
  }
}
