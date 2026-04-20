import json
import urllib.request
import urllib.error
import os
from http.server import BaseHTTPRequestHandler


class handler(BaseHTTPRequestHandler):

    def log_message(self, fmt, *args):
        pass  # Silences default request logging

    def do_OPTIONS(self):
        self.send_response(204)
        self._set_cors_headers()
        self.end_headers()

    def do_POST(self):
        api_key = os.environ.get("ANTHROPIC_API_KEY", "")

        if not api_key:
            self._respond(500, {
                "error": "ANTHROPIC_API_KEY no configurada. "
                         "Agrégala en Vercel: Settings → Environment Variables."
            })
            return

        length = int(self.headers.get("Content-Length", 0))
        body = self.rfile.read(length)

        try:
            req = urllib.request.Request(
                "https://api.anthropic.com/v1/messages",
                data=body,
                headers={
                    "Content-Type": "application/json",
                    "x-api-key": api_key,
                    "anthropic-version": "2023-06-01",
                },
                method="POST",
            )
            with urllib.request.urlopen(req, timeout=60) as resp:
                self._respond_raw(200, resp.read())

        except urllib.error.HTTPError as e:
            self._respond_raw(e.code, e.read())
        except Exception as ex:
            self._respond(500, {"error": str(ex)})

    def _set_cors_headers(self):
        self.send_header("Access-Control-Allow-Origin", "*")
        self.send_header("Access-Control-Allow-Methods", "POST, OPTIONS")
        self.send_header("Access-Control-Allow-Headers", "Content-Type")

    def _respond(self, code, data):
        payload = json.dumps(data).encode()
        self.send_response(code)
        self.send_header("Content-Type", "application/json")
        self._set_cors_headers()
        self.end_headers()
        self.wfile.write(payload)

    def _respond_raw(self, code, raw_bytes):
        self.send_response(code)
        self.send_header("Content-Type", "application/json")
        self._set_cors_headers()
        self.end_headers()
        self.wfile.write(raw_bytes)
