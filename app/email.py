import html
import secrets
from email.message import EmailMessage

import aiosmtplib

from app.config import get_settings


def gen_temp_password() -> str:
    return secrets.token_urlsafe(16)


async def send_temp_password_email(recipient: str, username: str, temp_password: str) -> None:
    settings = get_settings()
    if not settings.smtp_pass:
        raise RuntimeError("SMTP_PASS is required")

    escaped_username = html.escape(username or "")
    escaped_password = html.escape(temp_password)
    body = f"""
    <p>Hello,</p>
    <p>MU website is: <a href="https://molecular-universe.com">MU website</a></p>
    <p>Your username is: <strong>{escaped_username}</strong></p>
    <p>Your temporary password is:</p>
    <pre style="font-size:1.2em; padding:8px; background:#f4f4f4;">
      {escaped_password}
    </pre>
    <p>
      Please <a href="https://molecular-universe.com/forgot-password">click here</a> to
      set a new permanent password.
    </p>
    <p>- The SES.AI Team</p>
    """

    message = EmailMessage()
    message["Subject"] = "Your Molecular Universe Temporary Password"
    message["From"] = settings.mail_from
    message["To"] = recipient
    message.set_content(
        "Your Molecular Universe account temporary password has been generated. "
        "Please view this message in an HTML-capable mail client."
    )
    message.add_alternative(body, subtype="html")

    await aiosmtplib.send(
        message,
        hostname=settings.smtp_host,
        port=settings.smtp_port,
        username=settings.smtp_user,
        password=settings.smtp_pass,
        start_tls=True,
        validate_certs=True,
    )
