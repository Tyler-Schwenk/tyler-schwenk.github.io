# Pac-Tyler

<p align="center">
<!--     <a href="https://github.com/Tyler-Schwenk/Pac-Tyler/actions"><img alt="CI Status" src="https://github.com/Tyler-Schwenk/Pac-Tyler/actions/workflows/ci.yaml/badge.svg?branch=main"></a>
    <a href="https://Pac-Tyler.readthedocs.io/en/latest"><img alt="Documentation Status" src="https://readthedocs.org/projects/Pac-Tyler/badge/?version=latest"></a>
    <a href="https://pypi.org/project/Pac-Tyler"><img alt="PyPI" src="https://img.shields.io/pypi/v/Pac-Tyler.svg"></a>
    <a href="https://github.com/Tyler-Schwenk/Pac-Tyler"><img alt="Code style: black" src="https://img.shields.io/badge/code%20style-black-000000.svg"></a>
    <a href="https://codecov.io/gh/Tyler-Schwenk/Pac-Tyler"><img alt="Coverage Status" src="https://codecov.io/gh/Tyler-Schwenk/Pac-Tyler/branch/main/graph/badge.svg"></a> -->
    <a href="https://www.gnu.org/licenses/agpl-3.0"><img alt="License: GNU Affero General Public License v3.0" src="https://img.shields.io/badge/License-AGPL_v3-blue.svg"></a>
    <a href="https://github.com/Tyler-Schwenk/Pac-Tyler/issues"><img alt="Issue Badge" src="https://img.shields.io/github/issues/Tyler-Schwenk/Pac-Tyler"></a>
    <a href="https://github.com/Tyler-Schwenk/Pac-Tyler/pulls"><img alt="Pull requests Badge" src="https://img.shields.io/github/issues-pr/Tyler-Schwenk/Pac-Tyler"></a>
</p>

## Overview

Tracking my attempt to run/bike the length of every street in San Diego. Current progress [Here](https://tyler-schwenk.github.io/pac-tyler.html).

Inspired by Pac-Tom: [Watch Here](https://www.youtube.com/watch?v=1c8i5SABqwU).

## How It Works

This script automates the data retrieval process, so the user only needs to log in to Strava and grant authentication permission.

### Features
- **Automated Data Retrieval**: The script downloads all activities from Strava and can optionally reduce GPS point density through configuration to control file size.
- **Idempotent Updates**: New activities are automatically added without duplicating data.
- **Error Correction**: The script cleans errors in the data provided by Strava. If a user pauses their activity, moves, and then unpauses, it may draw a straight line between the points, creating a false path. The script splits tracks when the distance between consecutive points exceeds the pause threshold.
- **Analytics Export**: The script exports a normalized activity dataset to `public/data/pac-tyler-activities.json` in the website repository.

## Usage

### Prerequisites
- Set `CLIENT_ID` and `CLIENT_SECRET` in your environment or a `.env` file (supported locations: `setup-pac-tyler/Pac-Tyler/.env` and `setup-pac-tyler/.env`)

### Run the updater
1. Run `startup.py` to install dependencies and execute the updater
2. Authorize the app in the browser when prompted
3. The script writes `cleaned_output.geojson` at the repository root
4. A small lookback window is used to avoid missing recent activities; duplicates are removed automatically
5. Activity types and dates are normalized
6. Coordinates are validated; simplification is optional via configuration
7. The script also writes `public/data/pac-tyler-activities.json` for frontend analytics
8. Optional override: set `PAC_TYLER_LOOKBACK_DAYS` to change the lookback window
