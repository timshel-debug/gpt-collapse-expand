#!/usr/bin/env python3
"""Update manifest.json with correct AMO ID"""
import json
from pathlib import Path

manifest_path = Path('manifest.json')
manifest = json.loads(manifest_path.read_text())

# Set to correct AMO ID
correct_id = "{b7f9c8e6-d3a2-4f1b-9e8a-c5d2f1a8e7b9}"
old_id = manifest['browser_specific_settings']['gecko']['id']

if old_id != correct_id:
    manifest['browser_specific_settings']['gecko']['id'] = correct_id
    manifest_path.write_text(json.dumps(manifest, indent=2) + '\n')
    print(f"✓ Updated manifest.json")
    print(f"  Old ID: {old_id}")
    print(f"  New ID: {correct_id}")
else:
    print(f"✓ Manifest already has correct ID: {correct_id}")
