#import <React/RCTBridgeModule.h>
#import <React/RCTEventEmitter.h>

@interface RCT_EXTERN_MODULE(ARScanModule, RCTEventEmitter)

// Start the AR scan session — presents the AR view controller
RCT_EXTERN_METHOD(startScan:(RCTPromiseResolveBlock)resolve
                  rejecter:(RCTPromiseRejectBlock)reject)

// Called after scanning phase — enters the tap-to-measure phase
RCT_EXTERN_METHOD(beginMeasuring:(RCTPromiseResolveBlock)resolve
                  rejecter:(RCTPromiseRejectBlock)reject)

// Dismiss the AR view and clean up session
RCT_EXTERN_METHOD(dismissScan)

@end
