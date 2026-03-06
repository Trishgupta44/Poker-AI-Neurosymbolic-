import type { Player } from '../../types/player';
import type { Card } from '../../types/card';
import { PlayerSeat } from './PlayerSeat';
import { CommunityCards } from './CommunityCards';
import { PotDisplay } from './PotDisplay';

interface PokerTableProps {
  players: Player[];
  communityCards: Card[];
  pot: number;
  dealerIndex: number;
  activePlayerIndex: number;
  showCardsForPlayerId: string | null;
  isShowdown: boolean;
}

/**
 * Returns the felt shape CSS for a rectangular table.
 */
function getTableShape(): { className: string; insetClass: string; useDropShadow?: boolean } {
  return {
    className: 'rounded-[3rem]', // Nice rounded rectangle corners
    insetClass: 'inset-y-[15%] inset-x-[15%]', // Inset evenly for rectangular feel
  };
}

/**
 * Calculates seat positions around a rectangular table.
 * Places up to 4 players at the midpoints of the 4 sides.
 * Index 0 is always the hero seat (bottom center).
 */
function getSeatLayout(playerCount: number): Array<{ x: string; y: string }> {
  // The user provided explicit `left` (x) and `top` (y) values for each seat side:
  // Right: left: calc(85% + 20px), top: 25%
  // Left: left: 0%, top: 25%
  // Bottom: left: 45%, top: calc(85% + 20px)
  // Top: left: 45%, top: -25%
  
  const bottomCenter = { x: '45%', y: 'calc(85% + 20px)' };
  const topCenter    = { x: '45%', y: '-25%' };
  const leftCenter   = { x: '0%',  y: '25%' };
  const rightCenter  = { x: 'calc(85% + 20px)', y: '25%' };

  if (playerCount === 2) {
    return [bottomCenter, topCenter];
  }
  
  if (playerCount === 3) {
    return [bottomCenter, leftCenter, rightCenter];
  }

  // 4 or more players (falls back to 4 max supported by this specific layout)
  return [bottomCenter, leftCenter, topCenter, rightCenter];
}

export function PokerTable({
  players,
  communityCards,
  pot,
  dealerIndex,
  activePlayerIndex,
  showCardsForPlayerId,
  isShowdown,
}: PokerTableProps) {
  const layout = getSeatLayout(players.length);
  const tableShape = getTableShape();

  // Find the hero (AI-assisted human, or first human, or player index 0)
  let heroIndex = players.findIndex(p => p.type === 'HUMAN' && p.hasAIAssistance);
  if (heroIndex === -1) heroIndex = players.findIndex(p => p.type === 'HUMAN');
  if (heroIndex === -1) heroIndex = 0;

  // Map each player to a seat position:
  // heroIndex -> layout[0] (bottom), then clockwise from there
  const seatPositions = players.map((_, playerIdx) => {
    // Go clockwise (subtract from hero, wrap around)
    let offset = (heroIndex - playerIdx) % players.length;
    if (offset < 0) offset += players.length;
    return layout[offset];
  });

  // Standard box-shadow for felt
  const feltBoxShadow = `
    0 0 0 8px #0d3a22,
    0 0 0 12px #1a1a1a,
    0 0 0 14px #C9A84C22,
    0 8px 32px rgba(0,0,0,0.6),
    inset 0 2px 20px rgba(0,0,0,0.3)
  `;

  return (
    <div className="relative w-full max-w-[800px] top-[-4%] overflow-visible" style={{ aspectRatio: '16/9' }}>
      {/* Table felt */}
      <div className={`absolute ${tableShape.insetClass}`}>
        <div
          className={`w-full h-full ${tableShape.className} poker-table-felt`}
          style={{ boxShadow: feltBoxShadow }}
        >
          {/* Community cards + Pot in center */}
          <div className="absolute inset-0 flex flex-col items-center justify-center gap-2">
            <PotDisplay amount={pot} />
            <CommunityCards cards={communityCards} />
          </div>
        </div>
      </div>

      {/* Player seats */}
      {players.map((player, index) => {
        const shouldShowCards = isShowdown || player.id === showCardsForPlayerId;

        return (
          <PlayerSeat
            key={player.id}
            player={player}
            isActive={index === activePlayerIndex}
            isDealer={index === dealerIndex}
            showCards={shouldShowCards}
            position={seatPositions[index]}
          />
        );
      })}
    </div>
  );
}
