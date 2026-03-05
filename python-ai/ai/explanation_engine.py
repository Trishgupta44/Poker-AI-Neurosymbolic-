"""
Explanation Engine — generates plain English explanations for AI scores.

Template-based system that references board texture, hand category,
bet sizing, and equity to produce human-readable advice.
"""

from .board_texture import classify_board_texture

# ── Hand Strength Explanations ───────────────────────────────────────────────

def generate_hand_strength_explanation(
    hand_category: str,
    equity: float,
    community_cards: list[dict],
    hole_cards: list[dict],
    board_texture: str,
) -> str:
    """
    Generate a 1-2 sentence explanation of the player's hand strength.

    Args:
        hand_category: e.g. "Two Pair", "Flush", "High Card"
        equity: 0-100 percentage
        community_cards: Board cards
        hole_cards: Player's hole cards
        board_texture: 'DRY', 'WET', or 'PAIRED'

    Returns:
        Plain English explanation string
    """
    # Pre-flop (no community cards)
    if len(community_cards) == 0:
        if equity >= 75:
            return f"Premium hand — {hand_category} is a top-tier starting hand. Raise for value."
        elif equity >= 55:
            return f"Strong hand — {hand_category} plays well. Consider raising."
        elif equity >= 40:
            return f"Playable hand — {hand_category} has decent potential. Position and opponent tendencies matter here."
        elif equity >= 25:
            return f"Marginal hand — {hand_category} is borderline. Only play in position or cheaply."
        else:
            return f"Weak hand — {hand_category} is below average. Consider folding unless the price is right."

    # Post-flop
    texture_desc = "a dry" if board_texture == "DRY" else "a wet" if board_texture == "WET" else "a paired"

    if equity >= 85:
        return f"Very strong — {hand_category} on {texture_desc} board. Highly likely to be best hand. Bet confidently."
    elif equity >= 65:
        return f"Good — {hand_category} on {texture_desc} board. Likely ahead of most one-pair hands. Bet for value."
    elif equity >= 45:
        return f"Moderate — {hand_category} on {texture_desc} board. Probably ahead, but vulnerable to draws."
    elif equity >= 25:
        return f"Weak — {hand_category} on {texture_desc} board. Behind most betting ranges. Proceed cautiously."
    else:
        return f"Very weak — {hand_category} on {texture_desc} board. Likely behind. Consider folding to aggression."


# ── Recommended Action ───────────────────────────────────────────────────────

def get_recommended_action(
    equity: float,
    community_cards: list[dict],
    current_bet: float,
    pot: float,
    facing_raise: bool,
) -> dict:
    """
    Get the AI's recommended action based on equity and game context.

    Returns:
        { action: str, reason: str }
    """
    is_preflop = len(community_cards) == 0

    # Very strong hand — raise/bet for value
    if equity >= 75:
        return {
            "action": "RAISE",
            "reason": "Very strong hand — raise to extract maximum value.",
        }

    # Strong hand
    if equity >= 60:
        if facing_raise:
            return {
                "action": "CALL",
                "reason": "Strong hand facing a raise — call and re-evaluate on the next street.",
            }
        return {
            "action": "RAISE",
            "reason": "Strong hand — raise for value while ahead.",
        }

    # Medium hand
    if equity >= 40:
        if facing_raise:
            # Calculate pot odds
            call_amount = current_bet
            pot_odds = call_amount / (pot + call_amount) * 100 if (pot + call_amount) > 0 else 50
            if equity > pot_odds:
                return {
                    "action": "CALL",
                    "reason": f"Decent hand — pot odds ({pot_odds:.0f}%) justify a call with {equity:.0f}% equity.",
                }
            return {
                "action": "FOLD",
                "reason": f"Marginal hand — pot odds ({pot_odds:.0f}%) don't justify calling with {equity:.0f}% equity.",
            }
        return {
            "action": "CHECK",
            "reason": "Medium strength — check and see what develops.",
        }

    # Weak hand
    if equity >= 25:
        if facing_raise:
            return {
                "action": "FOLD",
                "reason": "Weak hand facing aggression — fold and wait for a better spot.",
            }
        if is_preflop and current_bet == 0:
            return {
                "action": "CHECK",
                "reason": "Weak hand — check and see a free card.",
            }
        return {
            "action": "CALL" if current_bet > 0 else "CHECK",
            "reason": "Playable hand — worth seeing a flop at this price." if is_preflop
            else "Weak but worth a check to see the next card.",
        }

    # Very weak
    if facing_raise:
        return {
            "action": "FOLD",
            "reason": "Very weak hand — fold to any aggression.",
        }

    if current_bet > 0:
        return {
            "action": "FOLD",
            "reason": "Weak hand — fold and wait for a better spot.",
        }

    return {
        "action": "CHECK",
        "reason": "Weak hand — check and hope to improve.",
    }


# ── Confidence Explanation ───────────────────────────────────────────────────

def generate_confidence_explanation(
    profile: dict,
    bet_size_ratio: float,
    board_texture: str,
    confidence: float,
) -> str:
    """
    Generate an explanation for the confidence score.

    Args:
        profile: Opponent profile dict
        bet_size_ratio: Bet amount / pot
        board_texture: 'DRY', 'WET', or 'PAIRED'
        confidence: 0-100 (100 = strong hand, 0 = bluffing)
    """
    name = profile.get("subjectName", "Opponent")
    total_hands = profile.get("totalHands", 0)
    bluff_pct = round(100 - confidence)

    bluff_signals = []

    if bet_size_ratio > 1.0:
        bluff_signals.append("overbet sizing")
    elif bet_size_ratio > 0.7:
        bluff_signals.append("large bet sizing")

    if board_texture == "DRY":
        bluff_signals.append("dry board (favors bluffs)")

    if bluff_pct > 60:
        bluff_signals.append("historical bluff pattern")

    explanation = (
        f"{name} has a {bluff_pct}% chance of bluffing "
        f"based on {total_hands} observed showdowns. "
    )

    if bluff_signals:
        explanation += f"Key bluff signals: {', '.join(bluff_signals)}."
    else:
        explanation += "No strong bluff signals detected."

    return explanation
