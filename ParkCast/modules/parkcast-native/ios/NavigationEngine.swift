import Foundation
import CoreLocation
import MapKit
import CarPlay
import UIKit

/// Real GPS, Apple Maps search and routing, turn-by-turn progress, and the Smart Park Lock signal.
final class NavigationEngine: NSObject, CLLocationManagerDelegate {
  private let manager = CLLocationManager()
  private var started = false
  private var parkTimer: Timer?

  private(set) var lastLocation: CLLocation?
  private(set) var isMoving = false
  private var movingSince: Date?
  private var stillSince: Date?

  private var routes: [MKRoute] = []
  private var destination: MKMapItem?
  private(set) var activeRoute: MKRoute?
  private var stepIndex = 0
  private var stepEnds: [CLLocation] = []

  private weak var mapTemplate: CPMapTemplate?
  private var navSession: CPNavigationSession?
  private var trip: CPTrip?

  var onUpdate: (() -> Void)?
  var onRouteChanged: ((MKRoute?) -> Void)?

  var speedMetersPerSecond: Double { max(0, lastLocation?.speed ?? 0) }

  func start() {
    guard !started else { return }
    started = true
    manager.delegate = self
    manager.desiredAccuracy = kCLLocationAccuracyBestForNavigation
    manager.distanceFilter = kCLDistanceFilterNone
    manager.activityType = .automotiveNavigation
    manager.pausesLocationUpdatesAutomatically = false
    startUpdatesIfAuthorized()
    parkTimer = Timer.scheduledTimer(withTimeInterval: 1, repeats: true) { [weak self] _ in
      self?.evaluateParkState()
    }
  }

  private var isAuthorized: Bool {
    let status = manager.authorizationStatus
    return status == .authorizedWhenInUse || status == .authorizedAlways
  }

  private func startUpdatesIfAuthorized() {
    guard isAuthorized else { return }
    manager.startUpdatingLocation()
  }

  func locationManagerDidChangeAuthorization(_ manager: CLLocationManager) {
    startUpdatesIfAuthorized()
  }

  func locationManager(_ manager: CLLocationManager, didUpdateLocations locations: [CLLocation]) {
    guard let location = locations.last else { return }
    lastLocation = location
    evaluateParkState()
    updateGuidance(location)
    onUpdate?()
  }

  func locationManager(_ manager: CLLocationManager, didFailWithError error: Error) {}

  // MARK: Smart Park Lock

  private func evaluateParkState() {
    let now = Date()
    let fresh = (lastLocation.map { now.timeIntervalSince($0.timestamp) } ?? 999) < 4
    let speed = fresh ? speedMetersPerSecond : 0
    if speed > 2.5 {
      stillSince = nil
      if movingSince == nil { movingSince = now }
      if !isMoving, let since = movingSince, now.timeIntervalSince(since) >= 2 {
        setMoving(true)
      }
    } else if speed < 0.8 {
      movingSince = nil
      if stillSince == nil { stillSince = now }
      if isMoving, let since = stillSince, now.timeIntervalSince(since) >= 5 {
        setMoving(false)
      }
    }
  }

  private func setMoving(_ moving: Bool) {
    isMoving = moving
    CarSessionStore.shared.emit("onParkState", ["moving": moving, "speedKmh": speedMetersPerSecond * 3.6])
    CarSessionStore.shared.carController?.parkStateChanged()
  }

  // MARK: Search and routing

  func searchPlaces(_ query: String, completion: @escaping ([[String: Any]]) -> Void) {
    let request = MKLocalSearch.Request()
    request.naturalLanguageQuery = query
    if let location = lastLocation {
      request.region = MKCoordinateRegion(center: location.coordinate, latitudinalMeters: 60_000, longitudinalMeters: 60_000)
    }
    MKLocalSearch(request: request).start { [weak self] response, _ in
      let items = response?.mapItems ?? []
      var results: [[String: Any]] = []
      for (index, item) in items.prefix(12).enumerated() {
        let coordinate = item.placemark.coordinate
        var entry: [String: Any] = [
          "id": "\(index)-\(coordinate.latitude),\(coordinate.longitude)",
          "name": item.name ?? "",
          "address": NavigationEngine.address(item.placemark),
          "latitude": coordinate.latitude,
          "longitude": coordinate.longitude,
        ]
        if let here = self?.lastLocation, let there = item.placemark.location {
          entry["distance"] = here.distance(from: there)
        }
        results.append(entry)
      }
      DispatchQueue.main.async { completion(results) }
    }
  }

  static func address(_ placemark: MKPlacemark) -> String {
    let street = [placemark.subThoroughfare, placemark.thoroughfare].compactMap { $0 }.joined(separator: " ")
    return [street, placemark.locality ?? ""].filter { !$0.isEmpty }.joined(separator: ", ")
  }

  func getRoutes(latitude: Double, longitude: Double, name: String, completion: @escaping ([[String: Any]]?, String?) -> Void) {
    let placemark = MKPlacemark(coordinate: CLLocationCoordinate2D(latitude: latitude, longitude: longitude))
    let target = MKMapItem(placemark: placemark)
    target.name = name
    let request = MKDirections.Request()
    request.source = MKMapItem.forCurrentLocation()
    request.destination = target
    request.transportType = .automobile
    request.requestsAlternateRoutes = true
    MKDirections(request: request).calculate { [weak self] response, error in
      DispatchQueue.main.async {
        guard let self = self, let response = response, !response.routes.isEmpty else {
          completion(nil, error?.localizedDescription ?? "No driving route found.")
          return
        }
        self.routes = Array(response.routes.prefix(3))
        self.destination = target
        var payload: [[String: Any]] = []
        for (index, route) in self.routes.enumerated() {
          let steps: [[String: Any]] = route.steps
            .filter { !$0.instructions.isEmpty }
            .map { ["instructions": $0.instructions, "distance": $0.distance] }
          payload.append([
            "index": index,
            "name": route.name,
            "distance": route.distance,
            "expectedTravelTime": route.expectedTravelTime,
            "advisories": route.advisoryNotices,
            "steps": steps,
          ])
        }
        completion(payload, nil)
      }
    }
  }

  func routeAndStart(latitude: Double, longitude: Double, name: String) {
    getRoutes(latitude: latitude, longitude: longitude, name: name) { [weak self] routes, _ in
      guard routes != nil else { return }
      _ = self?.startNavigation(index: 0)
    }
  }

  // MARK: Guidance

  func startNavigation(index: Int) -> Bool {
    guard index >= 0, index < routes.count else { return false }
    let route = routes[index]
    activeRoute = route
    stepIndex = 0
    stepEnds = route.steps.map { step in
      let count = step.polyline.pointCount
      let coordinate = count > 0 ? step.polyline.points()[count - 1].coordinate : step.polyline.coordinate
      return CLLocation(latitude: coordinate.latitude, longitude: coordinate.longitude)
    }
    if isAuthorized {
      manager.allowsBackgroundLocationUpdates = true
    }
    startCarSession()
    onRouteChanged?(route)
    if let location = lastLocation {
      updateGuidance(location)
    }
    return true
  }

  func stopNavigation(arrived: Bool) {
    if let session = navSession {
      if arrived { session.finishTrip() } else { session.cancelTrip() }
    }
    navSession = nil
    trip = nil
    activeRoute = nil
    stepEnds = []
    manager.allowsBackgroundLocationUpdates = false
    onRouteChanged?(nil)
    CarSessionStore.shared.emit("onRouteProgress", ["active": false, "arrived": arrived])
  }

  private var upcomingInstruction: String {
    guard let route = activeRoute else { return "" }
    if stepIndex + 1 < route.steps.count {
      let text = route.steps[stepIndex + 1].instructions
      if !text.isEmpty { return text }
    }
    return "Arrive at \(destination?.name ?? "your destination")"
  }

  private func updateGuidance(_ location: CLLocation) {
    guard let route = activeRoute, stepIndex < stepEnds.count else { return }
    var toManeuver = location.distance(from: stepEnds[stepIndex])
    if toManeuver < 25 && stepIndex < stepEnds.count - 1 {
      stepIndex += 1
      toManeuver = location.distance(from: stepEnds[stepIndex])
      pushManeuver()
    }
    let after = route.steps.suffix(from: stepIndex + 1).reduce(0.0) { $0 + $1.distance }
    let remaining = toManeuver + after
    let timeRemaining = route.distance > 0 ? route.expectedTravelTime * remaining / route.distance : 0
    let arrived = stepIndex >= stepEnds.count - 1 && toManeuver < 40

    CarSessionStore.shared.emit("onRouteProgress", [
      "active": true,
      "instruction": upcomingInstruction,
      "distanceToManeuver": toManeuver,
      "remainingDistance": remaining,
      "remainingTime": timeRemaining,
      "arrived": arrived,
      "destination": destination?.name ?? "",
    ])
    updateCarEstimates(toManeuver: toManeuver, remaining: remaining, timeRemaining: timeRemaining)
    if arrived {
      stopNavigation(arrived: true)
    }
  }

  // MARK: CarPlay navigation session

  func attach(mapTemplate: CPMapTemplate) {
    self.mapTemplate = mapTemplate
    if activeRoute != nil {
      startCarSession()
    }
  }

  func detachMapTemplate() {
    navSession = nil
    trip = nil
    mapTemplate = nil
  }

  private func startCarSession() {
    guard let template = mapTemplate, let target = destination, let route = activeRoute else { return }
    navSession?.cancelTrip()
    let choice = CPRouteChoice(
      summaryVariants: [route.name.isEmpty ? "Fastest route" : route.name],
      additionalInformationVariants: [NavigationEngine.formatDuration(route.expectedTravelTime)],
      selectionSummaryVariants: [route.name]
    )
    let newTrip = CPTrip(origin: MKMapItem.forCurrentLocation(), destination: target, routeChoices: [choice])
    trip = newTrip
    navSession = template.startNavigationSession(for: newTrip)
    pushManeuver()
  }

  private func pushManeuver() {
    guard let session = navSession, stepIndex < stepEnds.count else { return }
    let maneuver = CPManeuver()
    let text = upcomingInstruction
    maneuver.instructionVariants = [text]
    maneuver.symbolImage = UIImage(systemName: NavigationEngine.symbolName(for: text))
    let distance = lastLocation.map { $0.distance(from: stepEnds[stepIndex]) } ?? 0
    maneuver.initialTravelEstimates = CPTravelEstimates(distanceRemaining: NavigationEngine.measurement(distance), timeRemaining: 0)
    session.upcomingManeuvers = [maneuver]
  }

  private func updateCarEstimates(toManeuver: Double, remaining: Double, timeRemaining: Double) {
    guard let session = navSession, let trip = trip, let template = mapTemplate else { return }
    if let maneuver = session.upcomingManeuvers.first {
      session.updateEstimates(CPTravelEstimates(distanceRemaining: NavigationEngine.measurement(toManeuver), timeRemaining: 0), for: maneuver)
    }
    template.update(
      CPTravelEstimates(distanceRemaining: NavigationEngine.measurement(remaining), timeRemaining: timeRemaining),
      for: trip,
      with: .default
    )
  }

  // MARK: Formatting

  static func symbolName(for instruction: String) -> String {
    let text = instruction.lowercased()
    if text.contains("arrive") || text.contains("destination") { return "mappin.circle.fill" }
    if text.contains("u-turn") { return "arrow.uturn.left" }
    if text.contains("roundabout") { return "arrow.triangle.turn.up.right.circle" }
    if text.contains("left") { return text.contains("keep") || text.contains("slight") ? "arrow.up.left" : "arrow.turn.up.left" }
    if text.contains("right") { return text.contains("keep") || text.contains("slight") ? "arrow.up.right" : "arrow.turn.up.right" }
    return "arrow.up"
  }

  static func measurement(_ meters: Double) -> Measurement<UnitLength> {
    if CarSessionStore.shared.usesMetric {
      if meters >= 1000 { return Measurement(value: (meters / 100).rounded() / 10, unit: .kilometers) }
      return Measurement(value: (meters / 10).rounded() * 10, unit: .meters)
    }
    let miles = meters / 1609.344
    if miles >= 0.1 { return Measurement(value: (miles * 10).rounded() / 10, unit: .miles) }
    return Measurement(value: (meters * 3.28084 / 50).rounded() * 50, unit: .feet)
  }

  static func formatDuration(_ seconds: Double) -> String {
    let minutes = Int((seconds / 60).rounded())
    if minutes < 60 { return "\(max(1, minutes)) min" }
    return "\(minutes / 60) h \(minutes % 60) min"
  }
}
