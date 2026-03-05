"""
Poker AI — Python Backend Server

FastAPI server that provides all AI computation endpoints.
The React frontend calls these endpoints via fetch().

Run: python server.py
Or:  uvicorn server:app --reload --port 8000

Endpoints:
  POST /api/hand-equity    — Monte Carlo equity simulation
  POST /api/confidence     — 8-feature Naive Bayes bluff detection
  POST /api/bot-decision   — Personality-driven bot action
  POST /api/audit-round    — Post-round hand classification
  POST /api/update-profile — EMA opponent profile update
  POST /api/board-texture  — Board texture classification
"""

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel
from typing import Optional
import uvicorn

from ai.monte_carlo import calculate_hand_equity
from ai.confidence_score import calculate_confidence, update_opponent_profile
from ai.bot_brain import decide_bot_action
from ai.post_round_audit import audit_round
from ai.board_texture import classify_board_texture

# ── App Setup ────────────────────────────────────────────────────────────────

app = FastAPI(title="Poker AI Backend", version="1.0.0")

# Allow frontend (Vite dev server) to call us
app.add_middleware(
    CORSMiddleware,
    allow_origins=["http://127.0.0.1:5173", "http://localhost:5173"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


# ── Request/Response Models ──────────────────────────────────────────────────

class Card(BaseModel):
    rank: str   # '2'-'9', 'T', 'J', 'Q', 'K', 'A'
    suit: str   # 'h', 'd', 'c', 's'


class HandEquityRequest(BaseModel):
    holeCards: list[Card]
    communityCards: list[Card]
    numOpponents: int
    street: str
    iterations: int = 1000
    currentBet: float = 0
    pot: float = 0
    facingRaise: bool = False


class PlayerAction(BaseModel):
    playerId: str
    playerName: str
    street: str
    action: str
    amount: float
    timestamp: float


class ConfidenceRequest(BaseModel):
    profile: dict
    betSizeRatio: float
    boardTexture: str
    opponentPosition: str
    street: str
    priorActions: list[dict]
    opponentStack: float
    potSize: float
    roundsSinceBluffCaught: Optional[int] = None
    actionTimeMs: Optional[float] = None


class BotDecisionRequest(BaseModel):
    bot: dict
    round: dict
    allPlayers: list[dict]


class AuditRoundRequest(BaseModel):
    round: dict
    players: list[dict]
    communityCards: list[Card]


class UpdateProfileRequest(BaseModel):
    profile: dict
    auditResult: dict
    boardTexture: str
    street: str
    betSizeRatio: float
    wasInPosition: bool
    actionSequence: str
    spr: float
    wasCaughtBluffing: bool
    actionTimeMs: Optional[float] = None


class BoardTextureRequest(BaseModel):
    communityCards: list[Card]


# ── Endpoints ────────────────────────────────────────────────────────────────

@app.post("/api/hand-equity")
async def hand_equity_endpoint(req: HandEquityRequest):
    """Calculate hand equity via Monte Carlo simulation."""
    hole = [c.model_dump() for c in req.holeCards]
    community = [c.model_dump() for c in req.communityCards]

    result = calculate_hand_equity(
        hole_cards=hole,
        community_cards=community,
        num_opponents=req.numOpponents,
        street=req.street,
        iterations=req.iterations,
        current_bet=req.currentBet,
        pot=req.pot,
        facing_raise=req.facingRaise,
    )
    return result


@app.post("/api/confidence")
async def confidence_endpoint(req: ConfidenceRequest):
    """Calculate 8-feature Naive Bayes confidence score."""
    result = calculate_confidence(
        profile=req.profile,
        bet_size_ratio=req.betSizeRatio,
        board_texture=req.boardTexture,
        opponent_position=req.opponentPosition,
        street=req.street,
        prior_actions=req.priorActions,
        opponent_stack=req.opponentStack,
        pot_size=req.potSize,
        rounds_since_bluff_caught=req.roundsSinceBluffCaught,
        action_time_ms=req.actionTimeMs,
    )
    return result


@app.post("/api/bot-decision")
async def bot_decision_endpoint(req: BotDecisionRequest):
    """Get personality-driven bot action."""
    result = decide_bot_action(
        bot=req.bot,
        round_state=req.round,
        all_players=req.allPlayers,
    )
    return result


@app.post("/api/audit-round")
async def audit_round_endpoint(req: AuditRoundRequest):
    """Audit completed round — classify hands as BLUFF/VALUE/etc."""
    community = [c.model_dump() for c in req.communityCards]
    results = audit_round(
        round_state=req.round,
        players=req.players,
        community_cards=community,
    )
    return results


@app.post("/api/update-profile")
async def update_profile_endpoint(req: UpdateProfileRequest):
    """Update opponent profile with EMA decay."""
    updated = update_opponent_profile(
        profile=req.profile,
        audit_result=req.auditResult,
        board_texture=req.boardTexture,
        street=req.street,
        bet_size_ratio=req.betSizeRatio,
        was_in_position=req.wasInPosition,
        action_sequence=req.actionSequence,
        spr=req.spr,
        was_caught_bluffing=req.wasCaughtBluffing,
        action_time_ms=req.actionTimeMs,
    )
    return updated


@app.post("/api/board-texture")
async def board_texture_endpoint(req: BoardTextureRequest):
    """Classify board texture as DRY/WET/PAIRED."""
    cards = [c.model_dump() for c in req.communityCards]
    texture = classify_board_texture(cards)
    return {"texture": texture}


@app.get("/api/health")
async def health_check():
    """Health check endpoint to verify the server is running."""
    return {"status": "ok", "message": "Poker AI Python backend is running"}


# ── Main ─────────────────────────────────────────────────────────────────────

if __name__ == "__main__":
    print("=" * 60)
    print("  Poker AI -- Python Backend")
    print("  Server:   http://127.0.0.1:8000")
    print("  API Docs: http://127.0.0.1:8000/docs")
    print("=" * 60)
    uvicorn.run(app, host="127.0.0.1", port=8000)
