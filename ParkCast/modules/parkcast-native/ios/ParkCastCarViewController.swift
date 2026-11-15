import UIKit
import MapKit
import AVFoundation
import WebKit
import CoreImage
import ImageIO

final class PlayerHostView: UIView {
  override class var layerClass: AnyClass { AVPlayerLayer.self }
  var playerLayer: AVPlayerLayer { layer as! AVPlayerLayer }
}

final class PaddedLabel: UILabel {
  var insets = UIEdgeInsets(top: 7, left: 14, bottom: 7, right: 14)

  override func drawText(in rect: CGRect) {
    super.drawText(in: rect.inset(by: insets))
  }

  override var intrinsicContentSize: CGSize {
    let size = super.intrinsicContentSize
    return CGSize(width: size.width + insets.left + insets.right, height: size.height + insets.top + insets.bottom)
  }
}

private extension UIColor {
  func scaled(_ factor: CGFloat) -> UIColor {
    var r: CGFloat = 0, g: CGFloat = 0, b: CGFloat = 0, a: CGFloat = 0
    getRed(&r, green: &g, blue: &b, alpha: &a)
    return UIColor(red: r * factor, green: g * factor, blue: b * factor, alpha: a)
  }
}

/// Root view controller of the CarPlay window: live map, Cinema home, and a stage that plays
/// phone videos, photos, slideshows, web video and the mirrored iPhone screen.
final class ParkCastCarViewController: UIViewController, MKMapViewDelegate, WKNavigationDelegate {
  var onStageModeChanged: ((Bool) -> Void)?

  private let mapView = MKMapView()
  private let homeView = UIView()
  private let homeGradient = CAGradientLayer()
  private let greetingLabel = UILabel()
  private let clockLabel = UILabel()
  private let dateLabel = UILabel()
  private let statsLabel = UILabel()

  private let glowHalo = UIView()
  private let stageView = UIView()
  private let playerHost = PlayerHostView()
  private let frameView = UIImageView()
  private let photoView = UIImageView()
  private let mirrorView = UIImageView()
  private var webView: WKWebView?
  private let messageLabel = UILabel()

  private let statusBar = PaddedLabel()
  private let parkBanner = PaddedLabel()
  private let locatingPill = PaddedLabel()

  private let player = AVPlayer()
  private var videoOutput: AVPlayerItemVideoOutput?
  private let ciContext = CIContext()
  private var itemStatusObservation: NSKeyValueObservation?
  private var timeControlObservation: NSKeyValueObservation?
  private var frameTimer: Timer?
  private var clockTimer: Timer?
  private var slideshowTimer: Timer?
  private var sleepTimer: Timer?

  private var mode = "home"
  private var wantsPlaying = true
  private var fill = false
  private var settings: [String: Any] = [:]
  private var weatherText = ""
  private var greeting = ""
  private var currentVideoURI = ""
  private var currentPhotoURI = ""
  private var currentWebURI = ""
  private var slideshowItems: [String] = []
  private var slideshowIndex = 0
  private var sleepMinutes = 0
  private var glowCounter = 0
  private var lockedByMotion = false
  private var routeOverlay: MKPolyline?
  private var hasCenteredOnUser = false

  private var isStageMode: Bool {
    ["video", "photo", "slideshow", "web", "mirror"].contains(mode)
  }

  private var glowEnabled: Bool { settings["glow"] as? Bool ?? true }
  /// Free tier: video and photos are shown at 480p on the car.
  private var basicQuality: Bool { (settings["quality"] as? String ?? "basic") == "basic" }
  private static let basicMaxPixels: CGFloat = 480

  // MARK: Lifecycle

  override func viewDidLoad() {
    super.viewDidLoad()
    view.backgroundColor = .black
    try? AVAudioSession.sharedInstance().setCategory(.playback, mode: .moviePlayback, options: [])

    mapView.delegate = self
    mapView.showsUserLocation = true
    mapView.showsCompass = false
    if let location = CarSessionStore.shared.navigation.lastLocation {
      mapView.setRegion(MKCoordinateRegion(center: location.coordinate, latitudinalMeters: 1500, longitudinalMeters: 1500), animated: false)
      hasCenteredOnUser = true
    }
    mapView.setUserTrackingMode(.follow, animated: false)
    view.addSubview(mapView)

    buildHome()
    buildStage()
    buildOverlays()

    player.allowsExternalPlayback = false
    player.automaticallyWaitsToMinimizeStalling = true
    playerHost.playerLayer.player = player
    playerHost.playerLayer.videoGravity = .resizeAspect
    timeControlObservation = player.observe(\.timeControlStatus, options: [.new]) { [weak self] observed, _ in
      DispatchQueue.main.async {
        guard let self = self, self.mode == "video" else { return }
        switch observed.timeControlStatus {
        case .playing: self.hideMessage()
        case .waitingToPlayAtSpecifiedRate: self.showMessage("Loading…")
        default: break
        }
      }
    }
    NotificationCenter.default.addObserver(self, selector: #selector(itemDidEnd), name: .AVPlayerItemDidPlayToEndTime, object: nil)
    UIDevice.current.isBatteryMonitoringEnabled = true

    let store = CarSessionStore.shared
    store.mirror.onFrame = { [weak self] image in self?.showMirrorFrame(image) }
    store.navigation.onUpdate = { [weak self] in self?.locationUpdated() }
    store.navigation.onRouteChanged = { [weak self] route in self?.showRoute(route) }

    startTimers()
    apply(state: store.state)
  }

  func teardown() {
    frameTimer?.invalidate()
    clockTimer?.invalidate()
    slideshowTimer?.invalidate()
    sleepTimer?.invalidate()
    player.pause()
    webView?.stopLoading()
    let store = CarSessionStore.shared
    store.mirror.onFrame = nil
    store.navigation.onUpdate = nil
    store.navigation.onRouteChanged = nil
  }

  private func startTimers() {
    let frame = Timer(timeInterval: 1.0 / 30.0, repeats: true) { [weak self] _ in
      self?.renderVideoFrame()
    }
    RunLoop.main.add(frame, forMode: .common)
    frameTimer = frame

    let clock = Timer(timeInterval: 1.0, repeats: true) { [weak self] _ in
      self?.tick()
    }
    RunLoop.main.add(clock, forMode: .common)
    clockTimer = clock
  }

  // MARK: Building views

  private func buildHome() {
    homeGradient.colors = [
      UIColor(red: 0.04, green: 0.06, blue: 0.12, alpha: 1).cgColor,
      UIColor(red: 0.08, green: 0.12, blue: 0.24, alpha: 1).cgColor,
    ]
    homeView.layer.addSublayer(homeGradient)

    greetingLabel.textColor = UIColor(white: 1, alpha: 0.7)
    greetingLabel.font = .systemFont(ofSize: 20, weight: .semibold)
    greetingLabel.textAlignment = .center

    clockLabel.textColor = .white
    clockLabel.font = .systemFont(ofSize: 110, weight: .thin)
    clockLabel.textAlignment = .center
    clockLabel.adjustsFontSizeToFitWidth = true
    clockLabel.minimumScaleFactor = 0.4

    dateLabel.textColor = UIColor(white: 1, alpha: 0.85)
    dateLabel.font = .systemFont(ofSize: 20, weight: .medium)
    dateLabel.textAlignment = .center

    statsLabel.textColor = .white
    statsLabel.font = .systemFont(ofSize: 20, weight: .semibold)
    statsLabel.textAlignment = .center

    [greetingLabel, clockLabel, dateLabel, statsLabel].forEach { homeView.addSubview($0) }
    view.addSubview(homeView)
  }

  private func buildStage() {
    glowHalo.backgroundColor = .black
    glowHalo.layer.shadowOpacity = 0.9
    glowHalo.layer.shadowRadius = 46
    glowHalo.layer.shadowOffset = .zero
    glowHalo.layer.shadowColor = UIColor.systemBlue.cgColor
    view.addSubview(glowHalo)

    stageView.backgroundColor = .black
    stageView.clipsToBounds = true
    view.addSubview(stageView)

    frameView.contentMode = .scaleAspectFit
    photoView.contentMode = .scaleAspectFit
    mirrorView.contentMode = .scaleAspectFit
    [playerHost, frameView, photoView, mirrorView].forEach { stageView.addSubview($0) }

    messageLabel.textColor = .white
    messageLabel.font = .systemFont(ofSize: 22, weight: .semibold)
    messageLabel.textAlignment = .center
    messageLabel.numberOfLines = 0
    messageLabel.isHidden = true
    stageView.addSubview(messageLabel)
  }

  private func buildOverlays() {
    statusBar.font = .monospacedDigitSystemFont(ofSize: 15, weight: .semibold)
    statusBar.textColor = .white
    statusBar.backgroundColor = UIColor(white: 0, alpha: 0.55)
    statusBar.layer.cornerRadius = 14
    statusBar.clipsToBounds = true
    view.addSubview(statusBar)

    parkBanner.text = "Drive safe — playback resumes when you park"
    parkBanner.font = .systemFont(ofSize: 17, weight: .bold)
    parkBanner.textColor = .white
    parkBanner.backgroundColor = UIColor(red: 0.07, green: 0.09, blue: 0.16, alpha: 0.92)
    parkBanner.layer.cornerRadius = 16
    parkBanner.clipsToBounds = true
    parkBanner.isHidden = true
    view.addSubview(parkBanner)

    locatingPill.text = "Finding your location…"
    locatingPill.font = .systemFont(ofSize: 15, weight: .semibold)
    locatingPill.textColor = .white
    locatingPill.backgroundColor = UIColor(white: 0, alpha: 0.6)
    locatingPill.layer.cornerRadius = 14
    locatingPill.clipsToBounds = true
    locatingPill.isHidden = CarSessionStore.shared.navigation.lastLocation != nil
    view.addSubview(locatingPill)
  }

  override func viewDidLayoutSubviews() {
    super.viewDidLayoutSubviews()
    let bounds = view.bounds
    let content = bounds.inset(by: view.safeAreaInsets)

    mapView.frame = bounds
    homeView.frame = bounds
    homeGradient.frame = homeView.bounds

    let centerY = content.midY
    greetingLabel.frame = CGRect(x: content.minX, y: centerY - 130, width: content.width, height: 26)
    clockLabel.frame = CGRect(x: content.minX + 20, y: centerY - 100, width: content.width - 40, height: 120)
    dateLabel.frame = CGRect(x: content.minX, y: centerY + 24, width: content.width, height: 26)
    statsLabel.frame = CGRect(x: content.minX, y: centerY + 64, width: content.width, height: 28)

    let stageFrame: CGRect
    if glowEnabled && isStageMode && !lockedByMotion {
      stageFrame = content.insetBy(dx: content.width * 0.035, dy: content.height * 0.05)
      stageView.layer.cornerRadius = 18
    } else {
      stageFrame = content
      stageView.layer.cornerRadius = 0
    }
    stageView.frame = stageFrame
    glowHalo.frame = stageFrame
    glowHalo.layer.cornerRadius = stageView.layer.cornerRadius
    glowHalo.layer.shadowPath = UIBezierPath(roundedRect: glowHalo.bounds, cornerRadius: glowHalo.layer.cornerRadius).cgPath
    [playerHost, frameView, photoView, mirrorView].forEach { $0.frame = stageView.bounds }
    webView?.frame = stageView.bounds
    messageLabel.frame = stageView.bounds.insetBy(dx: 40, dy: 30)

    let statusSize = statusBar.intrinsicContentSize
    statusBar.frame = CGRect(x: content.maxX - statusSize.width - 14, y: content.minY + 12, width: statusSize.width, height: statusSize.height)

    let bannerSize = parkBanner.intrinsicContentSize
    parkBanner.frame = CGRect(x: content.midX - bannerSize.width / 2, y: content.maxY - bannerSize.height - 18, width: bannerSize.width, height: bannerSize.height)

    let pillSize = locatingPill.intrinsicContentSize
    locatingPill.frame = CGRect(x: content.midX - pillSize.width / 2, y: content.maxY - pillSize.height - 18, width: pillSize.width, height: pillSize.height)
  }

  // MARK: State from the phone

  func apply(state: [String: Any]) {
    settings = state["settings"] as? [String: Any] ?? [:]
    weatherText = state["weather"] as? String ?? ""
    greeting = state["greeting"] as? String ?? ""
    fill = state["fill"] as? Bool ?? false
    wantsPlaying = state["playing"] as? Bool ?? true
    player.isMuted = state["muted"] as? Bool ?? false
    applyGravity()

    let newMode = state["mode"] as? String ?? "home"
    if let media = state["media"] as? [String: Any] {
      load(media: media, for: newMode)
    }
    setMode(newMode, notify: false)
    configureSleepTimer(minutes: settings["sleepMinutes"] as? Int ?? 0)
    tick()
  }

  func control(action: String, value: Double) {
    switch action {
    case "seekBy":
      if mode == "video" {
        let target = max(0, player.currentTime().seconds + value)
        player.seek(to: CMTime(seconds: target, preferredTimescale: 600))
      } else if mode == "web" {
        webView?.evaluateJavaScript("(function(){var v=document.querySelector('video.__pc_full')||document.querySelector('video');if(v){v.currentTime=Math.max(0,v.currentTime+(\(value)));}})()")
      }
    case "seekTo":
      if mode == "video" {
        player.seek(to: CMTime(seconds: max(0, value), preferredTimescale: 600))
      }
    case "nextSlide":
      advanceSlide()
    default:
      break
    }
  }

  func showModeFromCar(_ newMode: String) {
    setMode(newMode, notify: true)
  }

  func togglePlayFromCar() {
    wantsPlaying.toggle()
    applyPlayState()
    CarSessionStore.shared.emit("onCarCommand", ["type": "playing", "value": wantsPlaying])
  }

  func toggleFillFromCar() {
    fill.toggle()
    applyGravity()
    CarSessionStore.shared.emit("onCarCommand", ["type": "fill", "value": fill])
  }

  func playLibraryEntry(_ entry: [String: Any]) {
    let kind = entry["kind"] as? String ?? "video"
    let media: [String: Any] = ["uri": entry["uri"] as? String ?? "", "items": entry["items"] as? [String] ?? [], "title": entry["title"] as? String ?? ""]
    wantsPlaying = true
    load(media: media, for: kind)
    setMode(kind, notify: false)
  }

  private func setMode(_ newMode: String, notify: Bool) {
    let changed = newMode != mode
    mode = newMode
    if changed && notify {
      CarSessionStore.shared.emit("onCarCommand", ["type": "mode", "mode": newMode])
    }
    updateParkLock()
  }

  private func load(media: [String: Any], for targetMode: String) {
    let uri = media["uri"] as? String ?? ""
    switch targetMode {
    case "video":
      if uri != currentVideoURI { playVideo(uri) }
    case "photo":
      if uri != currentPhotoURI { showPhoto(uri) }
    case "slideshow":
      let items = media["items"] as? [String] ?? []
      if items != slideshowItems { startSlideshow(items) }
    case "web":
      if uri != currentWebURI { openWeb(uri) }
    default:
      break
    }
  }

  // MARK: Rendering

  private func render() {
    let stage = isStageMode && !lockedByMotion
    homeView.isHidden = mode != "home" || lockedByMotion
    mapView.isHidden = !(mode == "map" || lockedByMotion)
    stageView.isHidden = !stage
    glowHalo.isHidden = !stage || !glowEnabled
    playerHost.isHidden = mode != "video"
    frameView.isHidden = mode != "video" || frameView.image == nil
    photoView.isHidden = !(mode == "photo" || mode == "slideshow")
    photoView.contentMode = mode == "slideshow" ? .scaleAspectFill : (fill ? .scaleAspectFill : .scaleAspectFit)
    if mode != "slideshow" { photoView.transform = .identity }
    mirrorView.isHidden = mode != "mirror"
    webView?.isHidden = mode != "web"
    parkBanner.isHidden = !lockedByMotion
    locatingPill.isHidden = !(mapView.isHidden == false && CarSessionStore.shared.navigation.lastLocation == nil) || lockedByMotion

    if mode != "video" { player.pause() }
    if mode != "web" { webView?.evaluateJavaScript(ParkCastCarViewController.jsPause) }
    if mode != "slideshow" {
      slideshowTimer?.invalidate()
      slideshowTimer = nil
    }
    if mode == "mirror" {
      if CarSessionStore.shared.mirror.isActive {
        hideMessage()
      } else {
        mirrorView.image = nil
        showMessage("Ready to mirror.\nOn your iPhone, open ParkCast › Mirror › Start mirroring.")
      }
    } else if mode == "photo" || mode == "slideshow" {
      if photoView.image != nil { hideMessage() }
    }
    if !stage || !glowEnabled {
      view.backgroundColor = .black
    }
    statusBar.isHidden = !(stage && (settings["statusBar"] as? Bool ?? true))
    statusBar.alpha = CGFloat(settings["statusOpacity"] as? Double ?? 0.85)
    applyPlayState()
    onStageModeChanged?(stage)
    view.setNeedsLayout()
  }

  private func showMessage(_ text: String) {
    messageLabel.text = text
    messageLabel.isHidden = false
  }

  private func hideMessage() {
    messageLabel.isHidden = true
  }

  private func applyGravity() {
    playerHost.playerLayer.videoGravity = fill ? .resizeAspectFill : .resizeAspect
    frameView.contentMode = fill ? .scaleAspectFill : .scaleAspectFit
    mirrorView.contentMode = fill ? .scaleAspectFill : .scaleAspectFit
    if mode == "photo" { photoView.contentMode = fill ? .scaleAspectFill : .scaleAspectFit }
    webView?.evaluateJavaScript(fill ? "document.documentElement.classList.add('__pc_fill')" : "document.documentElement.classList.remove('__pc_fill')")
  }

  private func applyPlayState() {
    let allowed = wantsPlaying && !lockedByMotion
    switch mode {
    case "video":
      if allowed {
        try? AVAudioSession.sharedInstance().setActive(true)
        player.play()
      } else {
        player.pause()
      }
    case "web":
      webView?.evaluateJavaScript(allowed ? ParkCastCarViewController.jsPlay : ParkCastCarViewController.jsPause)
    case "slideshow":
      if allowed && slideshowTimer == nil && !slideshowItems.isEmpty {
        let timer = Timer(timeInterval: 6, repeats: true) { [weak self] _ in self?.advanceSlide() }
        RunLoop.main.add(timer, forMode: .common)
        slideshowTimer = timer
      } else if !allowed {
        slideshowTimer?.invalidate()
        slideshowTimer = nil
      }
    default:
      break
    }
  }

  // MARK: Video

  private func playVideo(_ uri: String) {
    currentVideoURI = uri
    frameView.image = nil
    guard let url = URL(string: uri), !uri.isEmpty else {
      showMessage("This video link isn't valid.")
      return
    }
    if url.isFileURL && !FileManager.default.fileExists(atPath: url.path) {
      showMessage("This video is no longer on your iPhone.\nPick it again in ParkCast.")
      return
    }
    showMessage("Loading…")
    let item = AVPlayerItem(url: url)
    item.preferredForwardBufferDuration = 4
    if basicQuality {
      item.preferredMaximumResolution = CGSize(width: 854, height: 480)
      item.preferredPeakBitRate = 1_200_000
    }
    let output = AVPlayerItemVideoOutput(pixelBufferAttributes: [
      kCVPixelBufferPixelFormatTypeKey as String: Int(kCVPixelFormatType_32BGRA),
    ])
    item.add(output)
    videoOutput = output
    itemStatusObservation = item.observe(\.status, options: [.new]) { [weak self] observed, _ in
      DispatchQueue.main.async {
        if observed.status == .failed {
          self?.showMessage("This video can't play on the car screen.\nTry Mirror on your iPhone instead.")
        }
      }
    }
    player.replaceCurrentItem(with: item)
    applyPlayState()
  }

  @objc private func itemDidEnd(_ note: Notification) {
    guard let item = note.object as? AVPlayerItem, item === player.currentItem else { return }
    player.seek(to: .zero)
    wantsPlaying = false
    CarSessionStore.shared.emit("onCarCommand", ["type": "ended"])
  }

  private func renderVideoFrame() {
    guard mode == "video", !lockedByMotion, let output = videoOutput, let item = player.currentItem else { return }
    let time = item.currentTime()
    guard output.hasNewPixelBuffer(forItemTime: time),
          let pixelBuffer = output.copyPixelBuffer(forItemTime: time, itemTimeForDisplay: nil) else { return }
    var image = CIImage(cvPixelBuffer: pixelBuffer)
    let shortSide = min(image.extent.width, image.extent.height)
    if basicQuality && shortSide > Self.basicMaxPixels {
      let scale = Self.basicMaxPixels / shortSide
      image = image.transformed(by: CGAffineTransform(scaleX: scale, y: scale))
    }
    guard let cgImage = ciContext.createCGImage(image, from: image.extent) else { return }
    frameView.image = UIImage(cgImage: cgImage)
    frameView.isHidden = false
    glowCounter += 1
    if glowCounter % 20 == 0 {
      updateGlow(from: image)
    }
  }

  // MARK: Photos and Memories slideshow

  private func showPhoto(_ uri: String) {
    currentPhotoURI = uri
    photoView.image = nil
    showMessage("Loading…")
    ParkCastCarViewController.loadImage(uri, maxPixels: basicQuality ? 854 : 2200) { [weak self] image in
      guard let self = self, self.currentPhotoURI == uri else { return }
      guard let image = image else {
        self.showMessage("This photo couldn't be opened.")
        return
      }
      self.hideMessage()
      UIView.transition(with: self.photoView, duration: 0.35, options: .transitionCrossDissolve) {
        self.photoView.image = image
      }
      if let ci = CIImage(image: image) { self.updateGlow(from: ci) }
    }
  }

  private func startSlideshow(_ items: [String]) {
    slideshowItems = items
    slideshowIndex = 0
    slideshowTimer?.invalidate()
    slideshowTimer = nil
    showSlide()
  }

  private func advanceSlide() {
    guard !slideshowItems.isEmpty, wantsPlaying, !lockedByMotion else { return }
    slideshowIndex = (slideshowIndex + 1) % slideshowItems.count
    showSlide()
  }

  private func showSlide() {
    guard !slideshowItems.isEmpty else { return }
    let uri = slideshowItems[slideshowIndex % slideshowItems.count]
    ParkCastCarViewController.loadImage(uri, maxPixels: basicQuality ? 854 : 2200) { [weak self] image in
      guard let self = self, let image = image, self.mode == "slideshow" else { return }
      self.hideMessage()
      self.photoView.layer.removeAllAnimations()
      self.photoView.transform = .identity
      UIView.transition(with: self.photoView, duration: 0.9, options: .transitionCrossDissolve) {
        self.photoView.image = image
      }
      let dx = CGFloat.random(in: -24...24)
      let dy = CGFloat.random(in: -14...14)
      UIView.animate(withDuration: 6.5, delay: 0, options: [.curveLinear, .allowUserInteraction]) {
        self.photoView.transform = CGAffineTransform(scaleX: 1.14, y: 1.14).translatedBy(x: dx, y: dy)
      }
      if let ci = CIImage(image: image) { self.updateGlow(from: ci) }
    }
  }

  private static func loadImage(_ uri: String, maxPixels: Int, completion: @escaping (UIImage?) -> Void) {
    DispatchQueue.global(qos: .userInitiated).async {
      var image: UIImage?
      if let url = URL(string: uri) {
        let source: CGImageSource?
        if url.isFileURL {
          source = CGImageSourceCreateWithURL(url as CFURL, nil)
        } else if let data = try? Data(contentsOf: url) {
          source = CGImageSourceCreateWithData(data as CFData, nil)
        } else {
          source = nil
        }
        if let source = source {
          let options: [CFString: Any] = [
            kCGImageSourceCreateThumbnailFromImageAlways: true,
            kCGImageSourceCreateThumbnailWithTransform: true,
            kCGImageSourceThumbnailMaxPixelSize: maxPixels,
          ]
          if let cgImage = CGImageSourceCreateThumbnailAtIndex(source, 0, options as CFDictionary) {
            image = UIImage(cgImage: cgImage)
          }
        }
      }
      DispatchQueue.main.async { completion(image) }
    }
  }

  // MARK: Web video (Watch in Car)

  private static let jsFullscreenVideo = #"""
  (function(){
    if (window.__parkcast) return; window.__parkcast = true;
    var style = document.createElement('style');
    style.textContent = 'video.__pc_full{position:fixed!important;left:0!important;top:0!important;width:100vw!important;height:100vh!important;max-width:none!important;max-height:none!important;z-index:2147483647!important;background:#000!important;object-fit:contain!important}html.__pc_fill video.__pc_full{object-fit:cover!important}';
    document.documentElement.appendChild(style);
    function pick(){
      var videos = Array.prototype.slice.call(document.querySelectorAll('video'));
      if (!videos.length) return;
      videos.sort(function(a,b){ return (b.videoWidth*b.videoHeight) - (a.videoWidth*a.videoHeight); });
      var best = videos[0];
      videos.forEach(function(v){ if (v !== best) v.classList.remove('__pc_full'); });
      best.classList.add('__pc_full');
      best.setAttribute('playsinline', '');
      if (best.paused && !window.__pcPaused) {
        best.play().catch(function(){ best.muted = true; best.play().catch(function(){}); });
      }
    }
    setInterval(pick, 1000);
    pick();
  })();
  """#

  private static let jsPlay = "window.__pcPaused=false;(function(){var v=document.querySelector('video.__pc_full')||document.querySelector('video');if(v){v.play();}})()"
  private static let jsPause = "window.__pcPaused=true;(function(){var v=document.querySelector('video.__pc_full')||document.querySelector('video');if(v){v.pause();}})()"

  private func ensureWebView() -> WKWebView {
    if let existing = webView { return existing }
    let config = WKWebViewConfiguration()
    config.allowsInlineMediaPlayback = true
    config.mediaTypesRequiringUserActionForPlayback = []
    config.userContentController.addUserScript(
      WKUserScript(source: ParkCastCarViewController.jsFullscreenVideo, injectionTime: .atDocumentEnd, forMainFrameOnly: true)
    )
    let created = WKWebView(frame: stageView.bounds, configuration: config)
    created.navigationDelegate = self
    created.isOpaque = false
    created.backgroundColor = .black
    created.scrollView.backgroundColor = .black
    stageView.insertSubview(created, belowSubview: messageLabel)
    webView = created
    return created
  }

  private func openWeb(_ uri: String) {
    currentWebURI = uri
    guard let url = URL(string: uri), !uri.isEmpty else {
      showMessage("This link isn't valid.")
      return
    }
    DiagnosticsLog.shared.record("car web: opening \(DiagnosticsLog.host(of: uri))")
    showMessage("Opening…")
    ensureWebView().load(URLRequest(url: url))
  }

  func webView(_ webView: WKWebView, didFinish navigation: WKNavigation!) {
    DiagnosticsLog.shared.record("car web: loaded \(DiagnosticsLog.host(of: webView.url?.absoluteString ?? currentWebURI))")
    hideMessage()
    webView.evaluateJavaScript(ParkCastCarViewController.jsFullscreenVideo)
    applyGravity()
    applyPlayState()
  }

  func webView(_ webView: WKWebView, didFail navigation: WKNavigation!, withError error: Error) {
    DiagnosticsLog.shared.record("car web: load failed for \(DiagnosticsLog.host(of: currentWebURI)): \(error.localizedDescription)")
    showMessage("This page couldn't load on the car screen.")
  }

  func webView(_ webView: WKWebView, didFailProvisionalNavigation navigation: WKNavigation!, withError error: Error) {
    DiagnosticsLog.shared.record("car web: could not open \(DiagnosticsLog.host(of: currentWebURI)): \(error.localizedDescription)")
    showMessage("This page couldn't load on the car screen.")
  }

  func webViewWebContentProcessDidTerminate(_ webView: WKWebView) {
    DiagnosticsLog.shared.record("car web: web content process ended, reloading")
    webView.reload()
  }

  // MARK: Mirroring

  private func showMirrorFrame(_ image: CGImage) {
    guard mode == "mirror", !lockedByMotion else { return }
    mirrorView.image = UIImage(cgImage: image)
    if !messageLabel.isHidden { hideMessage() }
    glowCounter += 1
    if glowCounter % 20 == 0 {
      updateGlow(from: CIImage(cgImage: image))
    }
  }

  func mirrorStateChanged(active: Bool) {
    if active && mode != "mirror" {
      setMode("mirror", notify: true)
    } else if !active && mode == "mirror" {
      render()
    }
  }

  // MARK: Ambient Cinema Glow

  private func updateGlow(from image: CIImage) {
    guard glowEnabled, isStageMode else { return }
    let extent = image.extent
    guard !extent.isEmpty,
          let filter = CIFilter(name: "CIAreaAverage", parameters: [kCIInputImageKey: image, kCIInputExtentKey: CIVector(cgRect: extent)]),
          let output = filter.outputImage else { return }
    var pixel = [UInt8](repeating: 0, count: 4)
    ciContext.render(output, toBitmap: &pixel, rowBytes: 4, bounds: CGRect(x: 0, y: 0, width: 1, height: 1), format: .RGBA8, colorSpace: CGColorSpaceCreateDeviceRGB())
    let color = UIColor(red: CGFloat(pixel[0]) / 255, green: CGFloat(pixel[1]) / 255, blue: CGFloat(pixel[2]) / 255, alpha: 1)
    UIView.animate(withDuration: 0.8) {
      self.view.backgroundColor = color.scaled(0.35)
    }
    glowHalo.layer.shadowColor = color.cgColor
  }

  // MARK: Smart Park Lock

  func parkStateChanged() {
    updateParkLock()
  }

  private func updateParkLock() {
    let enabled = settings["parkLock"] as? Bool ?? true
    lockedByMotion = enabled && CarSessionStore.shared.navigation.isMoving && isStageMode
    render()
  }

  // MARK: Map

  private func locationUpdated() {
    let navigation = CarSessionStore.shared.navigation
    if let location = navigation.lastLocation, !hasCenteredOnUser {
      hasCenteredOnUser = true
      mapView.setRegion(MKCoordinateRegion(center: location.coordinate, latitudinalMeters: 1500, longitudinalMeters: 1500), animated: true)
      mapView.setUserTrackingMode(navigation.activeRoute == nil ? .follow : .followWithHeading, animated: true)
      render()
    }
  }

  private func showRoute(_ route: MKRoute?) {
    if let existing = routeOverlay {
      mapView.removeOverlay(existing)
    }
    routeOverlay = route?.polyline
    if let polyline = routeOverlay {
      mapView.addOverlay(polyline)
      mapView.setUserTrackingMode(.followWithHeading, animated: true)
      setMode("map", notify: true)
    } else {
      mapView.setUserTrackingMode(.follow, animated: true)
    }
  }

  func mapView(_ mapView: MKMapView, rendererFor overlay: MKOverlay) -> MKOverlayRenderer {
    if let polyline = overlay as? MKPolyline {
      let renderer = MKPolylineRenderer(polyline: polyline)
      renderer.strokeColor = UIColor.systemBlue
      renderer.lineWidth = 8
      return renderer
    }
    return MKOverlayRenderer(overlay: overlay)
  }

  // MARK: Clock, status bar, progress, sleep timer

  private func tick() {
    let now = Date()
    let timeFormatter = DateFormatter()
    timeFormatter.timeStyle = .short
    timeFormatter.dateStyle = .none
    let dateFormatter = DateFormatter()
    dateFormatter.setLocalizedDateFormatFromTemplate("EEEEMMMMd")

    let time = timeFormatter.string(from: now)
    clockLabel.text = time
    dateLabel.text = dateFormatter.string(from: now)
    greetingLabel.text = greeting

    let store = CarSessionStore.shared
    let speed = store.navigation.speedMetersPerSecond
    let speedText = store.usesMetric ? "\(Int((speed * 3.6).rounded())) km/h" : "\(Int((speed * 2.23694).rounded())) mph"
    var parts = [speedText]
    if !weatherText.isEmpty { parts.append(weatherText) }
    let level = UIDevice.current.batteryLevel
    if level >= 0 { parts.append("Battery \(Int((level * 100).rounded()))%") }
    statsLabel.text = parts.joined(separator: "   ·   ")
    statusBar.text = ([time] + parts).joined(separator: "  ·  ")
    if !statusBar.isHidden { view.setNeedsLayout() }

    if mode == "video", let item = player.currentItem {
      let position = player.currentTime().seconds
      let duration = item.duration.seconds
      store.emit("onPlayerProgress", [
        "position": position.isFinite ? position : 0,
        "duration": duration.isFinite ? duration : 0,
        "playing": player.timeControlStatus == .playing,
      ])
    }
  }

  private func configureSleepTimer(minutes: Int) {
    guard minutes != sleepMinutes else { return }
    sleepMinutes = minutes
    sleepTimer?.invalidate()
    sleepTimer = nil
    guard minutes > 0 else { return }
    let timer = Timer(timeInterval: TimeInterval(minutes * 60), repeats: false) { [weak self] _ in
      guard let self = self else { return }
      self.wantsPlaying = false
      self.applyPlayState()
      if self.isStageMode { self.showMessage("Sleep timer ended.\nPress play on your iPhone to keep watching.") }
      CarSessionStore.shared.emit("onCarCommand", ["type": "playing", "value": false])
      CarSessionStore.shared.emit("onCarCommand", ["type": "sleepEnded"])
    }
    RunLoop.main.add(timer, forMode: .common)
    sleepTimer = timer
  }
}
