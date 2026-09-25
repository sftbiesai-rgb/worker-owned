#!/usr/bin/env python3
from http.server import HTTPServer, BaseHTTPRequestHandler
import os

FILE = os.path.join(os.path.dirname(os.path.abspath(__file__)), 'civic-engagement-roi.html')

class Handler(BaseHTTPRequestHandler):
    def do_GET(self):
        with open(FILE, 'rb') as f:
            content = f.read()
        self.send_response(200)
        self.send_header('Content-Type', 'text/html')
        self.end_headers()
        self.write = self.wfile.write
        self.write(content)

    def do_POST(self):
        length = int(self.headers['Content-Length'])
        body = self.rfile.read(length)
        with open(FILE, 'wb') as f:
            f.write(body)
        self.send_response(200)
        self.send_header('Content-Type', 'text/plain')
        self.end_headers()
        self.wfile.write(b'ok')
        print(f'Saved ({len(body)} bytes)')

    def log_message(self, format, *args):
        print(f'[edit-server] {args[0]}')

print(f'Editing: {FILE}')
print(f'Open http://localhost:8111')
HTTPServer(('localhost', 8111), Handler).serve_forever()
