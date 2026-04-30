import Foundation
import CoreML
import Vision
import UIKit

// Self-contained React Native module — no bridging header needed
// Uses @objc and NSObject directly

@objc(DrinkClassifierModule)
class DrinkClassifierModule: NSObject {

  private var vnModel: VNCoreMLModel?
  private var classNames: [String] = []
  private var isLoaded = false
  private var loadError: String?

  @objc static func requiresMainQueueSetup() -> Bool { return false }

  // ── Load model ───────────────────────────────────────────────────────────

  private func loadModel() {
    guard !isLoaded else { return }

    // Try .mlmodelc first (compiled), then .mlpackage
    let modelName = "DrinkClassifier"
    guard let modelURL = Bundle.main.url(forResource: modelName, withExtension: "mlmodelc")
                      ?? Bundle.main.url(forResource: modelName, withExtension: "mlpackage") else {
      loadError = "Model file '\(modelName).mlmodelc' not found in bundle. Files in bundle: \(bundleMLFiles())"
      NSLog("[DrinkClassifier] ERROR: %@", loadError!)
      return
    }

    NSLog("[DrinkClassifier] Found model at: %@", modelURL.path)

    do {
      let config = MLModelConfiguration()
      config.computeUnits = .all
      let mlModel = try MLModel(contentsOf: modelURL, configuration: config)
      vnModel = try VNCoreMLModel(for: mlModel)

      // Load class names from metadata
      if let classesJSON = mlModel.modelDescription.metadata[MLModelMetadataKey(rawValue: "classes")] as? String,
         let data = classesJSON.data(using: .utf8),
         let arr = try? JSONSerialization.jsonObject(with: data) as? [[String: Any]] {
        classNames = arr.sorted { ($0["index"] as? Int ?? 0) < ($1["index"] as? Int ?? 0) }
                       .compactMap { $0["name"] as? String }
        NSLog("[DrinkClassifier] Loaded %d class names from metadata", classNames.count)
      }

      // Fallback: load from drink_classes.json
      if classNames.isEmpty,
         let jsonURL = Bundle.main.url(forResource: "drink_classes", withExtension: "json"),
         let data = try? Data(contentsOf: jsonURL),
         let json = try? JSONSerialization.jsonObject(with: data) as? [String: Any],
         let classes = json["classes"] as? [[String: Any]] {
        classNames = classes.sorted { ($0["index"] as? Int ?? 0) < ($1["index"] as? Int ?? 0) }
                            .compactMap { $0["name"] as? String }
        NSLog("[DrinkClassifier] Loaded %d class names from drink_classes.json", classNames.count)
      }

      isLoaded = true
      NSLog("[DrinkClassifier] Model loaded successfully with %d classes", classNames.count)
    } catch {
      loadError = "Failed to load model: \(error.localizedDescription)"
      NSLog("[DrinkClassifier] ERROR: %@", loadError!)
    }
  }

  private func bundleMLFiles() -> String {
    let fm = FileManager.default
    guard let resourcePath = Bundle.main.resourcePath else { return "no resourcePath" }
    let files = (try? fm.contentsOfDirectory(atPath: resourcePath)) ?? []
    return files.filter { $0.contains("ml") || $0.contains("ML") || $0.contains("Drink") }.joined(separator: ", ")
  }

  // ── Preload ───────────────────────────────────────────────────────────────

  @objc func preloadModel(_ resolve: @escaping RCTPromiseResolveBlock,
                           rejecter reject: @escaping RCTPromiseRejectBlock) {
    DispatchQueue.global(qos: .background).async {
      self.loadModel()
      if self.isLoaded {
        resolve(["loaded": true, "classes": self.classNames.count])
      } else {
        resolve(["loaded": false, "error": self.loadError ?? "unknown"])
      }
    }
  }

  // ── Classify ──────────────────────────────────────────────────────────────

  @objc func classifyImage(_ imagePath: String,
                            topK: NSNumber,
                            resolver resolve: @escaping RCTPromiseResolveBlock,
                            rejecter reject: @escaping RCTPromiseRejectBlock) {
    DispatchQueue.global(qos: .userInitiated).async {
      self.loadModel()

      guard self.isLoaded, let vnModel = self.vnModel else {
        reject("MODEL_ERROR", self.loadError ?? "Model not loaded", nil)
        return
      }

      guard let image = UIImage(contentsOfFile: imagePath),
            let cgImage = image.cgImage else {
        reject("IMAGE_ERROR", "Cannot load image: \(imagePath)", nil)
        return
      }

      var output: [[String: Any]] = []
      let semaphore = DispatchSemaphore(value: 0)

      let request = VNCoreMLRequest(model: vnModel) { req, err in
        defer { semaphore.signal() }
        guard let obs = req.results as? [VNCoreMLFeatureValueObservation],
              let arr = obs.first?.featureValue.multiArrayValue else { return }

        var logits = [Float]()
        for i in 0..<arr.count { logits.append(arr[i].floatValue) }

        let maxL = logits.max() ?? 0
        let exps = logits.map { exp($0 - maxL) }
        let sum  = exps.reduce(0, +)
        let probs = exps.map { $0 / sum }

        let k = min(topK.intValue, probs.count)
        let sorted = probs.enumerated().sorted { $0.element > $1.element }.prefix(k)
        output = sorted.map { (idx, prob) in
          let name = idx < self.classNames.count ? self.classNames[idx] : "unknown_\(idx)"
          return ["classIndex": idx, "className": name, "probability": Double(prob)]
        }
      }

      request.imageCropAndScaleOption = .centerCrop
      try? VNImageRequestHandler(cgImage: cgImage, options: [:]).perform([request])
      semaphore.wait()
      resolve(output)
    }
  }
}
