/**
 * FrameExtractorModule.m
 * Pure Objective-C frame extractor — no Swift, no bridging header.
 */

#import <React/RCTBridgeModule.h>
#import <AVFoundation/AVFoundation.h>
#import <CoreImage/CoreImage.h>
#import <UIKit/UIKit.h>

@interface FrameExtractorModule : NSObject <RCTBridgeModule>
@end

@implementation FrameExtractorModule

RCT_EXPORT_MODULE(FrameExtractorModule)
+ (BOOL)requiresMainQueueSetup { return NO; }

RCT_EXPORT_METHOD(extractBestFrame:(NSString *)videoPath
                  resolver:(RCTPromiseResolveBlock)resolve
                  rejecter:(RCTPromiseRejectBlock)reject) {
  dispatch_async(dispatch_get_global_queue(DISPATCH_QUEUE_PRIORITY_USER_INITIATED, 0), ^{
    AVAsset *asset = [AVAsset assetWithURL:[NSURL fileURLWithPath:videoPath]];
    AVAssetImageGenerator *gen = [[AVAssetImageGenerator alloc] initWithAsset:asset];
    gen.appliesPreferredTrackTransform = YES;
    gen.maximumSize = CGSizeMake(640, 640);

    CMTime duration = asset.duration;
    Float64 secs = CMTimeGetSeconds(duration);
    if (secs <= 0) { reject(@"ERROR", @"Invalid video", nil); return; }

    UIImage *bestFrame = nil;
    double bestSharpness = -1;

    for (int i = 1; i <= 7; i++) {
      CMTime t = CMTimeMakeWithSeconds(secs * i / 8.0, 600);
      CGImageRef cgImg = [gen copyCGImageAtTime:t actualTime:nil error:nil];
      if (!cgImg) continue;

      // Laplacian variance sharpness
      CIImage *ci = [CIImage imageWithCGImage:cgImg];
      CIFilter *f = [CIFilter filterWithName:@"CIConvolution3X3"];
      [f setValue:ci forKey:kCIInputImageKey];
      CIVector *kernel = [CIVector vectorWithValues:(CGFloat[]){0,-1,0,-1,4,-1,0,-1,0} count:9];
      [f setValue:kernel forKey:@"inputWeights"];
      CIImage *out = f.outputImage;
      CIContext *ctx = [CIContext context];
      uint8_t px[4] = {0};
      [ctx render:out toBitmap:px rowBytes:4 bounds:CGRectMake(0,0,1,1) format:kCIFormatRGBA8 colorSpace:CGColorSpaceCreateDeviceRGB()];
      double sharpness = px[0];

      if (sharpness > bestSharpness) {
        bestSharpness = sharpness;
        bestFrame = [UIImage imageWithCGImage:cgImg];
      }
      CGImageRelease(cgImg);
    }

    if (!bestFrame) { reject(@"ERROR", @"No frames extracted", nil); return; }

    NSString *path = [NSTemporaryDirectory() stringByAppendingPathComponent:[NSString stringWithFormat:@"frame_%ld.jpg", (long)[[NSDate date] timeIntervalSince1970]]];
    [bestFrame.jpegData(0.92) writeToFile:path atomically:YES];
    resolve(path);
  });
}

RCT_EXPORT_METHOD(getPixelData:(NSString *)imagePath
                  width:(nonnull NSNumber *)width
                  height:(nonnull NSNumber *)height
                  resolver:(RCTPromiseResolveBlock)resolve
                  rejecter:(RCTPromiseRejectBlock)reject) {
  dispatch_async(dispatch_get_global_queue(DISPATCH_QUEUE_PRIORITY_USER_INITIATED, 0), ^{
    UIImage *image = [UIImage imageWithContentsOfFile:imagePath];
    if (!image) { reject(@"ERROR", @"Cannot load image", nil); return; }

    int w = width.intValue, h = height.intValue;
    CGSize size = CGSizeMake(w, h);
    UIGraphicsBeginImageContextWithOptions(size, NO, 1.0);
    [image drawInRect:CGRectMake(0,0,w,h)];
    UIImage *resized = UIGraphicsGetImageFromCurrentImageContext();
    UIGraphicsEndImageContext();

    CGImageRef cgImg = resized.CGImage;
    int bytesPerRow = w * 4;
    uint8_t *raw = calloc(h * bytesPerRow, 1);
    CGContextRef ctx = CGBitmapContextCreate(raw, w, h, 8, bytesPerRow, CGColorSpaceCreateDeviceRGB(), kCGImageAlphaPremultipliedLast);
    CGContextDrawImage(ctx, CGRectMake(0,0,w,h), cgImg);
    CGContextRelease(ctx);

    NSMutableArray *pixels = [NSMutableArray arrayWithCapacity:w*h*3];
    for (int i = 0; i < w*h; i++) {
      int base = i * 4;
      [pixels addObject:@(raw[base])];
      [pixels addObject:@(raw[base+1])];
      [pixels addObject:@(raw[base+2])];
    }
    free(raw);
    resolve(pixels);
  });
}

@end
