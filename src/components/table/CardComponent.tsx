import { motion } from 'framer-motion';
import type { Card } from '../../types/card';
import { SUIT_SYMBOLS, isRedSuit } from '../../types/card';

interface CardComponentProps {
  card: Card | null;
  faceDown?: boolean;
  size?: 'sm' | 'md' | 'lg';
  delay?: number;
  animate?: boolean;
}

/** Short display rank for card corners */
const RANK_DISPLAY: Record<string, string> = {
  '2': '2', '3': '3', '4': '4', '5': '5', '6': '6',
  '7': '7', '8': '8', '9': '9', 'T': '10',
  'J': 'J', 'Q': 'Q', 'K': 'K', 'A': 'A',
};

const sizes = {
  sm: { width: 48, height: 68, rank: 10, suit: 10, centerSuit: 22, pad: 2 },
  md: { width: 64, height: 92, rank: 12, suit: 12, centerSuit: 30, pad: 3 },
  lg: { width: 80, height: 115, rank: 15, suit: 15, centerSuit: 36, pad: 4 },
};

/** Check if a rank is a face card */
function isFaceCard(rank: string): boolean {
  return rank === 'J' || rank === 'Q' || rank === 'K';
}

export function CardComponent({ card, faceDown = false, size = 'md', delay = 0, animate = true }: CardComponentProps) {
  const s = sizes[size];
  const showBack = faceDown || !card;

  const cardVariants = animate ? {
    initial: { opacity: 0, scale: 0.5, y: -50 },
    animate: {
      opacity: 1,
      scale: 1,
      y: 0,
      transition: { duration: 0.4, delay, ease: 'easeOut' },
    },
  } : {};

  // ── Card Back ──
  if (showBack) {
    return (
      <motion.div
        {...cardVariants}
        className="rounded-lg overflow-hidden flex-shrink-0"
        style={{
          width: s.width,
          height: s.height,
          background: 'linear-gradient(145deg, #1a2744 0%, #0f1a2e 40%, #1a2744 100%)',
          boxShadow: '0 4px 16px rgba(0,0,0,0.5), 0 1px 3px rgba(0,0,0,0.3), inset 0 1px 0 rgba(255,255,255,0.05)',
          border: '1.5px solid #2a3f5f',
        }}
      >
        <div className="w-full h-full p-[3px]">
          <div
            className="w-full h-full rounded-md flex items-center justify-center"
            style={{
              border: '1px solid #C9A84C33',
              background: `
                repeating-linear-gradient(
                  45deg,
                  transparent,
                  transparent 4px,
                  rgba(201,168,76,0.06) 4px,
                  rgba(201,168,76,0.06) 8px
                ),
                repeating-linear-gradient(
                  -45deg,
                  transparent,
                  transparent 4px,
                  rgba(201,168,76,0.06) 4px,
                  rgba(201,168,76,0.06) 8px
                )
              `,
            }}
          >
            <div
              className="rounded-full flex items-center justify-center"
              style={{
                width: s.centerSuit * 0.9,
                height: s.centerSuit * 0.9,
                background: 'radial-gradient(circle, rgba(201,168,76,0.15) 0%, transparent 70%)',
                border: '1px solid rgba(201,168,76,0.2)',
              }}
            >
              <span style={{ fontSize: s.centerSuit * 0.45, color: 'rgba(201,168,76,0.35)' }}>
                {'\u2660'}
              </span>
            </div>
          </div>
        </div>
      </motion.div>
    );
  }

  // ── Card Face ──
  const isRed = isRedSuit(card.suit);
  const suitSymbol = SUIT_SYMBOLS[card.suit];
  const rankDisplay = RANK_DISPLAY[card.rank] ?? card.rank;
  const isFace = isFaceCard(card.rank);
  const isAce = card.rank === 'A';

  const cardColor = isRed ? '#DC2626' : '#1a1a1a';
  const aceGlow = isAce ? '0 0 20px rgba(201,168,76,0.15)' : 'none';

  return (
    <motion.div
      {...cardVariants}
      whileHover={{ y: -4, boxShadow: '0 8px 24px rgba(0,0,0,0.6)' }}
      className="rounded-lg overflow-hidden flex-shrink-0 cursor-default relative"
      style={{
        width: s.width,
        height: s.height,
        background: 'linear-gradient(165deg, #ffffff 0%, #f8f6f0 40%, #ece8df 100%)',
        boxShadow: `0 4px 16px rgba(0,0,0,0.5), 0 1px 3px rgba(0,0,0,0.3), inset 0 1px 0 rgba(255,255,255,0.8), ${aceGlow}`,
        border: '1px solid #c8c0b0',
      }}
    >
      {/* Inner border */}
      <div
        className="absolute pointer-events-none"
        style={{
          top: 2, left: 2, right: 2, bottom: 2,
          border: '0.5px solid rgba(0,0,0,0.06)',
          borderRadius: 6,
        }}
      />

      {/* Face card / Ace accent glow */}
      {(isFace || isAce) && (
        <div
          className="absolute inset-0 rounded-lg pointer-events-none"
          style={{
            background: isFace
              ? 'radial-gradient(ellipse at center, rgba(201,168,76,0.1) 0%, transparent 70%)'
              : 'radial-gradient(ellipse at center, rgba(201,168,76,0.08) 0%, transparent 60%)',
          }}
        />
      )}

      {/* Card content — absolute positioned for precise control */}
      <div className="relative w-full h-full" style={{ padding: s.pad }}>

        {/* Top-left corner */}
        <div
          style={{
            position: 'absolute',
            top: s.pad + 1,
            left: s.pad + 1,
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'center',
            lineHeight: 1,
          }}
        >
          <span
            style={{
              fontSize: s.rank,
              fontWeight: 700,
              color: cardColor,
              fontFamily: "'Georgia', serif",
            }}
          >
            {rankDisplay}
          </span>
          <span
            style={{
              fontSize: s.suit * 0.9,
              color: cardColor,
              marginTop: -2,
            }}
          >
            {suitSymbol}
          </span>
        </div>

        {/* Center — large suit or face card emblem */}
        <div
          style={{
            position: 'absolute',
            top: 0,
            left: 0,
            right: 0,
            bottom: 0,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
          }}
        >
          {isFace ? (
            <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center' }}>
              <span
                style={{
                  fontSize: s.centerSuit * 0.9,
                  fontWeight: 700,
                  color: cardColor,
                  fontFamily: "'Georgia', serif",
                  textShadow: '0 1px 2px rgba(0,0,0,0.1)',
                  WebkitTextStroke: '0.5px rgba(201,168,76,0.3)',
                  lineHeight: 1,
                }}
              >
                {rankDisplay}
              </span>
              <span
                style={{
                  fontSize: s.centerSuit * 0.45,
                  color: cardColor,
                  opacity: 0.5,
                  marginTop: -1,
                  lineHeight: 1,
                }}
              >
                {suitSymbol}
              </span>
            </div>
          ) : (
            <span
              style={{
                fontSize: isAce ? s.centerSuit * 1.3 : s.centerSuit,
                color: cardColor,
                filter: 'drop-shadow(0 1px 2px rgba(0,0,0,0.12))',
                lineHeight: 1,
              }}
            >
              {suitSymbol}
            </span>
          )}
        </div>

        {/* Bottom-right corner (rotated 180) */}
        <div
          style={{
            position: 'absolute',
            bottom: s.pad + 1,
            right: s.pad + 1,
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'center',
            lineHeight: 1,
            transform: 'rotate(180deg)',
          }}
        >
          <span
            style={{
              fontSize: s.rank,
              fontWeight: 700,
              color: cardColor,
              fontFamily: "'Georgia', serif",
            }}
          >
            {rankDisplay}
          </span>
          <span
            style={{
              fontSize: s.suit * 0.9,
              color: cardColor,
              marginTop: -2,
            }}
          >
            {suitSymbol}
          </span>
        </div>
      </div>

      {/* Glossy highlight overlay */}
      <div
        className="absolute inset-0 rounded-lg pointer-events-none"
        style={{
          background: 'linear-gradient(170deg, rgba(255,255,255,0.3) 0%, transparent 35%, transparent 100%)',
        }}
      />
    </motion.div>
  );
}
