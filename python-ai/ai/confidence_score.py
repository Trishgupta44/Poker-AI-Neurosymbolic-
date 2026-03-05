"""
8-Feature Naive Bayes Confidence Scorer

Computes P(bluff | evidence) using Bayesian inference:

    P(bluff|evidence) = P(bluff) × ∏ P(feature_i|bluff)
                        / [P(bluff) × ∏ P(f_i|bluff) + P(value) × ∏ P(f_i|value)]

Features:
    1. Bet Sizing  — SMALL (<0.5×), MEDIUM (0.5-1×), OVERBET (>1×)
    2. Street      — FLOP, TURN, RIVER bluff/value rates
    3. Board Texture — DRY vs WET bluff tendency
    4. Position    — In position vs out of position
    5. Action Sequence — Check-raise, passive-then-raise, persistent aggression
    6. SPR         — Stack-to-pot ratio: LOW (<3), MED (3-8), HIGH (>8)
    7. Recency     — Recently caught bluffing = tighter play
    8. Action Speed — Hesitation (>8s) = bluff signal, snap (<3s) = confidence

Returns 0-100 confidence that opponent has a VALUE hand.
    100 = strong hand (not bluffing)
    0   = almost certainly bluffing
"""

# ── Constants ────────────────────────────────────────────────────────────────

MIN_HANDS_FOR_CONFIDENCE = 1   # Minimum hands before scoring (lowered for faster feedback)
EMA_DECAY = 0.92               # Exponential moving average decay factor

# Action speed thresholds (milliseconds)
SNAP_THRESHOLD_MS = 3000       # < 3 seconds = snap action
SLOW_THRESHOLD_MS = 8000       # > 8 seconds = hesitation


# ── Helper: Classify bet size ────────────────────────────────────────────────

def classify_bet_size(bet_size_ratio: float) -> str:
    """Classify bet as SMALL, MEDIUM, or OVERBET relative to pot."""
    if bet_size_ratio < 0.5:
        return "SMALL"
    if bet_size_ratio <= 1.0:
        return "MEDIUM"
    return "OVERBET"


# ── Helper: Classify SPR ────────────────────────────────────────────────────

def classify_spr(opponent_stack: float, pot_size: float) -> str:
    """Classify stack-to-pot ratio as LOW, MEDIUM, or HIGH."""
    spr = opponent_stack / pot_size if pot_size > 0 else 10
    if spr < 3:
        return "LOW"
    if spr <= 8:
        return "MEDIUM"
    return "HIGH"


# ── Helper: Classify action sequence ────────────────────────────────────────

def classify_action_sequence(prior_actions: list[dict], opponent_id: str) -> str:
    """
    Detect betting patterns from action history.

    Returns: 'CHECK_RAISE', 'PASSIVE_THEN_RAISE', 'PERSISTENT_AGGR', or 'NONE'
    """
    opp_actions = [a for a in prior_actions if a.get("playerId") == opponent_id]
    if len(opp_actions) < 2:
        return "NONE"

    last_two = opp_actions[-2:]

    # Check-raise: checked then raised
    if last_two[0]["action"] == "CHECK" and last_two[1]["action"] in ("RAISE", "ALL_IN"):
        return "CHECK_RAISE"

    # Passive then raise: called then raised
    if last_two[0]["action"] == "CALL" and last_two[1]["action"] in ("RAISE", "ALL_IN"):
        return "PASSIVE_THEN_RAISE"

    # Persistent aggression: raised 2+ times
    raise_count = sum(1 for a in opp_actions if a["action"] in ("RAISE", "ALL_IN"))
    if raise_count >= 2:
        return "PERSISTENT_AGGR"

    return "NONE"


# ── Helper: Classify action speed ───────────────────────────────────────────

def classify_action_speed(action_time_ms: float | None) -> str:
    """
    Classify how quickly the opponent acted.

    - SNAP  (<3s): Quick/confident — often strong hand or snap-bluff
    - NORMAL (3-8s): Standard thinking time — neutral signal
    - SLOW  (>8s): Hesitation — often indicates bluffing or uncertainty

    Returns: 'SNAP', 'NORMAL', or 'SLOW'
    """
    if action_time_ms is None:
        return "NORMAL"  # No timing data = neutral
    if action_time_ms < SNAP_THRESHOLD_MS:
        return "SNAP"
    if action_time_ms > SLOW_THRESHOLD_MS:
        return "SLOW"
    return "NORMAL"


# ── Helper: Recency adjustment ──────────────────────────────────────────────

def recency_adjustment(last_caught_rounds_ago: int | None) -> float:
    """
    Adjust bluff prior based on how recently the opponent was caught bluffing.
    Recently caught = they'll be tighter = lower bluff multiplier.

    Returns multiplier in range [0.45, 1.0]
    """
    if last_caught_rounds_ago is None:
        return 1.0
    return min(1.0, 0.45 + (last_caught_rounds_ago / 10) * 0.55)


# ── Main: Calculate Confidence ──────────────────────────────────────────────

def calculate_confidence(
    profile: dict,
    bet_size_ratio: float,
    board_texture: str,
    opponent_position: str,    # 'EARLY', 'MIDDLE', 'LATE'
    street: str,               # 'PREFLOP', 'FLOP', 'TURN', 'RIVER'
    prior_actions: list[dict],
    opponent_stack: float,
    pot_size: float,
    rounds_since_bluff_caught: int | None,
    action_time_ms: float | None = None,  # NEW: Feature 8 — action speed
) -> dict:
    """
    8-Feature Naive Bayes confidence score.

    Returns:
        {
            opponentId, opponentName, score (0-100 or null),
            label, explanation, dataSufficient, handsRecorded,
            featureBreakdown: { featureName: {favoursBluff, note} }
        }
    """
    subject_id = profile.get("subjectId", "")
    subject_name = profile.get("subjectName", "Opponent")
    total_hands = profile.get("totalHands", 0)

    # ── Check minimum data threshold ──
    if total_hands < MIN_HANDS_FOR_CONFIDENCE:
        remaining = MIN_HANDS_FOR_CONFIDENCE - total_hands
        return {
            "opponentId": subject_id,
            "opponentName": subject_name,
            "score": None,
            "label": "Insufficient Data",
            "explanation": f"Need {remaining} more showdown{'s' if remaining > 1 else ''} to read {subject_name}.",
            "dataSufficient": False,
            "handsRecorded": total_hands,
            "featureBreakdown": {},
        }

    # ── Prior probability ──
    p_bluff = max(0.01, min(0.99, profile.get("bluffFrequency", 0.35)))
    feature_breakdown = {}

    def clamp(v: float) -> float:
        return max(0.01, min(0.99, v))

    # ── Feature 1: Bet Sizing ──
    bet_cat = classify_bet_size(bet_size_ratio)

    if bet_cat == "SMALL":
        p_bet_bluff = profile.get("smallBetBluffRate", 0.15)
        p_bet_value = profile.get("smallBetValueRate", 0.35)
        feature_breakdown["Bet Size"] = {
            "favoursBluff": p_bet_bluff > p_bet_value,
            "note": f"Small bet (<0.5× pot). Bluff rate: {p_bet_bluff * 100:.0f}%",
        }
    elif bet_cat == "MEDIUM":
        p_bet_bluff = profile.get("medBetBluffRate", 0.40)
        p_bet_value = profile.get("medBetValueRate", 0.50)
        feature_breakdown["Bet Size"] = {
            "favoursBluff": p_bet_bluff > p_bet_value,
            "note": f"Medium bet (0.5-1× pot). Bluff rate: {p_bet_bluff * 100:.0f}%",
        }
    else:
        p_bet_bluff = profile.get("overbetBluffRate", 0.25)
        p_bet_value = profile.get("ovBetValueRate", 0.15)
        feature_breakdown["Bet Size"] = {
            "favoursBluff": p_bet_bluff > p_bet_value,
            "note": f"Overbet (>1× pot). Bluff rate: {p_bet_bluff * 100:.0f}%",
        }

    # ── Feature 2: Street ──
    if street == "FLOP":
        p_street_bluff = profile.get("flopBluffRate", 0.40)
        p_street_value = profile.get("flopValueRate", 0.25)
    elif street == "TURN":
        p_street_bluff = profile.get("turnBluffRate", 0.35)
        p_street_value = profile.get("turnValueRate", 0.35)
    else:  # RIVER
        p_street_bluff = profile.get("riverBluffRate", 0.25)
        p_street_value = profile.get("riverValueRate", 0.40)

    feature_breakdown["Street"] = {
        "favoursBluff": p_street_bluff > p_street_value,
        "note": f"{street} action. Bluff rate: {p_street_bluff * 100:.0f}%",
    }

    # ── Feature 3: Board Texture ──
    if board_texture == "DRY":
        p_board_bluff = profile.get("dryBoardBluffRate", 0.25)
        p_board_value = 1 - p_board_bluff
    elif board_texture == "WET":
        p_board_bluff = profile.get("wetBoardBluffRate", 0.25)
        p_board_value = 1 - p_board_bluff
    else:  # PAIRED
        p_board_bluff = (profile.get("dryBoardBluffRate", 0.25) + profile.get("wetBoardBluffRate", 0.25)) / 2
        p_board_value = 1 - p_board_bluff

    feature_breakdown["Board"] = {
        "favoursBluff": p_board_bluff > p_board_value,
        "note": f"{board_texture} board. Bluff likelihood: {p_board_bluff * 100:.0f}%",
    }

    # ── Feature 4: Position ──
    is_in_position = opponent_position == "LATE"
    p_pos_bluff = profile.get("inPosBluffRate", 0.55) if is_in_position else (1 - profile.get("inPosBluffRate", 0.55))
    p_pos_value = profile.get("inPosValueRate", 0.50) if is_in_position else (1 - profile.get("inPosValueRate", 0.50))

    feature_breakdown["Position"] = {
        "favoursBluff": p_pos_bluff > p_pos_value,
        "note": (
            f"In position — bluffs here {profile.get('inPosBluffRate', 0.55) * 100:.0f}% of the time"
            if is_in_position
            else "Out of position — less likely to bluff"
        ),
    }

    # ── Feature 5: Action Sequence ──
    action_seq = classify_action_sequence(prior_actions, subject_id)
    p_seq_bluff = 0.5  # neutral default
    p_seq_value = 0.5

    if action_seq == "CHECK_RAISE":
        p_seq_bluff = profile.get("checkRaiseBluffRate", 0.20)
        p_seq_value = profile.get("checkRaiseValueRate", 0.30)
        feature_breakdown["Pattern"] = {
            "favoursBluff": p_seq_bluff > p_seq_value,
            "note": f"Check-raise detected. Bluff rate: {p_seq_bluff * 100:.0f}%",
        }
    elif action_seq == "PASSIVE_THEN_RAISE":
        p_seq_bluff = profile.get("passiveRaiseBluffRate", 0.40)
        p_seq_value = profile.get("passiveRaiseValueRate", 0.25)
        feature_breakdown["Pattern"] = {
            "favoursBluff": p_seq_bluff > p_seq_value,
            "note": f"Passive then raise. Bluff rate: {p_seq_bluff * 100:.0f}%",
        }
    elif action_seq == "PERSISTENT_AGGR":
        p_seq_bluff = profile.get("persistentAggrBluffRate", 0.30)
        p_seq_value = profile.get("persistentAggrValueRate", 0.45)
        feature_breakdown["Pattern"] = {
            "favoursBluff": p_seq_bluff > p_seq_value,
            "note": f"Persistent aggression. Bluff rate: {p_seq_bluff * 100:.0f}%",
        }

    # ── Feature 6: SPR ──
    spr_cat = classify_spr(opponent_stack, pot_size)
    p_spr_bluff = 0.5
    p_spr_value = 0.5

    if spr_cat == "LOW":
        p_spr_bluff = profile.get("lowSprBluffRate", 0.20)
        p_spr_value = profile.get("lowSprValueRate", 0.35)
        feature_breakdown["SPR"] = {
            "favoursBluff": p_spr_bluff > p_spr_value,
            "note": f"Low SPR (<3) — committed pot. Bluff rate: {p_spr_bluff * 100:.0f}%",
        }
    elif spr_cat == "HIGH":
        p_spr_bluff = profile.get("highSprBluffRate", 0.50)
        p_spr_value = profile.get("highSprValueRate", 0.35)
        feature_breakdown["SPR"] = {
            "favoursBluff": p_spr_bluff > p_spr_value,
            "note": f"High SPR (>8) — deep stacks. Bluff rate: {p_spr_bluff * 100:.0f}%",
        }

    # ── Feature 7: Recency ──
    recency_mult = recency_adjustment(rounds_since_bluff_caught)

    if rounds_since_bluff_caught is not None and rounds_since_bluff_caught <= 5:
        feature_breakdown["Recency"] = {
            "favoursBluff": False,
            "note": f"Caught bluffing {rounds_since_bluff_caught} round{'s' if rounds_since_bluff_caught != 1 else ''} ago — likely tighter now",
        }

    # ── Feature 8: Action Speed (NEW) ──
    speed_cat = classify_action_speed(action_time_ms)
    p_speed_bluff = 0.5  # neutral default
    p_speed_value = 0.5

    if speed_cat == "SNAP":
        p_speed_bluff = profile.get("snapActionBluffRate", 0.30)
        p_speed_value = profile.get("snapActionValueRate", 0.45)
        if action_time_ms is not None:
            feature_breakdown["Timing"] = {
                "favoursBluff": p_speed_bluff > p_speed_value,
                "note": f"Snap action ({action_time_ms / 1000:.1f}s) — usually indicates confidence",
            }
    elif speed_cat == "SLOW":
        p_speed_bluff = profile.get("slowActionBluffRate", 0.55)
        p_speed_value = profile.get("slowActionValueRate", 0.20)
        if action_time_ms is not None:
            feature_breakdown["Timing"] = {
                "favoursBluff": p_speed_bluff > p_speed_value,
                "note": f"Hesitated {action_time_ms / 1000:.1f}s before acting — bluff signal",
            }

    # ── Naive Bayes computation ──
    likelihood_bluff = (
        clamp(p_bet_bluff)
        * clamp(p_street_bluff)
        * clamp(p_board_bluff)
        * clamp(p_pos_bluff)
        * clamp(p_seq_bluff)
        * clamp(p_spr_bluff)
        * clamp(p_speed_bluff)   # Feature 8
    )

    likelihood_value = (
        clamp(p_bet_value)
        * clamp(p_street_value)
        * clamp(p_board_value)
        * clamp(p_pos_value)
        * clamp(p_seq_value)
        * clamp(p_spr_value)
        * clamp(p_speed_value)   # Feature 8
    )

    # Apply recency adjustment to bluff prior
    adjusted_p_bluff = clamp(p_bluff * recency_mult)
    adjusted_p_value = 1 - adjusted_p_bluff

    numerator = adjusted_p_bluff * likelihood_bluff
    denominator = numerator + adjusted_p_value * likelihood_value
    posterior_bluff = numerator / denominator if denominator > 0 else 0.5

    # Confidence = probability of VALUE hand (100 = strong, 0 = bluffing)
    confidence = round((1 - posterior_bluff) * 100)
    confidence = min(100, max(0, confidence))

    # ── 5-tier label system ──
    if confidence <= 20:
        label = "Almost certainly bluffing"
    elif confidence <= 40:
        label = "Likely bluffing — proceed with caution"
    elif confidence <= 60:
        label = "Mixed signals — could go either way"
    elif confidence <= 80:
        label = "Likely a value hand"
    else:
        label = "Strong hand — high confidence in their holding"

    # ── Build explanation ──
    bluff_pct = round(posterior_bluff * 100)
    bluff_signals = [k.lower() for k, v in feature_breakdown.items() if v["favoursBluff"]]
    explanation = (
        f"{subject_name} has a {bluff_pct}% chance of bluffing "
        f"based on {total_hands} observed showdowns. "
    )
    if bluff_signals:
        explanation += f"Key bluff signals: {', '.join(bluff_signals)}."
    else:
        explanation += "No strong bluff signals detected."

    return {
        "opponentId": subject_id,
        "opponentName": subject_name,
        "score": confidence,
        "label": label,
        "explanation": explanation,
        "dataSufficient": True,
        "handsRecorded": total_hands,
        "featureBreakdown": feature_breakdown,
    }


# ── EMA Update Helper ───────────────────────────────────────────────────────

def ema_update(old_value: float, new_observation: float) -> float:
    """Exponential moving average: recent observations weigh more."""
    return EMA_DECAY * old_value + (1 - EMA_DECAY) * new_observation


# ── Update Opponent Profile ─────────────────────────────────────────────────

def update_opponent_profile(
    profile: dict,
    audit_result: dict,
    board_texture: str,
    street: str,
    bet_size_ratio: float,
    was_in_position: bool,
    action_sequence: str,
    spr: float,
    was_caught_bluffing: bool,
    action_time_ms: float | None = None,
) -> dict:
    """
    Update opponent profile with EMA decay across all conditional fields.

    Called after each showdown with the audit result for the opponent.
    """
    is_bluff = 1 if audit_result.get("tag") == "BLUFF" else 0
    is_value = 1 if audit_result.get("tag") == "VALUE_BET" else 0
    is_slow_play = 1 if audit_result.get("tag") == "SLOW_PLAY" else 0
    is_passive = 1 if audit_result.get("tag") == "PASSIVE" else 0
    is_overbet = 1 if (bet_size_ratio > 1.0 and is_bluff) else 0

    bet_cat = classify_bet_size(bet_size_ratio)

    updated = {**profile}
    updated["totalHands"] = profile.get("totalHands", 0) + 1

    # Core rates
    updated["bluffFrequency"] = ema_update(profile.get("bluffFrequency", 0.35), is_bluff)
    updated["overbetBluffRate"] = ema_update(profile.get("overbetBluffRate", 0.25), is_overbet)
    updated["slowPlayFrequency"] = ema_update(profile.get("slowPlayFrequency", 0.25), is_slow_play)
    updated["passivePlayRate"] = ema_update(profile.get("passivePlayRate", 0.25), is_passive)

    # Board texture
    if board_texture == "DRY":
        updated["dryBoardBluffRate"] = ema_update(profile.get("dryBoardBluffRate", 0.25), is_bluff)
    if board_texture == "WET":
        updated["wetBoardBluffRate"] = ema_update(profile.get("wetBoardBluffRate", 0.25), is_bluff)

    # Street conditionals
    if street == "FLOP":
        updated["flopBluffRate"] = ema_update(profile.get("flopBluffRate", 0.40), is_bluff)
        updated["flopValueRate"] = ema_update(profile.get("flopValueRate", 0.25), is_value)
    elif street == "TURN":
        updated["turnBluffRate"] = ema_update(profile.get("turnBluffRate", 0.35), is_bluff)
        updated["turnValueRate"] = ema_update(profile.get("turnValueRate", 0.35), is_value)
    elif street == "RIVER":
        updated["riverBluffRate"] = ema_update(profile.get("riverBluffRate", 0.25), is_bluff)
        updated["riverValueRate"] = ema_update(profile.get("riverValueRate", 0.40), is_value)

    # Sizing conditionals
    if bet_cat == "SMALL":
        updated["smallBetBluffRate"] = ema_update(profile.get("smallBetBluffRate", 0.15), is_bluff)
        updated["smallBetValueRate"] = ema_update(profile.get("smallBetValueRate", 0.35), is_value)
    elif bet_cat == "MEDIUM":
        updated["medBetBluffRate"] = ema_update(profile.get("medBetBluffRate", 0.40), is_bluff)
        updated["medBetValueRate"] = ema_update(profile.get("medBetValueRate", 0.50), is_value)
    elif bet_cat == "OVERBET":
        updated["ovBetValueRate"] = ema_update(profile.get("ovBetValueRate", 0.15), is_value)

    # Position
    if was_in_position:
        updated["inPosBluffRate"] = ema_update(profile.get("inPosBluffRate", 0.55), is_bluff)
        updated["inPosValueRate"] = ema_update(profile.get("inPosValueRate", 0.50), is_value)

    # Action sequence
    if action_sequence == "CHECK_RAISE":
        updated["checkRaiseBluffRate"] = ema_update(profile.get("checkRaiseBluffRate", 0.20), is_bluff)
        updated["checkRaiseValueRate"] = ema_update(profile.get("checkRaiseValueRate", 0.30), is_value)
    elif action_sequence == "PASSIVE_THEN_RAISE":
        updated["passiveRaiseBluffRate"] = ema_update(profile.get("passiveRaiseBluffRate", 0.40), is_bluff)
        updated["passiveRaiseValueRate"] = ema_update(profile.get("passiveRaiseValueRate", 0.25), is_value)
    elif action_sequence == "PERSISTENT_AGGR":
        updated["persistentAggrBluffRate"] = ema_update(profile.get("persistentAggrBluffRate", 0.30), is_bluff)
        updated["persistentAggrValueRate"] = ema_update(profile.get("persistentAggrValueRate", 0.45), is_value)

    # SPR
    if spr < 3:
        updated["lowSprBluffRate"] = ema_update(profile.get("lowSprBluffRate", 0.20), is_bluff)
        updated["lowSprValueRate"] = ema_update(profile.get("lowSprValueRate", 0.35), is_value)
    elif spr > 8:
        updated["highSprBluffRate"] = ema_update(profile.get("highSprBluffRate", 0.50), is_bluff)
        updated["highSprValueRate"] = ema_update(profile.get("highSprValueRate", 0.35), is_value)

    # Action speed (Feature 8)
    if action_time_ms is not None:
        speed_cat = classify_action_speed(action_time_ms)
        if speed_cat == "SNAP":
            updated["snapActionBluffRate"] = ema_update(profile.get("snapActionBluffRate", 0.30), is_bluff)
            updated["snapActionValueRate"] = ema_update(profile.get("snapActionValueRate", 0.45), is_value)
        elif speed_cat == "SLOW":
            updated["slowActionBluffRate"] = ema_update(profile.get("slowActionBluffRate", 0.55), is_bluff)
            updated["slowActionValueRate"] = ema_update(profile.get("slowActionValueRate", 0.20), is_value)

    # Recency
    if was_caught_bluffing:
        updated["lastCaughtRoundsAgo"] = 0
    elif profile.get("lastCaughtRoundsAgo") is not None:
        updated["lastCaughtRoundsAgo"] = profile["lastCaughtRoundsAgo"] + 1

    return updated
