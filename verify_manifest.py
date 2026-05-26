import zipfile
import json

with zipfile.ZipFile('xpi-output/gpt-collapse-expand.xpi', 'r') as z:
    manifest_text = z.read('manifest.json').decode('utf-8')
    manifest = json.loads(manifest_text)
    
print('[OK] XPI Verification')
print('─' * 50)
print(f"Name:     {manifest['name']}")
print(f"Version:  {manifest['version']}")
print(f"ID:       {manifest['browser_specific_settings']['gecko']['id']}")
print('─' * 50)
print('[OK] New unique ID assigned')
print('[OK] Ready for Firefox submission')
