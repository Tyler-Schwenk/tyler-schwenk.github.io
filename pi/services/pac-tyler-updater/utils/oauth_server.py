"""Minimal OAuth callback server for one-time Strava authorization."""

import logging
from http.server import BaseHTTPRequestHandler, HTTPServer
from typing import Optional
from urllib.parse import parse_qs, urlparse

from config import OAUTH_PORT

authorization_code: Optional[str] = None


class OAuthCallbackHandler(BaseHTTPRequestHandler):
    """HTTP handler that captures the authorization code from the Strava callback."""

    def do_GET(self) -> None:
        """Handle the OAuth redirect GET request and capture the code.

        Returns:
            None

        Side Effects:
            Sets the module-level authorization_code variable.
        """
        global authorization_code
        parsed_path = urlparse(self.path)
        query = parse_qs(parsed_path.query)
        authorization_code = query.get("code", [None])[0]

        logging.info("Authorization code received.")

        self.send_response(200)
        self.send_header("Content-type", "text/html")
        self.end_headers()
        self.wfile.write(b"You can close this window now.")

    def log_message(self, format: str, *args: Any) -> None:  # noqa: A002
        """Suppress default request logging to keep output clean.

        Args:
            format (str): Log format string (unused).
            *args: Log arguments (unused).

        Returns:
            None
        """


def run_server() -> Optional[str]:
    """Start a one-shot HTTP server to capture the OAuth callback.

    Returns:
        Optional[str]: Authorization code from the callback, or None.
    """
    server_address = ("", OAUTH_PORT)
    httpd = HTTPServer(server_address, OAuthCallbackHandler)
    logging.info("Waiting for Strava OAuth callback on port %s...", OAUTH_PORT)
    try:
        httpd.handle_request()
    finally:
        httpd.server_close()
    return authorization_code
