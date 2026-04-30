/**
 * VolumeEstimatorModule.m
 * Pure Objective-C volume estimator — no Swift, no bridging header.
 */

#import <React/RCTBridgeModule.h>
#import <AVFoundation/AVFoundation.h>
#import <Vision/Vision.h>
#import <UIKit/UIKit.h>

@interface VolumeEstimatorModule : NSObject <RCTBridgeModule>
@end

@implementation VolumeEstimatorModule

RCT_EXPORT_MODULE(VolumeEstimatorModule)
+ (BOOL)requiresMainQueueSetup { return NO; }

RCT_EXPORT_METHOD(estimateVolume:(NSString *)videoPath
                  resolver:(RCTPromiseResolveBlock)resolve
                  rejecter:(RCTPromiseRejectBlock)reject) {
  dispatch_async(dispatch_get_global_queue(DISPATCH_QUEUE_PRIORITY_USER_INITIATED, 0), ^{
    AVAsset *asset = [AVAsset assetWithURL:[NSURL fileURLWithPath:videoPath]];
    AVAssetImageGenerator *gen = [[AVAssetImageGenerator alloc] initWithAsset:asset];
    gen.appliesPreferredTrackTransform = YES;
    gen.maximumSize = CGSizeMake(480, 480);

    CMTime duration = asset.duration;
    Float64 secs = CMTimeGetSeconds(duration);
    if (secs <= 0) {
      resolve([self fallback:@"invalid_video"]);
      return;
    }

    NSMutableArray *aspectRatios = [NSMutableArray array];
    NSMutableArray *fillRatios   = [NSMutableArray array];

    for (int i = 1; i <= 5; i++) {
      CMTime t = CMTimeMakeWithSeconds(secs * i / 6.0, 600);
      CGImageRef cgImg = [gen copyCGImageAtTime:t actualTime:nil error:nil];
      if (!cgImg) continue;

      VNDetectRectanglesRequest *req = [[VNDetectRectanglesRequest alloc] init];
      req.minimumAspectRatio = 0.1;
      req.maximumAspectRatio = 2.0;
      req.minimumSize = 0.15;
      req.maximumObservations = 3;
      req.minimumConfidence = 0.4;

      VNImageRequestHandler *handler = [[VNImageRequestHandler alloc] initWithCGImage:cgImg options:@{}];
      [handler performRequests:@[req] error:nil];

      NSArray<VNRectangleObservation *> *rects = req.results;
      VNRectangleObservation *best = nil;
      for (VNRectangleObservation *r in rects) {
        if (!best || r.confidence > best.confidence) best = r;
      }

      if (best) {
        double w = best.boundingBox.size.width;
        double h = best.boundingBox.size.height;
        if (h > 0) [aspectRatios addObject:@(w/h)];

        // Fill level: sample luminance strips
        double fillRatio = [self detectFillLevel:cgImg bounds:best.boundingBox];
        [fillRatios addObject:@(fillRatio)];
      }
      CGImageRelease(cgImg);
    }

    if (aspectRatios.count == 0) {
      resolve([self fallback:@"no_rectangle"]);
      return;
    }

    // Median
    NSArray *sortedAR = [aspectRatios sortedArrayUsingSelector:@selector(compare:)];
    NSArray *sortedFR = [fillRatios sortedArrayUsingSelector:@selector(compare:)];
    double medAR = [sortedAR[sortedAR.count/2] doubleValue];
    double medFR = [sortedFR[sortedFR.count/2] doubleValue];

    int volume = [self volumeForAspectRatio:medAR];
    double fill = MAX(5, MIN(99, medFR * 100));
    int liquid = (int)(volume * medFR);

    resolve(@{
      @"success": @YES,
      @"totalVolumeMl": @(volume),
      @"fillLevelPct": @((int)fill),
      @"liquidVolumeMl": @(liquid),
      @"method": @"vision_objc",
    });
  });
}

- (double)detectFillLevel:(CGImageRef)cgImage bounds:(CGRect)bounds {
  int strips = 16;
  double width = CGImageGetWidth(cgImage);
  double height = CGImageGetHeight(cgImage);

  NSMutableArray *lums = [NSMutableArray array];
  for (int i = 0; i < strips; i++) {
    double y = (1 - bounds.origin.y - bounds.size.height) * height + (bounds.size.height * height * i / strips);
    double x = bounds.origin.x * width;
    double w = bounds.size.width * width;
    double h = bounds.size.height * height / strips;
    CGRect r = CGRectMake(MAX(0,x), MAX(0,y), MIN(w, width-x), MIN(h, height-y));
    if (r.size.width <= 0 || r.size.height <= 0) continue;

    CGImageRef crop = CGImageCreateWithImageInRect(cgImage, r);
    int pw = (int)CGImageGetWidth(crop), ph = (int)CGImageGetHeight(crop);
    if (pw <= 0 || ph <= 0) { CGImageRelease(crop); continue; }

    uint8_t *raw = calloc(pw * ph * 4, 1);
    CGContextRef ctx = CGBitmapContextCreate(raw, pw, ph, 8, pw*4, CGColorSpaceCreateDeviceRGB(), kCGImageAlphaPremultipliedLast);
    CGContextDrawImage(ctx, CGRectMake(0,0,pw,ph), crop);
    CGContextRelease(ctx);
    CGImageRelease(crop);

    double lum = 0;
    for (int p = 0; p < pw*ph; p++) {
      lum += 0.2126*(raw[p*4]/255.0) + 0.7152*(raw[p*4+1]/255.0) + 0.0722*(raw[p*4+2]/255.0);
    }
    free(raw);
    [lums addObject:@(lum / (pw*ph))];
  }

  if (lums.count < 4) return 0.8;

  double maxGrad = 0; int surfIdx = (int)lums.count / 2;
  for (NSUInteger i = 1; i < lums.count; i++) {
    double g = fabs([lums[i] doubleValue] - [lums[i-1] doubleValue]);
    if (g > maxGrad) { maxGrad = g; surfIdx = (int)i; }
  }
  return MAX(0.05, MIN(0.99, 1.0 - (double)surfIdx / lums.count));
}

- (int)volumeForAspectRatio:(double)ar {
  if (ar < 0.4) return 500;
  if (ar < 0.65) return 473;
  if (ar < 0.8) return 354;
  if (ar < 1.0) return 300;
  if (ar < 1.2) return 240;
  return 60;
}

- (NSDictionary *)fallback:(NSString *)reason {
  return @{@"success": @NO, @"totalVolumeMl": @354, @"fillLevelPct": @80,
           @"liquidVolumeMl": @283, @"method": [NSString stringWithFormat:@"fallback_%@", reason]};
}

@end
