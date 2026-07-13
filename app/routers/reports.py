import re
import json
import time as time_module
from collections import defaultdict
from datetime import date, datetime, time, timedelta
from threading import Lock
from typing import Literal, Optional, Tuple

import msgpack
from fastapi import APIRouter, Depends, HTTPException, Query, status
from fastapi.responses import Response
from pydantic import BaseModel, Field
from sqlalchemy import bindparam, text
from sqlalchemy.exc import SQLAlchemyError

from app.auth import get_current_admin
from app.db import deerflow_engine, platform_engine, platform_read_engine
from app.user_permissions_report import DEFAULT_REPORT_RECIPIENTS, send_user_permissions_report_email


router = APIRouter(prefix="/api/reports", tags=["reports"], dependencies=[Depends(get_current_admin)])
EMAIL_RE = re.compile(r"^[^@\s]+@[^@\s]+\.[^@\s]+$")
AGENT_ROUND_CACHE_TTL_SECONDS = 300
_agent_round_cache = {}
_agent_round_cache_lock = Lock()


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


def _run_rows(query: str, params: Optional[dict] = None) -> list[dict]:
    statement = text(query)
    try:
        with platform_read_engine.connect() as conn:
            result = conn.execute(statement, params or {})
            return [dict(row._mapping) for row in result]
    except SQLAlchemyError as exc:
        message = str(exc).lower()
        if "permission denied" not in message and "insufficient privilege" not in message:
            raise
        with platform_engine.connect() as conn:
            result = conn.execute(statement, params or {})
            return [dict(row._mapping) for row in result]


def _run_deerflow_rows(query: str, params: Optional[dict] = None) -> list[dict]:
    with deerflow_engine.connect() as conn:
        statement = text(query)
        if params and "audience_identities" in params:
            statement = statement.bindparams(bindparam("audience_identities", expanding=True))
        result = conn.execute(statement, params or {})
        return [dict(row._mapping) for row in result]


def _audience_condition(alias: str) -> str:
    normalized_org = f"lower(replace(trim(COALESCE({alias}.organization_name, '')), ' ', '.'))"
    return f"""(
        :audience = 'all'
        OR (:audience = 'internal' AND {normalized_org} IN ('ses.ai', 'ses'))
        OR (:audience = 'external' AND {normalized_org} NOT IN ('ses.ai', 'ses'))
    )"""


def _message_types_from_blob(blob: bytes) -> list[str]:
    message_types = []

    def visit(value):
        if isinstance(value, msgpack.ExtType) and value.code == 5:
            try:
                decoded = msgpack.unpackb(value.data, raw=False, strict_map_key=False)
            except (ValueError, msgpack.UnpackException):
                return
            if isinstance(decoded, list) and len(decoded) >= 3 and isinstance(decoded[2], dict):
                message_type = decoded[2].get("type")
                if message_type in {"human", "ai"}:
                    message_types.append(message_type)
            visit(decoded)
        elif isinstance(value, dict):
            for item in value.values():
                visit(item)
        elif isinstance(value, (list, tuple)):
            for item in value:
                visit(item)

    try:
        visit(msgpack.unpackb(bytes(blob), raw=False, strict_map_key=False))
    except (ValueError, msgpack.UnpackException):
        return []
    return message_types


def _conversation_messages_from_blob(blob: bytes) -> list[dict]:
    messages = []

    def visit(value):
        if isinstance(value, msgpack.ExtType) and value.code == 5:
            try:
                decoded = msgpack.unpackb(value.data, raw=False, strict_map_key=False)
            except (ValueError, msgpack.UnpackException):
                return
            if isinstance(decoded, list) and len(decoded) >= 3 and isinstance(decoded[2], dict):
                payload = decoded[2]
                message_type = payload.get("type")
                if message_type in {"human", "ai", "tool"}:
                    content = payload.get("content", "")
                    if not isinstance(content, str):
                        content = json.dumps(content, ensure_ascii=False, default=str)
                    messages.append({"type": message_type, "content": content})
            visit(decoded)
        elif isinstance(value, dict):
            for item in value.values():
                visit(item)
        elif isinstance(value, (list, tuple)):
            for item in value:
                visit(item)

    try:
        visit(msgpack.unpackb(bytes(blob), raw=False, strict_map_key=False))
    except (ValueError, msgpack.UnpackException):
        return []
    return messages


def _get_agent_round_metrics(
    start_ts: datetime,
    end_ts: datetime,
    audience: str,
    audience_identities: tuple[str, ...],
) -> tuple[float, list[dict]]:
    cache_key = (start_ts.isoformat(), end_ts.isoformat(), audience)
    now = time_module.monotonic()
    with _agent_round_cache_lock:
        cached = _agent_round_cache.get(cache_key)
        if cached and now - cached[0] < AGENT_ROUND_CACHE_TTL_SECONDS:
            return cached[1]

    rows = _run_deerflow_rows(
        """
        WITH selected_threads AS (
            SELECT
                COALESCE(value->>'thread_id', key) AS thread_id,
                COALESCE(
                    to_timestamp(NULLIF(value->>'created_at', '')::double precision),
                    created_at
                )::date AS created_date
            FROM public.store
            WHERE prefix = 'threads'
              AND (
                  :audience = 'all'
                  OR lower(COALESCE(value->>'username', value->'metadata'->>'username')) IN :audience_identities
              )
              AND COALESCE(
                  to_timestamp(NULLIF(value->>'created_at', '')::double precision),
                  created_at
              ) >= :start_ts
              AND COALESCE(
                  to_timestamp(NULLIF(value->>'created_at', '')::double precision),
                  created_at
              ) < :end_ts
        )
        SELECT s.thread_id, s.created_date, w.blob
        FROM selected_threads s
        LEFT JOIN public.checkpoint_writes w
          ON w.thread_id = s.thread_id
         AND w.channel = 'messages'
         AND w.type = 'msgpack'
        """,
        {
            "start_ts": start_ts,
            "end_ts": end_ts,
            "audience": audience,
            "audience_identities": audience_identities,
        },
    )
    thread_counts = {}
    for row in rows:
        stats = thread_counts.setdefault(
            row["thread_id"],
            {"created_date": row["created_date"], "human": 0, "ai": 0},
        )
        if row["blob"] is None:
            continue
        for message_type in _message_types_from_blob(row["blob"]):
            stats[message_type] += 1

    daily_rounds = {}
    all_rounds = []
    for stats in thread_counts.values():
        rounds = min(stats["human"], stats["ai"])
        all_rounds.append(rounds)
        daily_rounds.setdefault(stats["created_date"], []).append(rounds)
    average_rounds = sum(all_rounds) / len(all_rounds) if all_rounds else 0.0
    trend = [
        {"bucket_start": day, "count": sum(values) / len(values)}
        for day, values in sorted(daily_rounds.items())
    ]
    result = (average_rounds, trend)
    with _agent_round_cache_lock:
        _agent_round_cache[cache_key] = (now, result)
    return result


def _default_date_range() -> Tuple[date, date]:
    today = date.today()
    return today - timedelta(days=29), today


def _resolve_date_range(start_date: Optional[date], end_date: Optional[date]) -> Tuple[date, date]:
    default_start, default_end = _default_date_range()
    resolved_start = start_date or default_start
    resolved_end = end_date or default_end
    if resolved_start > resolved_end:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="start_date cannot be later than end_date")
    return resolved_start, resolved_end


@router.get("/user-permissions/recipients")
def get_user_permissions_report_recipients():
    return {"recipients": DEFAULT_REPORT_RECIPIENTS}


@router.get("/dashboard")
def get_dashboard_report(
    start_date: Optional[date] = Query(default=None),
    end_date: Optional[date] = Query(default=None),
    include_agent_rounds: bool = Query(default=False),
    audience: Literal["all", "internal", "external"] = Query(default="all"),
    agent_feature: Literal["starseeker", "ask"] = Query(default="starseeker"),
):
    resolved_start, resolved_end = _resolve_date_range(start_date, end_date)
    start_ts = datetime.combine(resolved_start, time.min)
    end_ts = datetime.combine(resolved_end + timedelta(days=1), time.min)
    params = {
        "start_ts": start_ts,
        "end_ts": end_ts,
        "start_date": resolved_start.isoformat(),
        "end_date": resolved_end.isoformat(),
        "audience": audience,
    }
    audience_alias_rows = _run_rows(
        f"""
        SELECT lower(alias) AS identity
        FROM (
            SELECT username AS alias, organization_name FROM public.users WHERE username IS NOT NULL
            UNION ALL
            SELECT email AS alias, organization_name FROM public.users WHERE email IS NOT NULL
        ) user_aliases
        WHERE {_audience_condition('user_aliases')}
        """,
        params,
    )
    audience_identities = tuple(sorted({row["identity"] for row in audience_alias_rows if row["identity"]}))
    agent_params = {**params, "audience_identities": audience_identities or ("__no_matching_user__",)}

    overview = _run_rows(
        f"""
        WITH eligible_users AS (
            SELECT id, permissions
            FROM public.users u
            WHERE (u.deleted = false OR u.deleted IS NULL)
              AND {_audience_condition('u')}
        )
        SELECT
            (
                SELECT COUNT(DISTINCT user_id)
                FROM (
                    SELECT user_id
                    FROM public.activity a JOIN eligible_users u ON u.id = a.user_id
                    WHERE a.created_at >= :start_ts AND a.created_at < :end_ts
                    UNION
                    SELECT user_id
                    FROM public.chat_sessions s JOIN eligible_users u ON u.id = s.user_id
                    WHERE (s.deleted = false OR s.deleted IS NULL)
                      AND COALESCE(s.updated_at, s.created_at) >= :start_ts
                      AND COALESCE(s.updated_at, s.created_at) < :end_ts
                ) active_users
            ) AS active_users,
            (SELECT COUNT(*) FROM eligible_users WHERE permissions = 'admin') AS active_admins,
            (SELECT COUNT(*) FROM public.activity a JOIN eligible_users u ON u.id = a.user_id WHERE a.created_at >= :start_ts AND a.created_at < :end_ts) AS activity_in_period,
            (SELECT COUNT(*) FROM public.chat_sessions s JOIN eligible_users u ON u.id = s.user_id WHERE (s.deleted = false OR s.deleted IS NULL) AND COALESCE(s.updated_at, s.created_at) >= :start_ts AND COALESCE(s.updated_at, s.created_at) < :end_ts) AS sessions_in_period,
            (SELECT COUNT(*) FROM public.public_chat_sessions WHERE :audience = 'all' AND COALESCE(updated_at, created_at) >= :start_ts AND COALESCE(updated_at, created_at) < :end_ts) AS public_sessions_in_period,
            (
                SELECT COUNT(*)
                FROM public.users u
                WHERE u.created_at IS NOT NULL AND (u.deleted = false OR u.deleted IS NULL)
                  AND {_audience_condition('u')}
                  AND u.created_at >= :start_ts AND u.created_at < :end_ts
            ) AS signups_in_period,
            (
                SELECT COUNT(*)
                FROM public.users u
                WHERE u.created_at IS NOT NULL AND (u.deleted = false OR u.deleted IS NULL)
                  AND {_audience_condition('u')} AND u.created_at < :end_ts
            ) AS registered_users_total,
            (
                SELECT COUNT(DISTINCT user_id)
                FROM public.chat_sessions s JOIN eligible_users u ON u.id = s.user_id
                WHERE (s.deleted = false OR s.deleted IS NULL)
                  AND COALESCE(s.updated_at, s.created_at) >= :start_ts
                  AND COALESCE(s.updated_at, s.created_at) < :end_ts
            ) AS login_users_in_period,
            (
                SELECT COUNT(DISTINCT user_id)
                FROM public.activity a JOIN eligible_users u ON u.id = a.user_id
                WHERE a.created_at >= :start_ts AND a.created_at < :end_ts
            ) AS active_users_in_period
        """
        ,
        params,
    )[0]

    signup_trend = _run_rows(
        f"""
        SELECT
            date_trunc('day', created_at)::date AS bucket_start,
            COUNT(*) AS count
        FROM public.users u
        WHERE u.created_at IS NOT NULL AND (u.deleted = false OR u.deleted IS NULL)
          AND {_audience_condition('u')}
          AND u.created_at >= :start_ts AND u.created_at < :end_ts
        GROUP BY 1
        ORDER BY 1 ASC
        """,
        params,
    )

    platform_registered_user_trend = _run_rows(
        f"""
        SELECT
            day::date AS bucket_start,
            (
                SELECT COUNT(*)
                FROM public.users u
                WHERE u.created_at IS NOT NULL
                  AND (u.deleted = false OR u.deleted IS NULL)
                  AND {_audience_condition('u')}
                  AND u.created_at < day + interval '1 day'
            ) AS count
        FROM generate_series(
            CAST(:start_date AS date),
            CAST(:end_date AS date),
            interval '1 day'
        ) AS day
        ORDER BY 1 ASC
        """,
        params,
    )

    user_role_distribution = _run_rows(
        f"""
        SELECT
            COALESCE(NULLIF(permissions, ''), '未设置') AS label,
            COUNT(*) AS count
        FROM public.users u
        WHERE u.created_at IS NOT NULL AND (u.deleted = false OR u.deleted IS NULL)
          AND {_audience_condition('u')} AND u.created_at < :end_ts
        GROUP BY 1
        ORDER BY count DESC, label
        """,
        params,
    )

    user_organization_distribution = _run_rows(
        f"""
        SELECT
            COALESCE(NULLIF(trim(organization_name), ''), '未填写组织') AS label,
            COUNT(*) AS count
        FROM public.users u
        WHERE u.created_at IS NOT NULL AND (u.deleted = false OR u.deleted IS NULL)
          AND {_audience_condition('u')} AND u.created_at < :end_ts
        GROUP BY 1
        ORDER BY count DESC, label
        """,
        params,
    )

    session_trend = _run_rows(
        f"""
        SELECT
            date_trunc('day', COALESCE(s.updated_at, s.created_at))::date AS bucket_start,
            COUNT(*) AS count
        FROM public.chat_sessions s JOIN public.users u ON u.id = s.user_id
        WHERE (s.deleted = false OR s.deleted IS NULL) AND {_audience_condition('u')}
          AND COALESCE(s.updated_at, s.created_at) >= :start_ts
          AND COALESCE(s.updated_at, s.created_at) < :end_ts
        GROUP BY 1
        ORDER BY 1 ASC
        """,
        params,
    )

    activity_trend = _run_rows(
        f"""
        SELECT
            date_trunc('day', a.created_at)::date AS bucket_start,
            COUNT(*) AS count
        FROM public.activity a JOIN public.users u ON u.id = a.user_id
        WHERE a.created_at IS NOT NULL AND {_audience_condition('u')}
          AND a.created_at >= :start_ts AND a.created_at < :end_ts
        GROUP BY 1
        ORDER BY 1 ASC
        """,
        params,
    )

    login_user_trend = _run_rows(
        f"""
        SELECT
            date_trunc('day', COALESCE(s.updated_at, s.created_at))::date AS bucket_start,
            COUNT(DISTINCT s.user_id) AS count
        FROM public.chat_sessions s JOIN public.users u ON u.id = s.user_id
        WHERE (s.deleted = false OR s.deleted IS NULL) AND {_audience_condition('u')}
          AND COALESCE(s.updated_at, s.created_at) >= :start_ts
          AND COALESCE(s.updated_at, s.created_at) < :end_ts
        GROUP BY 1
        ORDER BY 1 ASC
        """,
        params,
    )

    active_user_trend = _run_rows(
        f"""
        SELECT
            date_trunc('day', a.created_at)::date AS bucket_start,
            COUNT(DISTINCT a.user_id) AS count
        FROM public.activity a JOIN public.users u ON u.id = a.user_id
        WHERE a.created_at IS NOT NULL AND {_audience_condition('u')}
          AND a.created_at >= :start_ts AND a.created_at < :end_ts
        GROUP BY 1
        ORDER BY 1 ASC
        """,
        params,
    )

    feature_usage = _run_rows(
        f"""
        WITH feature_catalog AS (
            SELECT 1 AS sort_order, 'StarSeeker' AS feature_name
            UNION ALL SELECT 2, 'Ask'
            UNION ALL SELECT 3, 'search'
            UNION ALL SELECT 4, 'MD'
            UNION ALL SELECT 5, 'cell life predict'
            UNION ALL SELECT 6, 'electrolyte design'
            UNION ALL SELECT 7, 'electrode forward design'
            UNION ALL SELECT 8, 'electrode inverse design'
        ),
        feature_events AS (
            SELECT
                CASE
                    WHEN endpoint LIKE '/rag%' OR endpoint LIKE '/rag-search-literature%' THEN 'Ask'
                    WHEN endpoint LIKE '/search%'
                      OR endpoint LIKE '/search-35%'
                      OR endpoint LIKE '/find-friend-with-image%'
                      OR endpoint LIKE '/api/molecule_details%' THEN 'search'
                    WHEN endpoint = '/api/md/run' THEN 'MD'
                    WHEN endpoint LIKE '/api/cellLife/model_predict%' THEN 'cell life predict'
                    WHEN endpoint LIKE '/api/cellPerformance/model_predict%'
                      OR endpoint LIKE '/api/cellPerformance/llm_analysis%' THEN 'electrolyte design'
                    WHEN endpoint LIKE '/api/electrodePerformance/model_predict?type=1%'
                      OR endpoint = '/api/electrodePerformance/model_predict'
                      OR (
                          endpoint LIKE '/api/electrodePerformance/model_predict%'
                          AND endpoint NOT LIKE '%type=2%'
                      ) THEN 'electrode forward design'
                    WHEN endpoint LIKE '/api/electrodePerformance/backward/result%'
                      OR endpoint LIKE '/api/electrodePerformance/model_predict?type=2%' THEN 'electrode inverse design'
                    ELSE NULL
                END AS feature_name,
                user_id
            FROM public.activity a JOIN public.users u ON u.id = a.user_id
            WHERE a.created_at >= :start_ts
              AND a.created_at < :end_ts
              AND {_audience_condition('u')}
              AND endpoint IS NOT NULL
              AND endpoint != ''
        )
        ,
        feature_stats AS (
            SELECT
                feature_name,
                COUNT(*) AS call_count,
                COUNT(DISTINCT user_id) AS user_count
            FROM feature_events
            WHERE feature_name IS NOT NULL
            GROUP BY feature_name
        )
        SELECT
            c.feature_name,
            COALESCE(s.call_count, 0) AS call_count,
            COALESCE(s.user_count, 0) AS user_count
        FROM feature_catalog c
        LEFT JOIN feature_stats s ON s.feature_name = c.feature_name
        ORDER BY c.sort_order
        """,
        params,
    )

    feature_usage_trend = _run_rows(
        f"""
        WITH feature_events AS (
            SELECT
                CASE
                    WHEN endpoint LIKE '/rag%' OR endpoint LIKE '/rag-search-literature%' THEN 'Ask'
                    WHEN endpoint LIKE '/search%'
                      OR endpoint LIKE '/search-35%'
                      OR endpoint LIKE '/find-friend-with-image%'
                      OR endpoint LIKE '/api/molecule_details%' THEN 'search'
                    WHEN endpoint = '/api/md/run' THEN 'MD'
                    WHEN endpoint LIKE '/api/cellLife/model_predict%' THEN 'cell life predict'
                    WHEN endpoint LIKE '/api/cellPerformance/model_predict%'
                      OR endpoint LIKE '/api/cellPerformance/llm_analysis%' THEN 'electrolyte design'
                    WHEN endpoint LIKE '/api/electrodePerformance/model_predict?type=1%'
                      OR endpoint = '/api/electrodePerformance/model_predict'
                      OR (
                          endpoint LIKE '/api/electrodePerformance/model_predict%'
                          AND endpoint NOT LIKE '%type=2%'
                      ) THEN 'electrode forward design'
                    WHEN endpoint LIKE '/api/electrodePerformance/backward/result%'
                      OR endpoint LIKE '/api/electrodePerformance/model_predict?type=2%' THEN 'electrode inverse design'
                    ELSE NULL
                END AS feature_name,
                date_trunc('day', a.created_at)::date AS bucket_start,
                user_id
            FROM public.activity a JOIN public.users u ON u.id = a.user_id
            WHERE a.created_at >= :start_ts
              AND a.created_at < :end_ts
              AND {_audience_condition('u')}
              AND endpoint IS NOT NULL
              AND endpoint != ''
        )
        SELECT
            feature_name,
            bucket_start,
            COUNT(*) AS call_count,
            COUNT(DISTINCT user_id) AS user_count
        FROM feature_events
        WHERE feature_name IS NOT NULL
        GROUP BY feature_name, bucket_start
        ORDER BY feature_name, bucket_start
        """,
        params,
    )

    agent_usage = _run_deerflow_rows(
        """
        WITH thread_rows AS (
            SELECT
                COALESCE(value->>'thread_id', key) AS thread_id,
                COALESCE(value->>'username', value->'metadata'->>'username', '-') AS username,
                COALESCE(value->'values'->>'title', value->>'thread_id', key, '-') AS name,
                COALESCE(
                    to_timestamp(NULLIF(value->>'created_at', '')::double precision),
                    created_at
                ) AS created_at
            FROM public.store
            WHERE prefix = 'threads'
              AND (:audience = 'all' OR lower(COALESCE(value->>'username', value->'metadata'->>'username')) IN :audience_identities)
        )
        SELECT thread_id, username, name, created_at
        FROM thread_rows
        WHERE created_at >= :start_ts
          AND created_at < :end_ts
        ORDER BY created_at DESC
        """,
        agent_params,
    )

    agent_usage_overview = _run_deerflow_rows(
        """
        WITH thread_rows AS (
            SELECT
                COALESCE(value->>'username', value->'metadata'->>'username', '-') AS username,
                COALESCE(
                    to_timestamp(NULLIF(value->>'created_at', '')::double precision),
                    created_at
                ) AS created_at
            FROM public.store
            WHERE prefix = 'threads'
              AND (:audience = 'all' OR lower(COALESCE(value->>'username', value->'metadata'->>'username')) IN :audience_identities)
        )
        SELECT
            COUNT(*) AS session_creations,
            COUNT(DISTINCT NULLIF(username, '-')) AS session_users
        FROM thread_rows
        WHERE created_at >= :start_ts
          AND created_at < :end_ts
        """,
        agent_params,
    )[0]

    agent_session_trend = _run_deerflow_rows(
        """
        SELECT
            date_trunc('day', COALESCE(
                to_timestamp(NULLIF(value->>'created_at', '')::double precision),
                created_at
            ))::date AS bucket_start,
            COUNT(*) AS count
        FROM public.store
        WHERE prefix = 'threads'
          AND (:audience = 'all' OR lower(COALESCE(value->>'username', value->'metadata'->>'username')) IN :audience_identities)
          AND COALESCE(
              to_timestamp(NULLIF(value->>'created_at', '')::double precision),
              created_at
          ) >= :start_ts
          AND COALESCE(
              to_timestamp(NULLIF(value->>'created_at', '')::double precision),
              created_at
          ) < :end_ts
        GROUP BY 1
        ORDER BY 1 ASC
        """,
        agent_params,
    )

    agent_user_trend = _run_deerflow_rows(
        """
        SELECT
            bucket_start,
            COUNT(DISTINCT username) AS count
        FROM (
            SELECT
                date_trunc('day', COALESCE(
                    to_timestamp(NULLIF(value->>'created_at', '')::double precision),
                    created_at
                ))::date AS bucket_start,
                COALESCE(value->>'username', value->'metadata'->>'username', '-') AS username
            FROM public.store
            WHERE prefix = 'threads'
              AND (:audience = 'all' OR lower(COALESCE(value->>'username', value->'metadata'->>'username')) IN :audience_identities)
              AND COALESCE(
                  to_timestamp(NULLIF(value->>'created_at', '')::double precision),
                  created_at
              ) >= :start_ts
              AND COALESCE(
                  to_timestamp(NULLIF(value->>'created_at', '')::double precision),
                  created_at
              ) < :end_ts
        ) agent_threads
        WHERE username != '-'
        GROUP BY 1
        ORDER BY 1 ASC
        """,
        agent_params,
    )
    agent_average_rounds, agent_round_trend = (0.0, [])
    if include_agent_rounds:
        agent_average_rounds, agent_round_trend = _get_agent_round_metrics(
            start_ts,
            end_ts,
            audience,
            audience_identities or ("__no_matching_user__",),
        )
    agent_usage_overview["average_session_rounds"] = agent_average_rounds

    platform_active_identities = _run_rows(
        f"""
        SELECT DISTINCT lower(COALESCE(NULLIF(u.username, ''), NULLIF(u.email, ''), u.id::text)) AS identity
        FROM public.users u
        WHERE (u.deleted = false OR u.deleted IS NULL)
          AND {_audience_condition('u')}
          AND (
              EXISTS (
                  SELECT 1 FROM public.activity a
                  WHERE a.user_id = u.id
                    AND a.created_at >= :start_ts
                    AND a.created_at < :end_ts
              )
              OR EXISTS (
                  SELECT 1 FROM public.chat_sessions s
                  WHERE s.user_id = u.id
                    AND (s.deleted = false OR s.deleted IS NULL)
                    AND COALESCE(s.updated_at, s.created_at) >= :start_ts
                    AND COALESCE(s.updated_at, s.created_at) < :end_ts
              )
          )
        """,
        params,
    )
    platform_identity_aliases = _run_rows(
        """
        SELECT
            lower(COALESCE(NULLIF(username, ''), NULLIF(email, ''), id::text)) AS canonical_identity,
            lower(NULLIF(username, '')) AS username_alias,
            lower(NULLIF(email, '')) AS email_alias,
            COALESCE(NULLIF(trim(organization_name), ''), '未填写组织') AS organization_name
        FROM public.users
        WHERE deleted = false OR deleted IS NULL
        """
    )
    platform_daily_active_identities = _run_rows(
        f"""
        WITH user_days AS (
            SELECT a.created_at::date AS bucket_start, a.user_id
            FROM public.activity a
            WHERE a.user_id IS NOT NULL
              AND a.created_at >= :start_ts
              AND a.created_at < :end_ts
            UNION
            SELECT COALESCE(s.updated_at, s.created_at)::date AS bucket_start, s.user_id
            FROM public.chat_sessions s
            WHERE s.user_id IS NOT NULL
              AND (s.deleted = false OR s.deleted IS NULL)
              AND COALESCE(s.updated_at, s.created_at) >= :start_ts
              AND COALESCE(s.updated_at, s.created_at) < :end_ts
        )
        SELECT DISTINCT
            d.bucket_start,
            lower(COALESCE(NULLIF(u.username, ''), NULLIF(u.email, ''), u.id::text)) AS identity
        FROM user_days d
        JOIN public.users u ON u.id = d.user_id
        WHERE (u.deleted = false OR u.deleted IS NULL)
          AND {_audience_condition('u')}
        """,
        params,
    )
    agent_daily_identities = _run_deerflow_rows(
        """
        SELECT DISTINCT
            COALESCE(
                to_timestamp(NULLIF(value->>'created_at', '')::double precision),
                created_at
            )::date AS bucket_start,
            lower(COALESCE(value->>'username', value->'metadata'->>'username')) AS identity
        FROM public.store
        WHERE prefix = 'threads'
          AND (:audience = 'all' OR lower(COALESCE(value->>'username', value->'metadata'->>'username')) IN :audience_identities)
          AND COALESCE(value->>'username', value->'metadata'->>'username') IS NOT NULL
          AND COALESCE(
              to_timestamp(NULLIF(value->>'created_at', '')::double precision),
              created_at
          ) >= :start_ts
          AND COALESCE(
              to_timestamp(NULLIF(value->>'created_at', '')::double precision),
              created_at
          ) < :end_ts
        """,
        agent_params,
    )

    # StarSeeker is the Deerflow Agent. Keep its platform feature metrics aligned
    # with the Agent monitor by treating each stored thread as one invocation.
    starseeker_summary = {
        "feature_name": "StarSeeker",
        "call_count": agent_usage_overview["session_creations"],
        "user_count": agent_usage_overview["session_users"],
    }
    feature_usage = [
        starseeker_summary if row["feature_name"] == "StarSeeker" else row
        for row in feature_usage
    ]
    feature_usage_trend = [
        row for row in feature_usage_trend if row["feature_name"] != "StarSeeker"
    ] + [
        {
            "feature_name": "StarSeeker",
            "bucket_start": session_row["bucket_start"],
            "call_count": session_row["count"],
            "user_count": next(
                (
                    user_row["count"]
                    for user_row in agent_user_trend
                    if user_row["bucket_start"] == session_row["bucket_start"]
                ),
                0,
            ),
        }
        for session_row in agent_session_trend
    ]
    feature_usage_trend.sort(key=lambda row: (row["feature_name"], row["bucket_start"]))

    agent_user_list = _run_deerflow_rows(
        """
        WITH thread_rows AS (
            SELECT
                COALESCE(value->>'username', value->'metadata'->>'username', '-') AS username,
                COALESCE(
                    to_timestamp(NULLIF(value->>'created_at', '')::double precision),
                    created_at
                ) AS created_at
            FROM public.store
            WHERE prefix = 'threads'
              AND (:audience = 'all' OR lower(COALESCE(value->>'username', value->'metadata'->>'username')) IN :audience_identities)
        )
        SELECT
            username,
            COUNT(*) AS session_creations,
            MIN(created_at) AS first_created_at,
            MAX(created_at) AS last_created_at
        FROM thread_rows
        WHERE username != '-'
          AND created_at >= :start_ts
          AND created_at < :end_ts
        GROUP BY username
        ORDER BY session_creations DESC, last_created_at DESC, username
        """,
        agent_params,
    )

    agent_retention_overview = _run_deerflow_rows(
        """
        WITH thread_rows AS (
            SELECT
                COALESCE(value->>'username', value->'metadata'->>'username', '-') AS username,
                COALESCE(
                    to_timestamp(NULLIF(value->>'created_at', '')::double precision),
                    created_at
                ) AS created_at
            FROM public.store
            WHERE prefix = 'threads'
              AND (:audience = 'all' OR lower(COALESCE(value->>'username', value->'metadata'->>'username')) IN :audience_identities)
        ),
        user_stats AS (
            SELECT
                username,
                COUNT(*) AS session_creations,
                COUNT(DISTINCT created_at::date) AS active_days,
                COUNT(DISTINCT date_trunc('week', created_at)::date) AS active_weeks
            FROM thread_rows
            WHERE username != '-'
              AND created_at >= :start_ts
              AND created_at < :end_ts
            GROUP BY username
        )
        SELECT
            COUNT(*) AS session_users,
            COUNT(*) FILTER (WHERE active_days >= 2) AS returning_users,
            COUNT(*) FILTER (WHERE active_days >= 3) AS sticky_users,
            COUNT(*) FILTER (WHERE active_weeks >= 2) AS multi_week_users,
            COALESCE(AVG(active_days::numeric), 0) AS avg_active_days,
            COALESCE(AVG(session_creations::numeric), 0) AS avg_sessions_per_user
        FROM user_stats
        """,
        agent_params,
    )[0]

    agent_stickiness_distribution = _run_deerflow_rows(
        """
        WITH thread_rows AS (
            SELECT
                COALESCE(value->>'username', value->'metadata'->>'username', '-') AS username,
                COALESCE(
                    to_timestamp(NULLIF(value->>'created_at', '')::double precision),
                    created_at
                ) AS created_at
            FROM public.store
            WHERE prefix = 'threads'
              AND (:audience = 'all' OR lower(COALESCE(value->>'username', value->'metadata'->>'username')) IN :audience_identities)
        ),
        user_stats AS (
            SELECT
                username,
                COUNT(DISTINCT created_at::date) AS active_days
            FROM thread_rows
            WHERE username != '-'
              AND created_at >= :start_ts
              AND created_at < :end_ts
            GROUP BY username
        )
        SELECT
            CASE
                WHEN active_days = 1 THEN '1天'
                WHEN active_days BETWEEN 2 AND 3 THEN '2-3天'
                WHEN active_days BETWEEN 4 AND 7 THEN '4-7天'
                ELSE '8天及以上'
            END AS bucket,
            COUNT(*) AS user_count,
            MIN(active_days) AS min_days,
            MAX(active_days) AS max_days
        FROM user_stats
        GROUP BY 1
        ORDER BY min_days ASC, max_days ASC
        """,
        agent_params,
    )

    agent_sticky_user_list = _run_deerflow_rows(
        """
        WITH thread_rows AS (
            SELECT
                COALESCE(value->>'username', value->'metadata'->>'username', '-') AS username,
                COALESCE(
                    to_timestamp(NULLIF(value->>'created_at', '')::double precision),
                    created_at
                ) AS created_at
            FROM public.store
            WHERE prefix = 'threads'
              AND (:audience = 'all' OR lower(COALESCE(value->>'username', value->'metadata'->>'username')) IN :audience_identities)
        )
        SELECT
            username,
            COUNT(*) AS session_creations,
            COUNT(DISTINCT created_at::date) AS active_days,
            COUNT(DISTINCT date_trunc('week', created_at)::date) AS active_weeks,
            MIN(created_at) AS first_created_at,
            MAX(created_at) AS last_created_at
        FROM thread_rows
        WHERE username != '-'
          AND created_at >= :start_ts
          AND created_at < :end_ts
        GROUP BY username
        ORDER BY active_days DESC, active_weeks DESC, session_creations DESC, last_created_at DESC, username
        LIMIT 20
        """,
        agent_params,
    )

    top_endpoints = _run_rows(
        f"""
        SELECT a.endpoint, COUNT(*) AS count
        FROM public.activity a
        JOIN public.users u ON u.id = a.user_id
        WHERE a.endpoint IS NOT NULL
          AND a.endpoint != ''
          AND {_audience_condition('u')}
          AND a.created_at >= :start_ts
          AND a.created_at < :end_ts
        GROUP BY a.endpoint
        ORDER BY count DESC, a.endpoint
        """,
        params,
    )

    top_users = _run_rows(
        f"""
        WITH activity_stats AS (
            SELECT user_id, COUNT(*) AS activity_count
            FROM public.activity
            WHERE created_at >= :start_ts
              AND created_at < :end_ts
            GROUP BY user_id
        ),
        session_stats AS (
            SELECT user_id, COUNT(*) AS session_count
            FROM public.chat_sessions
            WHERE (deleted = false OR deleted IS NULL)
              AND COALESCE(updated_at, created_at) >= :start_ts
              AND COALESCE(updated_at, created_at) < :end_ts
            GROUP BY user_id
        )
        SELECT
            u.id AS user_id,
            u.username,
            u.email,
            COALESCE(NULLIF(trim(u.organization_name), ''), '未填写组织') AS organization_name,
            COALESCE(a.activity_count, 0) AS activity_count,
            COALESCE(s.session_count, 0) AS session_count
        FROM public.users u
        LEFT JOIN activity_stats a ON a.user_id = u.id
        LEFT JOIN session_stats s ON s.user_id = u.id
        WHERE (u.deleted = false OR u.deleted IS NULL)
          AND {_audience_condition('u')}
          AND (COALESCE(a.activity_count, 0) > 0 OR COALESCE(s.session_count, 0) > 0)
        ORDER BY activity_count DESC, session_count DESC, u.id DESC
        """,
        params,
    )

    agent_user_stats = _run_deerflow_rows(
        """
        WITH thread_rows AS (
            SELECT
                lower(COALESCE(value->>'username', value->'metadata'->>'username')) AS identity,
                COALESCE(
                    to_timestamp(NULLIF(value->>'created_at', '')::double precision),
                    created_at
                ) AS created_at
            FROM public.store
            WHERE prefix = 'threads'
              AND (:audience = 'all' OR lower(COALESCE(value->>'username', value->'metadata'->>'username')) IN :audience_identities)
        )
        SELECT identity, COUNT(*) AS session_count
        FROM thread_rows
        WHERE identity IS NOT NULL
          AND created_at >= :start_ts
          AND created_at < :end_ts
        GROUP BY identity
        """,
        agent_params,
    )

    # User and platform monitoring cover the whole MU platform. A Deerflow thread
    # is one StarSeeker invocation, one platform behavior and one platform session.
    agent_session_count = int(agent_usage_overview["session_creations"] or 0)
    overview["activity_in_period"] = int(overview["activity_in_period"] or 0) + agent_session_count
    overview["sessions_in_period"] = int(overview["sessions_in_period"] or 0) + agent_session_count

    alias_to_canonical = {}
    organization_by_canonical = {}
    for row in platform_identity_aliases:
        canonical = row["canonical_identity"]
        organization_by_canonical[canonical] = row["organization_name"]
        for alias in (canonical, row["username_alias"], row["email_alias"]):
            if alias:
                alias_to_canonical[alias] = canonical

    def canonical_identity(identity: Optional[str]) -> Optional[str]:
        if not identity:
            return None
        normalized = identity.lower()
        return alias_to_canonical.get(normalized, normalized)

    def organization_for_identity(identity: Optional[str]) -> str:
        canonical = canonical_identity(identity)
        if not canonical:
            return "-"
        return organization_by_canonical.get(canonical, "未匹配组织")

    active_identities = {
        canonical_identity(row["identity"])
        for row in platform_active_identities
        if row["identity"]
    }
    active_identities.update(
        canonical_identity(row["identity"])
        for row in agent_daily_identities
        if row["identity"]
    )
    overview["active_users"] = len(active_identities)
    overview["active_users_in_period"] = len(active_identities)

    def merge_daily_counts(base_rows: list[dict], extra_rows: list[dict]) -> list[dict]:
        counts = {row["bucket_start"]: int(row["count"] or 0) for row in base_rows}
        for row in extra_rows:
            counts[row["bucket_start"]] = counts.get(row["bucket_start"], 0) + int(row["count"] or 0)
        return [{"bucket_start": day, "count": count} for day, count in sorted(counts.items())]

    session_trend = merge_daily_counts(session_trend, agent_session_trend)
    activity_trend = merge_daily_counts(activity_trend, agent_session_trend)

    daily_active = {}
    for row in platform_daily_active_identities + agent_daily_identities:
        identity = canonical_identity(row["identity"])
        if identity:
            daily_active.setdefault(row["bucket_start"], set()).add(identity)
    active_user_trend = [
        {"bucket_start": day, "count": len(identities)}
        for day, identities in sorted(daily_active.items())
    ]

    top_endpoints.append({"endpoint": "StarSeeker / Deerflow Session", "count": agent_session_count})
    top_endpoints.sort(key=lambda row: (-int(row["count"] or 0), row["endpoint"]))

    agent_counts = {}
    for row in agent_user_stats:
        identity = canonical_identity(row["identity"])
        if identity:
            agent_counts[identity] = agent_counts.get(identity, 0) + int(row["session_count"] or 0)

    agent_user_distribution = [
        {"label": identity, "count": count}
        for identity, count in sorted(agent_counts.items(), key=lambda item: (-item[1], item[0]))
    ]
    agent_organization_counts = {}
    for identity, count in agent_counts.items():
        organization = organization_by_canonical.get(identity, "未匹配组织")
        agent_organization_counts[organization] = agent_organization_counts.get(organization, 0) + count
    agent_organization_distribution = [
        {"label": organization, "count": count}
        for organization, count in sorted(
            agent_organization_counts.items(),
            key=lambda item: (-item[1], item[0]),
        )
    ]
    seen_agent_identities = set()
    for row in top_users:
        identity = canonical_identity(row.get("username") or row.get("email"))
        agent_count = agent_counts.get(identity, 0)
        row["activity_count"] = int(row["activity_count"] or 0) + agent_count
        row["session_count"] = int(row["session_count"] or 0) + agent_count
        row["organization_name"] = row.get("organization_name") or organization_for_identity(row.get("username") or row.get("email"))
        if agent_count:
            seen_agent_identities.add(identity)
    top_users.extend(
        {
            "user_id": None,
            "username": identity,
            "email": None,
            "organization_name": organization_for_identity(identity),
            "activity_count": count,
            "session_count": count,
        }
        for identity, count in agent_counts.items()
        if identity not in seen_agent_identities
    )
    for row in agent_usage:
        row["organization_name"] = organization_for_identity(row.get("username"))
    for row in agent_user_list:
        row["organization_name"] = organization_for_identity(row.get("username"))
    for row in agent_sticky_user_list:
        row["organization_name"] = organization_for_identity(row.get("username"))
    top_users = sorted(
        top_users,
        key=lambda row: (-int(row["activity_count"] or 0), -int(row["session_count"] or 0)),
    )

    monitor_agent_usage_overview = agent_usage_overview
    monitor_agent_session_trend = agent_session_trend
    monitor_agent_user_trend = agent_user_trend
    monitor_agent_round_trend = agent_round_trend
    monitor_agent_user_distribution = agent_user_distribution
    monitor_agent_organization_distribution = agent_organization_distribution
    monitor_agent_user_list = agent_user_list
    monitor_agent_retention_overview = agent_retention_overview
    monitor_agent_stickiness_distribution = agent_stickiness_distribution
    monitor_agent_sticky_user_list = agent_sticky_user_list
    monitor_agent_usage = agent_usage
    monitor_agent_definition = "一条 Deerflow thread 计为一次 StarSeeker 调用、一次平台行为和一次平台会话。"

    if agent_feature == "ask":
        ask_condition = "(a.endpoint LIKE '/rag%' OR a.endpoint LIKE '/rag-search-literature%')"
        monitor_agent_usage = _run_rows(
            f"""
            SELECT
                a.id::text AS thread_id,
                COALESCE(NULLIF(u.username, ''), NULLIF(u.email, ''), u.id::text) AS username,
                COALESCE(NULLIF(trim(u.organization_name), ''), '未填写组织') AS organization_name,
                COALESCE(NULLIF(a.endpoint, ''), 'Ask 调用') AS name,
                a.created_at,
                false AS exportable
            FROM public.activity a
            JOIN public.users u ON u.id = a.user_id
            WHERE {ask_condition}
              AND {_audience_condition('u')}
              AND a.created_at >= :start_ts
              AND a.created_at < :end_ts
            ORDER BY a.created_at DESC
            """,
            params,
        )
        monitor_agent_usage_overview = _run_rows(
            f"""
            SELECT
                COUNT(*) AS session_creations,
                COUNT(DISTINCT a.user_id) AS session_users,
                NULL::numeric AS average_session_rounds
            FROM public.activity a
            JOIN public.users u ON u.id = a.user_id
            WHERE {ask_condition}
              AND {_audience_condition('u')}
              AND a.created_at >= :start_ts
              AND a.created_at < :end_ts
            """,
            params,
        )[0]
        monitor_agent_session_trend = _run_rows(
            f"""
            SELECT date_trunc('day', a.created_at)::date AS bucket_start, COUNT(*) AS count
            FROM public.activity a
            JOIN public.users u ON u.id = a.user_id
            WHERE {ask_condition}
              AND {_audience_condition('u')}
              AND a.created_at >= :start_ts
              AND a.created_at < :end_ts
            GROUP BY 1
            ORDER BY 1 ASC
            """,
            params,
        )
        monitor_agent_user_trend = _run_rows(
            f"""
            SELECT bucket_start, COUNT(DISTINCT user_id) AS count
            FROM (
                SELECT date_trunc('day', a.created_at)::date AS bucket_start, a.user_id
                FROM public.activity a
                JOIN public.users u ON u.id = a.user_id
                WHERE {ask_condition}
                  AND {_audience_condition('u')}
                  AND a.created_at >= :start_ts
                  AND a.created_at < :end_ts
            ) ask_events
            GROUP BY 1
            ORDER BY 1 ASC
            """,
            params,
        )
        monitor_agent_round_trend = []
        monitor_agent_user_distribution = _run_rows(
            f"""
            SELECT
                COALESCE(NULLIF(u.username, ''), NULLIF(u.email, ''), u.id::text) AS label,
                COUNT(*) AS count
            FROM public.activity a
            JOIN public.users u ON u.id = a.user_id
            WHERE {ask_condition}
              AND {_audience_condition('u')}
              AND a.created_at >= :start_ts
              AND a.created_at < :end_ts
            GROUP BY 1
            ORDER BY count DESC, label
            """,
            params,
        )
        monitor_agent_organization_distribution = _run_rows(
            f"""
            SELECT
                COALESCE(NULLIF(trim(u.organization_name), ''), '未填写组织') AS label,
                COUNT(*) AS count
            FROM public.activity a
            JOIN public.users u ON u.id = a.user_id
            WHERE {ask_condition}
              AND {_audience_condition('u')}
              AND a.created_at >= :start_ts
              AND a.created_at < :end_ts
            GROUP BY 1
            ORDER BY count DESC, label
            """,
            params,
        )
        monitor_agent_user_list = _run_rows(
            f"""
            SELECT
                COALESCE(NULLIF(u.username, ''), NULLIF(u.email, ''), u.id::text) AS username,
                COALESCE(NULLIF(trim(u.organization_name), ''), '未填写组织') AS organization_name,
                COUNT(*) AS session_creations,
                MIN(a.created_at) AS first_created_at,
                MAX(a.created_at) AS last_created_at
            FROM public.activity a
            JOIN public.users u ON u.id = a.user_id
            WHERE {ask_condition}
              AND {_audience_condition('u')}
              AND a.created_at >= :start_ts
              AND a.created_at < :end_ts
            GROUP BY 1, 2
            ORDER BY session_creations DESC, last_created_at DESC, username
            """,
            params,
        )
        monitor_agent_retention_overview = _run_rows(
            f"""
            WITH user_stats AS (
                SELECT
                    a.user_id,
                    COUNT(*) AS session_creations,
                    COUNT(DISTINCT a.created_at::date) AS active_days,
                    COUNT(DISTINCT date_trunc('week', a.created_at)::date) AS active_weeks
                FROM public.activity a
                JOIN public.users u ON u.id = a.user_id
                WHERE {ask_condition}
                  AND {_audience_condition('u')}
                  AND a.created_at >= :start_ts
                  AND a.created_at < :end_ts
                GROUP BY a.user_id
            )
            SELECT
                COUNT(*) AS session_users,
                COUNT(*) FILTER (WHERE active_days >= 2) AS returning_users,
                COUNT(*) FILTER (WHERE active_days >= 3) AS sticky_users,
                COUNT(*) FILTER (WHERE active_weeks >= 2) AS multi_week_users,
                COALESCE(AVG(active_days::numeric), 0) AS avg_active_days,
                COALESCE(AVG(session_creations::numeric), 0) AS avg_sessions_per_user
            FROM user_stats
            """,
            params,
        )[0]
        monitor_agent_stickiness_distribution = _run_rows(
            f"""
            WITH user_stats AS (
                SELECT a.user_id, COUNT(DISTINCT a.created_at::date) AS active_days
                FROM public.activity a
                JOIN public.users u ON u.id = a.user_id
                WHERE {ask_condition}
                  AND {_audience_condition('u')}
                  AND a.created_at >= :start_ts
                  AND a.created_at < :end_ts
                GROUP BY a.user_id
            )
            SELECT
                CASE
                    WHEN active_days = 1 THEN '1天'
                    WHEN active_days BETWEEN 2 AND 3 THEN '2-3天'
                    WHEN active_days BETWEEN 4 AND 7 THEN '4-7天'
                    ELSE '8天及以上'
                END AS bucket,
                COUNT(*) AS user_count,
                MIN(active_days) AS min_days,
                MAX(active_days) AS max_days
            FROM user_stats
            GROUP BY 1
            ORDER BY min_days ASC, max_days ASC
            """,
            params,
        )
        monitor_agent_sticky_user_list = _run_rows(
            f"""
            SELECT
                COALESCE(NULLIF(u.username, ''), NULLIF(u.email, ''), u.id::text) AS username,
                COALESCE(NULLIF(trim(u.organization_name), ''), '未填写组织') AS organization_name,
                COUNT(*) AS session_creations,
                COUNT(DISTINCT a.created_at::date) AS active_days,
                COUNT(DISTINCT date_trunc('week', a.created_at)::date) AS active_weeks,
                MIN(a.created_at) AS first_created_at,
                MAX(a.created_at) AS last_created_at
            FROM public.activity a
            JOIN public.users u ON u.id = a.user_id
            WHERE {ask_condition}
              AND {_audience_condition('u')}
              AND a.created_at >= :start_ts
              AND a.created_at < :end_ts
            GROUP BY 1, 2
            ORDER BY active_days DESC, active_weeks DESC, session_creations DESC, last_created_at DESC, username
            LIMIT 20
            """,
            params,
        )
        monitor_agent_definition = "Ask 概览基于 umap_db.public.activity 中 /rag 与 /rag-search-literature 相关接口；一次接口调用计为一次 Ask 调用。"

    return {
        "meta": {
            "current_label": "所选时间段",
            "trend_label": "按日",
            "start_date": params["start_date"],
            "end_date": params["end_date"],
            "audience": audience,
            "audience_label": {"all": "全部", "internal": "SES 内部", "external": "外部客户"}[audience],
            "range_summary": f"统计区间为 {params['start_date']} 至 {params['end_date']}，用户群体为 { {'all': '全部', 'internal': 'SES 内部', 'external': '外部客户'}[audience] }，趋势统一按单日聚合。",
            "agent_feature": agent_feature,
            "agent_feature_label": {"starseeker": "StarSeeker", "ask": "Ask"}[agent_feature],
            "data_sources": {
                "platform": "umap_db",
                "agent": "deerflow_prod.public.store",
            },
            "agent_definition": monitor_agent_definition,
        },
        "overview": overview,
        "signup_trend": signup_trend,
        "platform_registered_user_trend": platform_registered_user_trend,
        "user_role_distribution": user_role_distribution,
        "user_organization_distribution": user_organization_distribution,
        "session_trend": session_trend,
        "activity_trend": activity_trend,
        "login_user_trend": login_user_trend,
        "active_user_trend": active_user_trend,
        "feature_usage": feature_usage,
        "feature_usage_trend": feature_usage_trend,
        "agent_usage_overview": monitor_agent_usage_overview,
        "agent_session_trend": monitor_agent_session_trend,
        "agent_user_trend": monitor_agent_user_trend,
        "agent_round_trend": monitor_agent_round_trend,
        "agent_user_distribution": monitor_agent_user_distribution,
        "agent_organization_distribution": monitor_agent_organization_distribution,
        "agent_user_list": monitor_agent_user_list,
        "agent_retention_overview": monitor_agent_retention_overview,
        "agent_stickiness_distribution": monitor_agent_stickiness_distribution,
        "agent_sticky_user_list": monitor_agent_sticky_user_list,
        "agent_usage": monitor_agent_usage,
        "top_endpoints": top_endpoints,
        "top_users": top_users,
    }


def _get_activity_call_dashboard_report(
    *,
    start_date: Optional[date] = Query(default=None),
    end_date: Optional[date] = Query(default=None),
    audience: Literal["all", "internal", "external"] = Query(default="all"),
    endpoint_condition: str,
    feature_key: str,
    feature_label: str,
    fallback_name: str,
    definition: str,
):
    resolved_start, resolved_end = _resolve_date_range(start_date, end_date)
    start_ts = datetime.combine(resolved_start, time.min)
    end_ts = datetime.combine(resolved_end + timedelta(days=1), time.min)
    params = {
        "start_ts": start_ts,
        "end_ts": end_ts,
        "start_date": resolved_start.isoformat(),
        "end_date": resolved_end.isoformat(),
        "audience": audience,
    }

    usage = _run_rows(
        f"""
        SELECT
            a.id::text AS thread_id,
            COALESCE(NULLIF(u.username, ''), NULLIF(u.email, ''), u.id::text) AS username,
            COALESCE(NULLIF(trim(u.organization_name), ''), '未填写组织') AS organization_name,
            COALESCE(NULLIF(a.endpoint, ''), :fallback_name) AS name,
            a.created_at,
            false AS exportable
        FROM public.activity a
        JOIN public.users u ON u.id = a.user_id
        WHERE {endpoint_condition}
          AND {_audience_condition('u')}
          AND a.created_at >= :start_ts
          AND a.created_at < :end_ts
        ORDER BY a.created_at DESC
        """,
        {**params, "fallback_name": fallback_name},
    )
    usage_overview = _run_rows(
        f"""
        SELECT
            COUNT(*) AS session_creations,
            COUNT(DISTINCT a.user_id) AS session_users,
            NULL::numeric AS average_session_rounds
        FROM public.activity a
        JOIN public.users u ON u.id = a.user_id
        WHERE {endpoint_condition}
          AND {_audience_condition('u')}
          AND a.created_at >= :start_ts
          AND a.created_at < :end_ts
        """,
        params,
    )[0]
    session_trend = _run_rows(
        f"""
        SELECT date_trunc('day', a.created_at)::date AS bucket_start, COUNT(*) AS count
        FROM public.activity a
        JOIN public.users u ON u.id = a.user_id
        WHERE {endpoint_condition}
          AND {_audience_condition('u')}
          AND a.created_at >= :start_ts
          AND a.created_at < :end_ts
        GROUP BY 1
        ORDER BY 1 ASC
        """,
        params,
    )
    user_trend = _run_rows(
        f"""
        SELECT bucket_start, COUNT(DISTINCT user_id) AS count
        FROM (
            SELECT date_trunc('day', a.created_at)::date AS bucket_start, a.user_id
            FROM public.activity a
            JOIN public.users u ON u.id = a.user_id
            WHERE {endpoint_condition}
              AND {_audience_condition('u')}
              AND a.created_at >= :start_ts
              AND a.created_at < :end_ts
        ) ask_events
        GROUP BY 1
        ORDER BY 1 ASC
        """,
        params,
    )
    user_distribution = _run_rows(
        f"""
        SELECT
            COALESCE(NULLIF(u.username, ''), NULLIF(u.email, ''), u.id::text) AS label,
            COUNT(*) AS count
        FROM public.activity a
        JOIN public.users u ON u.id = a.user_id
        WHERE {endpoint_condition}
          AND {_audience_condition('u')}
          AND a.created_at >= :start_ts
          AND a.created_at < :end_ts
        GROUP BY 1
        ORDER BY count DESC, label
        """,
        params,
    )
    organization_distribution = _run_rows(
        f"""
        SELECT
            COALESCE(NULLIF(trim(u.organization_name), ''), '未填写组织') AS label,
            COUNT(*) AS count
        FROM public.activity a
        JOIN public.users u ON u.id = a.user_id
        WHERE {endpoint_condition}
          AND {_audience_condition('u')}
          AND a.created_at >= :start_ts
          AND a.created_at < :end_ts
        GROUP BY 1
        ORDER BY count DESC, label
        """,
        params,
    )
    user_list = _run_rows(
        f"""
        SELECT
            COALESCE(NULLIF(u.username, ''), NULLIF(u.email, ''), u.id::text) AS username,
            COALESCE(NULLIF(trim(u.organization_name), ''), '未填写组织') AS organization_name,
            COUNT(*) AS session_creations,
            MIN(a.created_at) AS first_created_at,
            MAX(a.created_at) AS last_created_at
        FROM public.activity a
        JOIN public.users u ON u.id = a.user_id
        WHERE {endpoint_condition}
          AND {_audience_condition('u')}
          AND a.created_at >= :start_ts
          AND a.created_at < :end_ts
        GROUP BY 1, 2
        ORDER BY session_creations DESC, last_created_at DESC, username
        """,
        params,
    )
    retention_overview = _run_rows(
        f"""
        WITH user_stats AS (
            SELECT
                a.user_id,
                COUNT(*) AS session_creations,
                COUNT(DISTINCT a.created_at::date) AS active_days,
                COUNT(DISTINCT date_trunc('week', a.created_at)::date) AS active_weeks
            FROM public.activity a
            JOIN public.users u ON u.id = a.user_id
            WHERE {endpoint_condition}
              AND {_audience_condition('u')}
              AND a.created_at >= :start_ts
              AND a.created_at < :end_ts
            GROUP BY a.user_id
        )
        SELECT
            COUNT(*) AS session_users,
            COUNT(*) FILTER (WHERE active_days >= 2) AS returning_users,
            COUNT(*) FILTER (WHERE active_days >= 3) AS sticky_users,
            COUNT(*) FILTER (WHERE active_weeks >= 2) AS multi_week_users,
            COALESCE(AVG(active_days::numeric), 0) AS avg_active_days,
            COALESCE(AVG(session_creations::numeric), 0) AS avg_sessions_per_user
        FROM user_stats
        """,
        params,
    )[0]
    stickiness_distribution = _run_rows(
        f"""
        WITH user_stats AS (
            SELECT a.user_id, COUNT(DISTINCT a.created_at::date) AS active_days
            FROM public.activity a
            JOIN public.users u ON u.id = a.user_id
            WHERE {endpoint_condition}
              AND {_audience_condition('u')}
              AND a.created_at >= :start_ts
              AND a.created_at < :end_ts
            GROUP BY a.user_id
        )
        SELECT
            CASE
                WHEN active_days = 1 THEN '1天'
                WHEN active_days BETWEEN 2 AND 3 THEN '2-3天'
                WHEN active_days BETWEEN 4 AND 7 THEN '4-7天'
                ELSE '8天及以上'
            END AS bucket,
            COUNT(*) AS user_count,
            MIN(active_days) AS min_days,
            MAX(active_days) AS max_days
        FROM user_stats
        GROUP BY 1
        ORDER BY min_days ASC, max_days ASC
        """,
        params,
    )
    sticky_user_list = _run_rows(
        f"""
        SELECT
            COALESCE(NULLIF(u.username, ''), NULLIF(u.email, ''), u.id::text) AS username,
            COALESCE(NULLIF(trim(u.organization_name), ''), '未填写组织') AS organization_name,
            COUNT(*) AS session_creations,
            COUNT(DISTINCT a.created_at::date) AS active_days,
            COUNT(DISTINCT date_trunc('week', a.created_at)::date) AS active_weeks,
            MIN(a.created_at) AS first_created_at,
            MAX(a.created_at) AS last_created_at
        FROM public.activity a
        JOIN public.users u ON u.id = a.user_id
        WHERE {endpoint_condition}
          AND {_audience_condition('u')}
          AND a.created_at >= :start_ts
          AND a.created_at < :end_ts
        GROUP BY 1, 2
        ORDER BY active_days DESC, active_weeks DESC, session_creations DESC, last_created_at DESC, username
        LIMIT 20
        """,
        params,
    )

    audience_label = {"all": "全部", "internal": "SES 内部", "external": "外部客户"}[audience]
    return {
        "meta": {
            "current_label": "所选时间段",
            "trend_label": "按日",
            "start_date": params["start_date"],
            "end_date": params["end_date"],
            "audience": audience,
            "audience_label": audience_label,
            "range_summary": f"统计区间为 {params['start_date']} 至 {params['end_date']}，用户群体为 {audience_label}，趋势统一按单日聚合。",
            "agent_feature": feature_key,
            "agent_feature_label": feature_label,
            "data_sources": {"platform": "umap_db"},
            "agent_definition": definition,
        },
        "agent_usage_overview": usage_overview,
        "agent_session_trend": session_trend,
        "agent_user_trend": user_trend,
        "agent_round_trend": [],
        "agent_user_distribution": user_distribution,
        "agent_organization_distribution": organization_distribution,
        "agent_user_list": user_list,
        "agent_retention_overview": retention_overview,
        "agent_stickiness_distribution": stickiness_distribution,
        "agent_sticky_user_list": sticky_user_list,
        "agent_usage": usage,
    }


@router.get("/ask-dashboard")
def get_ask_dashboard_report(
    start_date: Optional[date] = Query(default=None),
    end_date: Optional[date] = Query(default=None),
    audience: Literal["all", "internal", "external"] = Query(default="all"),
):
    return _get_activity_call_dashboard_report(
        start_date=start_date,
        end_date=end_date,
        audience=audience,
        endpoint_condition="(a.endpoint LIKE '/rag%' OR a.endpoint LIKE '/rag-search-literature%')",
        feature_key="ask",
        feature_label="Ask",
        fallback_name="Ask 调用",
        definition="Ask 概览基于 umap_db.public.activity 中 /rag 与 /rag-search-literature 相关接口；一次接口调用计为一次 Ask 调用。",
    )


@router.get("/search-dashboard")
def get_search_dashboard_report(
    start_date: Optional[date] = Query(default=None),
    end_date: Optional[date] = Query(default=None),
    audience: Literal["all", "internal", "external"] = Query(default="all"),
):
    return _get_activity_call_dashboard_report(
        start_date=start_date,
        end_date=end_date,
        audience=audience,
        endpoint_condition=(
            "(a.endpoint LIKE '/search%' "
            "OR a.endpoint LIKE '/search-35%' "
            "OR a.endpoint LIKE '/find-friend-with-image%' "
            "OR a.endpoint LIKE '/api/molecule_details%')"
        ),
        feature_key="search",
        feature_label="search",
        fallback_name="search 调用",
        definition="search 概览基于 umap_db.public.activity 中 /search、/find-friend-with-image 与分子详情相关接口；一次接口调用计为一次 search 调用。",
    )


@router.get("/feature-dashboard")
def get_feature_dashboard_report(
    start_date: Optional[date] = Query(default=None),
    end_date: Optional[date] = Query(default=None),
    audience: Literal["all", "internal", "external"] = Query(default="all"),
):
    resolved_start, resolved_end = _resolve_date_range(start_date, end_date)
    start_ts = datetime.combine(resolved_start, time.min)
    end_ts = datetime.combine(resolved_end + timedelta(days=1), time.min)
    params = {
        "start_ts": start_ts,
        "end_ts": end_ts,
        "start_date": resolved_start.isoformat(),
        "end_date": resolved_end.isoformat(),
        "audience": audience,
    }
    feature_case = """
        CASE
            WHEN a.endpoint = '/api/md/run' THEN 'MD'
            WHEN a.endpoint LIKE '/api/cellLife/model_predict%' THEN 'cell life predict'
            WHEN a.endpoint LIKE '/api/cellPerformance/model_predict%'
              OR a.endpoint LIKE '/api/cellPerformance/llm_analysis%' THEN 'electrolyte design'
            WHEN a.endpoint LIKE '/api/electrodePerformance/model_predict?type=1%'
              OR a.endpoint = '/api/electrodePerformance/model_predict'
              OR (
                  a.endpoint LIKE '/api/electrodePerformance/model_predict%'
                  AND a.endpoint NOT LIKE '%type=2%'
              ) THEN 'electrode forward design'
            WHEN a.endpoint LIKE '/api/electrodePerformance/backward/result%'
              OR a.endpoint LIKE '/api/electrodePerformance/model_predict?type=2%' THEN 'electrode inverse design'
            ELSE NULL
        END
    """

    feature_usage = _run_rows(
        f"""
        WITH feature_events AS (
            SELECT
                a.id::text AS thread_id,
                COALESCE(NULLIF(u.username, ''), NULLIF(u.email, ''), u.id::text) AS username,
                COALESCE(NULLIF(trim(u.organization_name), ''), '未填写组织') AS organization_name,
                a.endpoint,
                a.created_at,
                {feature_case} AS feature_name
            FROM public.activity a
            JOIN public.users u ON u.id = a.user_id
            WHERE a.created_at >= :start_ts
              AND a.created_at < :end_ts
              AND {_audience_condition('u')}
              AND a.endpoint IS NOT NULL
              AND a.endpoint != ''
        )
        SELECT
            thread_id,
            username,
            organization_name,
            feature_name,
            endpoint,
            feature_name || ' / ' || endpoint AS name,
            created_at,
            false AS exportable
        FROM feature_events
        WHERE feature_name IS NOT NULL
        ORDER BY created_at DESC
        """,
        params,
    )

    feature_summary_counts = defaultdict(lambda: {"call_count": 0, "users": set()})
    daily_counts = defaultdict(lambda: {"call_count": 0, "users": set()})
    user_counts = defaultdict(lambda: {"organization_name": "-", "call_count": 0, "dates": set(), "weeks": set()})
    organization_counts = defaultdict(int)
    endpoint_counts = defaultdict(lambda: {"feature_name": "-", "call_count": 0})

    for row in feature_usage:
        feature_name = row.get("feature_name") or "-"
        username = row.get("username") or "-"
        organization_name = row.get("organization_name") or "未填写组织"
        endpoint = row.get("endpoint") or "-"
        created_at = row.get("created_at")
        if isinstance(created_at, datetime):
            bucket_start = created_at.date()
            week_start = bucket_start - timedelta(days=bucket_start.weekday())
        else:
            bucket_start = created_at
            week_start = created_at

        feature_summary_counts[feature_name]["call_count"] += 1
        feature_summary_counts[feature_name]["users"].add(username)
        daily_counts[(feature_name, bucket_start)]["call_count"] += 1
        daily_counts[(feature_name, bucket_start)]["users"].add(username)
        user_counts[username]["organization_name"] = organization_name
        user_counts[username]["call_count"] += 1
        user_counts[username]["dates"].add(bucket_start)
        user_counts[username]["weeks"].add(week_start)
        organization_counts[organization_name] += 1
        endpoint_counts[(endpoint, feature_name)]["feature_name"] = feature_name
        endpoint_counts[(endpoint, feature_name)]["call_count"] += 1

    feature_usage_summary = sorted(
        [
            {
                "feature_name": feature_name,
                "call_count": values["call_count"],
                "user_count": len(values["users"]),
            }
            for feature_name, values in feature_summary_counts.items()
        ],
        key=lambda row: (-row["call_count"], row["feature_name"]),
    )
    feature_usage_trend = sorted(
        [
            {
                "feature_name": feature_name,
                "bucket_start": bucket_start,
                "call_count": values["call_count"],
                "user_count": len(values["users"]),
            }
            for (feature_name, bucket_start), values in daily_counts.items()
        ],
        key=lambda row: (row["feature_name"], row["bucket_start"]),
    )
    feature_top_users = sorted(
        [
            {
                "username": username,
                "organization_name": values["organization_name"],
                "call_count": values["call_count"],
            }
            for username, values in user_counts.items()
        ],
        key=lambda row: (-row["call_count"], row["username"]),
    )[:10]
    feature_organization_distribution = sorted(
        [{"label": organization, "count": count} for organization, count in organization_counts.items()],
        key=lambda row: (-row["count"], row["label"]),
    )
    feature_top_endpoints = sorted(
        [
            {
                "endpoint": endpoint,
                "feature_name": values["feature_name"],
                "call_count": values["call_count"],
            }
            for (endpoint, _feature_name), values in endpoint_counts.items()
        ],
        key=lambda row: (-row["call_count"], row["endpoint"]),
    )[:10]
    feature_user_list = sorted(
        [
            {
                "username": username,
                "organization_name": values["organization_name"],
                "session_creations": values["call_count"],
                "active_days": len(values["dates"]),
                "active_weeks": len(values["weeks"]),
                "first_created_at": None,
                "last_created_at": None,
            }
            for username, values in user_counts.items()
        ],
        key=lambda row: (-row["session_creations"], row["username"]),
    )
    feature_stickiness_distribution_counts = defaultdict(int)
    for values in user_counts.values():
        active_days = len(values["dates"])
        if active_days == 1:
            bucket = "1天"
            min_days = max_days = 1
        elif active_days <= 3:
            bucket = "2-3天"
            min_days, max_days = 2, 3
        elif active_days <= 7:
            bucket = "4-7天"
            min_days, max_days = 4, 7
        else:
            bucket = "8天及以上"
            min_days, max_days = 8, active_days
        feature_stickiness_distribution_counts[(bucket, min_days, max_days)] += 1
    feature_stickiness_distribution = [
        {"bucket": bucket, "user_count": count, "min_days": min_days, "max_days": max_days}
        for (bucket, min_days, max_days), count in sorted(
            feature_stickiness_distribution_counts.items(),
            key=lambda item: (item[0][1], item[0][2]),
        )
    ]
    feature_sticky_user_list = sorted(
        feature_user_list,
        key=lambda row: (-row["active_days"], -row["active_weeks"], -row["session_creations"], row["username"]),
    )[:20]
    total_calls = len(feature_usage)
    total_users = len(user_counts)
    returning_users = sum(1 for values in user_counts.values() if len(values["dates"]) >= 2)
    sticky_users = sum(1 for values in user_counts.values() if len(values["dates"]) >= 3)
    multi_week_users = sum(1 for values in user_counts.values() if len(values["weeks"]) >= 2)
    avg_active_days = (
        sum(len(values["dates"]) for values in user_counts.values()) / total_users
        if total_users
        else 0
    )

    audience_label = {"all": "全部", "internal": "SES 内部", "external": "外部客户"}[audience]
    return {
        "meta": {
            "current_label": "所选时间段",
            "trend_label": "按日",
            "start_date": params["start_date"],
            "end_date": params["end_date"],
            "audience": audience,
            "audience_label": audience_label,
            "range_summary": f"统计区间为 {params['start_date']} 至 {params['end_date']}，用户群体为 {audience_label}，趋势统一按单日聚合。",
            "agent_feature": "feature",
            "agent_feature_label": "模型",
            "data_sources": {"platform": "umap_db"},
            "agent_definition": "模型概览统计 umap_db.public.activity 中除 StarSeeker、Ask 和 search 之外的模型分类调用。",
        },
        "agent_usage_overview": {
            "session_creations": total_calls,
            "session_users": total_users,
            "average_session_rounds": None,
        },
        "agent_session_trend": [
            {"bucket_start": row["bucket_start"], "count": row["call_count"]}
            for row in feature_usage_trend
        ],
        "agent_user_trend": [
            {"bucket_start": row["bucket_start"], "count": row["user_count"]}
            for row in feature_usage_trend
        ],
        "agent_round_trend": [],
        "agent_user_distribution": [
            {"label": row["username"], "count": row["session_creations"]}
            for row in feature_user_list
        ],
        "agent_organization_distribution": feature_organization_distribution,
        "agent_user_list": feature_user_list,
        "agent_retention_overview": {
            "session_users": total_users,
            "returning_users": returning_users,
            "sticky_users": sticky_users,
            "multi_week_users": multi_week_users,
            "avg_active_days": avg_active_days,
            "avg_sessions_per_user": total_calls / total_users if total_users else 0,
        },
        "agent_stickiness_distribution": feature_stickiness_distribution,
        "agent_sticky_user_list": feature_sticky_user_list,
        "agent_usage": feature_usage,
        "feature_usage_summary": feature_usage_summary,
        "feature_usage_trend": feature_usage_trend,
        "feature_top_users": feature_top_users,
        "feature_top_endpoints": feature_top_endpoints,
    }
    feature_usage_overview = _run_rows(
        f"""
        WITH feature_events AS (
            SELECT a.user_id, {feature_case} AS feature_name
            FROM public.activity a
            JOIN public.users u ON u.id = a.user_id
            WHERE a.created_at >= :start_ts
              AND a.created_at < :end_ts
              AND {_audience_condition('u')}
              AND a.endpoint IS NOT NULL
              AND a.endpoint != ''
        )
        SELECT
            COUNT(*) AS session_creations,
            COUNT(DISTINCT user_id) AS session_users,
            NULL::numeric AS average_session_rounds
        FROM feature_events
        WHERE feature_name IS NOT NULL
        """,
        params,
    )[0]
    feature_usage_summary = _run_rows(
        f"""
        WITH feature_events AS (
            SELECT a.user_id, {feature_case} AS feature_name
            FROM public.activity a
            JOIN public.users u ON u.id = a.user_id
            WHERE a.created_at >= :start_ts
              AND a.created_at < :end_ts
              AND {_audience_condition('u')}
              AND a.endpoint IS NOT NULL
              AND a.endpoint != ''
        )
        SELECT
            feature_name,
            COUNT(*) AS call_count,
            COUNT(DISTINCT user_id) AS user_count
        FROM feature_events
        WHERE feature_name IS NOT NULL
        GROUP BY feature_name
        ORDER BY call_count DESC, feature_name
        """,
        params,
    )
    feature_usage_trend = _run_rows(
        f"""
        WITH feature_events AS (
            SELECT
                date_trunc('day', a.created_at)::date AS bucket_start,
                a.user_id,
                {feature_case} AS feature_name
            FROM public.activity a
            JOIN public.users u ON u.id = a.user_id
            WHERE a.created_at >= :start_ts
              AND a.created_at < :end_ts
              AND {_audience_condition('u')}
              AND a.endpoint IS NOT NULL
              AND a.endpoint != ''
        )
        SELECT
            feature_name,
            bucket_start,
            COUNT(*) AS call_count,
            COUNT(DISTINCT user_id) AS user_count
        FROM feature_events
        WHERE feature_name IS NOT NULL
        GROUP BY feature_name, bucket_start
        ORDER BY feature_name, bucket_start
        """,
        params,
    )
    feature_session_trend = _run_rows(
        f"""
        WITH feature_events AS (
            SELECT date_trunc('day', a.created_at)::date AS bucket_start, {feature_case} AS feature_name
            FROM public.activity a
            JOIN public.users u ON u.id = a.user_id
            WHERE a.created_at >= :start_ts
              AND a.created_at < :end_ts
              AND {_audience_condition('u')}
              AND a.endpoint IS NOT NULL
              AND a.endpoint != ''
        )
        SELECT bucket_start, COUNT(*) AS count
        FROM feature_events
        WHERE feature_name IS NOT NULL
        GROUP BY 1
        ORDER BY 1 ASC
        """,
        params,
    )
    feature_user_trend = _run_rows(
        f"""
        WITH feature_events AS (
            SELECT date_trunc('day', a.created_at)::date AS bucket_start, a.user_id, {feature_case} AS feature_name
            FROM public.activity a
            JOIN public.users u ON u.id = a.user_id
            WHERE a.created_at >= :start_ts
              AND a.created_at < :end_ts
              AND {_audience_condition('u')}
              AND a.endpoint IS NOT NULL
              AND a.endpoint != ''
        )
        SELECT bucket_start, COUNT(DISTINCT user_id) AS count
        FROM feature_events
        WHERE feature_name IS NOT NULL
        GROUP BY 1
        ORDER BY 1 ASC
        """,
        params,
    )
    feature_user_distribution = _run_rows(
        f"""
        WITH feature_events AS (
            SELECT
                COALESCE(NULLIF(u.username, ''), NULLIF(u.email, ''), u.id::text) AS username,
                {feature_case} AS feature_name
            FROM public.activity a
            JOIN public.users u ON u.id = a.user_id
            WHERE a.created_at >= :start_ts
              AND a.created_at < :end_ts
              AND {_audience_condition('u')}
              AND a.endpoint IS NOT NULL
              AND a.endpoint != ''
        )
        SELECT username AS label, COUNT(*) AS count
        FROM feature_events
        WHERE feature_name IS NOT NULL
        GROUP BY username
        ORDER BY count DESC, label
        """,
        params,
    )
    feature_top_users = _run_rows(
        f"""
        WITH feature_events AS (
            SELECT
                COALESCE(NULLIF(u.username, ''), NULLIF(u.email, ''), u.id::text) AS username,
                COALESCE(NULLIF(trim(u.organization_name), ''), '未填写组织') AS organization_name,
                {feature_case} AS feature_name
            FROM public.activity a
            JOIN public.users u ON u.id = a.user_id
            WHERE a.created_at >= :start_ts
              AND a.created_at < :end_ts
              AND {_audience_condition('u')}
              AND a.endpoint IS NOT NULL
              AND a.endpoint != ''
        )
        SELECT username, organization_name, COUNT(*) AS call_count
        FROM feature_events
        WHERE feature_name IS NOT NULL
        GROUP BY username, organization_name
        ORDER BY call_count DESC, username
        LIMIT 10
        """,
        params,
    )
    feature_organization_distribution = _run_rows(
        f"""
        WITH feature_events AS (
            SELECT
                COALESCE(NULLIF(trim(u.organization_name), ''), '未填写组织') AS organization_name,
                {feature_case} AS feature_name
            FROM public.activity a
            JOIN public.users u ON u.id = a.user_id
            WHERE a.created_at >= :start_ts
              AND a.created_at < :end_ts
              AND {_audience_condition('u')}
              AND a.endpoint IS NOT NULL
              AND a.endpoint != ''
        )
        SELECT organization_name AS label, COUNT(*) AS count
        FROM feature_events
        WHERE feature_name IS NOT NULL
        GROUP BY organization_name
        ORDER BY count DESC, label
        """,
        params,
    )
    feature_top_endpoints = _run_rows(
        f"""
        WITH feature_events AS (
            SELECT a.endpoint, {feature_case} AS feature_name
            FROM public.activity a
            JOIN public.users u ON u.id = a.user_id
            WHERE a.created_at >= :start_ts
              AND a.created_at < :end_ts
              AND {_audience_condition('u')}
              AND a.endpoint IS NOT NULL
              AND a.endpoint != ''
        )
        SELECT endpoint, feature_name, COUNT(*) AS call_count
        FROM feature_events
        WHERE feature_name IS NOT NULL
        GROUP BY endpoint, feature_name
        ORDER BY call_count DESC, endpoint
        LIMIT 10
        """,
        params,
    )
    feature_user_list = _run_rows(
        f"""
        WITH feature_events AS (
            SELECT
                COALESCE(NULLIF(u.username, ''), NULLIF(u.email, ''), u.id::text) AS username,
                COALESCE(NULLIF(trim(u.organization_name), ''), '未填写组织') AS organization_name,
                a.created_at,
                {feature_case} AS feature_name
            FROM public.activity a
            JOIN public.users u ON u.id = a.user_id
            WHERE a.created_at >= :start_ts
              AND a.created_at < :end_ts
              AND {_audience_condition('u')}
              AND a.endpoint IS NOT NULL
              AND a.endpoint != ''
        )
        SELECT
            username,
            organization_name,
            COUNT(*) AS session_creations,
            MIN(created_at) AS first_created_at,
            MAX(created_at) AS last_created_at
        FROM feature_events
        WHERE feature_name IS NOT NULL
        GROUP BY username, organization_name
        ORDER BY session_creations DESC, last_created_at DESC, username
        """,
        params,
    )
    feature_retention_overview = _run_rows(
        f"""
        WITH user_stats AS (
            SELECT
                a.user_id,
                COUNT(*) AS session_creations,
                COUNT(DISTINCT a.created_at::date) AS active_days,
                COUNT(DISTINCT date_trunc('week', a.created_at)::date) AS active_weeks
            FROM public.activity a
            JOIN public.users u ON u.id = a.user_id
            WHERE a.created_at >= :start_ts
              AND a.created_at < :end_ts
              AND {_audience_condition('u')}
              AND a.endpoint IS NOT NULL
              AND a.endpoint != ''
              AND {feature_case} IS NOT NULL
            GROUP BY a.user_id
        )
        SELECT
            COUNT(*) AS session_users,
            COUNT(*) FILTER (WHERE active_days >= 2) AS returning_users,
            COUNT(*) FILTER (WHERE active_days >= 3) AS sticky_users,
            COUNT(*) FILTER (WHERE active_weeks >= 2) AS multi_week_users,
            COALESCE(AVG(active_days::numeric), 0) AS avg_active_days,
            COALESCE(AVG(session_creations::numeric), 0) AS avg_sessions_per_user
        FROM user_stats
        """,
        params,
    )[0]
    feature_stickiness_distribution = _run_rows(
        f"""
        WITH user_stats AS (
            SELECT a.user_id, COUNT(DISTINCT a.created_at::date) AS active_days
            FROM public.activity a
            JOIN public.users u ON u.id = a.user_id
            WHERE a.created_at >= :start_ts
              AND a.created_at < :end_ts
              AND {_audience_condition('u')}
              AND a.endpoint IS NOT NULL
              AND a.endpoint != ''
              AND {feature_case} IS NOT NULL
            GROUP BY a.user_id
        )
        SELECT
            CASE
                WHEN active_days = 1 THEN '1天'
                WHEN active_days BETWEEN 2 AND 3 THEN '2-3天'
                WHEN active_days BETWEEN 4 AND 7 THEN '4-7天'
                ELSE '8天及以上'
            END AS bucket,
            COUNT(*) AS user_count,
            MIN(active_days) AS min_days,
            MAX(active_days) AS max_days
        FROM user_stats
        GROUP BY 1
        ORDER BY min_days ASC, max_days ASC
        """,
        params,
    )
    feature_sticky_user_list = _run_rows(
        f"""
        WITH feature_events AS (
            SELECT
                COALESCE(NULLIF(u.username, ''), NULLIF(u.email, ''), u.id::text) AS username,
                COALESCE(NULLIF(trim(u.organization_name), ''), '未填写组织') AS organization_name,
                a.created_at,
                {feature_case} AS feature_name
            FROM public.activity a
            JOIN public.users u ON u.id = a.user_id
            WHERE a.created_at >= :start_ts
              AND a.created_at < :end_ts
              AND {_audience_condition('u')}
              AND a.endpoint IS NOT NULL
              AND a.endpoint != ''
        )
        SELECT
            username,
            organization_name,
            COUNT(*) AS session_creations,
            COUNT(DISTINCT created_at::date) AS active_days,
            COUNT(DISTINCT date_trunc('week', created_at)::date) AS active_weeks,
            MIN(created_at) AS first_created_at,
            MAX(created_at) AS last_created_at
        FROM feature_events
        WHERE feature_name IS NOT NULL
        GROUP BY username, organization_name
        ORDER BY active_days DESC, active_weeks DESC, session_creations DESC, last_created_at DESC, username
        LIMIT 20
        """,
        params,
    )

    audience_label = {"all": "全部", "internal": "SES 内部", "external": "外部客户"}[audience]
    return {
        "meta": {
            "current_label": "所选时间段",
            "trend_label": "按日",
            "start_date": params["start_date"],
            "end_date": params["end_date"],
            "audience": audience,
            "audience_label": audience_label,
            "range_summary": f"统计区间为 {params['start_date']} 至 {params['end_date']}，用户群体为 {audience_label}，趋势统一按单日聚合。",
            "agent_feature": "feature",
            "agent_feature_label": "功能",
            "data_sources": {"platform": "umap_db"},
            "agent_definition": "模型概览统计 umap_db.public.activity 中除 StarSeeker、Ask 和 search 之外的模型分类调用。",
        },
        "agent_usage_overview": feature_usage_overview,
        "agent_session_trend": feature_session_trend,
        "agent_user_trend": feature_user_trend,
        "agent_round_trend": [],
        "agent_user_distribution": feature_user_distribution,
        "agent_organization_distribution": feature_organization_distribution,
        "agent_user_list": feature_user_list,
        "agent_retention_overview": feature_retention_overview,
        "agent_stickiness_distribution": feature_stickiness_distribution,
        "agent_sticky_user_list": feature_sticky_user_list,
        "agent_usage": feature_usage,
        "feature_usage_summary": feature_usage_summary,
        "feature_usage_trend": feature_usage_trend,
        "feature_top_users": feature_top_users,
        "feature_top_endpoints": feature_top_endpoints,
    }


@router.get("/agent-sessions/{thread_id:path}/export")
def export_agent_session(thread_id: str):
    session_rows = _run_deerflow_rows(
        """
        SELECT
            COALESCE(value->>'thread_id', key) AS message_thread_id,
            COALESCE(value->'values'->>'title', value->>'thread_id', key, '-') AS name,
            COALESCE(value->>'username', value->'metadata'->>'username', '-') AS username,
            COALESCE(
                to_timestamp(NULLIF(value->>'created_at', '')::double precision),
                created_at
            ) AS created_at
        FROM public.store
        WHERE prefix = 'threads'
          AND (value->>'thread_id' = :thread_id OR key = :thread_id)
        LIMIT 1
        """,
        {"thread_id": thread_id},
    )
    if not session_rows:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Agent Session not found")

    session = session_rows[0]
    message_thread_id = session["message_thread_id"] or thread_id
    message_rows = _run_deerflow_rows(
        """
        SELECT blob
        FROM public.checkpoint_writes
        WHERE thread_id = :thread_id
          AND channel = 'messages'
          AND type = 'msgpack'
        ORDER BY checkpoint_id, task_id, idx
        """,
        {"thread_id": message_thread_id},
    )
    messages = []
    for row in message_rows:
        messages.extend(_conversation_messages_from_blob(row["blob"]))

    role_labels = {"human": "用户", "ai": "Agent", "tool": "工具"}
    sections = [
        f"# {session['name']}",
        "",
        f"- Session ID: {message_thread_id}",
        f"- 用户: {session['username']}",
        f"- 创建时间: {session['created_at']}",
        f"- 消息数: {len(messages)}",
        "",
    ]
    for index, message in enumerate(messages, start=1):
        sections.extend(
            [
                f"## {index}. {role_labels.get(message['type'], message['type'])}",
                "",
                message["content"] or "（空内容）",
                "",
            ]
        )
    content = "\n".join(sections)
    return Response(
        content=content.encode("utf-8"),
        media_type="text/markdown; charset=utf-8",
        headers={"Content-Disposition": f'attachment; filename="agent-session-{thread_id}.md"'},
    )


@router.get("/user-activity")
def get_user_activity(user_ids: list[int] = Query(default=[])):
    if not user_ids:
        return {"data": []}

    query = text(
        """
        WITH activity_stats AS (
            SELECT
                user_id,
                COUNT(*) AS activity_count,
                MAX(created_at) AS last_activity_at
            FROM public.activity
            WHERE user_id IN :user_ids
            GROUP BY user_id
        ),
        session_stats AS (
            SELECT
                user_id,
                COUNT(*) AS session_count,
                MAX(updated_at) AS last_session_at
            FROM public.chat_sessions
            WHERE user_id IN :user_ids
              AND (deleted = false OR deleted IS NULL)
            GROUP BY user_id
        )
        SELECT
            u.id AS user_id,
            COALESCE(a.activity_count, 0) AS activity_count,
            COALESCE(s.session_count, 0) AS session_count,
            CASE
                WHEN a.last_activity_at IS NULL THEN s.last_session_at
                WHEN s.last_session_at IS NULL THEN a.last_activity_at
                ELSE GREATEST(a.last_activity_at, s.last_session_at)
            END AS last_active_at
        FROM public.users u
        LEFT JOIN activity_stats a ON a.user_id = u.id
        LEFT JOIN session_stats s ON s.user_id = u.id
        WHERE u.id IN :user_ids
        ORDER BY u.id
        """
    ).bindparams(bindparam("user_ids", expanding=True))

    with platform_engine.connect() as conn:
        result = conn.execute(query, {"user_ids": user_ids})
        rows = [dict(row._mapping) for row in result]
    return {"data": rows}


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
