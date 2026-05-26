#!/usr/bin/env python3
import json
import zipfile
from pathlib import Path

# Check source manifest
source = json.loads(Path('manifest.json').read_text())
source_id = source['browser_specific_settings']['gecko']['id']

# Check XPI manifest
with zipfile.ZipFile('xpi-output/gpt-collapse-expand.xpi', 'r') as z:
    xpi = json.loads(z.read('manifest.json'))
    xpi_id = xpi['browser_specific_settings']['gecko']['id']

print("=== Manifest ID Verification ===")
print(f"Source manifest.json:  {source_id}")
print(f"Packaged XPI:          {xpi_id}")
print()

expected_amo_id = "{b7f9c8e6-d3a2-4f1b-9e8a-c5d2f1a8e7b9}"
print(f"Expected AMO ID:       {expected_amo_id}")
print()

if source_id == expected_amo_id and xpi_id == expected_amo_id:
    print("✓ SUCCESS: All IDs match AMO registration")
elif source_id == expected_amo_id:
    print("⚠ WARNING: Source correct but XPI needs rebuild")
else:
    print(f"❌ ERROR: Source has wrong ID")
    print(f"   Current: {source_id}")
    print(f"   Expected: {expected_amo_id}")
