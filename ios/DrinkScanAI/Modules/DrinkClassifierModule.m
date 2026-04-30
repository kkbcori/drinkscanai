#import <React/RCTBridgeModule.h>

@interface RCT_EXTERN_MODULE(DrinkClassifierModule, NSObject)

RCT_EXTERN_METHOD(preloadModel:(RCTPromiseResolveBlock)resolve
                  rejecter:(RCTPromiseRejectBlock)reject)

RCT_EXTERN_METHOD(classifyImage:(NSString *)imagePath
                  topK:(nonnull NSNumber *)topK
                  resolver:(RCTPromiseResolveBlock)resolve
                  rejecter:(RCTPromiseRejectBlock)reject)

@end
