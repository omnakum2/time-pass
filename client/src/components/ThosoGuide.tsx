import { Guide, type GuideData, type Lang, type GuideSection } from './Guide';

// Bilingual (English + Gujarati) guide DATA for Thoso. The shared <Guide> shell renders
// the language toggle, TOC, layout classes and home-link CTA identically across games;
// only the per-language page title + sections differ here. Colours follow the active
// theme tokens, so no game-specific colours are hardcoded. The English side is the
// source of truth for the rules; the Gujarati side matches BidBaazi's romanised register.
const SECTIONS: Record<Lang, GuideSection[]> = {
  en: [
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
  ],
  gu: [
    {
      id: 'overview',
      title: 'Saaransh',
      body: (
        <>
          <p>
            Thoso ek patta transfer karvaani ane pachhi haath na patta kaadhi
            naakhvaani game che. Pehla tame table ni aaspaas patta pass kari ne
            <strong>dhagli</strong> banaavo cho, pachhi tamara haath na patta ek-ek
            kari ne kaadho cho · sauthi pehla potano haath khaali karnaar khiladi
            jite che, ane chhelle sudhi jena haath ma patta rahi jaay te haare che.
          </p>
          <p>
            Aa game <strong>be phase</strong> ma ramaay che: Phase 1 · Uthaavvu &amp;
            Transfer, pachhi Phase 2 · Ramat (patta kaadhvaa).
          </p>
        </>
      ),
    },
    {
      id: 'transfer',
      title: 'Phase 1 · Uthaavvu & Transfer',
      body: (
        <>
          <p>
            Dar khiladi potani ek <strong>dhagli</strong> banaave che — ek ulti
            (face-down) thappi jeno <strong>fakt top pattu j badha joi shake</strong>
            (tame pan fakt tamaro potano top pattu joi shako). Aa dhagli j Phase 2 ma
            tamaro haath bani jaay che.
          </p>
          <p>
            <strong>Transfer no niyam:</strong> <strong>R</strong> rank no pattu fakt
            te khiladi ne aapi shakaay jeni dhagli no top pattu <strong>R−1</strong>
            hoy (koi pan color). Rank cyclic (chakkar) ma chale che · A → 2 → 3 → … →
            K → A, etle Ekko (A) Raja (K) upar jaay che. Aapelo pattu te dhagli no
            navo top bani jaay che.
          </p>
          <p>Tamaari vaari ma tame be jagya thi transfer kari shako, banne aa niyam ne aadhin:</p>
          <ul>
            <li>tamari potani dhagli no top pattu, ane/athva</li>
            <li>vachli (central) dhagli ma thi tame je pattu uthaavo (badha joi shake em face-up thay che).</li>
          </ul>
          <p>
            Je pan pattu niyam pramaane transfer thaay te transfer karo, pachhi
            uthaavo. Uthaavelo pattu jo transfer thai shake to te aage aapi shako, ane
            tame farithi uthaavo · jyaan sudhi transfer legal rahe tyaan sudhi vaari
            chaalu rahe. Uthaavelo pattu jo transfer <strong>na</strong> thai shake to
            te tamari potani dhagli upar mukaay ane tamari vaari puri thay che.
          </p>
          <p>
            <strong>Transfer chuki gaya?</strong> Potaana transfer jovaa e ek aavdat
            che. Jo koi legal transfer hato ane tame te chuki gaya, to server
            aap-melaap tamne saja aape che · <strong>biija dareky khiladi tamne ek-ek
            pattu aape che</strong>.
          </p>
          <p>Phase 1 tyaan sudhi chale jyaan sudhi badha 52 patta uthaavaai na jaay.</p>
        </>
      ),
    },
    {
      id: 'play',
      title: 'Phase 2 · Ramat (Patta Kaadho)',
      body: (
        <>
          <p>
            Have tame tamara haath na patta kaadho cho. Aama <strong>koi Sar
            nathi</strong> — fakt chaal thayeli color follow karvaani, jema Ekko
            sauthi moto (A &gt; K &gt; Q &gt; … &gt; 2). <strong>Kaali no Ekko
            (♠A)</strong> jeni pase hoy te sauthi pehla chaal kare che.
          </p>
          <p>
            Chaal karnaar koi pan pattu chale che, ane te thi <strong>chaal thayeli
            color</strong> nakki thay che. Baaki badha e <strong>chaal thayeli color
            follow karvi j pade</strong> jo temni pase hoy — te color no koi pan rank
            chale. Chaal thayeli color no sauthi moto pattu jeni pase hoy te chaal
            potaani pase raakhe ane aagli round ma pehlo chale che; kaadhela patta
            kaayam maate faki devaay che.
          </p>
          <p>
            Jo tame <strong>chaal thayeli color follow na kari shako</strong>, to tame
            <strong>Thoso</strong> chalo — koi pan biji color no pattu. Thoso round ne
            turat puri kari de che: chaal thayeli color no sauthi moto pattu atyare
            jeni pase hoy te khiladi e <strong>aa round na badha patta uthaavva
            pade</strong> (ek nuksaan), ane je khiladi e Thoso chalyo te pachhi chaal
            kare che.
          </p>
        </>
      ),
    },
    {
      id: 'winning',
      title: 'Jeet Ane Haar',
      body: (
        <>
          <p>
            Sauthi pehla potano <strong>chhello pattu</strong> chali denaar khiladi
            (Thoso na kaarane patta uthaavva na pade evi rite) <strong>baahar</strong>
            thai jaay che ane pachhi no rank le che · pehlo baar, biijo baar, evi rite
            aagal.
          </p>
          <p>
            Ramat tyaan sudhi chale jyaan sudhi fakt ek j khiladi na haath ma patta
            rahe · te khiladi <strong>haarnaar</strong> che ane chhello rank le che.
          </p>
        </>
      ),
    },
  ],
};

const PAGE_TITLE: Record<Lang, string> = {
  en: 'How to Play · Thoso',
  gu: 'Kem Ramvu · Thoso',
};

const thosoGuideData: GuideData = {
  title: PAGE_TITLE,
  sections: SECTIONS,
};

export function ThosoGuide({ showHomeLink = false }: { showHomeLink?: boolean }) {
  return <Guide data={thosoGuideData} showHomeLink={showHomeLink} />;
}
