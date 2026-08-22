#!/usr/bin/env python3
"""
Send outreach emails via SMTP from sftbiesai@gmail.com.
Parses outreach-emails.html and sends individual emails by name/number.

Usage:
  python3 send-email.py --list                  # List all unsent emails
  python3 send-email.py --preview "Dean"        # Preview an email by name
  python3 send-email.py --send "Dean"           # Send one email by name
  python3 send-email.py --send 1                # Send by number from --list
"""

import argparse
import smtplib
import sys
import re
from email.mime.multipart import MIMEMultipart
from email.mime.text import MIMEText
from html.parser import HTMLParser
from pathlib import Path

SMTP_SERVER = "smtp.gmail.com"
SMTP_PORT = 587
FROM_EMAIL = "sftbiesai@gmail.com"
PASSWORD_FILE = Path(__file__).parent.parent / ".gmail-app-password"
HTML_FILE = Path(__file__).parent / "outreach-emails.html"


def load_password():
    return PASSWORD_FILE.read_text().strip()


def parse_emails():
    """Parse outreach-emails.html and return list of email entries (not DMs)."""
    html = HTML_FILE.read_text()

    # Find all email entries (ones with email-badge class, not DM/form badges)
    entries = []

    # Split by email divs
    email_blocks = re.findall(
        r'<div class="email">\s*<h2>(.*?)</h2>\s*'
        r'<div class="meta">(.*?)</div>\s*'
        r'(?:<div class="subject">(.*?)</div>\s*)?'
        r'<div class="body"[^>]*>(.*?)</div>\s*'
        r'<button class="copy-btn"',
        html, re.DOTALL
    )

    for h2, meta, subject, body in email_blocks:
        # Only include actual emails (with email-badge), skip DMs/forms
        if 'email-badge' not in h2:
            continue

        # Extract name
        name = re.sub(r'<span.*?</span>', '', h2).strip()

        # Extract email address from meta
        addr_match = re.search(r'[\w.+-]+@[\w.-]+\.\w+', meta)
        if not addr_match:
            continue
        to_email = addr_match.group()

        # Extract subject line
        subj = ''
        if subject:
            subj = re.sub(r'^Subject:\s*', '', subject.strip())

        # Clean up body HTML - keep it as HTML for the email
        body_html = body.strip()

        entries.append({
            'name': name,
            'to': to_email,
            'subject': subj,
            'body_html': body_html,
        })

    return entries


def preview_email(entry):
    """Print a preview of an email entry."""
    print(f"To:      {entry['to']}")
    print(f"From:    {FROM_EMAIL}")
    print(f"Subject: {entry['subject']}")
    print(f"Name:    {entry['name']}")
    print("---")
    # Show a plain text version for preview
    text = re.sub(r'<a[^>]*href="([^"]*)"[^>]*>(.*?)</a>', r'\2 (\1)', entry['body_html'])
    text = re.sub(r'<br\s*/?>', '\n', text)
    text = re.sub(r'</?p>', '\n', text)
    text = re.sub(r'<[^>]+>', '', text)
    text = re.sub(r'\n{3,}', '\n\n', text).strip()
    print(text)


def send_email(entry):
    """Send a single email via SMTP."""
    password = load_password()

    msg = MIMEMultipart('alternative')
    msg['From'] = FROM_EMAIL
    msg['To'] = entry['to']
    msg['Subject'] = entry['subject']

    # Create plain text version
    text = re.sub(r'<a[^>]*href="([^"]*)"[^>]*>(.*?)</a>', r'\2 (\1)', entry['body_html'])
    text = re.sub(r'<br\s*/?>', '\n', text)
    text = re.sub(r'</?p>', '\n', text)
    text = re.sub(r'<[^>]+>', '', text)
    text = re.sub(r'\n{3,}', '\n\n', text).strip()

    # Create HTML version with minimal styling
    html_body = f"""<html><body style="font-family: sans-serif; font-size: 14px; line-height: 1.6; color: #222;">
{entry['body_html']}
</body></html>"""

    msg.attach(MIMEText(text, 'plain'))
    msg.attach(MIMEText(html_body, 'html'))

    with smtplib.SMTP(SMTP_SERVER, SMTP_PORT) as server:
        server.starttls()
        server.login(FROM_EMAIL, password)
        server.send_message(msg)

    print(f"Sent to {entry['to']} ({entry['name']})")


def find_entry(entries, query):
    """Find an entry by number or name substring."""
    # Try as number first
    try:
        idx = int(query) - 1
        if 0 <= idx < len(entries):
            return entries[idx]
        print(f"Number {query} out of range (1-{len(entries)})")
        sys.exit(1)
    except ValueError:
        pass

    # Search by name
    matches = [e for e in entries if query.lower() in e['name'].lower()]
    if len(matches) == 1:
        return matches[0]
    elif len(matches) > 1:
        print(f"Multiple matches for '{query}':")
        for m in matches:
            print(f"  - {m['name']} ({m['to']})")
        sys.exit(1)
    else:
        print(f"No match for '{query}'")
        sys.exit(1)


def main():
    parser = argparse.ArgumentParser(description='Send outreach emails via SMTP')
    parser.add_argument('--list', action='store_true', help='List all unsent emails')
    parser.add_argument('--preview', type=str, help='Preview email by name or number')
    parser.add_argument('--send', type=str, help='Send email by name or number')
    args = parser.parse_args()

    entries = parse_emails()

    if args.list:
        for i, e in enumerate(entries, 1):
            print(f"  {i}. {e['name']} — {e['to']}")
            print(f"     Subject: {e['subject']}")
        print(f"\n{len(entries)} emails ready to send")

    elif args.preview:
        entry = find_entry(entries, args.preview)
        preview_email(entry)

    elif args.send:
        entry = find_entry(entries, args.send)
        preview_email(entry)
        print("\n--- Sending... ---")
        send_email(entry)

    else:
        parser.print_help()


if __name__ == '__main__':
    main()
