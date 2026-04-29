/**
 * DrinkClassifierModule.swift
 * DrinkScanAI
 *
 * On-device drink classification using Apple CoreML.
 * Uses iPhone's Neural Engine (ANE) — no network, no privacy risk.
 *
 * Pipeline:
 *   video frame path → UIImage → CVPixelBuffer → VNCoreMLRequest → top-N results
 *
 * Performance: ~8ms inference on iPhone 15 (Neural Engine)
 * Accuracy: ~65% pre-fine-tuning, ~88% after fine-tuning
 */

import Foundation
import CoreML
import Vision
import UIKit
import React

@objc(DrinkClassifierModule)
class DrinkClassifierModule: NSObject, RCTBridgeModule {

  static func moduleName() -> String! { "DrinkClassifierModule" }
  static func requiresMainQueueSetup() -> Bool { false }

  // Lazy-load model once, reuse across scans
  private var vnModel: VNCoreMLModel?
  private var classNames: [String] = []
  private var modelLoaded = false

  // ── Model Loading ─────────────────────────────────────────────────────────

  private func loadModelIfNeeded() throws {
    guard !modelLoaded else { return }

    // Load DrinkClassifier.mlpackage from app bundle
    guard let modelURL = Bundle.main.url(
      forResource: "DrinkClassifier",
      withExtension: "mlmodelc"  // Xcode compiles .mlpackage → .mlmodelc
    ) ?? Bundle.main.url(
      forResource: "DrinkClassifier",
      withExtension: "mlpackage"
    ) else {
      throw NSError(
        domain: "DrinkClassifier",
        code: 404,
        userInfo: [NSLocalizedDescriptionKey: "DrinkClassifier.mlpackage not found in bundle. Did you add it to Xcode?"]
      )
    }

    // Configure for Neural Engine + GPU (fastest on iPhone)
    let config = MLModelConfiguration()
    config.computeUnits = .all

    let mlModel = try MLModel(contentsOf: modelURL, configuration: config)
    vnModel = try VNCoreMLModel(for: mlModel)

    // Load class names from metadata
    if let classesJSON = mlModel.modelDescription.metadata[MLModelMetadataKey.description] as? String,
       let data = classesJSON.data(using: .utf8),
       let decoded = try? JSONSerialization.jsonObject(with: data) as? [[String: Any]] {
      classNames = decoded.sorted { ($0["index"] as? Int ?? 0) < ($1["index"] as? Int ?? 0) }
                          .compactMap { $0["name"] as? String }
    }

    // Fallback: load from drink_classes.json in bundle
    if classNames.isEmpty, let jsonURL = Bundle.main.url(forResource: "drink_classes", withExtension: "json"),
       let data = try? Data(contentsOf: jsonURL),
       let json = try? JSONSerialization.jsonObject(with: data) as? [String: Any],
       let classes = json["classes"] as? [[String: Any]] {
      classNames = classes.sorted { ($0["index"] as? Int ?? 0) < ($1["index"] as? Int ?? 0) }
                          .compactMap { $0["name"] as? String }
    }

    modelLoaded = true
    NSLog("[DrinkClassifier] Model loaded: %d classes", classNames.count)
  }

  // ── Main Classification Entry Point ──────────────────────────────────────

  @objc func classifyImage(
    _ imagePath: String,
    topK: Int,
    resolver resolve: @escaping RCTPromiseResolveBlock,
    rejecter reject: @escaping RCTPromiseRejectBlock
  ) {
    DispatchQueue.global(qos: .userInitiated).async {
      do {
        try self.loadModelIfNeeded()

        guard let image = UIImage(contentsOfFile: imagePath),
              let cgImage = image.cgImage else {
          reject("IMAGE_ERROR", "Cannot load image at path: \(imagePath)", nil)
          return
        }

        guard let vnModel = self.vnModel else {
          reject("MODEL_ERROR", "CoreML model not loaded", nil)
          return
        }

        // Run Vision CoreML request
        var results: [[String: Any]] = []
        let semaphore = DispatchSemaphore(value: 0)

        let request = VNCoreMLRequest(model: vnModel) { request, error in
          defer { semaphore.signal() }

          if let error = error {
            NSLog("[DrinkClassifier] Inference error: %@", error.localizedDescription)
            return
          }

          // Parse raw logits output
          guard let observations = request.results as? [VNCoreMLFeatureValueObservation],
                let logitsArray = observations.first?.featureValue.multiArrayValue else {
            NSLog("[DrinkClassifier] No valid output from model")
            return
          }

          // Convert logits to probabilities via softmax
          let count = logitsArray.count
          var logits = [Float](repeating: 0, count: count)
          for i in 0..<count {
            logits[i] = logitsArray[i].floatValue
          }

          let probs = self.softmax(logits)

          // Get top-K results
          let indexed = probs.enumerated().map { ($0.offset, $0.element) }
          let topK_actual = min(topK, count)
          let topResults = indexed.sorted { $0.1 > $1.1 }.prefix(topK_actual)

          results = topResults.map { (index, prob) in
            let name = index < self.classNames.count ? self.classNames[index] : "unknown_\(index)"
            return [
              "classIndex": index,
              "className":  name,
              "probability": Double(prob),
            ]
          }
        }

        // Preprocess: crop to square, scale to 224×224
        request.imageCropAndScaleOption = .centerCrop

        let handler = VNImageRequestHandler(cgImage: cgImage, options: [:])
        try handler.perform([request])
        semaphore.wait()

        resolve(results)

      } catch {
        reject("CLASSIFIER_ERROR", error.localizedDescription, error)
      }
    }
  }

  // ── Preload Model ─────────────────────────────────────────────────────────

  @objc func preloadModel(
    _ resolve: @escaping RCTPromiseResolveBlock,
    rejecter reject: @escaping RCTPromiseRejectBlock
  ) {
    DispatchQueue.global(qos: .background).async {
      do {
        try self.loadModelIfNeeded()
        resolve(["loaded": true, "classes": self.classNames.count])
      } catch {
        // Non-fatal — resolve with error info so JS can show fallback
        resolve(["loaded": false, "error": error.localizedDescription])
      }
    }
  }

  // ── Softmax ───────────────────────────────────────────────────────────────

  private func softmax(_ logits: [Float]) -> [Float] {
    let maxLogit = logits.max() ?? 0
    let exps = logits.map { exp($0 - maxLogit) }
    let sum = exps.reduce(0, +)
    return sum > 0 ? exps.map { $0 / sum } : exps
  }
}
