import type { Street } from './game';

export type AuditTag = 'BLUFF' | 'VALUE_BET' | 'SLOW_PLAY' | 'PASSIVE' | 'FOLD' | 'NO_TAG';
export type BoardTexture = 'DRY' | 'WET' | 'PAIRED';

export type RecommendedAction = 'FOLD' | 'CHECK' | 'CALL' | 'RAISE' | 'ALL-IN';

export interface HandStrengthResult {
  equity: number;              // 0-100 percentage
  handCategory: string;        // e.g. "Top Pair", "Flush Draw"
  explanation: string;         // 1-2 sentence plain English
  recommendedAction: RecommendedAction;
  recommendationReason: string;
  street: Street;
  simulationCount: number;
}

export interface ConfidenceResult {
  opponentId: string;
  opponentName: string;
  score: number | null;        // 0-100, null if insufficient data
  label: string;
  explanation: string;
  dataSufficient: boolean;
  handsRecorded: number;
  featureBreakdown?: {
    [featureName: string]: {
      favoursBluff: boolean;
      note: string;
    };
  };
}

export interface OpponentProfile {
  subjectId: string;
  subjectName: string;
  totalHands: number;
  bluffFrequency: number;
  overbetBluffRate: number;
  dryBoardBluffRate: number;
  wetBoardBluffRate: number;
  slowPlayFrequency: number;
  passivePlayRate: number;
  lastUpdated: number;

  // ── Street conditionals ──
  flopBluffRate: number;       // P(bluff | flop)
  turnBluffRate: number;       // P(bluff | turn)
  riverBluffRate: number;      // P(bluff | river)
  flopValueRate: number;       // P(value | flop)
  turnValueRate: number;       // P(value | turn)
  riverValueRate: number;      // P(value | river)

  // ── Sizing conditionals ──
  smallBetBluffRate: number;   // P(bluff | small bet <0.5x)
  smallBetValueRate: number;   // P(value | small bet <0.5x)
  medBetBluffRate: number;     // P(bluff | med bet 0.5-1x)
  medBetValueRate: number;     // P(value | med bet 0.5-1x)
  ovBetValueRate: number;      // P(value | overbet >1x)

  // ── Position conditionals ──
  inPosBluffRate: number;      // P(bluff | in position)
  inPosValueRate: number;      // P(value | in position)

  // ── Sequence conditionals ──
  checkRaiseBluffRate: number;
  checkRaiseValueRate: number;
  passiveRaiseBluffRate: number;
  passiveRaiseValueRate: number;
  persistentAggrBluffRate: number;
  persistentAggrValueRate: number;

  // ── SPR conditionals ──
  lowSprBluffRate: number;     // P(bluff | SPR < 3)
  lowSprValueRate: number;     // P(value | SPR < 3)
  highSprBluffRate: number;    // P(bluff | SPR > 8)
  highSprValueRate: number;    // P(value | SPR > 8)

  // ── Recency ──
  lastCaughtRoundsAgo: number | null;

  // ── Action Speed conditionals (Feature 8) ──
  snapActionBluffRate: number;   // P(bluff | action < 3s)
  snapActionValueRate: number;   // P(value | action < 3s)
  slowActionBluffRate: number;   // P(bluff | action > 8s)
  slowActionValueRate: number;   // P(value | action > 8s)
}

export interface AuditResult {
  playerId: string;
  playerName: string;
  tag: AuditTag;
  handStrengthPercentile: number;
  betSizeRatio: number;
  street: Street;
}

export function createDefaultProfile(subjectId: string, subjectName: string): OpponentProfile {
  return {
    subjectId,
    subjectName,
    totalHands: 0,
    bluffFrequency: 0.35,
    overbetBluffRate: 0.25,
    dryBoardBluffRate: 0.25,
    wetBoardBluffRate: 0.25,
    slowPlayFrequency: 0.25,
    passivePlayRate: 0.25,
    lastUpdated: Date.now(),

    // Street conditionals (population priors)
    flopBluffRate: 0.40,
    turnBluffRate: 0.35,
    riverBluffRate: 0.25,
    flopValueRate: 0.25,
    turnValueRate: 0.35,
    riverValueRate: 0.40,

    // Sizing conditionals
    smallBetBluffRate: 0.15,
    smallBetValueRate: 0.35,
    medBetBluffRate: 0.40,
    medBetValueRate: 0.50,
    ovBetValueRate: 0.15,

    // Position conditionals
    inPosBluffRate: 0.55,
    inPosValueRate: 0.50,

    // Sequence conditionals
    checkRaiseBluffRate: 0.20,
    checkRaiseValueRate: 0.30,
    passiveRaiseBluffRate: 0.40,
    passiveRaiseValueRate: 0.25,
    persistentAggrBluffRate: 0.30,
    persistentAggrValueRate: 0.45,

    // SPR conditionals
    lowSprBluffRate: 0.20,
    lowSprValueRate: 0.35,
    highSprBluffRate: 0.50,
    highSprValueRate: 0.35,

    // Recency
    lastCaughtRoundsAgo: null,

    // Action Speed conditionals
    snapActionBluffRate: 0.30,
    snapActionValueRate: 0.45,
    slowActionBluffRate: 0.55,
    slowActionValueRate: 0.20,
  };
}
