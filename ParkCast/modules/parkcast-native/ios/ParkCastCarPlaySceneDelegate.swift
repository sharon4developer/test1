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

    var sections = [CPListSection(items: screenItems, header: "Screen", sectionIndexTitle: nil)]
    if !placeItems.isEmpty {
      sections.insert(CPListSection(items: placeItems, header: "Recent places", sectionIndexTitle: nil), at: 0)
    }
    interfaceController.pushTemplate(CPListTemplate(title: "More", sections: sections), animated: true, completion: nil)
  }
}
