#!/usr/bin/env python3
"""
patch_xcode_project.py
DrinkScanAI — Adds native Swift modules to Xcode project.pbxproj

Run once from your project root:
  python scripts/patch_xcode_project.py

This registers:
  - FrameExtractorModule.swift + .m
  - VolumeEstimatorModule.swift + .m
  - mobilenetv3_drinks.onnx (ML model)
  - drink_classes.json (class metadata)
"""

import os
import sys
import uuid
import re

PROJECT_PATH = "ios/DrinkScanAI.xcodeproj/project.pbxproj"

FILES_TO_ADD = [
    {
        "path": "DrinkScanAI/Modules/FrameExtractorModule.swift",
        "name": "FrameExtractorModule.swift",
        "type": "sourcecode.swift",
    },
    {
        "path": "DrinkScanAI/Modules/FrameExtractorModule.m",
        "name": "FrameExtractorModule.m",
        "type": "sourcecode.c.objc",
    },
    {
        "path": "DrinkScanAI/Modules/VolumeEstimatorModule.swift",
        "name": "VolumeEstimatorModule.swift",
        "type": "sourcecode.swift",
    },
    {
        "path": "DrinkScanAI/Modules/VolumeEstimatorModule.m",
        "name": "VolumeEstimatorModule.m",
        "type": "sourcecode.c.objc",
    },
    {
        "path": "DrinkScanAI/ML/mobilenetv3_drinks.onnx",
        "name": "mobilenetv3_drinks.onnx",
        "type": "file",
        "resource": True,  # Bundle resource, not compiled
    },
    {
        "path": "DrinkScanAI/ML/drink_classes.json",
        "name": "drink_classes.json",
        "type": "text.json",
        "resource": True,
    },
]

def gen_uuid():
    """Generate Xcode-style 24-char hex UUID."""
    return uuid.uuid4().hex[:24].upper()

def read_project():
    with open(PROJECT_PATH, 'r', encoding='utf-8') as f:
        return f.read()

def write_project(content):
    with open(PROJECT_PATH, 'w', encoding='utf-8') as f:
        f.write(content)
    print(f"✓ Written: {PROJECT_PATH}")

def file_already_added(content, filename):
    return filename in content

def find_section(content, section_name):
    """Find the start of a PBX section."""
    marker = f"/* Begin {section_name} section */"
    idx = content.find(marker)
    if idx == -1:
        return -1
    return idx + len(marker)

def find_sources_build_phase(content):
    """Find the Sources build phase for the main target."""
    # Look for the DrinkScanAI Sources build phase
    pattern = r'(\w{24}) /\* Sources \*/ = \{[^}]*isa = PBXSourcesBuildPhase'
    match = re.search(pattern, content)
    if match:
        return match.group(1)
    return None

def find_resources_build_phase(content):
    """Find the Resources build phase for the main target."""
    pattern = r'(\w{24}) /\* Resources \*/ = \{[^}]*isa = PBXResourcesBuildPhase'
    match = re.search(pattern, content)
    if match:
        return match.group(1)
    return None

def find_main_group(content):
    """Find the DrinkScanAI group UUID."""
    pattern = r'(\w{24}) /\* DrinkScanAI \*/ = \{\s*isa = PBXGroup'
    match = re.search(pattern, content)
    if match:
        return match.group(1)
    return None

def patch_project():
    if not os.path.exists(PROJECT_PATH):
        print(f"✗ Not found: {PROJECT_PATH}")
        print("  Run this script from your project root (DrinkScanAI/)")
        sys.exit(1)

    content = read_project()
    modified = False

    # Check which files need adding
    files_to_process = []
    for f in FILES_TO_ADD:
        if file_already_added(content, f['name']):
            print(f"  ℹ️  Already added: {f['name']}")
        else:
            files_to_process.append(f)

    if not files_to_process:
        print("✓ All files already registered in Xcode project")
        return

    print(f"\n📝 Adding {len(files_to_process)} files to Xcode project...")

    for file_info in files_to_process:
        file_uuid     = gen_uuid()
        buildref_uuid = gen_uuid()
        name          = file_info['name']
        path          = file_info['path']
        file_type     = file_info['type']
        is_resource   = file_info.get('resource', False)

        # 1. Add PBXFileReference
        file_ref_entry = (
            f'\t\t{file_uuid} /* {name} */ = '
            f'{{isa = PBXFileReference; lastKnownFileType = {file_type}; '
            f'path = {name}; sourceTree = "<group>"; }};\n'
        )

        ref_section_pos = find_section(content, "PBXFileReference")
        if ref_section_pos == -1:
            print(f"  ✗ Could not find PBXFileReference section")
            continue

        content = content[:ref_section_pos] + '\n' + file_ref_entry + content[ref_section_pos:]

        # 2. Add PBXBuildFile
        build_file_entry = (
            f'\t\t{buildref_uuid} /* {name} in '
            f'{"Resources" if is_resource else "Sources"} */ = '
            f'{{isa = PBXBuildFile; fileRef = {file_uuid} /* {name} */; }};\n'
        )

        build_section_pos = find_section(content, "PBXBuildFile")
        if build_section_pos == -1:
            print(f"  ✗ Could not find PBXBuildFile section")
            continue

        content = content[:build_section_pos] + '\n' + build_file_entry + content[build_section_pos:]

        # 3. Add to Sources or Resources build phase
        build_ref_line = f'\t\t\t\t{buildref_uuid} /* {name} in {"Resources" if is_resource else "Sources"} */,\n'

        if is_resource:
            phase_uuid = find_resources_build_phase(content)
            phase_name = "Resources"
        else:
            phase_uuid = find_sources_build_phase(content)
            phase_name = "Sources"

        if phase_uuid:
            # Find the files = ( section of this build phase
            phase_marker = f'{phase_uuid} /* {phase_name} */ = {{'
            phase_pos = content.find(phase_marker)
            if phase_pos != -1:
                files_pos = content.find('files = (', phase_pos)
                if files_pos != -1:
                    insert_pos = files_pos + len('files = (') + 1
                    content = content[:insert_pos] + build_ref_line + content[insert_pos:]
                    print(f"  ✓ Added to {phase_name}: {name}")
                else:
                    print(f"  ⚠️  Could not find files list in {phase_name} phase for {name}")
            else:
                print(f"  ⚠️  Could not find build phase {phase_uuid} for {name}")
        else:
            print(f"  ⚠️  Could not find {phase_name} build phase for {name}")

        # 4. Add to DrinkScanAI group (so it shows in Xcode navigator)
        main_group = find_main_group(content)
        if main_group:
            group_marker = f'{main_group} /* DrinkScanAI */ = {{'
            group_pos = content.find(group_marker)
            if group_pos != -1:
                children_pos = content.find('children = (', group_pos)
                if children_pos != -1:
                    insert_pos = children_pos + len('children = (') + 1
                    group_entry = f'\t\t\t\t{file_uuid} /* {name} */,\n'
                    content = content[:insert_pos] + group_entry + content[insert_pos:]

        modified = True

    if modified:
        write_project(content)
        print("\n✅ Xcode project updated successfully!")
        print("\nNext steps:")
        print("  git add ios/DrinkScanAI.xcodeproj/project.pbxproj")
        print('  git commit -m "feat: register native modules in Xcode project"')
        print("  git push")
    else:
        print("\n✓ No changes needed")

if __name__ == "__main__":
    patch_project()


def set_bridging_header():
    """Set the Swift bridging header in build settings."""
    content = read_project()
    
    bridging_header = "DrinkScanAI/DrinkScanAI-Bridging-Header.h"
    
    if bridging_header in content:
        print("ℹ️  Bridging header already set")
        return
    
    # Find Release and Debug build configurations and add the setting
    pattern = r'(SWIFT_VERSION = 5\.0;)'
    replacement = r'\1\n\t\t\t\tSWIFT_OBJC_BRIDGING_HEADER = "' + bridging_header + r'";'
    
    new_content = re.sub(pattern, replacement, content)
    
    if new_content != content:
        write_project(new_content)
        print(f"✓ Set bridging header: {bridging_header}")
    else:
        print("⚠️  Could not find SWIFT_VERSION to anchor bridging header setting")
        print(f"   Manually set in Xcode: SWIFT_OBJC_BRIDGING_HEADER = {bridging_header}")

# Run bridging header fix too
set_bridging_header()
