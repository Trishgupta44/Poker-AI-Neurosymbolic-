import { motion } from 'framer-motion';
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

  return (
    <motion.div
      className="absolute flex flex-col items-center gap-1"
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

      {/* Current bet */}
      {player.currentBet > 0 && !isFolded && (
        <motion.div
          initial={{ opacity: 0, y: -5 }}
          animate={{ opacity: 1, y: 0 }}
          className="mt-1 bg-noir-bg/80 border border-gold-border/30 rounded-full px-2 py-0.5"
        >
          <span className="font-[DM_Mono] text-[10px] text-gold-light">
            {player.currentBet.toLocaleString()}
          </span>
        </motion.div>
      )}
    </motion.div>
  );
}
