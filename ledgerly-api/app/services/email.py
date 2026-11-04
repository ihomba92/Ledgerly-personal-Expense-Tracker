"""Sending email through Resend or Brevo (EMAIL_PROVIDER), over HTTPS.

Without an API key for the chosen service (normal in development) the email is printed
in the terminal instead, so you can copy the link while testing.
"""
import logging
import sys
from email.utils import parseaddr

import requests
import resend
from flask import current_app

log = logging.getLogger("ledgerly.email")

BREVO_URL = "https://api.brevo.com/v3/smtp/email"


def send_email(to: str, subject: str, html: str, text: str) -> bool:
    provider = current_app.config.get("EMAIL_PROVIDER", "resend")
    api_key = current_app.config["BREVO_API_KEY" if provider == "brevo" else "RESEND_API_KEY"]
    if not api_key:
        log.warning("Email not sent (no %s API key): '%s'", provider, subject)
        if not current_app.config.get("TESTING") and current_app.config["APP_ENV"] != "production":
            # Development only: show the email in the terminal so the link can be copied. It is printed,
            # not logged, so links never end up in the log file.
            print(f"\n----- EMAIL PREVIEW (development) -----\nTo: {to}\nSubject: {subject}\n\n{text}\n"
                  "---------------------------------------\n", file=sys.stderr, flush=True)
        return False
    try:
        if provider == "brevo":
            return _send_brevo(api_key, to, subject, html, text)
        return _send_resend(api_key, to, subject, html, text)
    except Exception as exc:  # never let an email problem break the request or reveal details
        log.error("%s failed to send '%s': %s", provider.capitalize(), subject, exc)
        return False


def _send_resend(api_key: str, to: str, subject: str, html: str, text: str) -> bool:
    resend.api_key = api_key
    result = resend.Emails.send({"from": current_app.config["EMAIL_FROM"], "to": [to], "subject": subject,
                                 "html": html, "text": text})
    email_id = result.get("id") if isinstance(result, dict) else result
    log.info("Email sent via Resend: '%s' (id %s)", subject, email_id)
    return True


def _send_brevo(api_key: str, to: str, subject: str, html: str, text: str) -> bool:
    """Brevo's transactional email API. EMAIL_FROM like "Ledgerly <no-reply@example.com>"."""
    name, address = parseaddr(current_app.config["EMAIL_FROM"])
    if not address:
        log.error("Brevo: EMAIL_FROM is not a valid address: %s", current_app.config["EMAIL_FROM"])
        return False
    response = requests.post(
        BREVO_URL,
        headers={"api-key": api_key, "accept": "application/json", "content-type": "application/json"},
        json={"sender": {"name": name or "Ledgerly", "email": address}, "to": [{"email": to}],
              "subject": subject, "htmlContent": html, "textContent": text},
        timeout=10,
    )
    if response.status_code in (200, 201, 202):
        message_id = (response.json() or {}).get("messageId") if response.content else None
        log.info("Email sent via Brevo: '%s' (id %s)", subject, message_id)
        return True
    try:
        reason = response.json().get("message", response.text)
    except ValueError:
        reason = response.text
    log.error("Brevo refused '%s' (%s): %s", subject, response.status_code, reason[:300])
    return False


def _layout(heading: str, intro: str, button: str, link: str, footer: str) -> str:
    """Ledgerly's email look: cream background, white card, deep green button."""
    return f"""\
<div style="background:#fbf9f6;padding:32px 16px;font-family:Arial,Helvetica,sans-serif;color:#1F2421">
  <div style="max-width:480px;margin:0 auto;background:#ffffff;border-radius:12px;padding:32px;border:1px solid #E5E0D8">
    <p style="margin:0 0 24px;font-size:18px;font-weight:bold;color:#14422d">Ledgerly</p>
    <h1 style="margin:0 0 12px;font-family:Georgia,serif;font-weight:normal;font-size:26px">{heading}</h1>
    <p style="margin:0 0 24px;font-size:15px;line-height:24px;color:#575C57">{intro}</p>
    <a href="{link}" style="display:inline-block;background:#14422d;color:#ffffff;text-decoration:none;padding:12px 22px;border-radius:8px;font-size:15px">{button}</a>
    <p style="margin:24px 0 0;font-size:13px;line-height:20px;color:#8A8F8A">{footer}</p>
  </div>
</div>"""


def verification_email(name: str, link: str) -> tuple[str, str, str]:
    first = name.split()[0]
    subject = "Confirm your email for Ledgerly"
    text = (
        f"Hi {first},\n\nWelcome to Ledgerly. Confirm your email to open your ledger:\n\n{link}\n\n"
        "The link works once, for 24 hours. If you didn't create an account, you can ignore this email.\n\n— Ledgerly"
    )
    html = _layout(
        "Confirm your email",
        f"Hi {first}, welcome to Ledgerly. Confirm this is your email address and we’ll take you straight to your ledger. The link works once, for 24 hours.",
        "Confirm and open Ledgerly",
        link,
        "If you didn’t create a Ledgerly account, you can ignore this email.",
    )
    return subject, html, text


def password_reset_email(name: str, link: str, minutes: int) -> tuple[str, str, str]:
    first = name.split()[0]
    subject = "Reset your Ledgerly password"
    text = (
        f"Hi {first},\n\nWe received a request to reset your Ledgerly password.\n"
        f"Open this link to choose a new one (it works once, for {minutes} minutes):\n\n{link}\n\n"
        "If you didn't ask for this, you can ignore this email. Your password won't change.\n\n— Ledgerly"
    )
    html = _layout(
        "Reset your password",
        f"Hi {first}, we received a request to reset your Ledgerly password. This link works once and expires in {minutes} minutes.",
        "Choose a new password",
        link,
        "If you didn’t ask for this, you can ignore this email. Your password won’t change.",
    )
    return subject, html, text
