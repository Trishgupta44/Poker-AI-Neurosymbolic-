# Poker AI – Machine Learning & Data Flow Documentation

This document explicitly breaks down the core Artificial Intelligence engines powering the Poker AI project. It goes beyond the basic "how" to strictly explain **how they intrinsically work** on a mathematical level, and **why this architecture is absolutely necessary** to achieve a human-like, learning AI in a complex game like Texas Hold'em.

There are four primary engines located in `python-ai/ai/`:

1.  **Monte Carlo Simulator (`monte_carlo.py`)** — Raw Mathematical Equity Calculation
2.  **Naive Bayes Classifier (`confidence_score.py`)** — Bluff Detection & Pattern Recognition
3.  **Bot Brain (`bot_brain.py`)** — Opponent Decision Making
4.  **Post-Round Auditor (`post_round_audit.py`)** — Hand Profiling & State Tracking

---

## 1. Monte Carlo Equity Simulation (`monte_carlo.py`)
### What it is doing
The Monte Carlo simulator calculates the "Equity" of a hand—the raw mathematical percent chance that your two hole cards will win against random opposing cards by the river.

### How it intrinsically works
Texas Hold'em is a game of incomplete information with millions of permutation branches. Instead of trying to precisely calculate the exact probability algorithmically (which ranges into combinatoric explosion on the flop/turn), Monte Carlo takes a **stochastic (random) sampling** approach to approximate the real truth.
1.  **De-duplication:** It removes the cards currently in your hand and on the board from a virtual "deck."
2.  **1,000 Iteration Loop:** It shuffles the remaining deck 1,000 times. For each loop, it randomly assigns hole cards to your remaining opponents and deals out the rest of the missing community cards (River/Turn). 
3.  **Evaluation:** It runs those random hands against the `Treys` evaluator library and sees who wins.
4.  **Averaging:** `Wins / 1000 = Equity Percent`.

### Why this is necessary
Without Monte Carlo simulations, AI cannot understand poker mechanics. Simple heuristics ("Pair of Aces is good, 2/7 off-suit is bad") break down during multi-way pots or on scary boards (e.g., three hearts on the flop). By running 1,000 parallel random universes, the AI mathematically factors in "runner-runner" backdoor straight/flush draws simply by witnessing how often they accidentally occur in the data. This provides a rock-solid, mathematically optimal baseline for all other AI behaviors.

---

## 2. Bluff Detection Engine (`confidence_score.py`)
### What it is doing
This engine watches opponents in real-time. When an opponent bets, it spits out a percentage likelihood (0-100%) grading whether they are making a "Value Bet" (holding strong cards) or a "Bluff" (holding weak cards).

### How it intrinsically works
It uses a **Naive Bayes Classifier**, a foundational machine-learning algorithm based on Bayes' Theorem `P(A|B) = P(B|A) * P(A) / P(B)`. It evaluates 8 different, distinctly tracked behavioral "features":
1.  **Bet Sizing:** Overbets (>1.5x pot) massively skew the probability curve.
2.  **Action Speed:** Did they snap-call (0.0s) or tank for 5 seconds?
3.  **Position:** Early (UTG) raises require stronger cards than late (Button) raises mathematically.
4.  **Board Texture:** Handled by `board_texture.py`. Bluffs are empirically more likely on WET boards with many draws because the opponent expects you to fold if you missed the draw.
5.  **Historical Bluff Rate:** The opponent's baseline EMA bluff frequency from past rounds.
6.  **Stack-to-Pot Ratio (SPR):** It is mathematically illogical to bluff if the SPR is <1, because the opponent is effectively financially committed to call anyway.
7.  **Aggression Frequency:** Are they a maniac or a nit?
8.  **Action Sequence:** Consecutive aggression (e.g., Check-Raise) implies immense strength.

The engine multiplies the historical probabilities of an opponent exhibiting *these specific traits* while holding strong cards versus weak cards. 

### Why this is necessary
Basic bots just look at their cards and bet. A truly intelligent AI has to play the *player*, not the *cards*. Humans look for "tells" (bet sizing patterns, speed). The Naive Bayes model digitizes these human tells. Without it, the AI Advisor wouldn't be able to warn you that an opponent is acting suspiciously based on their historical behavior.

---

## 3. Bot Personality Engine (`bot_brain.py`)
### What it is doing
This engine makes decisions for the NPC opponents (Viktor, Luna, Rex) so you can play offline against competent AI without needing human players. 

### How it intrinsically works
Because you don't want every bot to play mathematically perfectly (which is boring), the engine scales decisions around preset "Identities." It takes the Bot's Monte Carlo equity and passes it through an emotional filter using mathematical sliders:
*   **Tightness (0-1):** Modifies the threshold required to voluntarily put money into the pot (VPIP). A tight bot (Rex) will fold marginal 45% equity; a loose bot (Luna) will happily call down to a 35% equity.
*   **Aggressiveness (0-1):** If the bot decides to play, this dictates if they Call (passive) or Raise (aggressive).
*   **Bluff Frequency (0-1):** A random number generator (RNG) bypasses equity entirely. If RNG triggers a bluff, the bot is forced to calculate an aggressive bet size despite having 0% equity.

### Why this is necessary
Poker requires table dynamics. If every bot evaluates equity perfectly and only bets when equity > 50%, the game becomes a predictable math problem. By giving bots distinct sliding identities, they make "human" mistakes. You can exploit Rex for folding too much or trap Luna by letting her bluff off her chips.

---

## 4. Post-Round Audit & Profiling (`post_round_audit.py`)
### What it is doing
This is the silent machine learning loop. At the end of every round, it grades the players' moves and permanently stores their tendencies in the browser memory to make the Bluff Detection stronger.

### How it intrinsically works
It compares the opponent's betting behavior during the hand against their actual hole cards revealed at showdown. 
1.  If they bet the pot on the river but only had "High Card," the engine tags them with `BLUFF`. 
2.  If they checked to the river with "Quads," it tags them `SLOW_PLAY`.

It updates their permanent profile using an **Exponential Moving Average (EMA)**. 
`New Bluff Rate = (Recent Hand Data * 0.2) + (Old Bluff Rate * 0.8)`. 

### Why this is necessary
This is what makes the AI "learn". If you play 50 hands against Luna and she bluffs 20 times, her historical Bluff Rate goes up in your browser memory. In round 51, when she makes a huge bet on the river, the Naive Bayes Bluff Detector (Engine #2) reads that memory and adjusts its math, confidently warning you: "Luna is likely bluffing based on history." 

Without EMA continuous learning, the bots are goldfish with 0 context. With EMA, the bots have memory, hold grudges, and establish table images.
