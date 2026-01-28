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
- **Automated Data Retrieval**: The script downloads all activities from Strava, resampling to use fewer GPS points for a more manageable file size.
- **Idempotent Updates**: New activities are automatically added without duplicating data.
- **Error Correction**: The script cleans errors in the data provided by Strava. If a user pauses their activity, moves, and then unpauses, it may draw a straight line between the points, creating a false path. The script identifies and removes these false paths.

## Usage

### Prerequisites
- Set `CLIENT_ID` and `CLIENT_SECRET` in your environment or a `.env` file

### Run the updater
1. Run `startup.py` to install dependencies and execute the updater
2. Authorize the app in the browser when prompted
3. The script writes `cleaned_output.geojson` at the repository root
