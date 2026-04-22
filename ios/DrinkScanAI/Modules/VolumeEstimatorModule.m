/**
 * VolumeEstimatorModule.m
 * ObjC bridge header for VolumeEstimatorModule.swift
 */

#import <React/RCTBridgeModule.h>

@interface RCT_EXTERN_MODULE(VolumeEstimatorModule, NSObject)

RCT_EXTERN_METHOD(
  estimateVolume:(NSString *)videoPath
  resolver:(RCTPromiseResolveBlock)resolve
  rejecter:(RCTPromiseRejectBlock)reject
)

@end
