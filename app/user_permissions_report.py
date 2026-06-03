from datetime import datetime
from email.message import EmailMessage
from typing import Iterable

import aiosmtplib
from sqlalchemy import text

from app.config import get_settings
from app.db import engine


DEFAULT_REPORT_RECIPIENTS = [
    "qichao@ses.ai",
    "Kang.Xu@ses.ai",
    "yumin.zhang@ses.ai",
    "lowryliu@ses.ai",
    "yuhe.chen@ses.ai",
    "xiaopei.qin@ses.ai",
]

QUERY_1 = """
SELECT
    CASE WHEN permissions LIKE 'enterprise%%' THEN 'enterprise' ELSE permissions END AS permissions,
    count(*) AS cnt
FROM public.users
WHERE organization_name != 'SES AI' AND email NOT LIKE '%%ses.ai%%'
GROUP BY CASE WHEN permissions LIKE 'enterprise%%' THEN 'enterprise' ELSE permissions END
ORDER BY permissions;
"""

QUERY_2 = """
SELECT
    CASE WHEN permissions LIKE 'enterprise%%' THEN 'enterprise' ELSE permissions END AS permissions,
    TO_CHAR(created_at, 'YYYY-MM') AS year_month_str,
    count(*) AS cnt
FROM public.users
WHERE organization_name != 'SES AI' AND email NOT LIKE '%%ses.ai%%'
GROUP BY CASE WHEN permissions LIKE 'enterprise%%' THEN 'enterprise' ELSE permissions END,
         TO_CHAR(created_at, 'YYYY-MM')
ORDER BY permissions, year_month_str DESC;
"""

QUERY_WEEKLY_SIGNUPS = """
WITH weekly_stats AS (
    SELECT
        date_trunc('week', created_at)::date AS stat_week,
        COUNT(*) AS user_count
    FROM public.users
    WHERE organization_name != 'SES AI'
      AND email NOT LIKE '%%ses.ai%%'
      AND permissions != 'admin'
      AND created_at IS NOT NULL
    GROUP BY date_trunc('week', created_at)
)
SELECT
    stat_week,
    user_count,
    LAG(user_count, 1) OVER (ORDER BY stat_week) AS prev_week_count,
    CASE
        WHEN LAG(user_count, 1) OVER (ORDER BY stat_week) IS NULL
             OR LAG(user_count, 1) OVER (ORDER BY stat_week) = 0 THEN NULL
        ELSE ROUND(
            ((user_count - LAG(user_count, 1) OVER (ORDER BY stat_week))::numeric
            / LAG(user_count, 1) OVER (ORDER BY stat_week)) * 100,
            2
        )
    END AS wow_growth_rate
FROM weekly_stats
ORDER BY stat_week DESC;
"""

TH = "padding:8px 14px; border:1px solid #ddd;"
TD = "padding:6px 14px; border:1px solid #ddd;"


def run_query(query: str) -> list[tuple]:
    with engine.connect() as conn:
        return [tuple(row) for row in conn.execute(text(query)).all()]


def build_table(
    title: str,
    headers: list[str],
    rows: list[tuple],
    total_label: str = "Total",
    include_total: bool = True,
) -> str:
    header_html = ""
    for index, header in enumerate(headers):
        align = "right" if index > 0 else "left"
        header_html += f"<th style='{TH} text-align:{align};'>{header}</th>"

    body_html = ""
    for row in rows:
        cells = ""
        for index, value in enumerate(row):
            align = "right" if index > 0 else "left"
            cells += f"<td style='{TD} text-align:{align};'>{value}</td>"
        body_html += f"<tr>{cells}</tr>\n"

    total_row = ""
    if include_total and rows:
        total = sum(row[-1] for row in rows)
        empty_cols = "".join(f"<td style='{TD}'></td>" for _ in range(len(headers) - 2))
        total_row = (
            f"<tr style='font-weight:bold; background:#f0f0f0;'>"
            f"<td style='{TD}'>{total_label}</td>{empty_cols}"
            f"<td style='{TD} text-align:right;'>{total}</td></tr>"
        )

    return f"""\
<h3 style="color:#4472C4; margin-top:28px;">{title}</h3>
<table style="border-collapse:collapse; min-width:320px;">
  <thead><tr style="background:#4472C4; color:#fff;">{header_html}</tr></thead>
  <tbody>
    {body_html}
    {total_row}
  </tbody>
</table>"""


def format_weekly_signup_rows(raw_rows: Iterable[tuple]) -> list[tuple]:
    out: list[tuple] = []
    for stat_week, user_count, prev_week_count, wow in raw_rows:
        week = stat_week.isoformat() if hasattr(stat_week, "isoformat") else stat_week
        prev = "-" if prev_week_count is None else prev_week_count
        wow_text = "-" if wow is None else f"{wow}%"
        out.append((week, user_count, prev, wow_text))
    return out


def build_full_html(tables_html: str, report_time: str) -> str:
    return f"""\
<html>
<body style="font-family:Arial,sans-serif; color:#333;">
<h2>MU User Permissions Report</h2>
<p>Report generated at: <strong>{report_time}</strong></p>
<p>External users (excluding SES AI org &amp; ses.ai emails)</p>
{tables_html}
<br>
<p style="color:#888; font-size:12px;">- Automated report from MU User Management</p>
</body>
</html>"""


def build_report_html(report_time: str) -> str:
    queries = [
        ("1. User Count by Permission Type", ["Permissions", "Count"], QUERY_1),
        ("2. User Count by Permission Type & Month", ["Permissions", "Year-Month", "Count"], QUERY_2),
    ]

    tables_html = ""
    for title, headers, query in queries:
        tables_html += build_table(title, headers, run_query(query))

    weekly_rows = format_weekly_signup_rows(run_query(QUERY_WEEKLY_SIGNUPS))
    tables_html += build_table(
        "3. Weekly New Users (non-admin external, WoW vs prior week)",
        ["Week start (UTC)", "Count", "Prev week", "WoW %"],
        weekly_rows,
        include_total=False,
    )
    return build_full_html(tables_html, report_time)


async def send_user_permissions_report_email(recipients: list[str]) -> str:
    settings = get_settings()
    if not settings.smtp_pass:
        raise RuntimeError("SMTP_PASS is required")

    report_time = datetime.utcnow().strftime("%Y-%m-%d %H:%M:%S UTC")
    html = build_report_html(report_time)

    message = EmailMessage()
    message["Subject"] = f"MU User Report - {report_time}"
    message["From"] = settings.mail_from
    message["To"] = ", ".join(recipients)
    message.set_content(
        "MU User Permissions Report has been generated. "
        "Please view this message in an HTML-capable mail client."
    )
    message.add_alternative(html, subtype="html")

    await aiosmtplib.send(
        message,
        hostname=settings.smtp_host,
        port=settings.smtp_port,
        username=settings.smtp_user,
        password=settings.smtp_pass,
        start_tls=True,
        validate_certs=True,
    )
    return report_time
