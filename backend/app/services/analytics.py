from app.core.supabase import get_supabase
from datetime import datetime, timedelta

def build_user_context(user_id: str) -> str:
    sb = get_supabase()
    lines = []

    # ── Recent sessions ──────────────────────────────
    sessions_res = sb.table("sessions") \
        .select("id, name, started_at, ended_at") \
        .eq("user_id", user_id) \
        .order("started_at", desc=True) \
        .limit(20) \
        .execute()
    sessions = sessions_res.data or []

    lines.append(f"TOTAL SESSIONS (recent 20): {len(sessions)}")

    # ── Sets with exercise info ───────────────────────
    if sessions:
        session_ids = [s["id"] for s in sessions]
        sets_res = sb.table("sets") \
            .select("session_id, weight, reps, rpe, exercise_id, exercises(name, muscle_group)") \
            .in_("session_id", session_ids) \
            .execute()
        sets = sets_res.data or []
    else:
        sets = []

    # ── Volume per session ────────────────────────────
    session_volumes = {}
    for s in sets:
        sid = s["session_id"]
        vol = (s.get("weight") or 0) * (s.get("reps") or 0)
        session_volumes[sid] = session_volumes.get(sid, 0) + vol

    total_volume = sum(session_volumes.values())
    lines.append(f"TOTAL VOLUME (recent sessions): {round(total_volume)}kg")

    # ── Muscle group frequency ────────────────────────
    muscle_counts = {}
    for s in sets:
        mg = s.get("exercises", {}).get("muscle_group")
        if mg:
            muscle_counts[mg] = muscle_counts.get(mg, 0) + 1

    if muscle_counts:
        sorted_muscles = sorted(muscle_counts.items(), key=lambda x: -x[1])
        lines.append("MUSCLE GROUP FREQUENCY (sets):")
        for muscle, count in sorted_muscles:
            lines.append(f"  - {muscle}: {count} sets")

    # ── Exercise variety ──────────────────────────────
    exercise_counts = {}
    for s in sets:
        name = s.get("exercises", {}).get("name")
        if name:
            exercise_counts[name] = exercise_counts.get(name, 0) + 1

    if exercise_counts:
        top_exercises = sorted(exercise_counts.items(), key=lambda x: -x[1])[:10]
        lines.append("TOP EXERCISES:")
        for name, count in top_exercises:
            lines.append(f"  - {name}: {count} sets")

    # ── Recent session breakdown ──────────────────────
    lines.append("\nRECENT SESSIONS:")
    for session in sessions[:10]:
        date = session["started_at"][:10]
        name = session.get("name") or "Unnamed workout"
        s_sets = [s for s in sets if s["session_id"] == session["id"]]

        muscles = list({s.get("exercises", {}).get("muscle_group") for s in s_sets if s.get("exercises", {}).get("muscle_group")})
        vol = round(session_volumes.get(session["id"], 0))
        lines.append(f"  {date} | {name} | muscles: {', '.join(muscles)} | volume: {vol}kg | sets: {len(s_sets)}")

    # ── PRs ───────────────────────────────────────────
    prs_res = sb.table("personal_records") \
        .select("value, record_type, achieved_at, exercises(name, muscle_group)") \
        .eq("user_id", user_id) \
        .order("achieved_at", desc=True) \
        .limit(10) \
        .execute()
    prs = prs_res.data or []

    if prs:
        lines.append("\nPERSONAL RECORDS (estimated 1RM):")
        for pr in prs:
            name = pr.get("exercises", {}).get("name", "Unknown")
            val  = round(pr.get("value", 0), 1)
            date = pr.get("achieved_at", "")[:10]
            lines.append(f"  - {name}: {val}kg (set on {date})")

    # ── Streak + recency ──────────────────────────────
    if sessions:
        last_session_date = sessions[0]["started_at"][:10]
        lines.append(f"\nLAST SESSION: {last_session_date}")

        days_since = (datetime.now() - datetime.fromisoformat(last_session_date)).days
        lines.append(f"DAYS SINCE LAST SESSION: {days_since}")

    return "\n".join(lines)
