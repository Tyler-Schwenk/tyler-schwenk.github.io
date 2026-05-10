"""One-time browser OAuth setup for Pac-Tyler Strava integration.

run this manually once on any machine with a browser to authorize with
Strava. it saves a token file to TOKEN_FILE so main.py can run headlessly
from then on.

    python auth_setup.py
"""

import logging
import os
import webbrowser

from dotenv import load_dotenv

from config import DOTENV_FILE, REDIRECT_URI, TOKEN_FILE
from utils.oauth_server import run_server
from utils.strava_client import StravaClient

LOGGING_FORMAT = "%(asctime)s - %(levelname)s - %(message)s"


def configure_logging() -> None:
    """Configure logging for the setup script.

    Returns:
        None
    """
    logging.basicConfig(level=logging.INFO, format=LOGGING_FORMAT)


def load_strava_credentials() -> tuple[str, str]:
    """Load Strava credentials from env or .env file.

    Returns:
        tuple: Client ID and client secret.

    Raises:
        ValueError: If credentials are missing.
    """
    if DOTENV_FILE.exists():
        load_dotenv(dotenv_path=DOTENV_FILE, override=False)

    client_id = os.getenv("CLIENT_ID")
    client_secret = os.getenv("CLIENT_SECRET")

    if not client_id or not client_secret:
        raise ValueError(
            "CLIENT_ID and CLIENT_SECRET must be set in the environment or .env file."
        )

    return client_id, client_secret


def main() -> None:
    """Run the one-time Strava OAuth flow and save the resulting token.

    opens a browser for Strava authorization, captures the callback code,
    exchanges it for tokens, and saves them to TOKEN_FILE.

    Returns:
        None
    """
    configure_logging()

    try:
        client_id, client_secret = load_strava_credentials()
    except ValueError as exc:
        logging.error("%s", exc)
        return

    strava = StravaClient(
        client_id=client_id,
        client_secret=client_secret,
        redirect_uri=REDIRECT_URI,
    )

    url = strava.get_authorization_url()
    logging.info("Opening browser for Strava authorization...")
    webbrowser.open_new(url)

    authorization_code = run_server()

    if not authorization_code:
        logging.error("No authorization code received. Check the browser and try again.")
        return

    strava.authenticate(authorization_code, token_path=TOKEN_FILE)
    logging.info("Token saved to %s. You can now run main.py headlessly.", TOKEN_FILE)


if __name__ == "__main__":
    main()
