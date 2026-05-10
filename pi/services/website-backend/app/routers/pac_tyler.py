"""
Pac-Tyler router for serving Strava activity data.

Serves the GeoJSON track file and derived activity dataset that the
pac-tyler-updater writes daily. data lives at PAC_TYLER_DATA_DIR on the
host, mounted into the container as a read-only volume.
"""

from pathlib import Path

from fastapi import APIRouter, HTTPException
from fastapi.responses import FileResponse

from app.config import settings

router = APIRouter(prefix="/pac-tyler", tags=["Pac-Tyler"])

GEOJSON_FILENAME = "cleaned_output.geojson"
ACTIVITIES_FILENAME = "pac-tyler-activities.json"


def _get_data_file(filename: str) -> Path:
    """Resolve a data file path and raise 503 if it doesnt exist yet.

    Args:
        filename (str): File name within the pac-tyler data directory.

    Returns:
        Path: Resolved path to the file.

    Raises:
        HTTPException: 503 if the file hasnt been generated yet.
    """
    path = Path(settings.PAC_TYLER_DATA_DIR) / filename
    if not path.exists():
        raise HTTPException(
            status_code=503,
            detail=f"{filename} not yet available. The updater may not have run yet.",
        )
    return path


@router.get("/geojson", summary="GeoJSON activity tracks")
async def get_geojson() -> FileResponse:
    """
    Return the GeoJSON FeatureCollection of all Strava activity tracks.

    Returns:
        FileResponse: GeoJSON file with all recorded routes.
    """
    path = _get_data_file(GEOJSON_FILENAME)
    return FileResponse(path, media_type="application/json")


@router.get("/activities", summary="Derived activity dataset")
async def get_activities() -> FileResponse:
    """
    Return the flat activity dataset used for frontend analytics.

    Returns:
        FileResponse: JSON file with activity list and summary stats.
    """
    path = _get_data_file(ACTIVITIES_FILENAME)
    return FileResponse(path, media_type="application/json")
