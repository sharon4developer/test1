import UIKit
import CarPlay

@objc(ParkCastCarPlaySceneDelegate)
class ParkCastCarPlaySceneDelegate: UIResponder, CPTemplateApplicationSceneDelegate {
  private var interfaceController: CPInterfaceController?
  private var carWindow: CPWindow?
  private var carController: ParkCastCarViewController?
  private var mapTemplate: CPMapTemplate?

  func templateApplicationScene(
    _ templateApplicationScene: CPTemplateApplicationScene,
    didConnect interfaceController: CPInterfaceController,
    to window: CPWindow
  ) {
    connect(interfaceController: interfaceController, window: window)
  }

  func templateApplicationScene(
    _ templateApplicationScene: CPTemplateApplicationScene,
    didDisconnect interfaceController: CPInterfaceController,
    from window: CPWindow
  ) {
    disconnect()
  }

  func scene(_ scene: UIScene, willConnectTo session: UISceneSession, options connectionOptions: UIScene.ConnectionOptions) {
    if let carScene = scene as? CPTemplateApplicationScene {
      connect(interfaceController: carScene.interfaceController, window: carScene.carWindow)
    }
  }

  func sceneDidDisconnect(_ scene: UIScene) {
    if carController != nil {
      disconnect()
    }
  }

  private func connect(interfaceController: CPInterfaceController, window: CPWindow) {
    if carController != nil, carWindow === window { return }
    self.interfaceController = interfaceController
    self.carWindow = window

    let store = CarSessionStore.shared
    store.start()

    let controller = ParkCastCarViewController()
    carController = controller
    store.carController = controller
    window.rootViewController = controller

    let map = CPMapTemplate()
    map.automaticallyHidesNavigationBar = false
    map.leadingNavigationBarButtons = [
      CPBarButton(title: "Map") { [weak controller] _ in controller?.showModeFromCar("map") },
      CPBarButton(title: "Watch") { [weak self] _ in self?.presentWatchList() },
    ]
    map.trailingNavigationBarButtons = [
      CPBarButton(title: "Mirror") { [weak controller] _ in controller?.showModeFromCar("mirror") },
      CPBarButton(title: "More") { [weak self] _ in self?.presentMoreList() },
    ]
    controller.onStageModeChanged = { [weak map] onStage in
      map?.automaticallyHidesNavigationBar = onStage
    }
    mapTemplate = map
    interfaceController.setRootTemplate(map, animated: false, completion: nil)
    store.navigation.attach(mapTemplate: map)
    store.setCarConnected(true)
  }

  private func disconnect() {
    let store = CarSessionStore.shared
    store.navigation.recordParking()
    store.navigation.detachMapTemplate()
    carController?.teardown()
    store.carController = nil
    carController = nil
    carWindow = nil
    interfaceController = nil
    mapTemplate = nil
    store.setCarConnected(false)
  }

  private func presentWatchList() {
    guard let interfaceController = interfaceController, let controller = carController else { return }
    let store = CarSessionStore.shared
    let library = store.state["library"] as? [[String: Any]] ?? []

    var mediaItems: [CPListItem] = []
    for entry in library.prefix(CPListTemplate.maximumItemCount > 0 ? min(CPListTemplate.maximumItemCount, 20) : 12) {
      let item = CPListItem(text: entry["title"] as? String ?? "Untitled", detailText: entry["subtitle"] as? String)
      item.handler = { [weak controller, weak interfaceController] _, completion in
        controller?.playLibraryEntry(entry)
        store.emit("onCarCommand", ["type": "playLibraryItem", "id": entry["id"] as? String ?? ""])
        interfaceController?.popToRootTemplate(animated: true, completion: nil)
        completion()
      }
      mediaItems.append(item)
    }
    if mediaItems.isEmpty {
      let hint = CPListItem(text: "Nothing here yet", detailText: "Pick photos or videos in ParkCast on your iPhone")
      hint.handler = { _, completion in completion() }
      mediaItems.append(hint)
    }

    let playPause = CPListItem(text: "Play / Pause", detailText: nil)
    playPause.handler = { [weak controller, weak interfaceController] _, completion in
      controller?.togglePlayFromCar()
      interfaceController?.popToRootTemplate(animated: true, completion: nil)
      completion()
    }
    let fit = CPListItem(text: "Fit / Fill screen", detailText: nil)
    fit.handler = { [weak controller, weak interfaceController] _, completion in
      controller?.toggleFillFromCar()
      interfaceController?.popToRootTemplate(animated: true, completion: nil)
      completion()
    }

    let template = CPListTemplate(title: "Watch", sections: [
      CPListSection(items: mediaItems, header: "Recent on your iPhone", sectionIndexTitle: nil),
      CPListSection(items: [playPause, fit], header: "Controls", sectionIndexTitle: nil),
    ])
    interfaceController.pushTemplate(template, animated: true, completion: nil)
  }

  private func presentMoreList() {
    guard let interfaceController = interfaceController, let controller = carController else { return }
    let store = CarSessionStore.shared
    let places = store.state["places"] as? [[String: Any]] ?? []

    var placeItems: [CPListItem] = []
    for place in places.prefix(8) {
      let name = place["name"] as? String ?? "Place"
      let item = CPListItem(text: name, detailText: place["address"] as? String)
      item.handler = { [weak interfaceController] _, completion in
        if let latitude = place["latitude"] as? Double, let longitude = place["longitude"] as? Double {
          store.navigation.routeAndStart(latitude: latitude, longitude: longitude, name: name)
          store.emit("onCarCommand", ["type": "navigatePlace", "name": name])
        }
        interfaceController?.popToRootTemplate(animated: true, completion: nil)
        completion()
      }
      placeItems.append(item)
    }

    let home = CPListItem(text: "Cinema home", detailText: "Clock, weather and speed")
    home.handler = { [weak controller, weak interfaceController] _, completion in
      controller?.showModeFromCar("home")
      interfaceController?.popToRootTemplate(animated: true, completion: nil)
      completion()
    }
    var screenItems = [home]
    if store.navigation.activeRoute != nil {
      let stop = CPListItem(text: "End route", detailText: nil)
      stop.handler = { [weak interfaceController] _, completion in
        store.navigation.stopNavigation(arrived: false)
        interfaceController?.popToRootTemplate(animated: true, completion: nil)
        completion()
      }
      screenItems.append(stop)
    }

    let nearbyItems: [CPListItem] = NavigationEngine.nearbyCategories.map { category in
      let item = CPListItem(text: category.title, detailText: nil, image: UIImage(systemName: Self.nearbySymbol(category.id)))
      item.accessoryType = .disclosureIndicator
      item.handler = { [weak self] _, completion in
        self?.presentNearby(category, completion: completion)
      }
      return item
    }

    var sections = [
      CPListSection(items: nearbyItems, header: "Find nearby", sectionIndexTitle: nil),
      CPListSection(items: screenItems, header: "Screen", sectionIndexTitle: nil),
    ]
    if !placeItems.isEmpty {
      sections.insert(CPListSection(items: placeItems, header: "Recent places", sectionIndexTitle: nil), at: 1)
    }
    interfaceController.pushTemplate(CPListTemplate(title: "More", sections: sections), animated: true, completion: nil)
  }

  private static func nearbySymbol(_ id: String) -> String {
    switch id {
    case "gas": return "fuelpump.fill"
    case "ev": return "bolt.car.fill"
    case "parking": return "parkingsign.circle.fill"
    case "coffee": return "cup.and.saucer.fill"
    case "food": return "fork.knife"
    case "restroom": return "figure.dress.line.vertical.figure"
    case "grocery": return "cart.fill"
    case "pharmacy": return "cross.case.fill"
    default: return "mappin.circle.fill"
    }
  }

  private func presentNearby(_ category: NavigationEngine.NearbyCategory, completion: @escaping () -> Void) {
    let store = CarSessionStore.shared
    store.navigation.searchNearby(category.id) { [weak self] results, error in
      completion()
      guard let self = self, let interfaceController = self.interfaceController else { return }
      var items: [CPListItem] = (results ?? []).map { place in
        let name = place["name"] as? String ?? category.title
        let distance = (place["distance"] as? Double).map {
          MeasurementFormatter.parkCast.string(from: NavigationEngine.measurement($0))
        }
        let detail = [distance, place["address"] as? String].compactMap { $0 }.filter { !$0.isEmpty }.joined(separator: " · ")
        let item = CPListItem(text: name, detailText: detail)
        item.handler = { [weak interfaceController] _, done in
          if let latitude = place["latitude"] as? Double, let longitude = place["longitude"] as? Double {
            store.navigation.routeAndStart(latitude: latitude, longitude: longitude, name: name)
            store.emit("onCarCommand", ["type": "navigatePlace", "name": name])
          }
          interfaceController?.popToRootTemplate(animated: true, completion: nil)
          done()
        }
        return item
      }
      if items.isEmpty {
        let empty = CPListItem(text: error ?? "Nothing found nearby", detailText: error == nil ? "Try another category" : nil)
        empty.handler = { _, done in done() }
        items = [empty]
      }
      let template = CPListTemplate(title: category.title, sections: [CPListSection(items: items)])
      interfaceController.pushTemplate(template, animated: true, completion: nil)
    }
  }
}

extension MeasurementFormatter {
  static let parkCast: MeasurementFormatter = {
    let formatter = MeasurementFormatter()
    formatter.unitOptions = .providedUnit
    formatter.numberFormatter.maximumFractionDigits = 1
    formatter.unitStyle = .short
    return formatter
  }()
}
