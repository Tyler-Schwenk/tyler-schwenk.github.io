"""Export a derived activity dataset from the existing GeoJSON file."""

import logging
from pathlib import Path
import sys

PROJECT_SRC = Path(__file__).resolve().parent / "src"
SYS_PATH_INSERT_INDEX = 0

sys.path.insert(SYS_PATH_INSERT_INDEX, str(PROJECT_SRC))

from src.utils.activity_dataset import save_activity_dataset
from src.utils.file_utils import load_existing_geojson

LOGGING_FORMAT = "%(asctime)s - %(levelname)s - %(message)s"


def configure_logging() -> None:
    """Configure logging for the export script.

    Returns:
        None
    """
    logging.basicConfig(level=logging.INFO, format=LOGGING_FORMAT)


def main() -> None:
    """Run the dataset export workflow.

    Returns:
        None
    """
    configure_logging()
    geojson = load_existing_geojson()
    dataset = save_activity_dataset(geojson)
    logging.info("Saved activity dataset with %s entries.", dataset["activity_count"])


if __name__ == "__main__":
    main()
