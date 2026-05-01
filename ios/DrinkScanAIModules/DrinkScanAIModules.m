/**
 * DrinkScanAIModules.m  — updated for photo-based scanning
 * VolumeEstimatorModule now accepts a photo path directly
 */

#import <React/RCTBridgeModule.h>
#import <CoreML/CoreML.h>
#import <Vision/Vision.h>
#import <AVFoundation/AVFoundation.h>
#import <UIKit/UIKit.h>

// ═══════════════════════════════════════════════════════════════
// MARK: - DrinkClassifierModule (unchanged)
// ═══════════════════════════════════════════════════════════════

@interface DrinkClassifierModule : NSObject <RCTBridgeModule>
@property (nonatomic, strong) VNCoreMLModel *vnModel;
@property (nonatomic, strong) NSArray<NSString *> *classNames;
@property (nonatomic, assign) BOOL isLoaded;
@property (nonatomic, copy)   NSString *loadError;
@end

@implementation DrinkClassifierModule

RCT_EXPORT_MODULE()
+ (BOOL)requiresMainQueueSetup { return NO; }

- (void)loadModelIfNeeded {
  if (self.isLoaded) return;
  NSURL *modelURL = [[NSBundle mainBundle] URLForResource:@"DrinkClassifier" withExtension:@"mlmodelc"]
                 ?: [[NSBundle mainBundle] URLForResource:@"DrinkClassifier" withExtension:@"mlpackage"];
  if (!modelURL) {
    NSArray *files = [[NSFileManager defaultManager] contentsOfDirectoryAtPath:[[NSBundle mainBundle] resourcePath] error:nil];
    NSPredicate *p = [NSPredicate predicateWithFormat:@"self CONTAINS[c] 'ml' OR self CONTAINS[c] 'Drink'"];
    self.loadError = [NSString stringWithFormat:@"Model not found. ML files: %@", [files filteredArrayUsingPredicate:p]];
    NSLog(@"[DrinkClassifier] %@", self.loadError);
    return;
  }
  NSLog(@"[DrinkClassifier] Found model: %@", modelURL.path);
  NSError *err;
  MLModelConfiguration *cfg = [[MLModelConfiguration alloc] init];
  cfg.computeUnits = MLComputeUnitsAll;

  // Compile .mlpackage at runtime if needed
  NSURL *compiledURL = modelURL;
  if ([modelURL.pathExtension isEqualToString:@"mlpackage"]) {
    compiledURL = [MLModel compileModelAtURL:modelURL error:&err];
    if (!compiledURL) {
      self.loadError = [NSString stringWithFormat:@"Compile failed: %@", err.localizedDescription];
      NSLog(@"[DrinkClassifier] %@", self.loadError);
      return;
    }
  }

  MLModel *ml = [MLModel modelWithContentsOfURL:compiledURL configuration:cfg error:&err];
  if (!ml) { self.loadError = err.localizedDescription; return; }
  self.vnModel = [VNCoreMLModel modelForMLModel:ml error:&err];
  if (!self.vnModel) { self.loadError = err.localizedDescription; return; }

  NSURL *jsonURL = [[NSBundle mainBundle] URLForResource:@"drink_classes" withExtension:@"json"];
  if (jsonURL) {
    NSData *data = [NSData dataWithContentsOfURL:jsonURL];
    NSDictionary *json = [NSJSONSerialization JSONObjectWithData:data options:0 error:nil];
    NSArray *sorted = [json[@"classes"] sortedArrayUsingComparator:^NSComparisonResult(NSDictionary *a, NSDictionary *b) {
      return [a[@"index"] compare:b[@"index"]];
    }];
    NSMutableArray *names = [NSMutableArray array];
    for (NSDictionary *c in sorted) [names addObject:c[@"name"] ?: @"unknown"];
    self.classNames = [names copy];
  }
  self.isLoaded = YES;
  NSLog(@"[DrinkClassifier] Ready with %lu classes", (unsigned long)self.classNames.count);
}

- (NSArray *)softmax:(MLMultiArray *)arr {
  NSInteger n = arr.count;
  float maxV = -INFINITY;
  for (NSInteger i = 0; i < n; i++) { float v = arr[i].floatValue; if (v > maxV) maxV = v; }
  float sum = 0;
  NSMutableArray *exps = [NSMutableArray arrayWithCapacity:n];
  for (NSInteger i = 0; i < n; i++) { float e = expf(arr[i].floatValue - maxV); [exps addObject:@(e)]; sum += e; }
  NSMutableArray *probs = [NSMutableArray arrayWithCapacity:n];
  for (NSNumber *e in exps) [probs addObject:@(e.floatValue / sum)];
  return probs;
}

RCT_EXPORT_METHOD(preloadModel:(RCTPromiseResolveBlock)resolve rejecter:(RCTPromiseRejectBlock)reject) {
  dispatch_async(dispatch_get_global_queue(QOS_CLASS_BACKGROUND, 0), ^{
    [self loadModelIfNeeded];
    resolve(self.isLoaded
      ? @{@"loaded": @YES, @"classes": @(self.classNames.count)}
      : @{@"loaded": @NO,  @"error":   self.loadError ?: @"unknown"});
  });
}

RCT_EXPORT_METHOD(classifyImage:(NSString *)path topK:(nonnull NSNumber *)k
                  resolver:(RCTPromiseResolveBlock)resolve rejecter:(RCTPromiseRejectBlock)reject) {
  dispatch_async(dispatch_get_global_queue(QOS_CLASS_USER_INITIATED, 0), ^{
    [self loadModelIfNeeded];
    if (!self.isLoaded) { reject(@"ERR", self.loadError, nil); return; }

    // Handle file:// prefix
    NSString *filePath = path;
    if ([path hasPrefix:@"file://"]) {
      filePath = [path stringByReplacingOccurrencesOfString:@"file://" withString:@""];
    }

    UIImage *img = [UIImage imageWithContentsOfFile:filePath];
    if (!img || !img.CGImage) {
      reject(@"IMAGE_ERROR", [NSString stringWithFormat:@"Cannot load image: %@", filePath], nil);
      return;
    }

    __block NSMutableArray *out = [NSMutableArray array];
    dispatch_semaphore_t sem = dispatch_semaphore_create(0);

    VNCoreMLRequest *req = [[VNCoreMLRequest alloc] initWithModel:self.vnModel completionHandler:^(VNRequest *r, NSError *e) {
      VNCoreMLFeatureValueObservation *obs = r.results.firstObject;
      NSArray *probs = [self softmax:obs.featureValue.multiArrayValue];
      NSMutableArray *idx = [NSMutableArray array];
      for (NSInteger i = 0; i < (NSInteger)probs.count; i++) [idx addObject:@[@(i), probs[i]]];
      [idx sortUsingComparator:^NSComparisonResult(NSArray *a, NSArray *b){ return [b[1] compare:a[1]]; }];
      NSInteger top = MIN(k.integerValue, (NSInteger)idx.count);
      for (NSInteger i = 0; i < top; i++) {
        NSInteger ci = [idx[i][0] integerValue];
        NSString *name = ci < (NSInteger)self.classNames.count ? self.classNames[ci] : @"unknown";
        [out addObject:@{@"classIndex":@(ci), @"className":name, @"probability":idx[i][1]}];
      }
      dispatch_semaphore_signal(sem);
    }];
    req.imageCropAndScaleOption = VNImageCropAndScaleOptionCenterCrop;
    [[[VNImageRequestHandler alloc] initWithCGImage:img.CGImage options:@{}] performRequests:@[req] error:nil];
    dispatch_semaphore_wait(sem, DISPATCH_TIME_FOREVER);
    resolve(out);
  });
}
@end

// ═══════════════════════════════════════════════════════════════
// MARK: - FrameExtractorModule (kept for backward compat)
// ═══════════════════════════════════════════════════════════════

@interface FrameExtractorModule : NSObject <RCTBridgeModule>
@end
@implementation FrameExtractorModule
RCT_EXPORT_MODULE()
+ (BOOL)requiresMainQueueSetup { return NO; }

RCT_EXPORT_METHOD(extractBestFrame:(NSString *)videoPath
                  resolver:(RCTPromiseResolveBlock)resolve
                  rejecter:(RCTPromiseRejectBlock)reject) {
  // No longer needed — photo mode returns path directly
  // Return the path as-is if it looks like a photo
  if ([videoPath hasSuffix:@".jpg"] || [videoPath hasSuffix:@".jpeg"] || [videoPath hasSuffix:@".png"]) {
    resolve(videoPath);
    return;
  }
  // Legacy video extraction
  dispatch_async(dispatch_get_global_queue(QOS_CLASS_USER_INITIATED, 0), ^{
    AVAsset *asset = [AVAsset assetWithURL:[NSURL fileURLWithPath:videoPath]];
    AVAssetImageGenerator *gen = [[AVAssetImageGenerator alloc] initWithAsset:asset];
    gen.appliesPreferredTrackTransform = YES;
    gen.maximumSize = CGSizeMake(640, 640);
    Float64 dur = CMTimeGetSeconds(asset.duration);
    if (dur <= 0) { reject(@"ERR", @"Invalid video", nil); return; }
    CMTime t = CMTimeMakeWithSeconds(dur * 0.5, 600);
    CGImageRef cg = [gen copyCGImageAtTime:t actualTime:nil error:nil];
    if (!cg) { reject(@"ERR", @"No frame", nil); return; }
    UIImage *frame = [UIImage imageWithCGImage:cg];
    CGImageRelease(cg);
    NSString *p = [NSTemporaryDirectory() stringByAppendingPathComponent:[NSString stringWithFormat:@"frame_%lld.jpg", (long long)[[NSDate date] timeIntervalSince1970]*1000]];
    [UIImageJPEGRepresentation(frame, 0.92) writeToFile:p atomically:YES];
    resolve(p);
  });
}

RCT_EXPORT_METHOD(getPixelData:(NSString *)imagePath width:(nonnull NSNumber *)w height:(nonnull NSNumber *)h
                  resolver:(RCTPromiseResolveBlock)resolve rejecter:(RCTPromiseRejectBlock)reject) {
  resolve(@[]);
}
@end

// ═══════════════════════════════════════════════════════════════
// MARK: - VolumeEstimatorModule — photo-based
// ═══════════════════════════════════════════════════════════════

@interface VolumeEstimatorModule : NSObject <RCTBridgeModule>
@end
@implementation VolumeEstimatorModule
RCT_EXPORT_MODULE()
+ (BOOL)requiresMainQueueSetup { return NO; }

- (NSDictionary *)estimateFromImage:(UIImage *)image {
  CGImageRef cgImg = image.CGImage;
  VNDetectRectanglesRequest *req = [[VNDetectRectanglesRequest alloc] init];
  req.minimumAspectRatio = 0.1; req.maximumAspectRatio = 2.5;
  req.minimumSize = 0.1; req.maximumObservations = 5; req.minimumConfidence = 0.3;
  [[[VNImageRequestHandler alloc] initWithCGImage:cgImg options:@{}] performRequests:@[req] error:nil];

  VNRectangleObservation *best = nil;
  for (VNRectangleObservation *r in req.results)
    if (!best || r.confidence > best.confidence) best = r;

  if (!best) return [self fallback:@"no_rect"];

  double w = best.boundingBox.size.width;
  double h = best.boundingBox.size.height;
  double ar = h > 0 ? w/h : 1.0;
  int vol = [self volumeFor:ar];

  // Fill level from luminance
  int fill = [self fillLevel:cgImg bounds:best.boundingBox];
  int liquid = (int)(vol * fill / 100.0);

  return @{@"success":@YES, @"totalVolumeMl":@(vol),
           @"fillLevelPct":@(fill), @"liquidVolumeMl":@(liquid),
           @"method":@"vision_photo"};
}

// Accept photo path directly
RCT_EXPORT_METHOD(estimateVolumeFromPhoto:(NSString *)photoPath
                  resolver:(RCTPromiseResolveBlock)resolve
                  rejecter:(RCTPromiseRejectBlock)reject) {
  dispatch_async(dispatch_get_global_queue(QOS_CLASS_USER_INITIATED, 0), ^{
    NSString *filePath = [photoPath hasPrefix:@"file://"]
      ? [photoPath stringByReplacingOccurrencesOfString:@"file://" withString:@""]
      : photoPath;
    UIImage *img = [UIImage imageWithContentsOfFile:filePath];
    if (!img) { resolve([self fallback:@"no_image"]); return; }
    resolve([self estimateFromImage:img]);
  });
}

// Also keep old method name for compat
RCT_EXPORT_METHOD(estimateVolume:(NSString *)path
                  resolver:(RCTPromiseResolveBlock)resolve
                  rejecter:(RCTPromiseRejectBlock)reject) {
  [self estimateVolumeFromPhoto:path resolver:resolve rejecter:reject];
}

- (int)fillLevel:(CGImageRef)cg bounds:(CGRect)bounds {
  int strips = 12;
  double W = CGImageGetWidth(cg), H = CGImageGetHeight(cg);
  NSMutableArray *lums = [NSMutableArray array];
  for (int i = 0; i < strips; i++) {
    double y = (1 - bounds.origin.y - bounds.size.height) * H + (bounds.size.height * H * i / strips);
    double x = bounds.origin.x * W, w = bounds.size.width * W, h = bounds.size.height * H / strips;
    CGRect r = CGRectMake(MAX(0,x), MAX(0,y), MIN(w,W-x), MIN(h,H-y));
    if (r.size.width<=0||r.size.height<=0) continue;
    CGImageRef crop = CGImageCreateWithImageInRect(cg, r);
    int pw=(int)CGImageGetWidth(crop), ph=(int)CGImageGetHeight(crop);
    if(pw<=0||ph<=0){CGImageRelease(crop);continue;}
    uint8_t *raw = calloc(pw*ph*4,1);
    CGContextRef ctx = CGBitmapContextCreate(raw,pw,ph,8,pw*4,CGColorSpaceCreateDeviceRGB(),kCGImageAlphaPremultipliedLast);
    CGContextDrawImage(ctx,CGRectMake(0,0,pw,ph),crop); CGContextRelease(ctx); CGImageRelease(crop);
    double lum=0;
    for(int p=0;p<pw*ph;p++) lum+=0.2126*(raw[p*4]/255.0)+0.7152*(raw[p*4+1]/255.0)+0.0722*(raw[p*4+2]/255.0);
    free(raw);
    [lums addObject:@(lum/(pw*ph))];
  }
  if(lums.count<4) return 75;
  double maxG=0; int surfIdx=(int)lums.count/2;
  for(NSUInteger i=1;i<lums.count;i++){
    double g=fabs([lums[i] doubleValue]-[lums[i-1] doubleValue]);
    if(g>maxG){maxG=g;surfIdx=(int)i;}
  }
  int fill = (int)MAX(5,MIN(99,(1.0-(double)surfIdx/lums.count)*100));
  return fill;
}

-(int)volumeFor:(double)ar {
  if(ar<0.4)return 60; if(ar<0.6)return 240; if(ar<0.8)return 354;
  if(ar<1.0)return 473; return 591;
}

-(NSDictionary*)fallback:(NSString*)r {
  return @{@"success":@NO,@"totalVolumeMl":@354,@"fillLevelPct":@75,
           @"liquidVolumeMl":@266,@"method":[NSString stringWithFormat:@"fallback_%@",r]};
}
@end
