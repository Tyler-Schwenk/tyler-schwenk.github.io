#!/usr/bin/env python3
"""
Photo migration script for Website Backend API.

Scans photo directories and registers them in the database via API.
Run inside Docker container: docker exec website-backend-api python scripts/migrate_photos.py
"""

import os
import sys
from pathlib import Path
import httpx
from typing import Dict, Optional


# API configuration
API_BASE_URL = "http://localhost:8000"
PHOTOS_DIR = Path("/app/photos")

# Supported image extensions
IMAGE_EXTENSIONS = {".jpg", ".jpeg", ".png", ".gif", ".webp", ".JPG", ".JPEG", ".PNG"}

# Gallery metadata mapping - customize titles and descriptions here
GALLERY_CONFIG: Dict[str, Dict[str, str]] = {
    "jordan": {
        "title": "Jordan",
        "description": "Lovely time in Jordan. February 2026"
    },
    "durango": {
        "title": "Durango",
        "description": "Climbing trip to Durango"
    },
    "elcap": {
        "title": "El Capitan",
        "description": "El Cap climb"
    },
    "halfdome": {
        "title": "Half Dome",
        "description": "Half Dome climb"
    },
    "enchantments": {
        "title": "Enchantments",
        "description": "Enchantments backpacking trip"
    },
    "epc": {
        "title": "El Potrero Chico",
        "description": "Climbing in El Potrero Chico"
    },
    "bikenite": {
        "title": "Bike Nite",
        "description": "Bike Nite events"
    },
    "Celciliawedding": {
        "title": "Celcilia's Wedding",
        "description": "Wedding celebration"
    },
    "friends": {
        "title": "Friends",
        "description": "Memories with friends"
    },
    "family": {
        "title": "Family",
        "description": "Family photos"
    },
    "college": {
        "title": "College",
        "description": "College memories"
    },
    "palestinepals": {
        "title": "Palestine Solidarity",
        "description": "Palestine solidarity event"
    }
}


def get_gallery_metadata(folder_name: str) -> Dict[str, str]:
    """
    Get gallery metadata for a folder.
    
    Args:
        folder_name: Name of the folder
        
    Returns:
        Dictionary with title and description
    """
    if folder_name in GALLERY_CONFIG:
        return GALLERY_CONFIG[folder_name]
    
    # Default: capitalize folder name
    title = folder_name.replace("-", " ").replace("_", " ").title()
    return {"title": title, "description": f"{title} gallery"}


def create_gallery(client: httpx.Client, folder_name: str) -> Optional[int]:
    """
    Create a gallery via API.
    
    Args:
        client: HTTP client
        folder_name: Folder name to use as slug
        
    Returns:
        Gallery ID if successful, None otherwise
    """
    slug = folder_name.lower()
    metadata = get_gallery_metadata(folder_name)
    
    # Check if gallery already exists
    try:
        response = client.get(f"/galleries/slug/{slug}")
        if response.status_code == 200:
            gallery = response.json()
            print(f"  Gallery '{metadata['title']}' already exists (ID: {gallery['id']})")
            return gallery["id"]
    except Exception:
        pass
    
    # Create new gallery
    try:
        response = client.post(
            "/galleries",
            json={
                "name": metadata["title"],
                "slug": slug,
                "description": metadata["description"],
                "is_public": True
            }
        )
        response.raise_for_status()
        gallery = response.json()
        print(f"  Created gallery '{metadata['title']}' (ID: {gallery['id']})")
        return gallery["id"]
    except Exception as e:
        print(f"  ERROR creating gallery '{metadata['title']}': {e}")
        return None


def upload_photo(client: httpx.Client, gallery_id: int, photo_path: Path, display_order: int) -> bool:
    """
    Upload a photo to a gallery via API.
    
    Args:
        client: HTTP client
        gallery_id: Target gallery ID
        photo_path: Path to photo file
        display_order: Display order in gallery
        
    Returns:
        True if successful, False otherwise
    """
    try:
        with open(photo_path, "rb") as f:
            files = {"file": (photo_path.name, f, "image/jpeg")}
            data = {
                "title": photo_path.stem.replace("-", " ").replace("_", " ").title(),
                "display_order": str(display_order)
            }
            
            response = client.post(
                f"/galleries/{gallery_id}/photos",
                files=files,
                data=data,
                timeout=30.0
            )
            response.raise_for_status()
            print(f"    Uploaded: {photo_path.name}")
            return True
    except Exception as e:
        print(f"    ERROR uploading {photo_path.name}: {e}")
        return False


def migrate_photos():
    """
    Migrate photos from filesystem to database.
    
    Scans photo directories and registers all images via API.
    Creates galleries and uploads photos with automatic thumbnail generation.
    """
    if not PHOTOS_DIR.exists():
        print(f"ERROR: Photos directory not found: {PHOTOS_DIR}")
        sys.exit(1)
    
    print(f"Scanning photos directory: {PHOTOS_DIR}")
    print(f"API base URL: {API_BASE_URL}\n")
    
    # Find all subdirectories
    folders = [d for d in PHOTOS_DIR.iterdir() if d.is_dir() and not d.name.startswith(".")]
    
    if not folders:
        print("No photo folders found.")
        return
    
    print(f"Found {len(folders)} photo folders\n")
    
    # Create HTTP client
    with httpx.Client(base_url=API_BASE_URL) as client:
        total_photos = 0
        total_galleries = 0
        
        for folder in sorted(folders):
            print(f"\nProcessing folder: {folder.name}")
            
            # Create gallery
            gallery_id = create_gallery(client, folder.name)
            if not gallery_id:
                continue
            
            total_galleries += 1
            
            # Find all images in folder
            images = [
                f for f in folder.iterdir()
                if f.is_file() and f.suffix in IMAGE_EXTENSIONS
            ]
            
            if not images:
                print(f"  No images found in {folder.name}")
                continue
            
            print(f"  Found {len(images)} images")
            
            # Upload each image
            for idx, image_path in enumerate(sorted(images)):
                if upload_photo(client, gallery_id, image_path, idx):
                    total_photos += 1
        
        print(f"\n{'='*60}")
        print(f"Migration complete!")
        print(f"  Galleries created: {total_galleries}")
        print(f"  Photos uploaded: {total_photos}")
        print(f"{'='*60}")


if __name__ == "__main__":
    migrate_photos()
