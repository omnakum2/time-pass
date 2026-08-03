import { useGameStore } from '../store/gameStore';

export function ConnectionBanner() {
  const connected = useGameStore(s => s.connected);

  return (
    <div className={`conn-banner${!connected ? ' conn-banner--visible' : ''}`}>
      Reconnecting to server…
    </div>
  );
}
