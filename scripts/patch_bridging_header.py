#!/usr/bin/env python3
"""
Adds SWIFT_OBJC_BRIDGING_HEADER to the main DrinkScanAI target
build configurations in project.pbxproj.

Run from project root:
  python scripts/patch_bridging_header.py
"""

import re, sys

PROJECT = "ios/DrinkScanAI.xcodeproj/project.pbxproj"
HEADER  = "DrinkScanAI/DrinkScanAI-Bridging-Header.h"
SETTING = f'SWIFT_OBJC_BRIDGING_HEADER = "{HEADER}";'

content = open(PROJECT).read()

if HEADER in content:
    print("✓ Bridging header already set")
    sys.exit(0)

# Find all XCBuildConfiguration blocks and add the setting
# only to those belonging to the DrinkScanAI target (not Pods)
# We anchor on PRODUCT_NAME = DrinkScanAI which appears in the app target configs

def add_to_config_block(match):
    block = match.group(0)
    # Only patch blocks that have PRODUCT_NAME = DrinkScanAI or SWIFT_VERSION
    if 'SWIFT_VERSION' in block and SETTING not in block:
        # Insert after SWIFT_VERSION line
        block = re.sub(
            r'(SWIFT_VERSION = 5\.0;)',
            f'\\1\n\t\t\t\t{SETTING}',
            block
        )
    return block

# Match XCBuildConfiguration blocks
pattern = r'(/\* [A-Za-z]+ \*/ = \{[^}]*isa = XCBuildConfiguration;.*?\};)'
new_content = re.sub(pattern, add_to_config_block, content, flags=re.DOTALL)

if new_content == content:
    print("⚠️  Could not find SWIFT_VERSION anchor — trying alternative")
    # Alternative: add to any block with IPHONEOS_DEPLOYMENT_TARGET
    def add_to_config_block2(match):
        block = match.group(0)
        if 'IPHONEOS_DEPLOYMENT_TARGET' in block and 'PRODUCT_BUNDLE_IDENTIFIER = com.drinkscanai' in block and SETTING not in block:
            block = block.replace(
                'IPHONEOS_DEPLOYMENT_TARGET',
                f'{SETTING}\n\t\t\t\tIPHONEOS_DEPLOYMENT_TARGET'
            )
        return block
    new_content = re.sub(pattern, add_to_config_block2, content, flags=re.DOTALL)

if HEADER in new_content:
    open(PROJECT, 'w').write(new_content)
    count = new_content.count(SETTING)
    print(f"✓ Added bridging header to {count} build configuration(s)")
    print("\nNext:")
    print("  git add ios/DrinkScanAI.xcodeproj/project.pbxproj")
    print('  git commit -m "fix: set SWIFT_OBJC_BRIDGING_HEADER in build settings"')
    print("  git push")
else:
    print("✗ Failed to patch — set manually in Xcode:")
    print(f'  SWIFT_OBJC_BRIDGING_HEADER = "{HEADER}"')
