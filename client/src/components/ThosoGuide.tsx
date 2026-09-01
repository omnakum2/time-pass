import { Surface } from './Surface';

interface Section {
  id: string;
  title: string;
  body: JSX.Element;
}

// English-only guide for Thoso. Mirrors Bid Club's GuideContent structure and
// classes (guide-title / guide-layout / guide-toc / guide-content / guide-section)
// so the overlay looks identical across games; colours follow the active theme
// tokens, so no game-specific colours are hardcoded here.
const SECTIONS: Section[] = [
  {
    id: 'overview',
    title: 'Overview',
    body: (
      <>
        <p>
          Thoso is a transfer-and-shedding card game. First you build up piles by
          passing cards around the table, then you shed the cards from your hand ·
          the first player to empty their hand wins, and the last player still
          holding cards loses.
        </p>
        <p>
          It plays in <strong>two phases</strong>: Phase 1 · Draw &amp; Transfer,
          then Phase 2 · Play (shedding).
        </p>
      </>
    ),
  },
  {
    id: 'transfer',
    title: 'Phase 1 · Draw & Transfer',
    body: (
      <>
        <p>
          Every player builds a personal <strong>pile</strong> — a face-down stack
          whose <strong>top card is the only one everyone can see</strong> (you see
          only your own top card too). This pile becomes your hand in Phase 2.
        </p>
        <p>
          <strong>Transfer rule:</strong> a card of rank <strong>R</strong> may be
          transferred only onto a player whose top card is <strong>R−1</strong>
          (any suit). Ranks are cyclic · A → 2 → 3 → … → K → A, so an Ace goes onto
          a King. The transferred card becomes that pile's new top.
        </p>
        <p>On your turn you may transfer from two sources, both subject to that rule:</p>
        <ul>
          <li>your own pile's top card, and/or</li>
          <li>the card you draw from the central pile (turned face-up for all to see).</li>
        </ul>
        <p>
          Transfer any legal cards, then draw. A drawn card that can be transferred
          may be passed on, and you draw again · the turn continues while transfers
          stay legal. A drawn card that <strong>cannot</strong> be transferred goes
          on top of your own pile and your turn ends.
        </p>
        <p>
          <strong>Missed a transfer?</strong> Spotting your transfers is a skill. If
          a legal transfer was available and you missed it, the server penalises you
          automatically · <strong>each opponent gives you one card</strong>.
        </p>
        <p>Phase 1 runs until all 52 cards have been drawn.</p>
      </>
    ),
  },
  {
    id: 'play',
    title: 'Phase 2 · Play (Shed)',
    body: (
      <>
        <p>
          Now you shed the cards in your hand. There is <strong>no trump</strong> —
          it is pure follow-suit, with Ace high (A &gt; K &gt; Q &gt; … &gt; 2). The
          holder of the <strong>Ace of Spades</strong> leads first.
        </p>
        <p>
          The leader plays any card, setting the <strong>led suit</strong>. Everyone
          else must <strong>follow the led suit</strong> if they hold it — any rank
          of that suit will do. The holder of the highest led-suit card keeps the
          lead and plays first next round; the shed cards are discarded for good.
        </p>
        <p>
          If you <strong>cannot follow suit</strong>, you play a <strong>Thoso</strong>
          — any off-suit card. A Thoso ends the round at once: the current holder of
          the highest led-suit card must <strong>pick up every card played</strong>
          that round (a setback), and the player who played the Thoso leads next.
        </p>
      </>
    ),
  },
  {
    id: 'winning',
    title: 'Winning & Losing',
    body: (
      <>
        <p>
          The first player to play their <strong>last card</strong> (without being
          forced to pick up by a Thoso) is <strong>finished</strong> and takes the
          next rank · 1st out, 2nd out, and so on.
        </p>
        <p>
          Play continues until only one player is left holding cards · that player
          is the <strong>loser</strong> and takes the last rank.
        </p>
      </>
    ),
  },
];

const PAGE_TITLE = 'How to Play · Thoso';

export function ThosoGuide() {
  return (
    <>
      <h1 className="guide-title">{PAGE_TITLE}</h1>
      <div className="guide-layout">
        <ol className="guide-toc">
          {SECTIONS.map(({ id, title }) => (
            <li key={id}>
              <button
                className="guide-toc__link"
                onClick={() =>
                  document.getElementById(id)?.scrollIntoView({ behavior: 'smooth' })
                }
              >
                {title}
              </button>
            </li>
          ))}
        </ol>
        <Surface as="article" className="guide-content">
          {SECTIONS.map(({ id, title, body }) => (
            <section id={id} key={id} className="guide-section">
              <h2>{title}</h2>
              {body}
            </section>
          ))}
        </Surface>
      </div>
    </>
  );
}
