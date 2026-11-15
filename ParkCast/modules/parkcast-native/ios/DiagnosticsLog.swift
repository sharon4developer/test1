import Foundation
import CoreLocation
import UIKit

/// Rolling, on-device event log the user can share from Settings › Diagnostics.
/// Holds no personal data: no URLs beyond the host, no coordinates, no passwords.
final class DiagnosticsLog {
  static let shared = DiagnosticsLog()

  private let queue = DispatchQueue(label: "app.parkcast.diagnostics")
  private var lines: [String] = []
  private let maxLines = 400
  private let formatter: DateFormatter = {
    let formatter = DateFormatter()
    formatter.dateFormat = "yyyy-MM-dd HH:mm:ss.SSS"
    formatter.locale = Locale(identifier: "en_US_POSIX")
    return formatter
  }()

  private var fileURL: URL? {
    FileManager.default.urls(for: .cachesDirectory, in: .userDomainMask).first?.appendingPathComponent("parkcast-diagnostics.log")
  }

  private init() {
    if let url = fileURL, let saved = try? String(contentsOf: url, encoding: .utf8) {
      lines = Array(saved.split(separator: "\n").map(String.init).suffix(maxLines))
    }
  }

  func record(_ event: String) {
    let line = "\(formatter.string(from: Date()))  \(event)"
    queue.async {
      self.lines.append(line)
      if self.lines.count > self.maxLines {
        self.lines.removeFirst(self.lines.count - self.maxLines)
      }
      if let url = self.fileURL {
        try? self.lines.joined(separator: "\n").write(to: url, atomically: true, encoding: .utf8)
      }
    }
  }

  func text() -> String {
    queue.sync { lines.joined(separator: "\n") }
  }

  func clear() {
    queue.sync {
      lines.removeAll()
      if let url = fileURL { try? FileManager.default.removeItem(at: url) }
    }
  }

  static func host(of uri: String) -> String {
    URL(string: uri)?.host ?? "invalid link"
  }

  // MARK: Snapshot

  static var broadcastExtensionInstalled: Bool {
    guard let plugins = Bundle.main.builtInPlugInsURL,
          let entries = try? FileManager.default.contentsOfDirectory(atPath: plugins.path) else { return false }
    return entries.contains { $0.hasSuffix(".appex") && $0.contains("Broadcast") }
  }

  static var carPlaySceneDeclared: Bool {
    let manifest = Bundle.main.object(forInfoDictionaryKey: "UIApplicationSceneManifest") as? [String: Any]
    let configurations = manifest?["UISceneConfigurations"] as? [String: Any]
    return configurations?["CPTemplateApplicationSceneSessionRoleApplication"] != nil
  }

  static func locationStatus(_ status: CLAuthorizationStatus) -> String {
    switch status {
    case .authorizedAlways: return "always"
    case .authorizedWhenInUse: return "whenInUse"
    case .denied: return "denied"
    case .restricted: return "restricted"
    case .notDetermined: return "notDetermined"
    @unknown default: return "unknown"
    }
  }

  static func snapshot() -> [String: Any] {
    let store = CarSessionStore.shared
    let info = Bundle.main.infoDictionary ?? [:]
    return [
      "appVersion": info["CFBundleShortVersionString"] as? String ?? "",
      "buildNumber": info["CFBundleVersion"] as? String ?? "",
      "bundleId": Bundle.main.bundleIdentifier ?? "",
      "iosVersion": UIDevice.current.systemVersion,
      "carPlaySceneDeclared": carPlaySceneDeclared,
      "carConnected": store.isCarConnected,
      "mirrorPort": MirrorReceiver.port.map { Int($0) } ?? 0,
      "mirrorListening": store.mirror.isListening,
      "mirrorActive": store.mirror.isActive,
      "mirrorFramesReceived": store.mirror.framesReceived,
      "broadcastExtensionInstalled": broadcastExtensionInstalled,
      "location": locationStatus(store.navigation.authorizationStatus),
      "hasLocationFix": store.navigation.lastLocation != nil,
    ]
  }
}
