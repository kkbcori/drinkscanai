/**
 * DrinkScanAIModules.m
 * All three native modules in a single file, registered as a CocoaPod.
 * This guarantees React Native discovers them via use_native_modules!
 */

#import <React/RCTBridgeModule.h>
#import <CoreML/CoreML.h>
#import <Vision/Vision.h>
#import <AVFoundation/AVFoundation.h>
#import <UIKit/UIKit.h>

// ═══════════════════════════════════════════════════════════════
// MARK: - DrinkClassifierModule
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

  // Find .mlmodelc (pre-compiled) or .mlpackage (needs runtime compile)
  NSURL *modelURL = [[NSBundle mainBundle] URLForResource:@"DrinkClassifier" withExtension:@"mlmodelc"];

  if (!modelURL) {
    // .mlpackage found — compile it at runtime to a temp location
    NSURL *pkgURL = [[NSBundle mainBundle] URLForResource:@"DrinkClassifier" withExtension:@"mlpackage"];
    if (!pkgURL) {
      NSArray *files = [[NSFileManager defaultManager] contentsOfDirectoryAtPath:[[NSBundle mainBundle] resourcePath] error:nil];
      NSPredicate *p = [NSPredicate predicateWithFormat:@"self CONTAINS[c] 'ml' OR self CONTAINS[c] 'Drink'"];
      self.loadError = [NSString stringWithFormat:@"Model not found. ML files: %@", [files filteredArrayUsingPredicate:p]];
      NSLog(@"[DrinkClassifier] %@", self.loadError);
      return;
    }
    NSLog(@"[DrinkClassifier] Compiling .mlpackage at runtime...");
    NSError *compileErr;
    NSURL *tmpDir = [NSURL fileURLWithPath:NSTemporaryDirectory()];
    modelURL = [MLModel compileModelAtURL:pkgURL error:&compileErr];
    if (!modelURL) {
      self.loadError = [NSString stringWithFormat:@"Compile failed: %@", compileErr.localizedDescription];
      NSLog(@"[DrinkClassifier] %@", self.loadError);
      return;
    }
    NSLog(@"[DrinkClassifier] Compiled to: %@", modelURL.path);
  }

  NSError *err;
  MLModelConfiguration *cfg = [[MLModelConfiguration alloc] init];
  cfg.computeUnits = MLComputeUnitsAll;
  MLModel *ml = [MLModel modelWithContentsOfURL:modelURL configuration:cfg error:&err];
  if (!ml) { self.loadError = err.localizedDescription; return; }

  self.vnModel = [VNCoreMLModel modelForMLModel:ml error:&err];
  if (!self.vnModel) { self.loadError = err.localizedDescription; return; }

  // Load class names
  NSURL *jsonURL = [[NSBundle mainBundle] URLForResource:@"drink_classes" withExtension:@"json"];
  if (jsonURL) {
    NSData *data = [NSData dataWithContentsOfURL:jsonURL];
    NSDictionary *json = [NSJSONSerialization JSONObjectWithData:data options:0 error:nil];
    NSArray *sorted = [json[@"classes"] sortedArrayUsingComparator:^NSComparisonResult(NSDictionary *a, NSDictionary *b) {
      return [a[@"index"] compare:b[@"index"]];
    }];
    NSMutableArray *names = [NSMutableArray array];
    for (NSDictionary *c in sorted) [names addObject:c[@"name"] ?: @"unknown"];
    self.classNames = names;
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
      ? @{@"loaded": @YES,  @"classes": @(self.classNames.count)}
      : @{@"loaded": @NO,   @"error": self.loadError ?: @"unknown"});
  });
}

RCT_EXPORT_METHOD(classifyImage:(NSString *)path topK:(nonnull NSNumber *)k
                  resolver:(RCTPromiseResolveBlock)resolve rejecter:(RCTPromiseRejectBlock)reject) {
  dispatch_async(dispatch_get_global_queue(QOS_CLASS_USER_INITIATED, 0), ^{
    [self loadModelIfNeeded];
    if (!self.isLoaded) { reject(@"ERR", self.loadError, nil); return; }

    UIImage *img = [UIImage imageWithContentsOfFile:path];
    if (!img.CGImage) { reject(@"ERR", @"Cannot load image", nil); return; }

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
// MARK: - FrameExtractorModule
// ═══════════════════════════════════════════════════════════════

@interface FrameExtractorModule : NSObject <RCTBridgeModule>
@end

@implementation FrameExtractorModule

RCT_EXPORT_MODULE()
+ (BOOL)requiresMainQueueSetup { return NO; }

RCT_EXPORT_METHOD(extractBestFrame:(NSString *)videoPath
                  resolver:(RCTPromiseResolveBlock)resolve
                  rejecter:(RCTPromiseRejectBlock)reject) {
  dispatch_async(dispatch_get_global_queue(QOS_CLASS_USER_INITIATED, 0), ^{
    AVAsset *asset = [AVAsset assetWithURL:[NSURL fileURLWithPath:videoPath]];
    AVAssetImageGenerator *gen = [[AVAssetImageGenerator alloc] initWithAsset:asset];
    gen.appliesPreferredTrackTransform = YES;
    gen.maximumSize = CGSizeMake(640, 640);
    Float64 dur = CMTimeGetSeconds(asset.duration);
    if (dur <= 0) { reject(@"ERR", @"Invalid video", nil); return; }

    UIImage *best = nil; double bestS = -1;
    for (int i = 1; i <= 7; i++) {
      CMTime t = CMTimeMakeWithSeconds(dur * i / 8.0, 600);
      CGImageRef cg = [gen copyCGImageAtTime:t actualTime:nil error:nil];
      if (!cg) continue;
      // Simple sharpness: average edge strength via sampling
      CGImageRef cg2 = cg;
      int sw = (int)MIN(CGImageGetWidth(cg2), 64), sh = (int)MIN(CGImageGetHeight(cg2), 64);
      uint8_t *px = calloc(sw*sh*4, 1);
      CGContextRef ctx = CGBitmapContextCreate(px,sw,sh,8,sw*4,CGColorSpaceCreateDeviceRGB(),kCGImageAlphaPremultipliedLast);
      CGContextDrawImage(ctx, CGRectMake(0,0,sw,sh), cg2); CGContextRelease(ctx);
      double sharpness = 0;
      for (int y=1;y<sh-1;y++) for (int x=1;x<sw-1;x++) {
        int i0=(y*sw+x)*4, iu=((y-1)*sw+x)*4, id=((y+1)*sw+x)*4;
        sharpness += fabs(px[i0]-px[iu]) + fabs(px[i0]-px[id]);
      }
      free(px);
      if (sharpness > bestS) { bestS = sharpness; if(best){} best = [UIImage imageWithCGImage:cg2]; }
      CGImageRelease(cg);
    }

    if (!best) { reject(@"ERR", @"No frames", nil); return; }
    NSString *p = [NSTemporaryDirectory() stringByAppendingPathComponent:[NSString stringWithFormat:@"frame_%lld.jpg",(long long)[[NSDate date] timeIntervalSince1970]*1000]];
    NSData *d = UIImageJPEGRepresentation(best, 0.92);
    [d writeToFile:p atomically:YES];
    resolve(p);
  });
}

RCT_EXPORT_METHOD(getPixelData:(NSString *)imagePath width:(nonnull NSNumber *)w height:(nonnull NSNumber *)h
                  resolver:(RCTPromiseResolveBlock)resolve rejecter:(RCTPromiseRejectBlock)reject) {
  dispatch_async(dispatch_get_global_queue(QOS_CLASS_USER_INITIATED, 0), ^{
    UIImage *img = [UIImage imageWithContentsOfFile:imagePath];
    if (!img) { reject(@"ERR",@"Cannot load image",nil); return; }
    int iw=w.intValue, ih=h.intValue;
    UIGraphicsBeginImageContextWithOptions(CGSizeMake(iw,ih), NO, 1.0);
    [img drawInRect:CGRectMake(0,0,iw,ih)];
    UIImage *r = UIGraphicsGetImageFromCurrentImageContext();
    UIGraphicsEndImageContext();
    uint8_t *px = calloc(iw*ih*4,1);
    CGContextRef ctx = CGBitmapContextCreate(px,iw,ih,8,iw*4,CGColorSpaceCreateDeviceRGB(),kCGImageAlphaPremultipliedLast);
    CGContextDrawImage(ctx,CGRectMake(0,0,iw,ih),r.CGImage); CGContextRelease(ctx);
    NSMutableArray *pixels = [NSMutableArray arrayWithCapacity:iw*ih*3];
    for(int i=0;i<iw*ih;i++){int b=i*4;[pixels addObject:@(px[b])];[pixels addObject:@(px[b+1])];[pixels addObject:@(px[b+2])];}
    free(px); resolve(pixels);
  });
}

@end

// ═══════════════════════════════════════════════════════════════
// MARK: - VolumeEstimatorModule
// ═══════════════════════════════════════════════════════════════

@interface VolumeEstimatorModule : NSObject <RCTBridgeModule>
@end

@implementation VolumeEstimatorModule

RCT_EXPORT_MODULE()
+ (BOOL)requiresMainQueueSetup { return NO; }

RCT_EXPORT_METHOD(estimateVolume:(NSString *)videoPath
                  resolver:(RCTPromiseResolveBlock)resolve
                  rejecter:(RCTPromiseRejectBlock)reject) {
  dispatch_async(dispatch_get_global_queue(QOS_CLASS_USER_INITIATED, 0), ^{
    AVAsset *asset = [AVAsset assetWithURL:[NSURL fileURLWithPath:videoPath]];
    Float64 dur = CMTimeGetSeconds(asset.duration);
    if (dur <= 0) { resolve([self fallback:@"invalid"]); return; }

    AVAssetImageGenerator *gen = [[AVAssetImageGenerator alloc] initWithAsset:asset];
    gen.appliesPreferredTrackTransform = YES;
    gen.maximumSize = CGSizeMake(480,480);

    NSMutableArray *ars = [NSMutableArray array], *frs = [NSMutableArray array];
    for (int i=1;i<=5;i++) {
      CMTime t = CMTimeMakeWithSeconds(dur*i/6.0,600);
      CGImageRef cg = [gen copyCGImageAtTime:t actualTime:nil error:nil];
      if (!cg) continue;
      VNDetectRectanglesRequest *req = [[VNDetectRectanglesRequest alloc] init];
      req.minimumAspectRatio=0.1; req.maximumAspectRatio=2.0;
      req.minimumSize=0.15; req.maximumObservations=3; req.minimumConfidence=0.4;
      [[[VNImageRequestHandler alloc] initWithCGImage:cg options:@{}] performRequests:@[req] error:nil];
      VNRectangleObservation *best=nil;
      for(VNRectangleObservation *r in req.results) if(!best||r.confidence>best.confidence) best=r;
      if(best){
        double w=best.boundingBox.size.width, h=best.boundingBox.size.height;
        if(h>0)[ars addObject:@(w/h)];
        [frs addObject:@(0.75)]; // simplified fill estimate
      }
      CGImageRelease(cg);
    }

    if(ars.count==0){resolve([self fallback:@"no_rect"]);return;}
    NSArray *sAR=[ars sortedArrayUsingSelector:@selector(compare:)];
    double ar=[sAR[sAR.count/2] doubleValue];
    int vol=[self volumeFor:ar];
    double fill=75.0;
    resolve(@{@"success":@YES,@"totalVolumeMl":@(vol),@"fillLevelPct":@((int)fill),@"liquidVolumeMl":@((int)(vol*fill/100)),@"method":@"vision_pod"});
  });
}

-(int)volumeFor:(double)ar {
  if(ar<0.4)return 500; if(ar<0.65)return 473; if(ar<0.8)return 354;
  if(ar<1.0)return 300; if(ar<1.2)return 240; return 60;
}

-(NSDictionary*)fallback:(NSString*)r {
  return @{@"success":@NO,@"totalVolumeMl":@354,@"fillLevelPct":@80,@"liquidVolumeMl":@283,@"method":[NSString stringWithFormat:@"fallback_%@",r]};
}

@end
