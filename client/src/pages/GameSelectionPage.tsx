import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { GAMES, GameInfo } from 'shared';
import { ErrorToast } from '../components/ErrorToast';
import '../styles/selection.css';

/* ── Mini playing-card data per game ──────────────────────────────────────── */
interface MiniCardData {
  rank: string;
  suit: string;
  color: 'red' | 'black';
}

interface GameCardConfig {
  cards: MiniCardData[];
  fanClass: string;
}

const GAME_CARDS: Record<string, GameCardConfig> = {
  'bidbaazi': {
    fanClass: 'fan-5',
    cards: [
      { rank: 'A', suit: '♥', color: 'red' },
      { rank: 'K', suit: '♥', color: 'red' },
      { rank: 'Q', suit: '♥', color: 'red' },
      { rank: 'J', suit: '♥', color: 'red' },
      { rank: '10', suit: '♥', color: 'red' },
    ],
  },
  rummy: {
    fanClass: 'fan-5',
    cards: [
      { rank: 'A', suit: '♠', color: 'black' },
      { rank: 'K', suit: '♠', color: 'black' },
      { rank: 'Q', suit: '♦', color: 'red' },
      { rank: '', suit: '', color: 'black' }, // Card back (reusing Blind card back)
      { rank: 'A', suit: '♦', color: 'red' },
    ],
  },
  thoso: {
    fanClass: 'fan-4',
    cards: [
      { rank: 'A', suit: '♣', color: 'black' },
      { rank: 'K', suit: '♣', color: 'black' },
      { rank: '7', suit: '♠', color: 'black' },
      { rank: '10', suit: '♠', color: 'black' },
    ],
  },
};

function MiniCard({ rank, suit, color }: MiniCardData) {
  // Card back reusing standard blind card back
  if (!rank && !suit) {
    return <div className="mini-card mini-card--back" />;
  }
  return (
    <div className={`mini-card mini-card--${color}`}>
      <span className="mini-card__rank">{rank}</span>
      <span className="mini-card__suit-corner">{suit}</span>
      <span className="mini-card__suit-center">{suit}</span>
    </div>
  );
}

export function GameSelectionPage() {
  const navigate = useNavigate();
  const [toastMessage, setToastMessage] = useState<string | null>(null);

  const handleCardClick = (game: GameInfo) => {
    if (game.status === 'active') {
      navigate(game.route);
    } else {
      setToastMessage(`${game.name} is currently under development. Stay tuned!`);
    }
  };

  return (
    <div className="game-selection-screen">
      <main className="selection-content">
        <div className="selection-header">
          <h1 className="selection-title">CardClub Lounge</h1>
          <p className="selection-subtitle">Select your game & step up to the table</p>
          <div className="selection-divider" />
        </div>

        <div className="game-cards-row">
          {GAMES.map((game) => {
            const cardData = GAME_CARDS[game.id] ?? GAME_CARDS['bidbaazi'];

            return (
              <div
                key={game.id}
                className="medallion"
                data-game={game.id}
                data-status={game.status}
                onClick={() => handleCardClick(game)}
                role="button"
                tabIndex={0}
                onKeyDown={(e) => {
                  if (e.key === 'Enter' || e.key === ' ') {
                    e.preventDefault();
                    handleCardClick(game);
                  }
                }}
              >
                {/* 1. Circular Gold Medallion Frame */}
                <div className="medallion__ring">
                  {/* Metallic Ring Shine Element (contained strictly within circular gold ring) */}
                  <div className="medallion__ring-shine" />

                  <div className="medallion__inner">
                    {/* Fanned Mini Playing Cards */}
                    <div className={`medallion__cards ${cardData.fanClass}`}>
                      {cardData.cards.map((card, i) => (
                        <MiniCard key={i} {...card} />
                      ))}
                    </div>
                  </div>

                  {/* Bottom Gemstone Clasp */}
                  <div className="medallion__gemstone" />
                </div>

                {/* 2. Overlapping Notched Ribbon Title + Connected Player Count Chip */}
                <div className="medallion__ribbon-stack">
                  {/* Overlapping Angled Notched Title Banner Ribbon with crisp gold drop-shadow border */}
                  <div className="medallion__title-banner-wrapper">
                    <div className="medallion__title-banner">
                      <h2 className="medallion__title-text">{game.name}</h2>
                    </div>
                  </div>

                  {/* Connected Player Count Chip */}
                  <div className="medallion__player-chip">
                    <span className="medallion__player-icon">👥</span>
                    <span className="medallion__player-text">{game.players}</span>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      </main>

      {toastMessage && (
        <ErrorToast message={toastMessage} onClose={() => setToastMessage(null)} />
      )}
    </div>
  );
}
