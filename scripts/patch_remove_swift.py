#!/usr/bin/env python3
"""
Removes the old Swift module files from project.pbxproj
and deletes the .swift files since we're replacing with pure ObjC.

Run from project root:
  python scripts/patch_remove_swift.py
"""
import re, os

PROJECT = "ios/DrinkScanAI.xcodeproj/project.pbxproj"

# Swift files to remove (replaced by pure ObjC versions)
REMOVE = [
    "DrinkClassifierModule.swift",
    "FrameExtractorModule.swift",
    "VolumeEstimatorModule.swift",
]

content = open(PROJECT).read()
original = content

for name in REMOVE:
    # Remove all lines referencing this file
    lines = content.split('\n')
    lines = [l for l in lines if name not in l]
    content = '\n'.join(lines)

if content != original:
    open(PROJECT, 'w').write(content)
    print(f"✓ Removed Swift file references from project.pbxproj")
else:
    print("ℹ️  No Swift references found to remove")

# Delete the actual .swift files
for name in REMOVE:
    path = f"ios/DrinkScanAI/Modules/{name}"
    if os.path.exists(path):
        os.remove(path)
        print(f"✓ Deleted {path}")
    else:
        print(f"ℹ️  {path} not found (already removed)")

print("\nDone. Now run:")
print("  git add .")
print('  git commit -m "fix: replace Swift modules with pure ObjC - no bridging header needed"')
print("  git push")
