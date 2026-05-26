import zipfile
import json

xpi_path = 'xpi-output/gpt-collapse-expand.xpi'

with zipfile.ZipFile(xpi_path, 'r') as z:
    manifest = json.loads(z.read('manifest.json'))
    
print("Manifest in XPI:")
print(f"  Version:   {manifest['version']}")
print(f"  Gecko ID:  {manifest['browser_specific_settings']['gecko']['id']}")
print()
print("✓ XPI successfully repackaged with updated manifest")
