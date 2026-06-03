import re

from fastapi import APIRouter, Depends, HTTPException, status
from pydantic import BaseModel, Field

from app.auth import get_current_admin
from app.user_permissions_report import DEFAULT_REPORT_RECIPIENTS, send_user_permissions_report_email


router = APIRouter(prefix="/api/reports", tags=["reports"], dependencies=[Depends(get_current_admin)])
EMAIL_RE = re.compile(r"^[^@\s]+@[^@\s]+\.[^@\s]+$")


class UserPermissionsReportSendRequest(BaseModel):
    recipients: list[str] = Field(min_length=1)


def _clean_recipients(recipients: list[str]) -> list[str]:
    cleaned = []
    seen = set()
    for item in recipients:
        email = item.strip()
        if not email:
            continue
        normalized = email.lower()
        if normalized in seen:
            continue
        if not EMAIL_RE.match(email):
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail=f"Invalid recipient email: {email}",
            )
        seen.add(normalized)
        cleaned.append(email)
    if not cleaned:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Recipients are required")
    return cleaned


@router.get("/user-permissions/recipients")
def get_user_permissions_report_recipients():
    return {"recipients": DEFAULT_REPORT_RECIPIENTS}


@router.post("/user-permissions/send")
async def send_user_permissions_report(payload: UserPermissionsReportSendRequest):
    recipients = _clean_recipients(payload.recipients)
    try:
        report_time = await send_user_permissions_report_email(recipients)
    except Exception as exc:
        raise HTTPException(status_code=status.HTTP_502_BAD_GATEWAY, detail=f"Report email send failed: {exc}") from exc

    return {
        "ok": True,
        "message": "User permissions report email sent",
        "report_time": report_time,
    }
