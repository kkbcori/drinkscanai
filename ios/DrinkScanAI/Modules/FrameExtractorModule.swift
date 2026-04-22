/**
 * FrameExtractorModule.swift
 * DrinkScanAI
 *
 * Extracts the best frame from a recorded video and returns:
 * 1. The frame as a file path (for display / debugging)
 * 2. Raw pixel data as a flat array (for ONNX inference)
 *
 * Uses AVFoundation — 100% on-device, no network calls.
 * The "best" frame is picked by sharpness (Laplacian variance)
 * from 5 evenly-spaced frames across the video.
 */

import Foundation
import AVFoundation
import UIKit
import CoreImage
import React

@objc(FrameExtractorModule)
class FrameExtractorModule: NSObject, RCTBridgeModule {

  static func moduleName() -> String! { "FrameExtractorModule" }
  static func requiresMainQueueSetup() -> Bool { false }

  // ── Extract best frame path ─────────────────────────────────────────────

  @objc func extractBestFrame(
    _ videoPath: String,
    resolver resolve: @escaping RCTPromiseResolveBlock,
    rejecter reject: @escaping RCTPromiseRejectBlock
  ) {
    DispatchQueue.global(qos: .userInitiated).async {
      guard let frame = self.getBestFrame(from: videoPath) else {
        reject("EXTRACT_ERROR", "Could not extract frame from video", nil)
        return
      }

      // Save frame to temp file
      let tempPath = NSTemporaryDirectory() + "drinkscan_frame_\(Int(Date().timeIntervalSince1970)).jpg"
      guard let jpegData = frame.jpegData(compressionQuality: 0.92) else {
        reject("JPEG_ERROR", "Could not encode frame to JPEG", nil)
        return
      }

      do {
        try jpegData.write(to: URL(fileURLWithPath: tempPath))
        resolve(tempPath)
      } catch {
        reject("WRITE_ERROR", error.localizedDescription, error)
      }
    }
  }

  // ── Get pixel data for ONNX inference ──────────────────────────────────

  @objc func getPixelData(
    _ imagePath: String,
    width: Int,
    height: Int,
    resolver resolve: @escaping RCTPromiseResolveBlock,
    rejecter reject: @escaping RCTPromiseRejectBlock
  ) {
    DispatchQueue.global(qos: .userInitiated).async {
      guard let image = UIImage(contentsOfFile: imagePath),
            let pixelData = self.extractPixelData(from: image, targetWidth: width, targetHeight: height)
      else {
        reject("PIXEL_ERROR", "Could not extract pixel data", nil)
        return
      }
      resolve(pixelData)
    }
  }

  // ── Private: best frame selection ──────────────────────────────────────

  private func getBestFrame(from videoPath: String) -> UIImage? {
    let asset = AVAsset(url: URL(fileURLWithPath: videoPath))
    let generator = AVAssetImageGenerator(asset: asset)
    generator.appliesPreferredTrackTransform = true
    generator.maximumSize = CGSize(width: 640, height: 640)

    let duration = CMTimeGetSeconds(asset.duration)
    guard duration > 0 else { return nil }

    // Sample 7 evenly-spaced frames
    let sampleCount = 7
    var bestFrame: UIImage?
    var bestSharpness: Double = -1

    for i in 0..<sampleCount {
      let t = duration * Double(i + 1) / Double(sampleCount + 1)
      let cmTime = CMTimeMakeWithSeconds(t, preferredTimescale: 600)

      guard let cgImage = try? generator.copyCGImage(at: cmTime, actualTime: nil) else { continue }
      let frame = UIImage(cgImage: cgImage)

      let sharpness = laplacianVariance(of: cgImage)
      if sharpness > bestSharpness {
        bestSharpness = sharpness
        bestFrame = frame
      }
    }

    return bestFrame
  }

  // ── Sharpness metric (Laplacian variance) ──────────────────────────────

  private func laplacianVariance(of cgImage: CGImage) -> Double {
    let ciImage = CIImage(cgImage: cgImage)
    let filter = CIFilter(name: "CIConvolution3X3")!
    // Laplacian kernel for edge detection (measures sharpness)
    filter.setValue(ciImage, forKey: kCIInputImageKey)
    filter.setValue(CIVector(values: [0, -1, 0, -1, 4, -1, 0, -1, 0], count: 9),
                   forKey: "inputWeights")
    filter.setValue(0.0, forKey: "inputBias")

    guard let outputImage = filter.outputImage else { return 0 }

    let context = CIContext()
    var bitmap = [UInt8](repeating: 0, count: 4)
    context.render(outputImage,
                   toBitmap: &bitmap,
                   rowBytes: 4,
                   bounds: CGRect(x: 0, y: 0, width: 1, height: 1),
                   format: .RGBA8,
                   colorSpace: CGColorSpaceCreateDeviceRGB())

    return Double(bitmap[0])
  }

  // ── Pixel extraction for ONNX ──────────────────────────────────────────

  private func extractPixelData(
    from image: UIImage,
    targetWidth: Int,
    targetHeight: Int
  ) -> [Float]? {
    // Resize to target dimensions
    let size = CGSize(width: targetWidth, height: targetHeight)
    UIGraphicsBeginImageContextWithOptions(size, false, 1.0)
    image.draw(in: CGRect(origin: .zero, size: size))
    let resized = UIGraphicsGetImageFromCurrentImageContext()
    UIGraphicsEndImageContext()

    guard let cgImage = resized?.cgImage else { return nil }

    let bytesPerPixel = 4
    let bytesPerRow = targetWidth * bytesPerPixel
    var rawData = [UInt8](repeating: 0, count: targetHeight * bytesPerRow)

    guard let context = CGContext(
      data: &rawData,
      width: targetWidth,
      height: targetHeight,
      bitsPerComponent: 8,
      bytesPerRow: bytesPerRow,
      space: CGColorSpaceCreateDeviceRGB(),
      bitmapInfo: CGImageAlphaInfo.premultipliedLast.rawValue
    ) else { return nil }

    context.draw(cgImage, in: CGRect(x: 0, y: 0, width: targetWidth, height: targetHeight))

    // Convert to HWC float array [R,G,B, R,G,B, ...] in 0-255 range
    // The JS side handles normalization
    var pixels = [Float]()
    pixels.reserveCapacity(targetWidth * targetHeight * 3)

    for i in 0..<(targetWidth * targetHeight) {
      let base = i * bytesPerPixel
      pixels.append(Float(rawData[base]))     // R
      pixels.append(Float(rawData[base + 1])) // G
      pixels.append(Float(rawData[base + 2])) // B
    }

    return pixels
  }
}
