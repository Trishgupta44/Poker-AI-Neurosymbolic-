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
 * Returns the felt shape CSS based on player count.
 * - 2 players: horizontal rectangle
 * - 3 players: triangle (clip-path)
 * - 4 players: square (rounded)
 */
function getTableShape(playerCount: number): {
  className: string;
  insetClass: string;
  clipPath?: string;
  useDropShadow?: boolean; // clip-path clips box-shadow, use filter instead
} {
  if (playerCount === 2) {
    return {
      className: 'rounded-2xl',
      insetClass: 'inset-y-[18%] inset-x-[8%]',
    };
  }
  if (playerCount === 3) {
    return {
      className: '',
      insetClass: 'inset-[5%]',
      clipPath: 'polygon(50% 5%, 3% 92%, 97% 92%)',
      useDropShadow: true,
    };
  }
  // 4 players: square
  return {
    className: 'rounded-2xl',
    insetClass: 'inset-y-[10%] inset-x-[26%]',
  };
}

/**
 * Fixed seat layout positions (percentages within the table container).
 * Index 0 is always the hero seat. Other positions go clockwise.
 *
 * - 2 players: horizontal rectangle, players at midpoints of long sides
 * - 3 players: triangle, players at the three vertices
 * - 4 players: square, players near the four corners
 */
function getSeatLayout(playerCount: number): Array<{ x: string; y: string }> {
  if (playerCount === 2) {
    // Horizontal rectangle: midpoints of long (top/bottom) sides
    return [
      { x: '50%', y: '82%' },  // Bottom midpoint (hero)
      { x: '50%', y: '8%' },   // Top midpoint (opponent)
    ];
  }
  if (playerCount === 3) {
    // Triangle: players at the three vertices
    return [
      { x: '15%', y: '92%' },  // Bottom-left vertex (hero)
      { x: '50%', y: '2%' },   // Top apex
      { x: '85%', y: '92%' },  // Bottom-right vertex
    ];
  }
  // 4 players: square, players near corners
  return [
    { x: '15%', y: '92%' },  // Bottom-left corner (hero)
    { x: '15%', y: '6%' },   // Top-left corner
    { x: '85%', y: '6%' },   // Top-right corner
    { x: '85%', y: '92%' },  // Bottom-right corner
  ];
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
  const tableShape = getTableShape(players.length);

  // Find the hero (AI-assisted human, or first human, or player index 0)
  let heroIndex = players.findIndex(p => p.type === 'HUMAN' && p.hasAIAssistance);
  if (heroIndex === -1) heroIndex = players.findIndex(p => p.type === 'HUMAN');
  if (heroIndex === -1) heroIndex = 0;

  // Map each player to a seat position:
  // heroIndex -> layout[0] (bottom), then clockwise from there
  const seatPositions = players.map((_, playerIdx) => {
    const offset = (playerIdx - heroIndex + players.length) % players.length;
    return layout[offset];
  });

  // Standard box-shadow for non-clipped shapes
  const feltBoxShadow = `
    0 0 0 8px #0d3a22,
    0 0 0 12px #1a1a1a,
    0 0 0 14px #C9A84C22,
    0 8px 32px rgba(0,0,0,0.6),
    inset 0 2px 20px rgba(0,0,0,0.3)
  `;

  // For triangle (clip-path), use drop-shadow filter on wrapper instead
  const feltDropShadow = 'drop-shadow(0 0 8px #0d3a22) drop-shadow(0 8px 32px rgba(0,0,0,0.6))';

  return (
    <div className="relative w-full max-w-[800px] mx-auto overflow-visible" style={{ aspectRatio: '16/9' }}>
      {/* Table felt */}
      <div
        className={`absolute ${tableShape.insetClass}`}
        style={tableShape.useDropShadow ? { filter: feltDropShadow } : undefined}
      >
        <div
          className={`w-full h-full ${tableShape.className} poker-table-felt`}
          style={{
            clipPath: tableShape.clipPath,
            boxShadow: tableShape.useDropShadow ? 'inset 0 2px 20px rgba(0,0,0,0.3)' : feltBoxShadow,
          }}
        >
          {/* Community cards + Pot in center */}
          <div
            className="absolute inset-0 flex flex-col items-center justify-center gap-2"
            style={players.length === 3 ? { paddingTop: '10%' } : undefined}
          >
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
