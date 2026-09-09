import { Guide, type GuideData, type Lang, type GuideSection } from './Guide';

// Bilingual (English + Gujarati) guide DATA for Business. The shared <Guide> shell renders
// the language toggle, TOC, layout classes and home-link CTA identically across games; only
// the per-language page title + sections differ here. Colours follow the active theme tokens,
// so no game-specific colours are hardcoded. The English side is the source of truth for the
// rules; the Gujarati side matches the romanised register used by the other guides. All the
// numbers below come from the board config GLOBALS (₹15,000 start, ₹1,500 START bonus, etc.).
const SECTIONS: Record<Lang, GuideSection[]> = {
  en: [
    {
      id: 'goal',
      title: 'Goal',
      body: (
        <>
          <p>
            Business is a property-trading board game for 2-4 players. Everyone starts
            with <strong>₹15,000</strong>. Roll the dice, travel the 36-tile board, buy
            the cities you land on and charge rent when rivals land on them.
          </p>
          <p>
            A player who cannot pay a debt goes <strong>bankrupt</strong> and drops out.
            The <strong>last player standing</strong> wins.
          </p>
        </>
      ),
    },
    {
      id: 'turn',
      title: 'Your Turn',
      body: (
        <>
          <p>
            On your turn, roll the two dice and move that many tiles clockwise, then
            resolve the tile you land on.
          </p>
          <ul>
            <li>Every time you <strong>pass or land on START</strong> you collect <strong>₹1,500</strong>.</li>
            <li>Roll a <strong>double</strong> (both dice equal) and, after resolving the tile, you roll again.</li>
          </ul>
        </>
      ),
    },
    {
      id: 'buyrent',
      title: 'Buying & Rent',
      body: (
        <>
          <p>
            Land on an unowned <strong>city, station or utility</strong> and you may
            <strong> buy</strong> it for its listed price, or decline and leave it with
            the bank.
          </p>
          <p>Land on a tile someone else owns and you pay them rent:</p>
          <ul>
            <li><strong>City</strong> - its site rent (or the higher building rent if it is developed).</li>
            <li><strong>Station</strong> - ₹1,000 / ₹2,000 / ₹4,000 / ₹8,000, by how many of the four the owner holds.</li>
            <li><strong>Utility</strong> - the dice roll <strong>× 4</strong> if the owner has one, <strong>× 10</strong> if they own both.</li>
          </ul>
        </>
      ),
    },
    {
      id: 'build',
      title: 'Building',
      body: (
        <>
          <p>
            Own <strong>all three tiles of one colour</strong> to start building. Each
            city takes up to <strong>3 houses</strong> and, separately, <strong>1 hotel</strong>.
          </p>
          <p>
            Building rent replaces the plain site rent and rises sharply with every house
            and the hotel. You can <strong>sell</strong> a house or hotel back to the bank
            for <strong>half</strong> its cost.
          </p>
        </>
      ),
    },
    {
      id: 'corners',
      title: 'The Corners',
      body: (
        <>
          <ul>
            <li><strong>START</strong> - pays <strong>₹1,500</strong> every time you pass it.</li>
            <li><strong>CLUB</strong> and <strong>REST HOUSE</strong> - you miss your next turn.</li>
            <li><strong>JAIL</strong> - a <strong>₹200</strong> fine, but your turn is <em>not</em> skipped.</li>
          </ul>
        </>
      ),
    },
    {
      id: 'cards',
      title: 'Chance & Community Chest',
      body: (
        <>
          <p>
            Landing on a <strong>Chance</strong> or <strong>Community Chest</strong> tile
            draws a card automatically - the <strong>dice total</strong> that brought you
            there picks it (even and odd totals draw different cards).
          </p>
          <p>
            Cards pay you money, charge you money, collect from every other player, or
            send you to Jail, the Rest House or the Club. Building-repair cards are
            <strong> skipped</strong> if you own no houses or hotels.
          </p>
        </>
      ),
    },
    {
      id: 'taxes',
      title: 'Taxes',
      body: (
        <>
          <ul>
            <li><strong>Income Tax</strong> - ₹200 for every city you own.</li>
            <li><strong>Wealth Tax</strong> - ₹1,000 for every building (house or hotel) you own.</li>
          </ul>
        </>
      ),
    },
    {
      id: 'mortgage',
      title: 'Mortgage',
      body: (
        <>
          <p>
            Short of cash? <strong>Mortgage</strong> a plot of land back to the bank for
            <strong> half</strong> its price - while mortgaged it collects no site rent.
          </p>
          <p>
            Un-mortgage later by repaying that amount plus <strong>10% interest</strong>.
          </p>
        </>
      ),
    },
    {
      id: 'deals',
      title: 'Deals',
      body: (
        <>
          <p>
            Propose a <strong>trade</strong> to any player at any time — land, buildings
            and cash on either side. They <strong>Accept</strong> or <strong>Reject</strong>.
          </p>
          <p>
            If they reject, you must wait <strong>5 minutes</strong> before offering that
            same player again.
          </p>
        </>
      ),
    },
    {
      id: 'bankruptcy',
      title: 'Bankruptcy',
      body: (
        <>
          <p>
            When you owe more than your cash, raise money by <strong>selling buildings,
            mortgaging land or trading</strong>.
          </p>
          <p>
            If you still cannot pay, you go <strong>bankrupt</strong> and drop out, and
            your tiles return to the bank. The last player left in the game wins.
          </p>
        </>
      ),
    },
  ],
  gu: [
    {
      id: 'goal',
      title: 'Dhyeya',
      body: (
        <>
          <p>
            Business 2–4 khiladi maate ni property-trading board game che. Dareky khiladi
            <strong> ₹15,000</strong> thi shuru kare che. Dice naakho, 36-tile na board par
            firo, je city par utaro te kharido ane biija khiladi tya utare tyare bhaadu lo.
          </p>
          <p>
            Je khiladi karj na chukavi shake te <strong>bankrupt</strong> thai baahar thay
            che. <strong>Chhello bacho khiladi</strong> jite che.
          </p>
        </>
      ),
    },
    {
      id: 'turn',
      title: 'Tamari Vaari',
      body: (
        <>
          <p>
            Tamari vaari ma be dice naakho ane etli tile clockwise aage khaso, pachhi je
            tile par utaro teno faislo karo.
          </p>
          <ul>
            <li>Dareky vaar tame <strong>START pass karo ke tya utaro</strong> to <strong>₹1,500</strong> melo.</li>
            <li><strong>Double</strong> (banne dice sarkha) aave to, tile no faislo karya pachhi, farithi naakho.</li>
          </ul>
        </>
      ),
    },
    {
      id: 'buyrent',
      title: 'Kharidvu Ane Bhaadu',
      body: (
        <>
          <p>
            Koi malik vagar ni <strong>city, station ke utility</strong> par utaro to tame
            te teni kimmat e <strong>kharidi</strong> shako, athva na kharidi ne bank paase
            raheva do.
          </p>
          <p>Biija koi ni tile par utaro to tame temne bhaadu aapo:</p>
          <ul>
            <li><strong>City</strong> — tenu site bhaadu (bandhkaam hoy to vadhu building bhaadu).</li>
            <li><strong>Station</strong> — ₹1,000 / ₹2,000 / ₹4,000 / ₹8,000, malik paase charma thi ketla che te pramaane.</li>
            <li><strong>Utility</strong> — dice na total <strong>× 4</strong> (ek malik hoy to), <strong>× 10</strong> (banne hoy to).</li>
          </ul>
        </>
      ),
    },
    {
      id: 'build',
      title: 'Bandhkaam',
      body: (
        <>
          <p>
            Ek j color ni <strong>traney tile</strong> tamari paase hoy to bandhkaam shuru
            kari shako. Dar city par vadhu ma vadhu <strong>3 ghar</strong> ane alag thi
            <strong> 1 hotel</strong> bane.
          </p>
          <p>
            Bandhkaam nu bhaadu saada site bhaadu ni jagya le che ane dar ghar ane hotel
            sathe ghanu vadhe. Ghar ke hotel bank ne teni kimmat na <strong>aadha</strong>
            bhaave paachu <strong>vechi</strong> shako.
          </p>
        </>
      ),
    },
    {
      id: 'corners',
      title: 'Khunao',
      body: (
        <>
          <ul>
            <li><strong>START</strong> — pass karo dareky vaar <strong>₹1,500</strong> aape.</li>
            <li><strong>CLUB</strong> ane <strong>REST HOUSE</strong> — tamari aagli vaari chukavi de che.</li>
            <li><strong>JAIL</strong> — <strong>₹200</strong> dandh, pan vaari <em>nathi</em> chukavto.</li>
          </ul>
        </>
      ),
    },
    {
      id: 'cards',
      title: 'Chance & Community Chest',
      body: (
        <>
          <p>
            <strong>Chance</strong> ke <strong>Community Chest</strong> tile par utaro to
            aap-melaap ek card nikle — je <strong>dice total</strong> thi tame tya aavya te
            card pasand kare che (even ane odd total alag card kaadhe).
          </p>
          <p>
            Card tamne paisa aape, paisa le, biija dareky khiladi paase thi vasule, ke
            tamne Jail, Rest House ke Club moke. Bandhkaam-repair na card tame koi ghar ke
            hotel na dharaavta ho to <strong>skip</strong> thay che.
          </p>
        </>
      ),
    },
    {
      id: 'taxes',
      title: 'Vero',
      body: (
        <>
          <ul>
            <li><strong>Income Tax</strong> — tamari dareky city par ₹200.</li>
            <li><strong>Wealth Tax</strong> — tamari dareky building (ghar ke hotel) par ₹1,000.</li>
          </ul>
        </>
      ),
    },
    {
      id: 'mortgage',
      title: 'Girvi',
      body: (
        <>
          <p>
            Paisa khute che? Koi jamin <strong>girvi</strong> mukine bank paase thi teni
            kimmat na <strong>aadha</strong> melo — girvi hoy tyaan sudhi te site bhaadu
            nathi apavto.
          </p>
          <p>
            Pachhi te rakam + <strong>10% vyaaj</strong> chukavine girvi chhodavo.
          </p>
        </>
      ),
    },
    {
      id: 'deals',
      title: 'Deal',
      body: (
        <>
          <p>
            Game te vakhte koi pan khiladi ne <strong>deal</strong> aapo — banne baaju
            jamin, building ane rokad. Te <strong>Accept</strong> ke <strong>Reject</strong>
            kare.
          </p>
          <p>
            Reject kare to te j khiladi ne farithi aapva maate tame <strong>5 minute</strong>
            rah joo pade.
          </p>
        </>
      ),
    },
    {
      id: 'bankruptcy',
      title: 'Bankrupt',
      body: (
        <>
          <p>
            Tamari rokad karta vadhu karj thay to <strong>building vechine, jamin girvi
            mukine ke deal karine</strong> paisa uthaavo.
          </p>
          <p>
            To pan na chukavi shako to tame <strong>bankrupt</strong> thai baahar thao, ane
            tamari tile bank ne paachi jaay. Chhelle sudhi bacho khiladi game jite che.
          </p>
        </>
      ),
    },
  ],
};

const PAGE_TITLE: Record<Lang, string> = {
  en: 'How to Play · Business',
  gu: 'Kem Ramvu · Business',
};

const businessGuideData: GuideData = {
  title: PAGE_TITLE,
  sections: SECTIONS,
};

export function BusinessGuide({ showHomeLink = false }: { showHomeLink?: boolean }) {
  return <Guide data={businessGuideData} showHomeLink={showHomeLink} />;
}
