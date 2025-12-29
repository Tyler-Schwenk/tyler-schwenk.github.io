"""
HEIC to JPG Converter for Gallery Images
Converts all .heic and .HEIC files in the gallery folders to .jpg format
"""

import os
from pathlib import Path

try:
    from PIL import Image
    from pillow_heif import register_heif_opener
    register_heif_opener()
    print("✓ Required libraries loaded")
except ImportError as e:
    print("❌ Missing required library!")
    print("Please run: pip install pillow pillow-heif")
    exit(1)

# Define the gallery folders to process
gallery_folders = [
    r"public\images\gallery\friends",
    r"public\images\gallery\palestinepals",
    r"public\images\gallery\family",
    r"public\images\gallery\college"
]

def convert_heic_to_jpg(heic_path):
    """Convert a single HEIC file to JPG"""
    try:
        # Open and convert
        img = Image.open(heic_path)
        
        # Convert to RGB if necessary
        if img.mode != 'RGB':
            img = img.convert('RGB')
        
        # Create new filename with .jpg extension
        jpg_path = heic_path.with_suffix('.jpg')
        
        # Save as JPG
        img.save(jpg_path, 'JPEG', quality=90)
        
        print(f"✓ Converted: {heic_path.name} → {jpg_path.name}")
        return True
    except Exception as e:
        print(f"✗ Failed to convert {heic_path.name}: {e}")
        return False

def main():
    total_converted = 0
    total_failed = 0
    
    print("Starting HEIC to JPG conversion...\n")
    
    for folder in gallery_folders:
        folder_path = Path(folder)
        
        if not folder_path.exists():
            print(f"⚠ Folder not found: {folder}")
            continue
        
        print(f"\n📁 Processing: {folder}")
        
        # Find all HEIC files (case-insensitive)
        heic_files = list(folder_path.glob('*.heic')) + list(folder_path.glob('*.HEIC'))
        
        if not heic_files:
            print(f"  No HEIC files found")
            continue
        
        print(f"  Found {len(heic_files)} HEIC files")
        
        for heic_file in heic_files:
            if convert_heic_to_jpg(heic_file):
                total_converted += 1
            else:
                total_failed += 1
    
    print(f"\n{'='*50}")
    print(f"✓ Successfully converted: {total_converted} files")
    if total_failed > 0:
        print(f"✗ Failed to convert: {total_failed} files")
    print(f"{'='*50}")
    
    if total_converted > 0:
        print("\n⚠ Note: Original HEIC files are still in the folders.")
        print("You can delete them manually if you want to save space.")

if __name__ == "__main__":
    main()
