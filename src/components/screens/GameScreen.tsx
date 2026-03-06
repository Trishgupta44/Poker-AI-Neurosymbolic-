import { useEffect, useState, useCallback, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { useGameStore } from '../../store/game-store';
import { useAIStore } from '../../store/ai-store';
import { PokerTable } from '../table/PokerTable';
import { ActionPanel } from '../actions/ActionPanel';
import { AIAdvisorPanel } from '../ai-panel/AIAdvisorPanel';
import { RoundRevealModal } from '../modals/RoundRevealModal';
import { TurnHandoverModal } from '../modals/TurnHandoverModal';
import { useBotActions } from '../../hooks/useBotActions';
import { useAIScoring } from '../../hooks/useAIScoring';
import { useGameSounds } from '../../hooks/useGameSounds';
import type { ActionType } from '../../types/game';

export function GameScreen() {
  const navigate = useNavigate();
  const gameState = useGameStore(s => s.gameState);
  const showRevealModal = useGameStore(s => s.showRevealModal);
  const submitAction = useGameStore(s => s.submitAction);
  const startRound = useGameStore(s => s.startRound);
  const advanceToNextRound = useGameStore(s => s.advanceToNextRound);
  const setShowRevealModal = useGameStore(s => s.setShowRevealModal);
  const resetGame = useGameStore(s => s.resetGame);
  const auditResults = useAIStore(s => s.lastAuditResults);

  // ── Local 2P handover state ──
  const [turnHandoverPlayer, setTurnHandoverPlayer] = useState<string | null>(null);
  const [handoverReady, setHandoverReady] = useState(false);
  // Track which player+round we last showed a handover for, so we only show
  // the handover when the active player CHANGES (or a new round starts).
  const lastHandoveredRef = useRef<{ playerId: string; roundNumber: number } | null>(null);

  // Activate bot actions, AI scoring, and sound effects hooks
  useBotActions();
  useAIScoring();
  useGameSounds();

  // Start first round when game screen mounts
  useEffect(() => {
    if (gameState && !gameState.currentRound && gameState.roundHistory.length === 0) {
      startRound();
    }
  }, [gameState, startRound]);

  // Handle 2-player mode turn handover.
  // Only show handover when:
  //   (a) a DIFFERENT player needs to act, or
  //   (b) a NEW round starts (cards changed, device needs to switch)
  // This prevents unnecessary handover modals when the same player acts
  // again on a new street (e.g. Player 2 calls pre-flop, acts first on flop).
  useEffect(() => {
    if (!gameState?.currentRound) return;
    if (gameState.config.mode !== 'LOCAL_2P') return;
    if (gameState.currentRound.phase !== 'BETTING') return;

    const currentPlayer = gameState.players[gameState.currentRound.activePlayerIndex];
    if (!currentPlayer || currentPlayer.type !== 'HUMAN') return;

    const roundNum = gameState.currentRound.roundNumber;
    const last = lastHandoveredRef.current;

    const isNewRound = !last || last.roundNumber !== roundNum;
    const isDifferentPlayer = !last || last.playerId !== currentPlayer.id;

    // Only show handover when player changes or new round starts
    if (isNewRound || isDifferentPlayer) {
      lastHandoveredRef.current = { playerId: currentPlayer.id, roundNumber: roundNum };
      setHandoverReady(false);
      setTurnHandoverPlayer(currentPlayer.name);
    }
  }, [
    gameState?.currentRound?.activePlayerIndex,
    gameState?.currentRound?.phase,
    gameState?.currentRound?.roundNumber,
    gameState?.config.mode,
    gameState?.players,
  ]);

  const handleAction = useCallback((action: string, amount: number) => {
    if (!gameState?.currentRound) return;
    const currentPlayer = gameState.players[gameState.currentRound.activePlayerIndex];
    if (!currentPlayer) return;

    submitAction(currentPlayer.id, action as ActionType, amount);
    // Don't reset handoverReady here — the effect handles it when the player changes.
    // This allows the same player to keep acting across street changes without
    // a redundant handover modal in between.
  }, [gameState, submitAction]);

  const handleContinue = useCallback(() => {
    if (gameState?.isGameOver) {
      resetGame();
      navigate('/');
    } else {
      setShowRevealModal(false);
      advanceToNextRound();
    }
  }, [gameState?.isGameOver, resetGame, navigate, setShowRevealModal, advanceToNextRound]);

  const handleHandoverReady = useCallback(() => {
    setTurnHandoverPlayer(null);
    setHandoverReady(true);
  }, []);

  if (!gameState) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <button
          onClick={() => navigate('/')}
          className="font-[Cinzel] text-gold-light hover:text-gold-primary transition-colors cursor-pointer"
        >
          No game in progress. Return to menu &rarr;
        </button>
      </div>
    );
  }

  const round = gameState.currentRound;
  const isHumanTurn = round?.phase === 'BETTING' &&
    gameState.players[round.activePlayerIndex]?.type === 'HUMAN';

  // Determine which player's cards to show
  const currentPlayer = round ? gameState.players[round.activePlayerIndex] : null;
  const assistedPlayer = gameState.players.find(p => p.hasAIAssistance);

  // In 2P mode, only show current human player's cards when handover is done
  // In VS_BOTS mode, always show the human player's cards
  const showCardsForPlayerId = gameState.config.mode === 'LOCAL_2P'
    ? (handoverReady ? currentPlayer?.id ?? null : null)
    : (assistedPlayer?.id ?? null);

  // Show AI panel for the assisted player when it's relevant
  // Keep panel visible even when user folds so they can watch confidence data build from bot-vs-bot play
  const showAIPanel = assistedPlayer && round?.phase === 'BETTING' &&
    (gameState.config.mode === 'VS_BOTS' || (currentPlayer?.id === assistedPlayer.id && handoverReady));

  // Is action panel enabled?
  const actionPanelDisabled = !isHumanTurn || (gameState.config.mode === 'LOCAL_2P' && !handoverReady);

  // Last completed round for reveal modal
  const lastRound = gameState.roundHistory[gameState.roundHistory.length - 1] ?? null;
  const winnerPlayer = gameState.winnerId
    ? gameState.players.find(p => p.id === gameState.winnerId)
    : null;

  return (
    <div className="h-screen flex flex-col overflow-hidden"
         style={{ background: 'radial-gradient(ellipse at center top, #1A1A1A 0%, #0A0A0A 50%)' }}>

      {/* Header */}
      <header className="flex-shrink-0 flex items-center justify-between px-4 py-2 border-b border-noir-border/50">
        <button
          onClick={() => { resetGame(); navigate('/'); }}
          className="font-[DM_Mono] text-xs text-text-muted hover:text-text-primary transition-colors cursor-pointer"
        >
          &larr; Exit
        </button>
        <div className="font-[Cinzel] text-sm text-gold-light tracking-wider">
          {gameState.config.mode === 'VS_BOTS' ? 'VS BOTS' : '2-PLAYER'}
        </div>
        <div className="font-[DM_Mono] text-xs text-text-muted">
          Round {round?.roundNumber ?? 0}
        </div>
      </header>

      {/* Main content */}
      <div className="flex-1 flex flex-row min-h-0 gap-2 p-2">
        {/* Table + Actions column */}
        <div className="flex-1 flex flex-col min-h-0 min-w-0 overflow-visible">
          {/* Poker Table — takes most of the vertical space */}
          <div className="flex-1 flex items-center justify-center min-h-0 overflow-visible">
            {round && (
              <PokerTable
                players={gameState.players}
                communityCards={round.communityCards}
                pot={round.pot}
                dealerIndex={round.dealerIndex}
                activePlayerIndex={round.activePlayerIndex}
                showCardsForPlayerId={showCardsForPlayerId}
                isShowdown={round.phase === 'SHOWDOWN'}
              />
            )}
          </div>

          {/* Action Panel — fixed at bottom */}
          <div className="flex-shrink-0 max-w-md mx-auto w-full pb-2 pt-1">
            {isHumanTurn && currentPlayer && round && (
              <ActionPanel
                player={currentPlayer}
                round={round}
                players={gameState.players}
                onAction={handleAction}
                disabled={actionPanelDisabled}
              />
            )}

            {!isHumanTurn && round?.phase === 'BETTING' && (
              <div className="text-center py-3">
                <span className="font-[DM_Mono] text-text-muted text-sm animate-pulse">
                  {currentPlayer?.name ?? 'Bot'} is thinking...
                </span>
              </div>
            )}
          </div>
        </div>

        {/* AI Advisor Panel (sidebar) */}
        <div className="w-[25%] flex-shrink-0 overflow-y-auto  text-2xl">
          <AIAdvisorPanel visible={!!showAIPanel} />
        </div>
      </div>

      {/* Turn Handover Modal (2P mode) — hide when reveal modal is showing */}
      {!showRevealModal && (
        <TurnHandoverModal
          show={!!turnHandoverPlayer && gameState.config.mode === 'LOCAL_2P'}
          playerName={turnHandoverPlayer ?? ''}
          onReady={handleHandoverReady}
        />
      )}

      {/* Round Reveal Modal */}
      <RoundRevealModal
        show={showRevealModal}
        round={lastRound}
        auditResults={auditResults}
        onContinue={handleContinue}
        isGameOver={gameState.isGameOver}
        winnerName={winnerPlayer?.name ?? null}
      />
    </div>
  );
}
