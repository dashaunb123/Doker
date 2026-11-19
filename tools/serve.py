#!/usr/bin/env python3
"""Host DOKER on your local network.

    python3 tools/serve.py            # port 8000
    python3 tools/serve.py 8080       # pick a port

Anyone on the same Wi-Fi opens  http://<this-computer's-IP>:<port>
Only the game itself is served (index.html, css/, js/, assets/); the
.git folder, tools, docs and anything else in the repo stay private.
Each player's progress and settings save in their own browser.
"""
import http.server
import os
import socket
import sys

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
ALLOWED_DIRS = ('/css/', '/js/', '/assets/')
PORT = int(sys.argv[1]) if len(sys.argv) > 1 else 8000


class GameHandler(http.server.SimpleHTTPRequestHandler):
    def __init__(self, *a, **kw):
        super().__init__(*a, directory=ROOT, **kw)

    def allowed(self):
        path = self.path.split('?', 1)[0].split('#', 1)[0]
        if path in ('/', '/index.html', '/favicon.ico'):
            return True
        if '..' in path or '/.' in path:
            return False
        return path.startswith(ALLOWED_DIRS) and not path.endswith('/')

    def do_GET(self):
        if not self.allowed():
            return self.send_error(404)
        return super().do_GET()

    def do_HEAD(self):
        if not self.allowed():
            return self.send_error(404)
        return super().do_HEAD()

    def end_headers(self):
        # Always serve the latest build, so players pick up changes on refresh.
        self.send_header('Cache-Control', 'no-cache')
        super().end_headers()

    def log_message(self, fmt, *args):
        sys.stderr.write('%s  %s\n' % (self.client_address[0], fmt % args))


def lan_ip():
    s = socket.socket(socket.AF_INET, socket.SOCK_DGRAM)
    try:
        s.connect(('10.255.255.255', 1))  # no packets sent; just picks the LAN interface
        return s.getsockname()[0]
    except OSError:
        return '127.0.0.1'
    finally:
        s.close()


if __name__ == '__main__':
    server = http.server.ThreadingHTTPServer(('0.0.0.0', PORT), GameHandler)
    print('DOKER is live on your network:')
    print('  http://%s:%d' % (lan_ip(), PORT))
    print('  (this computer: http://localhost:%d)   Ctrl+C to stop' % PORT, flush=True)
    try:
        server.serve_forever()
    except KeyboardInterrupt:
        pass
