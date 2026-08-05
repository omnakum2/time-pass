import { useState } from 'react';

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
            that prediction exactly — being close is not enough.
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
            Round 1, which deals a single card. The rounds always count down: 7, 6, 5, 4,
            3, 2, 1.
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
            One suit is trump each round and beats every other suit. The trump rotates in a
            fixed cycle and then repeats:
          </p>
          <p>Diamonds ♦ → Clubs ♣ → Hearts ♥ → Spades ♠ → No-Trump.</p>
          <ul>
            <li>Round 7 — Diamonds ♦</li>
            <li>Round 6 — Clubs ♣</li>
            <li>Round 5 — Hearts ♥</li>
            <li>Round 4 — Spades ♠</li>
            <li>Round 3 — No-Trump</li>
            <li>Round 2 — Diamonds ♦</li>
            <li>Round 1 — Clubs ♣</li>
          </ul>
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
          <ul>
            <li>Exact bid — bid × 10 plus your bid, i.e. bid × 11.</li>
            <li>Wrong bid — you lose bid × 10.</li>
            <li>Correct bid of 0 — you score +10.</li>
            <li>Missed bid of 0 — you score −10.</li>
          </ul>
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
      title: 'सारांश',
      body: (
        <>
          <p>
            झटपट एक ट्रिक लेने वाला भविष्यवाणी का खेल है। यह कुल 7 राउंड चलता है, और बाँटे
            जाने वाले पत्तों की संख्या पहले राउंड के 7 से घटते हुए आख़िरी राउंड में 1 तक आ जाती
            है।
          </p>
          <p>
            हर राउंड में आप बताते हैं कि आप कितनी ट्रिक जीतेंगे, और अंक तभी मिलते हैं जब आपकी
            भविष्यवाणी बिलकुल सही हो — पास होना काफ़ी नहीं है।
          </p>
        </>
      ),
    },
    {
      id: 'rounds',
      title: 'राउंड और पत्ते बाँटना',
      body: (
        <>
          <p>
            राउंड 7 में हर खिलाड़ी को 7 पत्ते मिलते हैं, राउंड 6 में 6, और इसी तरह घटते हुए
            राउंड 1 में सिर्फ़ 1 पत्ता। राउंड हमेशा घटते क्रम में चलते हैं: 7, 6, 5, 4, 3, 2, 1।
          </p>
          <p>हर राउंड की शुरुआत में पूरी गड्डी को नए सिरे से फेंटा जाता है।</p>
        </>
      ),
    },
    {
      id: 'trump',
      title: 'तुरुप',
      body: (
        <>
          <p>
            हर राउंड में एक रंग तुरुप (trump) होता है जो बाकी सभी रंगों को हराता है। तुरुप एक
            तय क्रम में घूमता रहता है और फिर दोहराता है:
          </p>
          <p>ईंट ♦ → चिड़ी ♣ → पान ♥ → हुकुम ♠ → नो-ट्रम्प।</p>
          <ul>
            <li>राउंड 7 — ईंट ♦</li>
            <li>राउंड 6 — चिड़ी ♣</li>
            <li>राउंड 5 — पान ♥</li>
            <li>राउंड 4 — हुकुम ♠</li>
            <li>राउंड 3 — नो-ट्रम्प</li>
            <li>राउंड 2 — ईंट ♦</li>
            <li>राउंड 1 — चिड़ी ♣</li>
          </ul>
          <p>
            नो-ट्रम्प राउंड में कोई तुरुप नहीं होता, इसलिए चली गई (led) रंग का सबसे बड़ा पत्ता
            हमेशा ट्रिक जीतता है।
          </p>
        </>
      ),
    },
    {
      id: 'bidding',
      title: 'बोली',
      body: (
        <>
          <p>
            हर राउंड से पहले हर खिलाड़ी बताता है कि वह कितनी ट्रिक जीतेगा — 0 से लेकर राउंड
            नंबर तक (यानी राउंड 7 में ज़्यादा से ज़्यादा 7, राउंड 1 में ज़्यादा से ज़्यादा 1)।
          </p>
          <p>
            पहली बोली लगाने वाला खिलाड़ी हर राउंड में एक जगह आगे खिसकता है, और वही खिलाड़ी
            पहली ट्रिक की शुरुआत करता है।
          </p>
        </>
      ),
    },
    {
      id: 'scoring',
      title: 'अंक गणना',
      body: (
        <>
          <p>किसी राउंड में आपके अंक पूरी तरह इस पर निर्भर करते हैं कि आपकी बोली सटीक थी या नहीं:</p>
          <ul>
            <li>सटीक बोली — बोली × 10 और साथ में आपकी बोली, यानी बोली × 11।</li>
            <li>गलत बोली — आपके बोली × 10 अंक कट जाते हैं।</li>
            <li>0 की सही बोली — +10 अंक।</li>
            <li>0 की गलत बोली — −10 अंक।</li>
          </ul>
        </>
      ),
    },
    {
      id: 'playing',
      title: 'ट्रिक खेलना',
      body: (
        <>
          <p>
            शुरुआत करने वाला खिलाड़ी एक पत्ता चलता है, और बाकी सभी को उसी रंग का पत्ता चलना
            ज़रूरी है, अगर उनके पास हो। अगर वह रंग न हो तो आप कोई भी पत्ता चल सकते हैं, तुरुप
            भी।
          </p>
          <p>
            ट्रिक में सबसे बड़ा तुरुप जीतता है। अगर कोई तुरुप नहीं चला, तो चली गई रंग का सबसे
            बड़ा पत्ता जीतता है। ट्रिक जीतने वाला अगली ट्रिक शुरू करता है।
          </p>
        </>
      ),
    },
    {
      id: 'winning',
      title: 'जीतना',
      body: (
        <>
          <p>
            राउंड 1 के बाद खेल खत्म हो जाता है और अंकों की तुलना होती है। सबसे ज़्यादा धनात्मक
            (positive) अंक वाला खिलाड़ी जीतता है।
          </p>
          <p>
            अगर सभी खिलाड़ियों के अंक ऋणात्मक (negative) हों, तो जिसका अंक शून्य के सबसे करीब है
            वह खिलाड़ी जीतता है।
          </p>
        </>
      ),
    },
  ],
};

const PAGE_TITLE: Record<Lang, string> = {
  en: 'How to Play — Jhatpat',
  hi: 'कैसे खेलें — झटपट',
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
          हिंदी
        </button>
      </div>
      <div className="guide-layout">
        <nav className="guide-toc">
          <ul>
            {sections.map(({ id, title }) => (
              <li key={id}>
                <button
                  onClick={() =>
                    document.getElementById(id)?.scrollIntoView({ behavior: 'smooth' })
                  }
                >
                  {title}
                </button>
              </li>
            ))}
          </ul>
        </nav>
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
  return (
    <div className="guide-page">
      <GuideContent />
    </div>
  );
}
