/**
 * DrinkClassifierModule.m
 * Pure Objective-C CoreML classifier — no Swift, no bridging header needed.
 */

#import <React/RCTBridgeModule.h>
#import <CoreML/CoreML.h>
#import <Vision/Vision.h>
#import <UIKit/UIKit.h>

@interface DrinkClassifierModule : NSObject <RCTBridgeModule>
@property (nonatomic, strong) VNCoreMLModel *vnModel;
@property (nonatomic, strong) NSArray<NSString *> *classNames;
@property (nonatomic, assign) BOOL isLoaded;
@property (nonatomic, copy)   NSString *loadError;
@end

@implementation DrinkClassifierModule

RCT_EXPORT_MODULE(DrinkClassifierModule)

+ (BOOL)requiresMainQueueSetup { return NO; }

- (void)loadModelIfNeeded {
  if (self.isLoaded) return;

  // Find model in bundle
  NSURL *modelURL = [[NSBundle mainBundle] URLForResource:@"DrinkClassifier" withExtension:@"mlmodelc"]
                 ?: [[NSBundle mainBundle] URLForResource:@"DrinkClassifier" withExtension:@"mlpackage"];

  if (!modelURL) {
    // List bundle contents for debugging
    NSString *resourcePath = [[NSBundle mainBundle] resourcePath];
    NSArray *files = [[NSFileManager defaultManager] contentsOfDirectoryAtPath:resourcePath error:nil];
    NSPredicate *pred = [NSPredicate predicateWithFormat:@"self CONTAINS[c] 'ml' OR self CONTAINS[c] 'Drink'"];
    NSArray *mlFiles = [files filteredArrayUsingPredicate:pred];
    self.loadError = [NSString stringWithFormat:@"DrinkClassifier not found. ML files in bundle: %@", mlFiles];
    NSLog(@"[DrinkClassifier] %@", self.loadError);
    return;
  }

  NSLog(@"[DrinkClassifier] Found model: %@", modelURL.path);

  NSError *error;
  MLModelConfiguration *config = [[MLModelConfiguration alloc] init];
  config.computeUnits = MLComputeUnitsAll;

  MLModel *mlModel = [MLModel modelWithContentsOfURL:modelURL configuration:config error:&error];
  if (!mlModel) {
    self.loadError = [NSString stringWithFormat:@"MLModel init failed: %@", error.localizedDescription];
    NSLog(@"[DrinkClassifier] %@", self.loadError);
    return;
  }

  self.vnModel = [VNCoreMLModel modelForMLModel:mlModel error:&error];
  if (!self.vnModel) {
    self.loadError = [NSString stringWithFormat:@"VNCoreMLModel failed: %@", error.localizedDescription];
    NSLog(@"[DrinkClassifier] %@", self.loadError);
    return;
  }

  // Load class names from drink_classes.json
  NSURL *jsonURL = [[NSBundle mainBundle] URLForResource:@"drink_classes" withExtension:@"json"];
  if (jsonURL) {
    NSData *data = [NSData dataWithContentsOfURL:jsonURL];
    NSDictionary *json = [NSJSONSerialization JSONObjectWithData:data options:0 error:nil];
    NSArray *classes = json[@"classes"];
    NSArray *sorted = [classes sortedArrayUsingComparator:^NSComparisonResult(NSDictionary *a, NSDictionary *b) {
      return [a[@"index"] compare:b[@"index"]];
    }];
    NSMutableArray *names = [NSMutableArray array];
    for (NSDictionary *c in sorted) {
      [names addObject:c[@"name"] ?: @"unknown"];
    }
    self.classNames = [names copy];
    NSLog(@"[DrinkClassifier] Loaded %lu class names", (unsigned long)self.classNames.count);
  }

  self.isLoaded = YES;
  NSLog(@"[DrinkClassifier] Model loaded with %lu classes", (unsigned long)self.classNames.count);
}

RCT_EXPORT_METHOD(preloadModel:(RCTPromiseResolveBlock)resolve rejecter:(RCTPromiseRejectBlock)reject) {
  dispatch_async(dispatch_get_global_queue(DISPATCH_QUEUE_PRIORITY_BACKGROUND, 0), ^{
    [self loadModelIfNeeded];
    if (self.isLoaded) {
      resolve(@{@"loaded": @YES, @"classes": @(self.classNames.count)});
    } else {
      resolve(@{@"loaded": @NO, @"error": self.loadError ?: @"unknown error"});
    }
  });
}

RCT_EXPORT_METHOD(classifyImage:(NSString *)imagePath
                  topK:(nonnull NSNumber *)topK
                  resolver:(RCTPromiseResolveBlock)resolve
                  rejecter:(RCTPromiseRejectBlock)reject) {
  dispatch_async(dispatch_get_global_queue(DISPATCH_QUEUE_PRIORITY_USER_INITIATED, 0), ^{
    [self loadModelIfNeeded];

    if (!self.isLoaded) {
      reject(@"MODEL_ERROR", self.loadError ?: @"Model not loaded", nil);
      return;
    }

    UIImage *image = [UIImage imageWithContentsOfFile:imagePath];
    if (!image || !image.CGImage) {
      reject(@"IMAGE_ERROR", [NSString stringWithFormat:@"Cannot load image: %@", imagePath], nil);
      return;
    }

    __block NSMutableArray *output = [NSMutableArray array];
    dispatch_semaphore_t sem = dispatch_semaphore_create(0);

    VNCoreMLRequest *request = [[VNCoreMLRequest alloc] initWithModel:self.vnModel completionHandler:^(VNRequest *req, NSError *err) {
      NSArray<VNCoreMLFeatureValueObservation *> *results = req.results;
      VNCoreMLFeatureValueObservation *obs = results.firstObject;
      MLMultiArray *arr = obs.featureValue.multiArrayValue;
      if (!arr) { dispatch_semaphore_signal(sem); return; }

      NSInteger count = arr.count;
      NSMutableArray *logits = [NSMutableArray arrayWithCapacity:count];
      float maxL = -INFINITY;
      for (NSInteger i = 0; i < count; i++) {
        float v = arr[i].floatValue;
        [logits addObject:@(v)];
        if (v > maxL) maxL = v;
      }

      // Softmax
      float sum = 0;
      NSMutableArray *exps = [NSMutableArray arrayWithCapacity:count];
      for (NSNumber *l in logits) {
        float e = expf(l.floatValue - maxL);
        [exps addObject:@(e)];
        sum += e;
      }

      NSMutableArray *indexed = [NSMutableArray arrayWithCapacity:count];
      for (NSInteger i = 0; i < count; i++) {
        float prob = [exps[i] floatValue] / sum;
        [indexed addObject:@[@(i), @(prob)]];
      }

      [indexed sortUsingComparator:^NSComparisonResult(NSArray *a, NSArray *b) {
        return [b[1] compare:a[1]];
      }];

      NSInteger k = MIN(topK.integerValue, indexed.count);
      for (NSInteger i = 0; i < k; i++) {
        NSArray *item = indexed[i];
        NSInteger idx = [item[0] integerValue];
        float prob = [item[1] floatValue];
        NSString *name = (idx < (NSInteger)self.classNames.count) ? self.classNames[idx] : [NSString stringWithFormat:@"unknown_%ld", (long)idx];
        [output addObject:@{@"classIndex": @(idx), @"className": name, @"probability": @(prob)}];
      }
      dispatch_semaphore_signal(sem);
    }];

    request.imageCropAndScaleOption = VNImageCropAndScaleOptionCenterCrop;
    VNImageRequestHandler *handler = [[VNImageRequestHandler alloc] initWithCGImage:image.CGImage options:@{}];
    [handler performRequests:@[request] error:nil];
    dispatch_semaphore_wait(sem, DISPATCH_TIME_FOREVER);
    resolve(output);
  });
}

@end
