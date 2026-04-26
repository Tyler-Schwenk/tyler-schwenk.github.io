#!/usr/bin/env python3
"""Photo migration script for Website Backend API.

Scans photo directories and registers them in the database via API.
Requires admin credentials to authenticate before creating galleries.

Run inside Docker container:
    docker exec website-backend-api python scripts/migrate_photos.py --password YOUR_PASSWORD
"""

import argparse
import os
import sys
from pathlib import Path
import httpx
from typing import Dict, Optional


# API configuration
ADMIN_EMAIL = "tylerschwenk1@yahoo.com"
API_BASE_URL = "http://localhost:8000"
PHOTOS_DIR = Path("/app/photos")

# Supported image extensions
IMAGE_EXTENSIONS = {".jpg", ".jpeg", ".png", ".gif", ".webp", ".JPG", ".JPEG", ".PNG"}

# Folders that are not real photo galleries — skip them
SKIP_FOLDERS = {"reasons", "sort", "thumbnails"}

# Gallery metadata — title and description for each folder slug
GALLERY_CONFIG: Dict[str, Dict[str, str]] = {
    "jordan": {
        "title": "Jordan",
        "description": "Lovely time in Jordan. February 2026"
    },
    "durango": {
        "title": "Durango",
        "description": "Visiting Jeff for 2 nights of backpacking after he finished the Colorado Trail.\nSept 5-8, 2025"
    },
    "elcap": {
        "title": "El Cap",
        "description": "Via triple direct.\nMay 10-16, 2025"
    },
    "halfdome": {
        "title": "Half Dome",
        "description": "Via Regular Northwest Face\nMay 2024"
    },
    "enchantments": {
        "title": "The Enchantments",
        "description": "Backpacking & Aasgard Sentinel\nJuly 2021"
    },
    "epc": {
        "title": "El Potrero Chico",
        "description": "From a few trips across multiple years\n2023, 2024, 2025"
    },
    "bikenite": {
        "title": "Bike Nite",
        "description": ""
    },
    "celciliawedding": {
        "title": "Cecilia's Wedding",
        "description": "Friends stayed with my family in phl, then went to the wedding at Cecilia's family farm, and finished with some NYC nightlife"
    },
    "instinct": {
        "title": "Portland, OR",
        "description": "Full grind mode at the Instinct headquarters assembling the new ASU 3's for launch. March 2026"
    },
    "friends": {
        "title": "Friends",
        "description": ""
    },
    "family": {
        "title": "Family",
        "description": "and Funtown"
    },
    "college": {
        "title": "College",
        "description": "Trash house"
    },
    "palestinepals": {
        "title": "Palestine Pals",
        "description": "Free Palestine"
    },
}


def get_gallery_metadata(folder_name: str) -> Dict[str, str]:
    """
    Get gallery metadata for a folder.

    Looks up by lowercased folder name so capitalization variations dont matter.

    Args:
        folder_name: Name of the folder on disk.

    Returns:
        Dict with title and description keys.
    """
    key = folder_name.lower()
    if key in GALLERY_CONFIG:
        return GALLERY_CONFIG[key]

    # fallback: clean up the folder name
    title = folder_name.replace("-", " ").replace("_", " ").title()
    return {"title": title, "description": ""}


def login(client: httpx.Client, password: str) -> str:
    """
    Authenticate with the API and return a JWT token.

    Args:
        client: HTTP client.
        password: Admin account password.

    Returns:
        Bearer token string.

    Raises:
        SystemExit: If login fails.
    """
    response = client.post(
        "/auth/login",
        data={"username": ADMIN_EMAIL, "password": password},
        headers={"Content-Type": "application/x-www-form-urlencoded"},
    )
    if response.status_code != 200:
        print(f"ERROR: login failed ({response.status_code}) — check your password")
        sys.exit(1)
    token = response.json()["access_token"]
    print(f"Logged in as {ADMIN_EMAIL}\n")
    return token


def create_gallery(client: httpx.Client, folder_name: str) -> Optional[int]:
    """
    Create a gallery via API, or return the existing gallery's ID.

    Args:
        client: HTTP client with auth headers already set.
        folder_name: Folder name used as the gallery slug.

    Returns:
        Gallery ID if successful, None otherwise.
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


def migrate_photos(password: str) -> None:
    """
    Migrate photos from filesystem to database.

    Logs in, scans photo directories, creates galleries, and uploads all images.
    Skips folders in SKIP_FOLDERS and galleries that already exist.

    Args:
        password: Admin account password used to get a JWT.
    """
    if not PHOTOS_DIR.exists():
        print(f"ERROR: Photos directory not found: {PHOTOS_DIR}")
        sys.exit(1)
    
    print(f"Scanning photos directory: {PHOTOS_DIR}")
    print(f"API base URL: {API_BASE_URL}\n")

    # Find all subdirectories, skip non-gallery folders
    folders = [
        d for d in PHOTOS_DIR.iterdir()
        if d.is_dir() and not d.name.startswith(".") and d.name.lower() not in SKIP_FOLDERS
    ]

    if not folders:
        print("No photo folders found.")
        return

    print(f"Found {len(folders)} photo folders\n")

    with httpx.Client(base_url=API_BASE_URL) as client:
        token = login(client, password)
        client.headers.update({"Authorization": f"Bearer {token}"})
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
    parser = argparse.ArgumentParser(description="migrate photos from disk into the gallery database")
    parser.add_argument("--password", required=True, help="admin account password")
    args = parser.parse_args()
    migrate_photos(args.password)
