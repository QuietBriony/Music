#!/usr/bin/env python3
"""
scripts/hazama-fm-capture-receiver.py
=====================================
Tiny CORS-enabled POST receiver for the autonomous Phase 2 capture flow
(see docs/HAZAMA-FM-MEASUREMENT.md "Capture — autonomous").

The Claude Code preview MCP records fm.html playback in-page, decodes it to
a 16-bit PCM WAV (webm -> decodeAudioData -> OfflineAudioContext -> WAV),
base64-encodes it, and POSTs the base64 here. This receiver decodes and
writes the .wav to captures/ — so the audio bytes go browser -> disk
WITHOUT passing through the agent's context (a ~2 MB base64 string would
otherwise blow the token budget).

Run (background) from the repo root, then POST from the preview page:
    python -X utf8 scripts/hazama-fm-capture-receiver.py [pill] [port]
    # default: pill=lofi, port=9099  ->  captures/fm-lofi.wav

In the preview:
    fetch('http://127.0.0.1:9099/save', {method:'POST', body: window._capWavB64})

captures/ is gitignored — recordings are scratch, never committed.
"""
import base64
import sys
from http.server import BaseHTTPRequestHandler, HTTPServer
from pathlib import Path

PILL = sys.argv[1] if len(sys.argv) > 1 else "lofi"
PORT = int(sys.argv[2]) if len(sys.argv) > 2 else 9099
OUT_DIR = Path(__file__).resolve().parent.parent / "captures"
OUT_DIR.mkdir(exist_ok=True)
OUT = OUT_DIR / f"fm-{PILL}.wav"


class Handler(BaseHTTPRequestHandler):
    def _cors(self):
        self.send_header("Access-Control-Allow-Origin", "*")
        self.send_header("Access-Control-Allow-Methods", "POST, OPTIONS")
        self.send_header("Access-Control-Allow-Headers", "*")

    def do_OPTIONS(self):
        self.send_response(204)
        self._cors()
        self.end_headers()

    def do_POST(self):
        n = int(self.headers.get("Content-Length", 0))
        body = self.rfile.read(n)
        try:
            data = base64.b64decode(body)
        except Exception as e:
            self.send_response(400)
            self._cors()
            self.end_headers()
            self.wfile.write(str(e).encode())
            return
        OUT.write_bytes(data)
        msg = f"wrote {len(data)} bytes to {OUT}"
        print(msg, flush=True)
        self.send_response(200)
        self._cors()
        self.end_headers()
        self.wfile.write(msg.encode())

    def log_message(self, *args):
        pass  # quiet


if __name__ == "__main__":
    print(f"capture receiver on http://127.0.0.1:{PORT} -> {OUT}", flush=True)
    HTTPServer(("127.0.0.1", PORT), Handler).serve_forever()
