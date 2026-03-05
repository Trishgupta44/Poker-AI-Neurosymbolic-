# Poker AI

A Texas Hold'em poker game with an AI advisor that helps you read opponents. Play against personality-driven bots while the AI tracks betting patterns, action speed, and board texture to detect bluffs in real time.

## Features

- **AI Hand Strength** — Monte Carlo equity simulation shows your win probability on every street
- **Bluff Detection** — 8-feature Naive Bayes classifier scores opponent bluff likelihood using bet sizing, position, action speed, board texture, and historical patterns
- **Opponent Profiling** — EMA-weighted profiles persist across rounds, tracking aggression frequency, bluff rate, positional tendencies, and stack-to-pot ratio behavior
- **Bot-vs-Bot Learning** — Confidence data is recorded even when you fold early, so opponent profiles build from ALL rounds
- **Move Recommendations** — AI suggests FOLD / CHECK / CALL / RAISE based on pot odds, equity, and opponent tendencies
- **Post-Round Audit** — Classifies opponent hands as BLUFF, VALUE_BET, SLOW_PLAY, or PASSIVE after each showdown
- **Dynamic Table Shapes** — Square (4 players), triangle (3 players), horizontal rectangle (2 players)
- **Sound Effects** — Synthesized card, chip, and action sounds via Web Audio API
- **3 Bot Personalities** — Rex (aggressive), Cleo (balanced), Max (tight-passive)

## Requirements

- **Node.js** v18 or higher — [Download](https://nodejs.org/)
- **Python** 3.10 or higher — [Download](https://www.python.org/downloads/)
- **pip** (comes with Python)
- **npm** (comes with Node.js)

## Setup

### 1. Clone the repository

```bash
git clone <your-repo-url>
cd poker-ai
```

### 2. Install frontend dependencies

```bash
npm install
```

### 3. Install Python backend dependencies

```bash
cd python-ai
pip install -r requirements.txt
cd ..
```

### 4. Start the Python AI server (Terminal 1)

```bash
cd python-ai
python server.py
```

This starts the FastAPI backend on **http://localhost:8000**. Keep this terminal open.

### 5. Start the frontend dev server (Terminal 2)

```bash
npm run dev
```

This starts Vite on **http://localhost:5173**. Open this URL in your browser.

## How to Play

1. Open http://localhost:5173 in your browser
2. Click **VS Bots** to play against AI opponents
3. Choose 2, 3, or 4 players and set starting chips
4. The AI panel on the right shows:
   - **Hand Strength** gauge — your win equity percentage
   - **Bluff Likelihood** gauge — how likely the last opponent action was a bluff
   - **Move Recommendation** — suggested action with reasoning
   - **Opponent Analysis** — per-opponent confidence cards with feature breakdowns
5. Play rounds — the AI learns opponent patterns over time, even from rounds where you fold early

## Tech Stack

| Layer | Technology |
|-------|-----------|
| Frontend | React 19, TypeScript, Vite, Tailwind CSS v4 |
| State | Zustand (with localStorage persistence for profiles) |
| Animation | Framer Motion |
| AI Backend | Python FastAPI, Treys (poker hand evaluation) |
| Hand Solving | pokersolver (JS) + Treys (Python Monte Carlo) |
| Audio | Web Audio API (synthesized, no external files) |

## Project Structure

```
poker-ai/
├── src/
│   ├── components/       # React UI components
│   │   ├── ai-panel/     # AI advisor gauges & cards
│   │   ├── table/        # Poker table, seats, cards
│   │   └── screens/      # Game, Home, Instructions screens
│   ├── engine/           # Game controller & bot AI logic
│   ├── store/            # Zustand stores (game, AI, profiles)
│   ├── api/              # Frontend → Python API bridge
│   ├── types/            # TypeScript type definitions
│   └── audio/            # Sound effect synthesizer
├── python-ai/
│   ├── server.py         # FastAPI server (port 8000)
│   ├── ai/               # AI modules (equity, confidence, bots, audit)
│   ├── tests/            # Python unit tests
│   └── requirements.txt  # Python dependencies
├── package.json
└── README.md
```

## Troubleshooting

- **AI panel shows "Waiting..."** — Make sure the Python server is running on port 8000
- **No opponent analysis data** — Play at least 1 full round. Data records from all rounds including when you fold
- **Port 8000 already in use** — Kill the existing process or change the port in `python-ai/server.py`
- **Python import errors** — Make sure you ran `pip install -r requirements.txt` from the `python-ai/` directory
