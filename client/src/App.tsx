import { lazy, Suspense, useEffect } from 'react';
import { Routes, Route, Navigate, useLocation, useParams } from 'react-router-dom';
import { GAMES } from 'shared';
import { Header } from './components/Header';
import { GameSelectionPage } from './pages/GameSelectionPage';
import { HomePage } from './pages/HomePage';
import { GAME_DESCRIPTORS } from './games';
const GuidePage = lazy(() => import('./pages/GuidePage').then(m => ({ default: m.GuidePage })));
import { ErrorToast } from './components/ErrorToast';

export default function App() {
  return (
    <div className="app-shell">
      <ThemeSync />
      <Header />
      <ErrorToast />
      <main className="app-main">
        <Suspense fallback={<div className="page"><p>Loading…</p></div>}>
          <Routes>
            <Route path="/" element={<GameSelectionPage />} />
            <Route path="/:game" element={<GameGate><HomePage /></GameGate>} />
            <Route path="/:game/guide" element={<GameGate><GuidePage /></GameGate>} />
            <Route path="/:game/room/:roomId" element={<GameGate><RoomForGame /></GameGate>} />
            <Route path="*" element={<Navigate to="/" replace />} />
          </Routes>
        </Suspense>
      </main>
    </div>
  );
}

// Per-game in-room root comes from the game registry (BidBaazi's own root now
// encapsulates the former RoomRouter lobby→game→winner phase logic). A future game
// needs only a GAME_DESCRIPTORS entry — no edit here.
function RoomForGame() {
  const { game } = useParams();
  const Root = GAME_DESCRIPTORS[game ?? '']?.play?.RoomRoot;
  return Root ? <Root /> : <Navigate to="/" replace />;
}

function GameGate({ children }: { children: JSX.Element }) {
  const { game } = useParams();
  const ok = GAMES.some(g => g.id === game && g.status === 'active');
  return ok ? children : <Navigate to="/" replace />;
}

function ThemeSync() {
  const { pathname } = useLocation();
  useEffect(() => {
    const seg = pathname.split('/')[1];
    // Theme by the route's game id iff it's a registry game; a new game needs no edit here.
    const game = GAMES.some(g => g.id === seg) ? seg : null;
    const root = document.documentElement;
    if (game) root.setAttribute('data-game', game);
    else root.removeAttribute('data-game'); // lounge / neutral
  }, [pathname]);
  return null;
}
