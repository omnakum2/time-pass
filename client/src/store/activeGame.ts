import { useBidBaaziStore } from './bidbaaziStore';
import { useThosoStore } from './thosoStore';

/**
 * Single place that knows which game stores exist and when their table is
 * "in game" (an active round on screen, i.e. past the lobby). Adding a new game
 * = add its store's in-game predicate here; Header and any other in-game
 * detection extend automatically.
 *
 * The phase sets below preserve the exact BidBaazi/Thoso semantics Header used
 * before the store split (BidBaazi excludes LOBBY + GAME_OVER; Thoso excludes
 * LOBBY but keeps its GAME_OVER standings screen in-game).
 */
const BIDBAAZI_INGAME_PHASES = new Set([
  'DEALING', 'TRUMP_SELECT', 'BIDDING', 'PUSH', 'PLAYING', 'ROUND_SCORING',
]);
const THOSO_INGAME_PHASES = new Set(['TRANSFER', 'PLAYING', 'GAME_OVER']);

/** True when any game's table is showing an active round (not just the lobby). */
export function useInGame(): boolean {
  const bidPhase = useBidBaaziStore((s) => s.gameState?.phase);
  const thosoPhase = useThosoStore((s) => s.state?.phase);
  return (
    (!!bidPhase && BIDBAAZI_INGAME_PHASES.has(bidPhase)) ||
    (!!thosoPhase && THOSO_INGAME_PHASES.has(thosoPhase))
  );
}

/** The id of whichever game currently holds board state, or null if none. */
export function useActiveGameId(): string | null {
  const hasBidBaazi = useBidBaaziStore((s) => !!s.gameState);
  const hasThoso = useThosoStore((s) => !!s.state);
  if (hasBidBaazi) return 'bidbaazi';
  if (hasThoso) return 'thoso';
  return null;
}
