#!/usr/bin/env python3
"""
Local email-sending server for outreach-emails.html.
Run this, then open outreach-emails.html — the Send buttons will work.

Usage: python3 email-server.py
"""

import json
import smtplib
from email.mime.multipart import MIMEMultipart
from email.mime.text import MIMEText
from http.server import HTTPServer, SimpleHTTPRequestHandler
from pathlib import Path
import re

SMTP_SERVER = "smtp.gmail.com"
SMTP_PORT = 587
FROM_EMAIL = "sftbiesai@gmail.com"
PASSWORD_FILE = Path(__file__).parent.parent / ".gmail-app-password"
PORT = 8777


class Handler(SimpleHTTPRequestHandler):
    def __init__(self, *args, **kwargs):
        super().__init__(*args, directory=str(Path(__file__).parent), **kwargs)

    def do_POST(self):
        if self.path == '/send':
            length = int(self.headers['Content-Length'])
            body = json.loads(self.rfile.read(length))

            to = body['to']
            subject = body['subject']
            html_body = body['body_html']

            # Create plain text version
            text = re.sub(r'<a[^>]*href="([^"]*)"[^>]*>(.*?)</a>', r'\2 (\1)', html_body)
            text = re.sub(r'<br\s*/?>', '\n', text)
            text = re.sub(r'</?p>', '\n', text)
            text = re.sub(r'<[^>]+>', '', text)
            text = re.sub(r'\n{3,}', '\n\n', text).strip()

            try:
                password = PASSWORD_FILE.read_text().strip()
                msg = MIMEMultipart('alternative')
                msg['From'] = FROM_EMAIL
                msg['To'] = to
                msg['Subject'] = subject

                msg.attach(MIMEText(text, 'plain'))
                styled_html = f'<html><body style="font-family: sans-serif; font-size: 14px; line-height: 1.6; color: #222;">{html_body}</body></html>'
                msg.attach(MIMEText(styled_html, 'html'))

                with smtplib.SMTP(SMTP_SERVER, SMTP_PORT) as server:
                    server.starttls()
                    server.login(FROM_EMAIL, password)
                    server.send_message(msg)

                self.send_response(200)
                self.send_header('Content-Type', 'application/json')
                self.send_header('Access-Control-Allow-Origin', '*')
                self.end_headers()
                self.wfile.write(json.dumps({'ok': True}).encode())
                print(f"  Sent to {to}")

            except Exception as e:
                self.send_response(500)
                self.send_header('Content-Type', 'application/json')
                self.send_header('Access-Control-Allow-Origin', '*')
                self.end_headers()
                self.wfile.write(json.dumps({'error': str(e)}).encode())
                print(f"  FAILED: {to} — {e}")

        elif self.path == '/save':
            length = int(self.headers['Content-Length'])
            body = json.loads(self.rfile.read(length))
            html = body.get('html', '')

            try:
                html_file = Path(__file__).parent / 'outreach-emails.html'
                html_file.write_text(html, encoding='utf-8')

                self.send_response(200)
                self.send_header('Content-Type', 'application/json')
                self.send_header('Access-Control-Allow-Origin', '*')
                self.end_headers()
                self.wfile.write(json.dumps({'ok': True}).encode())
                print(f"  Saved outreach-emails.html")

            except Exception as e:
                self.send_response(500)
                self.send_header('Content-Type', 'application/json')
                self.send_header('Access-Control-Allow-Origin', '*')
                self.end_headers()
                self.wfile.write(json.dumps({'error': str(e)}).encode())
                print(f"  SAVE FAILED: {e}")
        else:
            self.send_response(404)
            self.end_headers()

    def do_OPTIONS(self):
        self.send_response(200)
        self.send_header('Access-Control-Allow-Origin', '*')
        self.send_header('Access-Control-Allow-Methods', 'POST, OPTIONS')
        self.send_header('Access-Control-Allow-Headers', 'Content-Type')
        self.end_headers()


if __name__ == '__main__':
    print(f"Email server running on http://localhost:{PORT}")
    print(f"Open http://localhost:{PORT}/outreach-emails.html")
    print(f"Sending from {FROM_EMAIL}")
    print()
    HTTPServer(('localhost', PORT), Handler).serve_forever()
