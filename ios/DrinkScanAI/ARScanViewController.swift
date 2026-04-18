import UIKit
import ARKit
import SceneKit

// MARK: - Scan state machine
enum ScanState {
  case scanning          // building world map, user moves phone
  case readyToMeasure    // enough map built, waiting for user to tap
  case measuringTop      // waiting for tap on cup top rim
  case measuringBottom   // waiting for tap on cup base
  case measuringWidth    // waiting for tap on cup widest edge
  case complete          // all 3 points captured
}

// MARK: - ARScanViewController
class ARScanViewController: UIViewController, ARSCNViewDelegate, ARSessionDelegate {

  // MARK: Callbacks (set by ARScanModule)
  var onProgressUpdate: ((Float) -> Void)?
  var onScanReady: (() -> Void)?
  var onMeasurementComplete: (([String: Any]) -> Void)?
  var onError: ((String) -> Void)?

  // MARK: - UI
  private var sceneView: ARSCNView!
  private var instructionLabel: UILabel!
  private var progressRing: CAShapeLayer!
  private var progressTrack: CAShapeLayer!
  private var readyButton: UIButton!
  private var closeButton: UIButton!
  private var tapHintLabel: UILabel!

  // MARK: - AR state
  private var state: ScanState = .scanning
  private var worldMapSize: Int = 0          // grows as user scans
  private var planeAnchor: ARPlaneAnchor?    // detected table surface

  // MARK: - Measurement points (3D world coords in meters)
  private var pointTop: simd_float3?
  private var pointBottom: simd_float3?
  private var pointWidth: simd_float3?

  // MARK: - Visual anchors shown in AR
  private var dotNodes: [SCNNode] = []

  // MARK: - Lifecycle
  override func viewDidLoad() {
    super.viewDidLoad()
    setupSceneView()
    setupUI()
    startARSession()
  }

  override func viewWillDisappear(_ animated: Bool) {
    super.viewWillDisappear(animated)
    sceneView.session.pause()
  }

  // MARK: - AR session setup
  private func startARSession() {
    let config = ARWorldTrackingConfiguration()
    config.planeDetection = [.horizontal]
    config.environmentTexturing = .none

    // Feature points help us gauge world map quality
    sceneView.debugOptions = [] // set to [.showFeaturePoints] for debugging

    sceneView.session.run(config, options: [.resetTracking, .removeExistingAnchors])
  }

  // MARK: - UI Setup
  private func setupSceneView() {
    sceneView = ARSCNView(frame: view.bounds)
    sceneView.autoresizingMask = [.flexibleWidth, .flexibleHeight]
    sceneView.delegate = self
    sceneView.session.delegate = self
    sceneView.automaticallyUpdatesLighting = true
    view.addSubview(sceneView)

    let tap = UITapGestureRecognizer(target: self, action: #selector(handleTap(_:)))
    sceneView.addGestureRecognizer(tap)
  }

  private func setupUI() {
    view.backgroundColor = .black

    // Close button
    closeButton = UIButton(type: .system)
    closeButton.setTitle("✕", for: .normal)
    closeButton.titleLabel?.font = .systemFont(ofSize: 20)
    closeButton.tintColor = .white
    closeButton.translatesAutoresizingMaskIntoConstraints = false
    closeButton.addTarget(self, action: #selector(closeTapped), for: .touchUpInside)
    view.addSubview(closeButton)

    // Progress ring
    let ringSize: CGFloat = 80
    let ringCenter = CGPoint(x: view.bounds.midX, y: 120)
    let trackPath = UIBezierPath(arcCenter: ringCenter, radius: 34,
                                  startAngle: -.pi / 2, endAngle: .pi * 1.5, clockwise: true)
    progressTrack = CAShapeLayer()
    progressTrack.path = trackPath.cgPath
    progressTrack.strokeColor = UIColor.white.withAlphaComponent(0.2).cgColor
    progressTrack.fillColor = UIColor.clear.cgColor
    progressTrack.lineWidth = 4
    view.layer.addSublayer(progressTrack)

    progressRing = CAShapeLayer()
    progressRing.path = trackPath.cgPath
    progressRing.strokeColor = UIColor(red: 0.2, green: 0.9, blue: 0.6, alpha: 1).cgColor
    progressRing.fillColor = UIColor.clear.cgColor
    progressRing.lineWidth = 4
    progressRing.lineCap = .round
    progressRing.strokeEnd = 0
    view.layer.addSublayer(progressRing)

    // Instruction label
    instructionLabel = UILabel()
    instructionLabel.text = "Slowly move phone around the cup"
    instructionLabel.textColor = .white
    instructionLabel.font = .systemFont(ofSize: 16, weight: .medium)
    instructionLabel.textAlignment = .center
    instructionLabel.numberOfLines = 2
    instructionLabel.translatesAutoresizingMaskIntoConstraints = false
    view.addSubview(instructionLabel)

    // Tap hint label (shown during measure phase)
    tapHintLabel = UILabel()
    tapHintLabel.text = ""
    tapHintLabel.textColor = UIColor(red: 0.2, green: 0.9, blue: 0.6, alpha: 1)
    tapHintLabel.font = .systemFont(ofSize: 14, weight: .regular)
    tapHintLabel.textAlignment = .center
    tapHintLabel.alpha = 0
    tapHintLabel.translatesAutoresizingMaskIntoConstraints = false
    view.addSubview(tapHintLabel)

    // Ready button (shown when scan is good enough)
    readyButton = UIButton(type: .system)
    readyButton.setTitle("Start Measuring", for: .normal)
    readyButton.titleLabel?.font = .systemFont(ofSize: 17, weight: .semibold)
    readyButton.backgroundColor = UIColor(red: 0.2, green: 0.9, blue: 0.6, alpha: 1)
    readyButton.setTitleColor(.black, for: .normal)
    readyButton.layer.cornerRadius = 24
    readyButton.alpha = 0
    readyButton.translatesAutoresizingMaskIntoConstraints = false
    readyButton.addTarget(self, action: #selector(readyTapped), for: .touchUpInside)
    view.addSubview(readyButton)

    NSLayoutConstraint.activate([
      closeButton.topAnchor.constraint(equalTo: view.safeAreaLayoutGuide.topAnchor, constant: 12),
      closeButton.leadingAnchor.constraint(equalTo: view.leadingAnchor, constant: 20),
      closeButton.widthAnchor.constraint(equalToConstant: 44),
      closeButton.heightAnchor.constraint(equalToConstant: 44),

      instructionLabel.topAnchor.constraint(equalTo: view.safeAreaLayoutGuide.topAnchor, constant: 150),
      instructionLabel.leadingAnchor.constraint(equalTo: view.leadingAnchor, constant: 24),
      instructionLabel.trailingAnchor.constraint(equalTo: view.trailingAnchor, constant: -24),

      tapHintLabel.topAnchor.constraint(equalTo: instructionLabel.bottomAnchor, constant: 8),
      tapHintLabel.leadingAnchor.constraint(equalTo: view.leadingAnchor, constant: 24),
      tapHintLabel.trailingAnchor.constraint(equalTo: view.trailingAnchor, constant: -24),

      readyButton.bottomAnchor.constraint(equalTo: view.safeAreaLayoutGuide.bottomAnchor, constant: -32),
      readyButton.centerXAnchor.constraint(equalTo: view.centerXAnchor),
      readyButton.widthAnchor.constraint(equalToConstant: 220),
      readyButton.heightAnchor.constraint(equalToConstant: 52),
    ])
  }

  // MARK: - ARSessionDelegate — track world map quality
  func session(_ session: ARSession, didUpdate frame: ARFrame) {
    guard state == .scanning else { return }

    // Use feature point count as proxy for scan quality (0 → ready)
    let pointCount = frame.rawFeaturePoints?.points.count ?? 0
    worldMapSize = max(worldMapSize, pointCount)

    // Require plane detection + enough feature points
    let hasPlane = planeAnchor != nil
    let progress = min(Float(pointCount) / 400.0, 1.0)

    DispatchQueue.main.async {
      self.progressRing.strokeEnd = CGFloat(progress)
      self.onProgressUpdate?(progress)

      if progress >= 0.8 && hasPlane && self.state == .scanning {
        self.showReadyState()
      }
    }
  }

  // MARK: - ARSCNViewDelegate — plane detection
  func renderer(_ renderer: SCNSceneRenderer, didAdd node: SCNNode, for anchor: ARAnchor) {
    guard let planeAnchor = anchor as? ARPlaneAnchor,
          planeAnchor.alignment == .horizontal,
          self.planeAnchor == nil else { return }
    self.planeAnchor = planeAnchor
  }

  // MARK: - State transitions
  private func showReadyState() {
    guard state == .scanning else { return }
    state = .readyToMeasure
    onScanReady?()

    UIView.animate(withDuration: 0.4) {
      self.readyButton.alpha = 1
      self.instructionLabel.text = "Good scan! Place cup on a flat surface"
    }
    UIImpactFeedbackGenerator(style: .medium).impactOccurred()
  }

  func enterMeasureMode() {
    state = .measuringTop
    updateMeasureInstructions()

    UIView.animate(withDuration: 0.3) {
      self.readyButton.alpha = 0
      self.progressRing.opacity = 0
      self.progressTrack.opacity = 0
      self.tapHintLabel.alpha = 1
    }
  }

  private func updateMeasureInstructions() {
    switch state {
    case .measuringTop:
      instructionLabel.text = "Tap the TOP RIM of the cup"
      tapHintLabel.text = "Point 1 of 3"
    case .measuringBottom:
      instructionLabel.text = "Tap the BOTTOM EDGE of the cup"
      tapHintLabel.text = "Point 2 of 3"
    case .measuringWidth:
      instructionLabel.text = "Tap the WIDEST POINT of the opening"
      tapHintLabel.text = "Point 3 of 3 — almost done!"
    case .complete:
      instructionLabel.text = "Measuring..."
      tapHintLabel.text = ""
    default:
      break
    }
  }

  // MARK: - Tap handling
  @objc private func handleTap(_ gesture: UITapGestureRecognizer) {
    guard state == .measuringTop || state == .measuringBottom || state == .measuringWidth else {
      return
    }

    let location = gesture.location(in: sceneView)
    guard let worldPoint = raycast(from: location) else {
      showToast("Couldn't detect surface — try tapping a different spot")
      return
    }

    placeDot(at: worldPoint)
    UIImpactFeedbackGenerator(style: .light).impactOccurred()

    switch state {
    case .measuringTop:
      pointTop = worldPoint
      state = .measuringBottom
    case .measuringBottom:
      pointBottom = worldPoint
      state = .measuringWidth
    case .measuringWidth:
      pointWidth = worldPoint
      state = .complete
      computeAndReturn()
    default:
      break
    }

    updateMeasureInstructions()
  }

  // MARK: - Raycast — 3D position from 2D screen tap
  private func raycast(from point: CGPoint) -> simd_float3? {
    // First try raycasting against detected planes (most accurate)
    let raycastQuery = sceneView.raycastQuery(
      from: point,
      allowing: .estimatedPlane,
      alignment: .any
    )
    if let query = raycastQuery,
       let result = sceneView.session.raycast(query).first {
      return simd_float3(result.worldTransform.columns.3.x,
                         result.worldTransform.columns.3.y,
                         result.worldTransform.columns.3.z)
    }

    // Fallback: hit test against feature points
    let results = sceneView.hitTest(point, types: [.featurePoint, .existingPlaneUsingExtent])
    if let hit = results.first {
      let col = hit.worldTransform.columns.3
      return simd_float3(col.x, col.y, col.z)
    }

    return nil
  }

  // MARK: - Visual dot placed at tapped point
  private func placeDot(at position: simd_float3) {
    let colors: [UIColor] = [
      UIColor(red: 0.2, green: 0.9, blue: 0.6, alpha: 1),  // top — green
      UIColor(red: 0.35, green: 0.6, blue: 1.0, alpha: 1),  // bottom — blue
      UIColor(red: 1.0, green: 0.6, blue: 0.2, alpha: 1),   // width — orange
    ]
    let color = colors[min(dotNodes.count, 2)]

    let sphere = SCNSphere(radius: 0.005)
    sphere.firstMaterial?.diffuse.contents = color

    let node = SCNNode(geometry: sphere)
    node.position = SCNVector3(position.x, position.y, position.z)
    sceneView.scene.rootNode.addChildNode(node)
    dotNodes.append(node)

    // Draw line between dots
    if dotNodes.count == 2, let topNode = dotNodes.first {
      drawLine(from: topNode.position, to: node.position, color: colors[0])
    }
  }

  private func drawLine(from start: SCNVector3, to end: SCNVector3, color: UIColor) {
    let indices: [Int32] = [0, 1]
    let source = SCNGeometrySource(vertices: [start, end])
    let element = SCNGeometryElement(indices: indices, primitiveType: .line)
    let geometry = SCNGeometry(sources: [source], elements: [element])
    geometry.firstMaterial?.diffuse.contents = color
    geometry.firstMaterial?.isDoubleSided = true
    let node = SCNNode(geometry: geometry)
    sceneView.scene.rootNode.addChildNode(node)
  }

  // MARK: - Compute measurements from 3 world points
  private func computeAndReturn() {
    guard let top = pointTop, let bottom = pointBottom, let width = pointWidth else {
      onError?("Missing measurement points")
      return
    }

    // Height: vertical distance between top and bottom points (meters → mm)
    let heightM = abs(top.y - bottom.y)
    let heightMM = heightM * 1000

    // Diameter: horizontal distance from center to width point × 2
    // Center X is average of top and bottom X
    let centerX = (top.x + bottom.x) / 2
    let centerZ = (top.x + bottom.z) / 2  // use Z for horizontal plane
    let radiusM = sqrt(pow(width.x - centerX, 2) + pow(width.z - centerZ, 2))
    let diameterMM = radiusM * 1000 * 2

    // Volume: cylinder approximation (v1 — frustum in v2 when we have top/bottom diameters)
    // V = π × r² × h  (in ml, since 1 ml = 1 cm³)
    let radiusCM = Double(radiusM) * 100
    let heightCM = Double(heightM) * 100
    let volumeML = Double.pi * radiusCM * radiusCM * heightCM

    let result: [String: Any] = [
      "height_mm": Int(heightMM.rounded()),
      "diameter_mm": Int(diameterMM.rounded()),
      "volume_ml": Int(volumeML.rounded()),
      "confidence": computeConfidence(heightMM: heightMM, diameterMM: diameterMM)
    ]

    DispatchQueue.main.asyncAfter(deadline: .now() + 0.5) {
      self.onMeasurementComplete?(result)
    }
  }

  // Confidence score based on sanity checks on the measurements
  private func computeConfidence(heightMM: Float, diameterMM: Float) -> String {
    let isReasonableHeight = heightMM > 40 && heightMM < 350
    let isReasonableDiameter = diameterMM > 40 && diameterMM < 200
    let aspectRatioOK = (heightMM / diameterMM) > 0.5 && (heightMM / diameterMM) < 6.0

    if isReasonableHeight && isReasonableDiameter && aspectRatioOK { return "high" }
    if isReasonableHeight || isReasonableDiameter { return "medium" }
    return "low"
  }

  // MARK: - Helpers
  private func showToast(_ message: String) {
    let toast = UILabel()
    toast.text = message
    toast.textColor = .white
    toast.backgroundColor = UIColor.black.withAlphaComponent(0.75)
    toast.font = .systemFont(ofSize: 13)
    toast.textAlignment = .center
    toast.layer.cornerRadius = 10
    toast.clipsToBounds = true
    toast.translatesAutoresizingMaskIntoConstraints = false
    view.addSubview(toast)

    NSLayoutConstraint.activate([
      toast.centerXAnchor.constraint(equalTo: view.centerXAnchor),
      toast.bottomAnchor.constraint(equalTo: view.safeAreaLayoutGuide.bottomAnchor, constant: -100),
      toast.widthAnchor.constraint(lessThanOrEqualToConstant: 280),
      toast.heightAnchor.constraint(equalToConstant: 36),
    ])
    toast.layoutIfNeeded()

    UIView.animate(withDuration: 0.2, delay: 2.0, options: [], animations: {
      toast.alpha = 0
    }) { _ in toast.removeFromSuperview() }
  }

  @objc private func readyTapped() {
    enterMeasureMode()
  }

  @objc private func closeTapped() {
    dismiss(animated: true)
  }
}
