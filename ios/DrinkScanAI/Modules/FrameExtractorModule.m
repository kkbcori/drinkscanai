/**
 * FrameExtractorModule.m
 * ObjC bridge header for FrameExtractorModule.swift
 */

#import <React/RCTBridgeModule.h>

@interface RCT_EXTERN_MODULE(FrameExtractorModule, NSObject)

RCT_EXTERN_METHOD(
  extractBestFrame:(NSString *)videoPath
  resolver:(RCTPromiseResolveBlock)resolve
  rejecter:(RCTPromiseRejectBlock)reject
)

RCT_EXTERN_METHOD(
  getPixelData:(NSString *)imagePath
  width:(NSInteger)width
  height:(NSInteger)height
  resolver:(RCTPromiseResolveBlock)resolve
  rejecter:(RCTPromiseRejectBlock)reject
)

@end
