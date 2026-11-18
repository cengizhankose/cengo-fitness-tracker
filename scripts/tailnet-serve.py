#!/usr/bin/env python3
"""Loopback-only SPA server; Tailscale Serve provides private HTTPS."""
from http.server import ThreadingHTTPServer, SimpleHTTPRequestHandler
from pathlib import Path
from urllib.parse import urlsplit
ROOT = Path.home() / "Library/Application Support/CengoFitness/current"
class Handler(SimpleHTTPRequestHandler):
    def __init__(self, *args, **kwargs): super().__init__(*args, directory=str(ROOT), **kwargs)
    def end_headers(self):
        self.send_header("Cache-Control", "no-cache")
        super().end_headers()
    def do_GET(self):
        path = Path(self.translate_path(self.path))
        if not path.exists() and not Path(urlsplit(self.path).path).suffix:
            self.path = "/index.html"
        super().do_GET()
ThreadingHTTPServer(("127.0.0.1", 4175), Handler).serve_forever()
