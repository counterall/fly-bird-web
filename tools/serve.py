#!/usr/bin/env python3
"""Serve web/ for development (npm start).

Like `python3 -m http.server`, but tells the browser not to cache. Without
that, browsers guess how long files stay fresh and can keep running an old
module next to new ones after an edit.
"""
import functools
import http.server
import pathlib
import sys


class NoCacheHandler(http.server.SimpleHTTPRequestHandler):
    def end_headers(self):
        self.send_header('Cache-Control', 'no-store')
        super().end_headers()


port = int(sys.argv[1]) if len(sys.argv) > 1 else 8080
root = pathlib.Path(__file__).resolve().parent.parent / 'web'
handler = functools.partial(NoCacheHandler, directory=str(root))
print(f'Serving {root} at http://localhost:{port}/ (no caching)')
http.server.ThreadingHTTPServer(('', port), handler).serve_forever()
