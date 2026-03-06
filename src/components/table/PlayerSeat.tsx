import { motion, AnimatePresence } from 'framer-motion';
import { useEffect, useState } from 'react';
import type { Player } from '../../types/player';
import { CardComponent } from './CardComponent';

interface PlayerSeatProps {
  player: Player;
  isActive: boolean;
  isDealer: boolean;
  showCards: boolean;
  position: { x: string; y: string };
}

export function PlayerSeat({ player, isActive, isDealer, showCards, position }: PlayerSeatProps) {
  const isFolded = player.isFolded;
  const isAllIn = player.isAllIn;

  // Local state to manage the visibility of the action text
  const [showAction, setShowAction] = useState(false);

  useEffect(() => {
    // If a new action comes in (and it's not a blind post hiding in the background)
    if (player.lastActionTimestamp && player.lastAction && !player.lastAction.includes('Blind')) {
      setShowAction(true);
      const timer = setTimeout(() => setShowAction(false), 2000);
      return () => clearTimeout(timer);
    }
  }, [player.lastActionTimestamp, player.lastAction]);

  return (
    <motion.div
      className="absolute flex flex-col items-center gap-1 z-10"
      style={{
        left: position.x,
        top: position.y,
        transform: 'translate(-50%, -50%)',
      }}
      animate={{
        opacity: isFolded ? 0.4 : 1,
        scale: isActive ? 1.05 : 1,
      }}
      transition={{ duration: 0.3 }}
    >


      {/* Current bet */}
      <motion.div
        initial={{ opacity: 0, y: -5 }}
        animate={{ 
          opacity: player.currentBet > 0 && !isFolded ? 1 : 0, 
          y: player.currentBet > 0 && !isFolded ? 0 : -5 
        }}
        transition={{ duration: 0.2 }}
        className={`mt-1 bg-noir-bg/80 border border-gold-border/30 rounded-full px-2 py-0.5 select-none ${
          player.currentBet > 0 && !isFolded ? 'visible' : 'invisible'
        }`}
      >
        <span className="font-[DM_Mono] text-[10px] text-gold-light">
          {player.currentBet > 0 ? player.currentBet.toLocaleString() : '0'}
        </span>
      </motion.div>


      {/* Player Info Box */}
      <div
        className={`relative rounded-lg px-3 py-1.5 min-w-[100px] text-center transition-all duration-300
          ${isActive
            ? 'bg-noir-elevated border-2 border-gold-primary shadow-[0_0_15px_rgba(201,168,76,0.3)]'
            : 'bg-noir-card border border-noir-border'
          }
          ${isFolded ? 'border-noir-border/50' : ''}
        `}
      >
        {/* Dealer button */}
        {isDealer && (
          <div className="absolute -top-2 -right-2 w-5 h-5 bg-gold-primary rounded-full flex items-center justify-center
                          text-noir-bg text-[10px] font-bold shadow-md">
            D
          </div>
        )}

        {/* Name */}
        <div className={`font-[Cinzel] text-xs truncate ${isFolded ? 'text-text-muted' : 'text-text-primary'}`}>
          {player.name}
          {player.hasAIAssistance && (
            <span className="ml-1 text-gold-primary" title="AI Assisted">✦</span>
          )}
        </div>

        {/* Chips */}
        <div className={`font-[DM_Mono] text-xs ${isFolded ? 'text-text-muted' : 'text-gold-light'}`}>
          {player.chips.toLocaleString()}
        </div>

        {/* Status badges */}
        {isFolded && (
          <div className="font-[DM_Mono] text-[10px] text-status-danger/70 mt-0.5">
            FOLDED
          </div>
        )}
        {isAllIn && !isFolded && (
          <div className="font-[DM_Mono] text-[10px] text-status-warning mt-0.5">
            ALL IN
          </div>
        )}
      </div>





      {/* Cards */}
      <div className="flex gap-0.5 mb-1">
        {player.holeCards.length > 0 ? (
          player.holeCards.map((card, i) => (
            <CardComponent
              key={i}
              card={card}
              faceDown={!showCards}
              size="sm"
              delay={i * 0.1}
            />
          ))
        ) : (
          <div className="h-[68px]" /> // Spacer when no cards
        )}
      </div>

      {/* Floating Action Text - Wrap in absolutely positioned container to prevent layout shifts */}
      <div className="absolute top-full left-1/2 -translate-x-1/2 mt-1 z-50 flex items-start justify-center overflow-visible pointer-events-none w-0 h-0">
        <AnimatePresence>
          {showAction && player.lastAction && (
            <motion.div
              initial={{ opacity: 0, y: -10, scale: 0.8 }}
              animate={{ opacity: 1, y: 10, scale: 1.1 }}
              exit={{ opacity: 0, y: 20, scale: 0.9 }}
              transition={{ duration: 0.5, type: 'spring' }}
              className="whitespace-nowrap"
            >
              <div className="bg-gold-primary/90 text-noir-bg font-bold font-[Cinzel] text-sm px-3 py-1 rounded-full shadow-[0_0_15px_rgba(201,168,76,0.5)] border border-gold-light">
                {player.lastAction}
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </div>

    </motion.div>
  );
}
