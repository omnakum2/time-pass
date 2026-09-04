import { useBidBaaziStore } from './bidbaaziStore';
import { useThosoStore } from './thosoStore';
import { GAME_DESCRIPTORS } from '../games';

/**
 * Single place that knows which game stores exist and when their table is
 * "in game" (an active round on screen, i.e. past the lobby). Each game's in-game
 * predicate now lives on its descriptor (games.tsx GAME_DESCRIPTORS[id].play.isInGame),
 * preserving the exact BidBaazi/Thoso semantics (BidBaazi excludes LOBBY + GAME_OVER;
 * Thoso excludes LOBBY but keeps its GAME_OVER standings screen in-game).
 */

/** True when any game's table is showing an active round (not just the lobby). */
export function useInGame(): boolean {
  const bidPhase = useBidBaaziStore((s) => s.state?.phase);
  const thosoPhase = useThosoStore((s) => s.state?.phase);
  return (
    !!GAME_DESCRIPTORS.bidbaazi.play?.isInGame(bidPhase) ||
    !!GAME_DESCRIPTORS.thoso.play?.isInGame(thosoPhase)
  );
}

/** The id of whichever game currently holds board state, or null if none. */
export function useActiveGameId(): string | null {
  const hasBidBaazi = useBidBaaziStore((s) => !!s.state);
  const hasThoso = useThosoStore((s) => !!s.state);
  if (hasBidBaazi) return 'bidbaazi';
  if (hasThoso) return 'thoso';
  return null;
}
