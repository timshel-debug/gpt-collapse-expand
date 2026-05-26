import json
from pathlib import Path

manifest_path = Path('manifest.json')
manifest = json.loads(manifest_path.read_text())

print("Source manifest.json on disk:")
print(f"  Version:   {manifest['version']}")
print(f"  Gecko ID:  {manifest['browser_specific_settings']['gecko']['id']}")
print()

# Now check what's in the XPI
import zipfile
xpi_path = Path('xpi-output/gpt-collapse-expand.xpi')
if xpi_path.exists():
    with zipfile.ZipFile(xpi_path, 'r') as z:
        xpi_manifest = json.loads(z.read('manifest.json'))
        print("Manifest in current XPI:")
        print(f"  Version:   {xpi_manifest['version']}")
        print(f"  Gecko ID:  {xpi_manifest['browser_specific_settings']['gecko']['id']}")
        
        if manifest['browser_specific_settings']['gecko']['id'] == xpi_manifest['browser_specific_settings']['gecko']['id']:
            print("\n✓ IDs match - XPI is current")
        else:
            print("\n❌ IDs don't match - need to rebuild")
else:
    print("No XPI found")
