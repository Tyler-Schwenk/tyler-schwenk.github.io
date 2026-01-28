"""Minimal OAuth callback server for Strava authentication."""

import logging
from http.server import HTTPServer, BaseHTTPRequestHandler
from typing import Optional
from urllib.parse import urlparse, parse_qs

from config import OAUTH_PORT

authorization_code: Optional[str] = None

class OAuthCallbackHandler(BaseHTTPRequestHandler):
    """HTTP handler that captures the authorization code from the callback."""

    def do_GET(self) -> None:
        """Handle the OAuth redirect and capture the authorization code.

        Returns:
            None
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

def run_server() -> Optional[str]:
    """Run a single-request HTTP server to capture the OAuth callback.

    Returns:
        Optional[str]: Authorization code if present.
    """
    server_address = ("", OAUTH_PORT)
    httpd = HTTPServer(server_address, OAuthCallbackHandler)
    logging.info("Starting HTTP server for OAuth callback on port %s.", OAUTH_PORT)
    httpd.handle_request()
    return authorization_code
