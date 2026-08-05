import { useState } from 'react';
import { useNavigate } from 'react-router-dom';

type Lang = 'en' | 'hi';

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
            Jhatpat is a trick-taking prediction game. It runs for 7 rounds, and the
            number of cards dealt counts down from 7 in the first round to 1 in the last.
          </p>
          <p>
            Each round you predict how many tricks you will win, and you score by matching
            that prediction exactly · being close is not enough.
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
            <li>Exact bid · bid × 10 plus your bid, i.e. bid × 11.</li>
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
      id: 'winning',
      title: 'Winning',
      body: (
        <>
          <p>
            After Round 1 the game ends and scores are compared. The highest positive score
            wins.
          </p>
          <p>
            If every player finished with a negative score, the player whose score is closest
            to zero wins.
          </p>
        </>
      ),
    },
  ],
  hi: [
    {
      id: 'overview',
      title: 'Saaraansh',
      body: (
        <>
          <p>
            Jhatpat ek trick-taking prediction game hai. Ye kul 7 round chalta hai, aur
            baante jaane waale patton ki sankhya pehle round ke 7 se ghatte hue aakhiri
            round me 1 tak aa jaati hai.
          </p>
          <p>
            Har round me aap andaaza lagate ho ki aap kitne haath (tricks) jeetoge, aur
            points sirf tab milte hain jab aapka andaaza bilkul sahi ho · paas hona kaafi
            nahi hai.
          </p>
        </>
      ),
    },
    {
      id: 'rounds',
      title: 'Round Aur Patte Baantna',
      body: (
        <>
          <p>
            Round 7 me har khiladi ko 7 patte milte hain, Round 6 me 6, aur isi tarah
            ghatte hue Round 1 me sirf 1 patta. Round hamesha ulti ginti me chalte hain:
            7 → 6 → 5 → 4 → 3 → 2 → 1.
          </p>
          <p>Har round ki shuruaat me 52 patton ki poori gaddi naye sire se phenti jaati hai.</p>
        </>
      ),
    },
    {
      id: 'trump',
      title: 'Trump (Turup)',
      body: (
        <>
          <p>
            Har round me ek suit trump (turup) hoti hai jo baaki sabhi suits ko haraati
            hai. Har round ki shuruaat me trump in paanch me se randomly (bina kisi kram ke)
            chuni jaati hai:
          </p>
          <ul>
            <li>Diamond ♦ (eent)</li>
            <li>Club ♣ (chidi)</li>
            <li>Heart ♥ (paan)</li>
            <li>Spade ♠ (hukum)</li>
            <li>No-Trump</li>
          </ul>
          <p>
            Trump kabhi bhi lagataar do round tak ek jaisi nahi rehti, isliye aap pehle se
            andaaza nahi laga sakte ki agli trump kaunsi hogi.
          </p>
          <p>
            No-Trump round me koi trump suit nahi hoti, isliye chali gayi (led) suit ka
            sabse bada patta hamesha haath jeet leta hai.
          </p>
        </>
      ),
    },
    {
      id: 'bidding',
      title: 'Bidding (Andaaza)',
      body: (
        <>
          <p>
            Har round se pehle har khiladi andaaza lagata hai ki wo kitne haath jeetega ·
            0 se le kar round number tak (yaani Round 7 me zyada se zyada 7, Round 1 me
            zyada se zyada 1).
          </p>
          <p>
            Pehli bid lagane waala khiladi har round me ek seat aage khiskta hai, aur wahi
            khiladi pehla haath (trick) shuru karta hai.
          </p>
        </>
      ),
    },
    {
      id: 'scoring',
      title: 'Scoring (Points)',
      body: (
        <>
          <p>Kisi round me aapke points puri tarah is baat par nirbhar karte hain ki aapki bid sahi thi ya nahi:</p>
          <ol>
            <li>Sahi bid · bid × 10 aur saath me aapki bid, yaani bid × 11.</li>
            <li>Galat bid · aapke bid × 10 points kat jaate hain.</li>
            <li>0 ki sahi bid · +10 points.</li>
            <li>0 ki galat bid · −10 points.</li>
          </ol>
        </>
      ),
    },
    {
      id: 'playing',
      title: 'Haath (Trick) Khelna',
      body: (
        <>
          <p>
            Shuruaat karne waala khiladi ek patta chalta hai, aur baaki sab ko usi suit ka
            patta chalna zaroori hai, agar unke paas ho. Agar wo suit na ho to aap koi bhi
            patta chal sakte ho, trump bhi.
          </p>
          <p>
            Haath me sabse bada trump jeetta hai. Agar koi trump nahi chala, to chali gayi
            suit ka sabse bada patta jeetta hai. Haath jeetne waala agla haath shuru karta hai.
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
            Round 1 ke baad khel khatam ho jaata hai aur points ki tulna hoti hai. Sabse
            zyada positive score waala khiladi jeetta hai.
          </p>
          <p>
            Agar sabhi khiladiyon ka score negative ho, to jiska score zero ke sabse kareeb
            hai wo khiladi jeetta hai.
          </p>
        </>
      ),
    },
  ],
};

const PAGE_TITLE: Record<Lang, string> = {
  en: 'How to Play · Jhatpat',
  hi: 'Kaise Khele · Jhatpat',
};

export function GuideContent() {
  const [lang, setLang] = useState<Lang>('en');
  const sections = SECTIONS[lang];

  return (
    <>
      <h1>{PAGE_TITLE[lang]}</h1>
      <div className="guide-lang">
        <button className={lang === 'en' ? 'active' : ''} onClick={() => setLang('en')}>
          English
        </button>
        <button className={lang === 'hi' ? 'active' : ''} onClick={() => setLang('hi')}>
          Hindi
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
        <article className="guide-content">
          {sections.map(({ id, title, body }) => (
            <section id={id} key={id} className="guide-section">
              <h2>{title}</h2>
              {body}
            </section>
          ))}
        </article>
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
        · Back
      </button>
      <GuideContent />
    </div>
  );
}
