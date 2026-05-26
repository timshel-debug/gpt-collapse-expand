#!/usr/bin/env python3
"""Build XPI with proper forward-slash paths for Firefox"""
import os
import zipfile
from pathlib import Path

def build_xpi():
    script_dir = Path(__file__).parent
    xpi_dir = script_dir / 'xpi-output'
    xpi_path = xpi_dir / 'gpt-collapse-expand.xpi'
    
    # Remove old XPI
    if xpi_path.exists():
        xpi_path.unlink()
        print('[OK] Removed old XPI')
    
    # Create XPI (ZIP archive)
    with zipfile.ZipFile(xpi_path, 'w', zipfile.ZIP_DEFLATED) as zf:
        # Add root files
        root_files = [
            'manifest.json',
            'background.js',
            'content-script.js',
            'options.html',
            'options.js',
            'content-styles.css'
        ]
        
        for filename in root_files:
            filepath = script_dir / filename
            if filepath.exists():
                zf.write(filepath, arcname=filename)
                print(f'  + {filename}')
        
        # Add icon files with forward slashes
        icons_dir = script_dir / 'icons'
        if icons_dir.exists():
            for icon_file in icons_dir.rglob('*'):
                if icon_file.is_file():
                    # Use forward slashes in archive
                    arcname = icon_file.relative_to(script_dir).as_posix()
                    zf.write(icon_file, arcname=arcname)
                    print(f'  + {arcname}')
    
    # Report
    size_kb = xpi_path.stat().st_size / 1024
    print()
    print('[SUCCESS] XPI package created')
    print(f'  File: {xpi_path.name}')
    print(f'  Size: {size_kb:.2f} KB')
    print(f'  Path: {xpi_path}')

if __name__ == '__main__':
    os.chdir(Path(__file__).parent)
    build_xpi()
