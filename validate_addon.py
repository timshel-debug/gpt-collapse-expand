#!/usr/bin/env python3
"""
Firefox add-on validator (manual checks for common issues)
"""
import json
import zipfile
from pathlib import Path

def validate_xpi(xpi_path):
    issues = []
    warnings = []
    
    print("=" * 60)
    print("FIREFOX ADD-ON VALIDATION REPORT")
    print("=" * 60)
    
    with zipfile.ZipFile(xpi_path, 'r') as z:
        # Check manifest.json exists
        if 'manifest.json' not in z.namelist():
            issues.append("❌ manifest.json not found")
            return issues, warnings
        
        # Parse manifest
        manifest_text = z.read('manifest.json').decode('utf-8')
        manifest = json.loads(manifest_text)
        
        # Validate manifest version
        if manifest.get('manifest_version') != 3:
            issues.append(f"❌ Invalid manifest_version: {manifest.get('manifest_version')} (must be 3)")
        else:
            print(f"✓ Manifest version: {manifest['manifest_version']}")
        
        # Check required fields
        if not manifest.get('name'):
            issues.append("❌ Missing: name")
        else:
            print(f"✓ Name: {manifest['name']}")
        
        if not manifest.get('version'):
            issues.append("❌ Missing: version")
        else:
            print(f"✓ Version: {manifest['version']}")
        
        if not manifest.get('description'):
            warnings.append("⚠ Missing: description")
        else:
            print(f"✓ Description: {manifest['description'][:50]}...")
        
        # Check gecko ID
        gecko_id = manifest.get('browser_specific_settings', {}).get('gecko', {}).get('id')
        if not gecko_id:
            warnings.append("⚠ No gecko ID specified (required for submission)")
        else:
            print(f"✓ Gecko ID: {gecko_id}")
            if not gecko_id.startswith('{') or not gecko_id.endswith('}'):
                issues.append(f"❌ Invalid gecko ID format: {gecko_id}")
        
        # Check permissions
        perms = manifest.get('permissions', [])
        if not perms:
            warnings.append("⚠ No permissions declared")
        else:
            print(f"✓ Permissions: {', '.join(perms[:3])}...")
        
        # Check content scripts
        scripts = manifest.get('content_scripts', [])
        if not scripts:
            warnings.append("⚠ No content scripts defined")
        else:
            print(f"✓ Content scripts: {len(scripts)}")
        
        # Check file paths (must use forward slashes)
        print("\n✓ File paths (must use forward slashes):")
        files = z.namelist()
        bad_paths = [f for f in files if '\\' in f]
        if bad_paths:
            issues.append(f"❌ Files with backslashes: {bad_paths}")
        else:
            for f in sorted(files):
                print(f"    {f}")
        
        # Check required files
        required = ['manifest.json', 'background.js', 'content-script.js']
        missing = [f for f in required if f not in files]
        if missing:
            issues.append(f"❌ Missing required files: {missing}")
    
    print("\n" + "=" * 60)
    return issues, warnings

if __name__ == '__main__':
    xpi_path = 'xpi-output/gpt-collapse-expand.xpi'
    issues, warnings = validate_xpi(xpi_path)
    
    if warnings:
        print("\nWARNINGS:")
        for w in warnings:
            print(f"  {w}")
    
    if issues:
        print("\nERRORS:")
        for e in issues:
            print(f"  {e}")
        print("\n❌ VALIDATION FAILED")
        exit(1)
    else:
        print("\n✅ VALIDATION PASSED - Ready for Firefox submission")
        exit(0)
