import Foundation
import ARKit

// MARK: - ARScanModule
// React Native native module that bridges to ARKit.
// Presents ARScanViewController modally and returns measurements.

@objc(ARScanModule)
class ARScanModule: RCTEventEmitter {

  private var scanViewController: ARScanViewController?
  private var scanResolver: RCTPromiseResolveBlock?
  private var scanRejecter: RCTPromiseRejectBlock?
  private var measureResolver: RCTPromiseResolveBlock?

  // MARK: - RCTEventEmitter required override
  override func supportedEvents() -> [String]! {
    return [
      "onScanProgress",   // fired as user scans — sends % coverage
      "onScanReady",      // fired when enough world map built
      "onMeasurement",    // fired with final measurements
      "onScanError"       // fired on any error
    ]
  }

  override static func requiresMainQueueSetup() -> Bool {
    return true
  }

  // MARK: - Start scan
  // Presents the AR camera view. Resolves when the view is visible.
  @objc func startScan(
    _ resolve: @escaping RCTPromiseResolveBlock,
    rejecter reject: @escaping RCTPromiseRejectBlock
  ) {
    guard ARWorldTrackingConfiguration.isSupported else {
      reject("AR_UNSUPPORTED", "ARKit is not supported on this device", nil)
      return
    }

    DispatchQueue.main.async {
      let vc = ARScanViewController()

      // Wire up callbacks
      vc.onProgressUpdate = { [weak self] progress in
        self?.sendEvent(withName: "onScanProgress", body: ["progress": progress])
      }
      vc.onScanReady = { [weak self] in
        self?.sendEvent(withName: "onScanReady", body: [:])
      }
      vc.onMeasurementComplete = { [weak self] result in
        self?.sendEvent(withName: "onMeasurement", body: result)
        self?.measureResolver?(result)
        self?.measureResolver = nil
      }
      vc.onError = { [weak self] message in
        self?.sendEvent(withName: "onScanError", body: ["message": message])
        self?.scanRejecter?("SCAN_ERROR", message, nil)
        self?.scanRejecter = nil
      }

      // Present from root view controller
      if let rootVC = UIApplication.shared.keyWindow?.rootViewController {
        vc.modalPresentationStyle = .fullScreen
        rootVC.present(vc, animated: true) {
          resolve(["status": "scanning"])
        }
      } else {
        reject("NO_ROOT_VC", "Could not find root view controller", nil)
      }

      self.scanViewController = vc
      self.scanRejecter = reject
    }
  }

  // MARK: - Begin measuring
  // Switches VC from scan mode to tap-to-measure mode.
  // Resolves with {height_mm, diameter_top_mm, diameter_bottom_mm, volume_ml}
  // after the user has placed 3 measurement taps.
  @objc func beginMeasuring(
    _ resolve: @escaping RCTPromiseResolveBlock,
    rejecter reject: @escaping RCTPromiseRejectBlock
  ) {
    measureResolver = resolve
    DispatchQueue.main.async {
      self.scanViewController?.enterMeasureMode()
    }
  }

  // MARK: - Dismiss
  @objc func dismissScan() {
    DispatchQueue.main.async {
      self.scanViewController?.dismiss(animated: true)
      self.scanViewController = nil
      self.measureResolver = nil
    }
  }
}
