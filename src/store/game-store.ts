import { create } from 'zustand';
import type { GameState, GameConfig, ActionType } from '../types/game';
import {
  initializeGame,
  startNewRound,
  processPlayerAction,
  getCurrentPlayer,
} from '../engine/game-controller';

interface GameStore {
  // State
  gameState: GameState | null;
  showRevealModal: boolean;
  turnHandoverTarget: string | null;
  isProcessingAction: boolean;
  lastActionTimestamp: number;
  turnStartedAt: number;  // When the current player's turn began (for action speed tracking)

  // Actions
  initGame: (config: GameConfig) => void;
  startRound: () => void;
  submitAction: (playerId: string, action: ActionType, amount: number) => void;
  setShowRevealModal: (show: boolean) => void;
  setTurnHandover: (playerName: string | null) => void;
  resetGame: () => void;
  advanceToNextRound: () => void;
}

export const useGameStore = create<GameStore>((set, get) => ({
  gameState: null,
  showRevealModal: false,
  turnHandoverTarget: null,
  isProcessingAction: false,
  lastActionTimestamp: 0,
  turnStartedAt: 0,

  initGame: (config: GameConfig) => {
    const gameState = initializeGame(config);
    set({ gameState, showRevealModal: false, turnHandoverTarget: null });
  },

  startRound: () => {
    const { gameState } = get();
    if (!gameState) return;

    const newState = startNewRound(gameState);
    set({
      gameState: newState,
      showRevealModal: false,
      lastActionTimestamp: Date.now(),
      turnStartedAt: Date.now(),
    });
  },

  submitAction: (playerId: string, action: ActionType, amount: number) => {
    const { gameState, isProcessingAction } = get();
    if (!gameState || isProcessingAction) return;

    set({ isProcessingAction: true });

    try {
      const newState = processPlayerAction(gameState, playerId, action, amount);

      // Check if round ended (showdown)
      const isShowdown = newState.currentRound?.phase === 'SHOWDOWN';

      set({
        gameState: newState,
        isProcessingAction: false,
        showRevealModal: false, // Delay showing the modal
        lastActionTimestamp: Date.now(),
        turnStartedAt: Date.now(),  // Next player's turn starts now
      });

      if (isShowdown) {
        setTimeout(() => {
          get().setShowRevealModal(true);
        }, 1000); // 1 second delay
      }
    } catch (error) {
      console.error('Error processing action:', error);
      set({ isProcessingAction: false });
    }
  },

  setShowRevealModal: (show: boolean) => {
    set({ showRevealModal: show });
  },

  setTurnHandover: (playerName: string | null) => {
    set({ turnHandoverTarget: playerName });
  },

  advanceToNextRound: () => {
    const { gameState } = get();
    if (!gameState) return;

    set({ showRevealModal: false });

    // Start next round after a brief delay
    const newState = startNewRound(gameState);
    set({
      gameState: newState,
      lastActionTimestamp: Date.now(),
      turnStartedAt: Date.now(),
    });
  },

  resetGame: () => {
    set({
      gameState: null,
      showRevealModal: false,
      turnHandoverTarget: null,
      isProcessingAction: false,
    });
  },
}));

// Selectors
export const selectCurrentPlayer = (state: GameStore) => {
  if (!state.gameState) return null;
  return getCurrentPlayer(state.gameState);
};

export const selectIsHumanTurn = (state: GameStore) => {
  const player = selectCurrentPlayer(state);
  return player?.type === 'HUMAN';
};

export const selectIsBotTurn = (state: GameStore) => {
  const player = selectCurrentPlayer(state);
  return player?.type === 'BOT';
};

export const selectActivePlayers = (state: GameStore) => {
  if (!state.gameState) return [];
  return state.gameState.players.filter(p => !p.isFolded && !p.isSittingOut);
};
