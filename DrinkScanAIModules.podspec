Pod::Spec.new do |s|
  s.name         = "DrinkScanAIModules"
  s.version      = "1.0.0"
  s.summary      = "Native modules for DrinkScanAI"
  s.homepage     = "https://github.com/kkbcori/drinkscanai"
  s.license      = "MIT"
  s.author       = "DrinkScanAI"
  s.platform     = :ios, "16.0"
  s.source       = { :path => "." }
  s.source_files  = "ios/DrinkScanAIModules/**/*.{m,mm,h}"
  s.resources     = [
    "ios/DrinkScanAI/ML/DrinkClassifier.mlpackage",
    "ios/DrinkScanAI/ML/drink_classes.json"
  ]
  s.frameworks   = "CoreML", "Vision", "AVFoundation", "UIKit"
  s.dependency   "React-Core"
end
