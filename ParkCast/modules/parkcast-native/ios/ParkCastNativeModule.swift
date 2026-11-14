import ExpoModulesCore
import UIKit
import ReplayKit
import WebKit

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
      "onMirrorStatus"
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

enum BroadcastPicker {
  static func show() {
    let picker = RPSystemBroadcastPickerView(frame: CGRect(x: 0, y: 0, width: 44, height: 44))
    picker.showsMicrophoneButton = false
    if let bundleId = Bundle.main.bundleIdentifier {
      picker.preferredExtension = bundleId + ".broadcast"
    }
    let window = UIApplication.shared.connectedScenes
      .compactMap { $0 as? UIWindowScene }
      .flatMap { $0.windows }
      .first { $0.isKeyWindow }
    picker.alpha = 0.01
    window?.addSubview(picker)
    for case let button as UIButton in picker.subviews {
      button.sendActions(for: .allTouchEvents)
    }
    DispatchQueue.main.asyncAfter(deadline: .now() + 3) {
      picker.removeFromSuperview()
    }
  }
}
