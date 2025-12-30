from PIL import Image
import pillow_heif
import os
from pathlib import Path

# Register HEIF opener with Pillow
pillow_heif.register_heif_opener()

# Base gallery directory
gallery_dir = Path("public/images/gallery")

# Find all HEIC files recursively
heic_files = list(gallery_dir.rglob("*.heic")) + list(gallery_dir.rglob("*.HEIC"))

print(f"Found {len(heic_files)} HEIC files to convert")

converted_count = 0
for heic_path in heic_files:
    try:
        # Open and convert to RGB
        img = Image.open(heic_path)
        if img.mode != 'RGB':
            img = img.convert('RGB')
        
        # Create JPG path (same location, different extension)
        jpg_path = heic_path.with_suffix('.jpg')
        
        # Save as JPG
        img.save(jpg_path, 'JPEG', quality=95)
        print(f"Converted: {heic_path.name} -> {jpg_path.name}")
        converted_count += 1
        
    except Exception as e:
        print(f"Error converting {heic_path}: {e}")

print(f"\nSuccessfully converted {converted_count} files")
