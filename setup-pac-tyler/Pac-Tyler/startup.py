"""Bootstrap script to install dependencies and run the updater."""

import os
import subprocess
import sys
from typing import Dict

REQUIREMENTS_FILE = "requirements.txt"
MAIN_SCRIPT = "src/main.py"

def install_requirements() -> None:
    """Install Python dependencies from the requirements file.

    Returns:
        None
    """
    subprocess.check_call([sys.executable, "-m", "pip", "install", "-r", REQUIREMENTS_FILE])

def build_environment() -> Dict[str, str]:
    """Build the environment for running the updater.

    Returns:
        dict: Environment variables for subprocess execution.
    """
    env = os.environ.copy()
    env["PYTHONPATH"] = os.path.abspath(".")
    return env

def run_updater(env: Dict[str, str]) -> None:
    """Run the updater entry point.

    Args:
        env (dict): Environment variables for the subprocess.

    Returns:
        None
    """
    subprocess.check_call([sys.executable, MAIN_SCRIPT], env=env)

def main() -> None:
    """Install dependencies and run the updater workflow.

    Returns:
        None
    """
    install_requirements()
    env = build_environment()
    run_updater(env)

if __name__ == "__main__":
    main()
