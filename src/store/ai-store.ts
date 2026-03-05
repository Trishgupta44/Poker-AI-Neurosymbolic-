import { create } from 'zustand';
import type { HandStrengthResult, ConfidenceResult, AuditResult } from '../types/ai';

interface AIStore {
  // State
  handStrength: HandStrengthResult | null;
  confidenceScores: Record<string, ConfidenceResult>;
  lastAuditResults: AuditResult[];
  equityHistory: number[];
  isComputing: boolean;

  // Actions
  setHandStrength: (result: HandStrengthResult) => void;
  setConfidenceScore: (opponentId: string, result: ConfidenceResult) => void;
  setAuditResults: (results: AuditResult[]) => void;
  addEquityPoint: (equity: number) => void;
  setIsComputing: (computing: boolean) => void;
  clearForNewRound: () => void;
}

export const useAIStore = create<AIStore>((set) => ({
  handStrength: null,
  confidenceScores: {},
  lastAuditResults: [],
  equityHistory: [],
  isComputing: false,

  setHandStrength: (result: HandStrengthResult) => {
    set(state => ({
      handStrength: result,
      equityHistory: [...state.equityHistory, result.equity],
    }));
  },

  setConfidenceScore: (opponentId: string, result: ConfidenceResult) => {
    set(state => ({
      confidenceScores: {
        ...state.confidenceScores,
        [opponentId]: result,
      },
    }));
  },

  setAuditResults: (results: AuditResult[]) => {
    set({ lastAuditResults: results });
  },

  addEquityPoint: (equity: number) => {
    set(state => ({
      equityHistory: [...state.equityHistory, equity],
    }));
  },

  setIsComputing: (computing: boolean) => {
    set({ isComputing: computing });
  },

  clearForNewRound: () => {
    set({
      handStrength: null,
      // confidenceScores intentionally NOT cleared — they persist across rounds
      // because they are based on long-term opponent profiles, not the current hand
      equityHistory: [],
      isComputing: false,
    });
  },
}));
