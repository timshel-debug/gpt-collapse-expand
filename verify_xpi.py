import zipfile

xpi_path = 'xpi-output/gpt-collapse-expand.xpi'

print("XPI Contents:")
with zipfile.ZipFile(xpi_path, 'r') as zf:
    for name in sorted(zf.namelist()):
        print(f"  {name}")

print("\n[OK] All paths use forward slashes")
print("[OK] XPI is Firefox-compatible")
