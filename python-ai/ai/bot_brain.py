"""
Bot Brain — personality-driven decision engine for bot opponents.

Each bot has a personality with:
  - aggressiveness: 0-1 (tendency to raise vs call)
  - bluffFrequency: 0-1 (how often to bluff)
  - tightness: 0-1 (hand range tightness)

Bot Decision Matrix (equity-based):
  equity < 20%  → fold (or rare bluff)
  equity 20-40% → check/call or bluff-raise
  equity 40-65% → check/call or value-raise (if aggressive)
  equity 65-85% → value bet
  equity > 85%  → big raise (or slow-play 15%)

All thresholds are modulated by personality.
Bet sizing has ±15% random jitter.
Think time simulates human-like delays (800-3000ms).
"""

import random
from .monte_carlo import calculate_hand_equity


def decide_bot_action(
    bot: dict,
    round_state: dict,
    all_players: list[dict],
) -> dict:
    """
    Compute a bot's action based on personality and hand equity.

    Args:
        bot: Bot player dict (with holeCards, chips, botPersonality)
        round_state: Current round state
        all_players: All players in the game

    Returns:
        {action: str, amount: int, thinkTimeMs: int}
    """
    personality = bot.get("botPersonality", {})
    aggressiveness = personality.get("aggressiveness", 0.5)
    bluff_freq = personality.get("bluffFrequency", 0.3)
    tightness = personality.get("tightness", 0.5)

    hole_cards = bot.get("holeCards", [])
    community_cards = round_state.get("communityCards", [])
    current_bet = round_state.get("currentBet", 0)
    bot_current_bet = bot.get("currentBet", 0)
    pot = round_state.get("pot", 0)
    chips = bot.get("chips", 0)
    min_raise = round_state.get("minRaise", round_state.get("lastRaiseAmount", 20))

    # How much to call
    to_call = current_bet - bot_current_bet

    # Count non-folded opponents
    num_opponents = sum(
        1 for p in all_players
        if not p.get("isFolded") and not p.get("isSittingOut") and p["id"] != bot["id"]
    )
    num_opponents = max(1, num_opponents)

    # Calculate equity (300 iterations for speed)
    equity_result = calculate_hand_equity(
        hole_cards, community_cards, num_opponents,
        round_state.get("currentStreet", "PREFLOP"),
        iterations=300
    )
    equity = equity_result["equity"]

    # ── Personality-modulated thresholds ──
    fold_threshold = 20 + tightness * 15       # Tight players fold more (20-35%)
    bluff_threshold = 15 - bluff_freq * 10     # High bluff = lower threshold (5-15%)
    raise_threshold = 65 - aggressiveness * 15  # Aggressive = raise at lower equity (50-65%)

    # ── Get valid actions ──
    can_check = to_call == 0
    can_call = to_call > 0 and chips >= to_call
    can_raise = chips > to_call + min_raise
    # ALL_IN: bot can't fully call but has chips left, or wants to shove
    can_all_in = chips > 0 and chips <= to_call

    # ── ALL_IN shortcut ──
    # When facing a bet bigger than our stack, only options are FOLD or ALL_IN
    if can_all_in and not can_call and not can_check:
        # Decide based on equity whether to call all-in or fold
        # Use pot odds: need equity > chips / (pot + chips) to call profitably
        pot_odds = chips / (pot + chips) if (pot + chips) > 0 else 0.5
        equity_decimal = equity / 100.0

        # Personality modulation: aggressive players call lighter, tight players fold more
        call_threshold = pot_odds * (1.2 - aggressiveness * 0.4)

        if equity_decimal >= call_threshold:
            action, amount = "ALL_IN", int(chips)
        else:
            # Even with bad equity, occasionally hero-call based on bluff frequency
            if random.random() < bluff_freq * 0.2:
                action, amount = "ALL_IN", int(chips)
            else:
                action, amount = "FOLD", 0

        think_time = calculate_think_time(equity, action, aggressiveness)
        return {
            "action": action,
            "amount": int(amount),
            "thinkTimeMs": think_time,
        }

    # ── Decision logic ──
    action = "CHECK"
    amount = 0

    is_preflop = len(community_cards) == 0

    if is_preflop:
        action, amount = _decide_preflop(
            equity, fold_threshold, bluff_freq, aggressiveness,
            to_call, pot, chips, min_raise,
            can_check, can_call, can_raise,
        )
    else:
        action, amount = _decide_postflop(
            equity, fold_threshold, bluff_threshold, raise_threshold,
            aggressiveness, bluff_freq,
            to_call, pot, chips, min_raise,
            can_check, can_call, can_raise,
        )

    # ── Think time (simulate human-like delay) ──
    think_time = calculate_think_time(equity, action, aggressiveness)

    return {
        "action": action,
        "amount": int(amount),
        "thinkTimeMs": think_time,
    }


def _decide_preflop(
    equity, fold_threshold, bluff_freq, aggressiveness,
    to_call, pot, chips, min_raise,
    can_check, can_call, can_raise,
):
    """Pre-flop decision logic."""
    # Strong hand — raise
    if equity > 70:
        if can_raise:
            raise_amount = _calculate_raise_amount(pot, aggressiveness, chips, min_raise, to_call)
            return "RAISE", raise_amount
        if can_call:
            return "CALL", to_call
        return "CHECK", 0

    # Medium hand — call or check
    if equity > fold_threshold:
        if to_call > 0 and can_call:
            # Only call if price is right
            if to_call <= pot * 0.5:
                return "CALL", to_call
            # Tight players fold to big raises with medium hands
            if random.random() < 0.3:
                return "FOLD", 0
            return "CALL", to_call
        return "CHECK", 0

    # Weak hand — fold or occasional bluff
    if to_call > 0:
        if random.random() < bluff_freq * 0.15 and can_raise:
            raise_amount = _calculate_raise_amount(pot, aggressiveness * 0.5, chips, min_raise, to_call)
            return "RAISE", raise_amount
        return "FOLD", 0

    return "CHECK", 0


def _decide_postflop(
    equity, fold_threshold, bluff_threshold, raise_threshold,
    aggressiveness, bluff_freq,
    to_call, pot, chips, min_raise,
    can_check, can_call, can_raise,
):
    """Post-flop decision logic with equity brackets."""

    # ── Monster (>85%) — value bet big (or slow-play 15%) ──
    if equity > 85:
        if random.random() < 0.15:
            return ("CHECK", 0) if can_check else ("CALL", to_call)
        if can_raise:
            raise_amount = _calculate_raise_amount(pot, aggressiveness + 0.2, chips, min_raise, to_call)
            return "RAISE", raise_amount
        if can_call:
            return "CALL", to_call
        return "CHECK", 0

    # ── Strong (65-85%) — value bet ──
    if equity > raise_threshold:
        if can_raise and random.random() < aggressiveness:
            raise_amount = _calculate_raise_amount(pot, aggressiveness, chips, min_raise, to_call)
            return "RAISE", raise_amount
        if can_call:
            return "CALL", to_call
        return "CHECK", 0

    # ── Medium (40-65%) — check/call ──
    if equity > 40:
        if to_call > 0:
            # Call if price is reasonable
            if to_call <= pot * 0.6:
                return "CALL", to_call
            return "FOLD", 0
        # Occasional bet with medium hands
        if can_raise and random.random() < aggressiveness * 0.3:
            raise_amount = _calculate_raise_amount(pot, aggressiveness * 0.5, chips, min_raise, to_call)
            return "RAISE", raise_amount
        return "CHECK", 0

    # ── Weak (20-40%) — mostly fold/check, occasional bluff ──
    if equity > fold_threshold:
        if to_call > 0:
            if to_call <= pot * 0.3:
                return "CALL", to_call
            return "FOLD", 0
        # Bluff attempt
        if can_raise and random.random() < bluff_freq * 0.4:
            raise_amount = _calculate_raise_amount(pot, 0.5, chips, min_raise, to_call)
            return "RAISE", raise_amount
        return "CHECK", 0

    # ── Very weak (<20%) — fold or rare bluff ──
    if to_call > 0:
        # Rare bluff raise
        if can_raise and random.random() < bluff_freq * 0.1:
            raise_amount = _calculate_raise_amount(pot, aggressiveness, chips, min_raise, to_call)
            return "RAISE", raise_amount
        return "FOLD", 0

    # Can check for free
    if random.random() < bluff_freq * 0.2 and can_raise:
        raise_amount = _calculate_raise_amount(pot, 0.4, chips, min_raise, to_call)
        return "RAISE", raise_amount
    return "CHECK", 0


def _calculate_raise_amount(
    pot: float, aggressiveness: float, chips: float, min_raise: float, to_call: float
) -> int:
    """Calculate raise amount with personality-based sizing and jitter."""
    # Base: 50-100% of pot based on aggressiveness
    base_ratio = 0.4 + aggressiveness * 0.6
    base_amount = pot * base_ratio

    # Add ±15% random jitter
    jitter = random.uniform(0.85, 1.15)
    amount = base_amount * jitter

    # Ensure minimum raise
    amount = max(amount, min_raise + to_call)

    # Cap at player's chips
    amount = min(amount, chips)

    return int(round(amount))


def calculate_think_time(equity: float, action: str, aggressiveness: float) -> int:
    """
    Calculate simulated think time in milliseconds.
    Harder decisions (medium equity) take longer.
    Aggressive players think faster.
    """
    base = 800  # Base think time

    # Equity-based: medium equity = harder = longer think
    if 30 < equity < 70:
        base += 1200  # Tough decision
    elif 20 < equity < 80:
        base += 600   # Moderate decision
    # Clear decisions are faster

    # Action-based
    if action == "FOLD":
        base -= 200
    elif action == "RAISE":
        base += 400
    elif action == "ALL_IN":
        base += 800

    # Personality: aggressive players are faster
    base -= int(aggressiveness * 300)

    # Random variance
    variance = random.randint(-200, 400)
    think_time = max(500, base + variance)
    think_time = min(3000, think_time)

    return think_time
