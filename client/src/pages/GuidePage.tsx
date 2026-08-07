import { useState } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { Surface } from '../components/Surface';

type Lang = 'en' | 'gu';

interface Section {
  id: string;
  title: string;
  body: JSX.Element;
}

const SECTIONS: Record<Lang, Section[]> = {
  en: [
    {
      id: 'overview',
      title: 'Overview',
      body: (
        <>
          <p>
            Bid Club is a trick-taking prediction game. It runs for 7 rounds, and the
            number of cards dealt counts down from 7 in the first round to 1 in the last.
          </p>
          <p>
            Each round you predict how many tricks you will win, and you score by matching
            that prediction exactly · being close is not enough.
          </p>
          <p>
            The rules below describe <strong>Classic</strong> mode. Other game modes each
            change just one thing · see <em>Game Modes</em> below.
          </p>
        </>
      ),
    },
    {
      id: 'rounds',
      title: 'Rounds & Dealing',
      body: (
        <>
          <p>
            Round 7 deals 7 cards to every player, Round 6 deals 6, and so on down to
            Round 1, which deals a single card. The rounds always count down: 7 → 6 → 5 →
            4 → 3 → 2 → 1.
          </p>
          <p>Every round begins with a fresh shuffle of the full deck.</p>
          <p>
            (In <strong>Up &amp; Down</strong> mode the rounds instead climb 1 → 7 and then
            back down to 1 · see <em>Game Modes</em>.)
          </p>
        </>
      ),
    },
    {
      id: 'trump',
      title: 'Trump',
      body: (
        <>
          <p>
            One suit is trump each round and beats every other suit. The trump is chosen
            randomly at the start of every round from these five options:
          </p>
          <ul>
            <li>Diamonds ♦</li>
            <li>Clubs ♣</li>
            <li>Hearts ♥</li>
            <li>Spades ♠</li>
            <li>No-Trump</li>
          </ul>
          <p>
            The trump is never the same two rounds in a row, so you cannot predict it
            ahead of time.
          </p>
          <p>
            In a No-Trump round there is no trump suit, so the highest card of the led suit
            always wins the trick.
          </p>
          <p>
            (In <strong>Revolving Trump</strong> mode the first bidder chooses the trump
            instead · see <em>Game Modes</em>.)
          </p>
        </>
      ),
    },
    {
      id: 'bidding',
      title: 'Bidding',
      body: (
        <>
          <p>
            Before each round every player predicts how many tricks they will win, anywhere
            from 0 up to the round number (so up to 7 in Round 7, up to 1 in Round 1).
          </p>
          <p>
            The first bidder rotates by one seat each round, and that same player leads the
            first trick.
          </p>
        </>
      ),
    },
    {
      id: 'scoring',
      title: 'Scoring',
      body: (
        <>
          <p>Your score for a round depends entirely on whether your bid was exact:</p>
          <ol>
            <li>Exact bid · bid × 10 plus the bid itself, i.e. bid × 11.</li>
            <li>Wrong bid · you lose bid × 10.</li>
            <li>Correct bid of 0 · you score +10.</li>
            <li>Missed bid of 0 · you score −10.</li>
          </ol>
        </>
      ),
    },
    {
      id: 'playing',
      title: 'Playing a Trick',
      body: (
        <>
          <p>
            The player on lead plays a card, and everyone else must follow the led suit if
            they hold it. If you cannot follow, you may play anything, including a trump.
          </p>
          <p>
            The highest trump in the trick wins it. If no trump was played, the highest card
            of the led suit wins. The winner of the trick leads the next one.
          </p>
        </>
      ),
    },
    {
      id: 'modes',
      title: 'Game Modes',
      body: (
        <>
          <p>
            The host picks a mode when creating the room. <strong>Classic</strong> is the
            default; each other mode changes just one thing.
          </p>
          <ul>
            <li><strong>Classic</strong> · the original game: 7 rounds counting down 7 → 1, with a random trump each round.</li>
            <li><strong>Up &amp; Down</strong> · 13 rounds instead of 7: the deal climbs 1 → 7 and then back down to 1. Everything else is like Classic.</li>
            <li><strong>Blind Bid</strong> · you place your bid before seeing your cards; your hand is revealed only once play begins.</li>
            <li><strong>Revolving Trump</strong> · instead of a random trump, the first bidder chooses the round's trump before bidding. Since the first bidder rotates each round, the choice "revolves". They can pick a suit, No-Trump, or one of the specials below.</li>
          </ul>
          <p>Revolving Trump specials:</p>
          <ul>
            <li><strong>High Card</strong> · no trump; the highest card played wins, any suit.</li>
            <li><strong>Low Card</strong> · no trump; the lowest card played wins, any suit.</li>
            <li><strong>AK47</strong> · every Ace, King, 4 and 7 (all suits) is a trump.</li>
            <li><strong>One Trump</strong> · one random rank, chosen at the round's start, is trump in all four suits.</li>
            <li><strong>King-Queen</strong> · every King and Queen (all suits) is a trump.</li>
          </ul>
          <p>
            In every mode you still must follow the led suit. Among trumps the natural rank
            order applies (Ace high), and if two trumps tie on rank the card played first wins.
          </p>
        </>
      ),
    },
    {
      id: 'winning',
      title: 'Winning',
      body: (
        <>
          <p>
            After Round 1 the game ends and scores are compared. The player with the highest
            total score wins.
          </p>
          <p>
            If every player finished with a negative score, the player whose score is closest
            to zero wins.
          </p>
        </>
      ),
    },
  ],
  gu: [
    {
      id: 'overview',
      title: 'Saaransh',
      body: (
        <>
          <p>
            Bid Club ek trick-taking prediction game che. Aama kul 7 round ni game thai che.
          </p>
          <p>
            Dar round ma tame andaajo lagaavo cho ke tame ketla haath jitso, ane
            point tyare j made jyare tamaro andaajo sachho hoy.
          </p>
          <p>
            Niche na rules <strong>Classic</strong> mode na che. Baaki na modes ek-ek vaar
            badle che · niche <em>Game Modes</em> juo.
          </p>
        </>
      ),
    },
    {
      id: 'rounds',
      title: 'Round Ane Patta',
      body: (
        <>
          <p>
            Round 7 ma dar khiladi ne 7 patta made che, Round 6 ma 6, ane aa rite ghatti
            ne Round 1 ma fakt 1 pattu. Round hamesha ulti ganatri ma chale che:
            7 → 6 → 5 → 4 → 3 → 2 → 1.
          </p>
          <p>Dar round ni shruaat ma 52 patta ne farithi shuffle karvama aave che.</p>
          <p>
            (<strong>Up &amp; Down</strong> mode ma round 1 → 7 sudhi vadhe ane pachha 1
            sudhi ghate · <em>Game Modes</em> juo.)
          </p>
        </>
      ),
    },
    {
      id: 'trump',
      title: 'Sar',
      body: (
        <>
          <p>
            Dar round ma ek color no Sar hoy che je baaki badha color ne haravi de che.
            Dar round ni shruaat ma Sar aa paanch ma thi koi kram vagar pasand
            thay che:
          </p>
          <ul>
            <li>Charkat ♦</li>
            <li>Falli ♣</li>
            <li>Laal ♥</li>
            <li>Kaali ♠</li>
            <li>Koi Sar nathi</li>
          </ul>
          <p>
            Sar dar round ma kram vagar pasand thay che ane kyarey sathe be round sudhi ek
            sarkho nathi reheto, etle tame aaglo Sar pehle thi predict nathi kari shakta.
          </p>
          <p>
            Jyare round ma koi Sar nathi hoto, etle chaal thayeli color no
            sauthi motu pattu hamesha haath jiti le che.
          </p>
          <p>
            (<strong>Revolving Trump</strong> mode ma pehlo bidder Sar pasand kare che ·
            <em>Game Modes</em> juo.)
          </p>
        </>
      ),
    },
    {
      id: 'bidding',
      title: 'Andaajo',
      body: (
        <>
          <p>
            Dar round pehla dar khiladi andaajo lagaave che ke te ketla haath jitse ·
            0 thi lai ne round number sudhi (etle Round 7 ma vadhu ma vadhu 7, Round 1 ma
            vadhu ma vadhu 1).
          </p>
          <p>
            Pehli bid lagaavnaar khiladi dar round ma ek seat aage khase che, ane te j
            khiladi pehlo haath shuru kare che.
          </p>
        </>
      ),
    },
    {
      id: 'scoring',
      title: 'Points',
      body: (
        <>
          <p>Koi round ma tamara point puri rite aa vaat par aadhaar raakhe che ke tamari bid sachi hati ke nahi:</p>
          <ol>
            <li>Sachi bid · bid × 10 ane sathe tamari bid, etle bid × 11.</li>
            <li>Khoti bid · tamara bid × 10 point kapaai jaay che.</li>
            <li>0 ni sachi bid · +10 point.</li>
            <li>0 ni khoti bid · −10 point.</li>
          </ol>
        </>
      ),
    },
    {
      id: 'playing',
      title: 'Haath Ramvo',
      body: (
        <>
          <p>
            Shruaat karnaar khiladi ek pattu chale che, ane baaki badha e j color no
            pattu chalvu jaruri che, jo temni pase hoy. Jo te color na hoy to tame koi pan
            pattu chali shako cho, Sar pan.
          </p>
          <p>
            Haath ma sauthi moto Sar jite che. Jo koi Sar na chalyo hoy, to chaal thayeli
            color no sauthi motu pattu jite che. Haath jitnaar khiladi aaglo haath
            shuru kare che.
          </p>
        </>
      ),
    },
    {
      id: 'modes',
      title: 'Ramat Na Prakaar',
      body: (
        <>
          <p>
            Room banaavti vakhte host ek mode pasand kare che. <strong>Classic</strong>
            default che; baaki na dareky mode fakt ek vaar badle che.
          </p>
          <ul>
            <li><strong>Classic</strong> · aslo game: 7 round, 7 → 1 ghatta, ane dar round ma kram vagar no Sar.</li>
            <li><strong>Up &amp; Down</strong> · 7 na badle 13 round: patta 1 → 7 sudhi vadhe ane pachha 1 sudhi ghate. Baaki badhu Classic jevu j.</li>
            <li><strong>Blind Bid</strong> · tame tamara patta joya pehla j bid lagaavo cho; tamaro haath fakt ramat shuru thaay tyare dekhaay che.</li>
            <li><strong>Revolving Trump</strong> · kram vagar na Sar na badle, pehli bid lagaavnaar khiladi bidding pehla round no Sar pasand kare che. Pehlo bidder dar round ma badle che, etle aa pasandgi "farti" rahe che. Te ek color, No-Trump, athva niche na special ma thi ek pasand kari shake.</li>
          </ul>
          <p>Revolving Trump na special:</p>
          <ul>
            <li><strong>High Card</strong> · koi Sar nahi; sauthi motu pattu jite, gme te color.</li>
            <li><strong>Low Card</strong> · koi Sar nahi; sauthi nanu pattu jite, gme te color.</li>
            <li><strong>AK47</strong> · dareky Ace, King, 4 ane 7 (badhi color) Sar che.</li>
            <li><strong>One Trump</strong> · ek kram vagar ni rank, round ni shruaat ma pasand thay, te charey color ma Sar bane che.</li>
            <li><strong>King-Queen</strong> · dareky King ane Queen (badhi color) Sar che.</li>
          </ul>
          <p>
            Dareky mode ma tame chaal thayeli color follow karvi j pade. Sar vachche natural
            rank kram lage che (Ace sauthi motu), ane be Sar ni rank sarkhi hoy to pehlu
            chalayel pattu jite.
          </p>
        </>
      ),
    },
    {
      id: 'winning',
      title: 'Jeet',
      body: (
        <>
          <p>
            Round 1 pachhi ramat puri thai jaay che ane point ni sarkhavani thay che.
            Sauthi vadhu total score vaalo khiladi jite che.
          </p>
          <p>
            Jo badha khiladi o no score minus ma hoy, to jena score zero ni sauthi najik
            hoy te khiladi jite che.
          </p>
        </>
      ),
    },
  ],
};

const PAGE_TITLE: Record<Lang, string> = {
  en: 'How to Play · Bid Club',
  gu: 'Kem Ramvu · Bid Club',
};

export function GuideContent({ showHomeLink = false }: { showHomeLink?: boolean }) {
  const [lang, setLang] = useState<Lang>('en');
  const sections = SECTIONS[lang];

  return (
    <>
      <h1>{PAGE_TITLE[lang]}</h1>
      <div className="guide-lang">
        <button className={lang === 'en' ? 'active' : ''} onClick={() => setLang('en')}>
          English
        </button>
        <button className={lang === 'gu' ? 'active' : ''} onClick={() => setLang('gu')}>
          Gujarati
        </button>
      </div>
      <div className="guide-layout">
        <ol className="guide-toc">
          {sections.map(({ id, title }) => (
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
          {sections.map(({ id, title, body }) => (
            <section id={id} key={id} className="guide-section">
              <h2>{title}</h2>
              {body}
            </section>
          ))}
          {showHomeLink && (
            <p className="guide-home-cta">
              {lang === 'gu' ? (
                <>
                  Ramva mate taiyar cho? Room banavva ke join karva mate{' '}
                  <Link className="home-seo__link" to="/">Home</Link> page par pacha jao.
                </>
              ) : (
                <>
                  Ready to play? Head back to the{' '}
                  <Link className="home-seo__link" to="/">Home</Link> page to create or join a room.
                </>
              )}
            </p>
          )}
        </Surface>
      </div>
    </>
  );
}

export function GuidePage() {
  const navigate = useNavigate();

  return (
    <div className="guide-page">
      <button
        className="btn btn--secondary btn--sm guide-back"
        onClick={() => (window.history.length > 1 ? navigate(-1) : navigate('/'))}
      >
        Go Back
      </button>
      <GuideContent showHomeLink />
    </div>
  );
}
