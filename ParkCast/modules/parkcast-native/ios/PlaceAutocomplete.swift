import Foundation
import MapKit

/// Apple Maps style suggestions while typing, backed by MKLocalSearchCompleter.
/// Only the newest request gets results; an older pending request resolves with an empty list.
final class PlaceAutocomplete: NSObject, MKLocalSearchCompleterDelegate {
  private let completer = MKLocalSearchCompleter()
  private var pending: (([[String: Any]]) -> Void)?
  private var timeout: DispatchWorkItem?
  private var completions: [String: MKLocalSearchCompletion] = [:]
  private var generation = 0

  override init() {
    super.init()
    completer.delegate = self
    completer.resultTypes = [.address, .pointOfInterest, .query]
  }

  func suggest(_ query: String, near location: CLLocation?, completion: @escaping ([[String: Any]]) -> Void) {
    finish(with: [])
    let trimmed = query.trimmingCharacters(in: .whitespacesAndNewlines)
    guard !trimmed.isEmpty else {
      completion([])
      return
    }
    if let location = location {
      completer.region = MKCoordinateRegion(center: location.coordinate, latitudinalMeters: 50_000, longitudinalMeters: 50_000)
    }
    pending = completion
    let work = DispatchWorkItem { [weak self] in self?.finish(with: []) }
    timeout = work
    DispatchQueue.main.asyncAfter(deadline: .now() + 4, execute: work)
    if completer.queryFragment == trimmed {
      completerDidUpdateResults(completer)
    } else {
      completer.queryFragment = trimmed
    }
  }

  /// Turns a suggestion into concrete places (one for an address, several for a query like "coffee").
  func resolve(_ id: String, near location: CLLocation?, completion: @escaping ([MKMapItem], String?) -> Void) {
    guard let suggestion = completions[id] else {
      completion([], "This suggestion has expired. Search again.")
      return
    }
    let request = MKLocalSearch.Request(completion: suggestion)
    if let location = location {
      request.region = MKCoordinateRegion(center: location.coordinate, latitudinalMeters: 60_000, longitudinalMeters: 60_000)
    }
    MKLocalSearch(request: request).start { response, error in
      DispatchQueue.main.async {
        let items = response?.mapItems ?? []
        completion(items, items.isEmpty ? (error?.localizedDescription ?? "No place found for this suggestion.") : nil)
      }
    }
  }

  func completerDidUpdateResults(_ completer: MKLocalSearchCompleter) {
    generation += 1
    var map: [String: MKLocalSearchCompletion] = [:]
    let results: [[String: Any]] = completer.results.prefix(8).enumerated().map { index, item in
      let id = "s\(generation)-\(index)"
      map[id] = item
      return [
        "id": id,
        "title": item.title,
        "subtitle": item.subtitle,
        "isQuery": item.subtitle.isEmpty,
      ]
    }
    completions.merge(map) { _, new in new }
    if completions.count > 200 {
      completions = map
    }
    finish(with: results)
  }

  func completer(_ completer: MKLocalSearchCompleter, didFailWithError error: Error) {
    DiagnosticsLog.shared.record("search: suggestions failed: \(error.localizedDescription)")
    finish(with: [])
  }

  private func finish(with results: [[String: Any]]) {
    timeout?.cancel()
    timeout = nil
    let callback = pending
    pending = nil
    callback?(results)
  }
}
