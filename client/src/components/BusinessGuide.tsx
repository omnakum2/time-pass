import { Guide, type GuideData, type Lang, type GuideSection } from './Guide';

// Bilingual (English + Gujarati) guide DATA for Business. The shared <Guide> shell renders
// the language toggle, TOC, layout classes and home-link CTA identically across games; only
// the per-language page title + sections differ here. Colours follow the active theme tokens,
// so no game-specific colours are hardcoded. The English side is the source of truth for the
// rules; the Gujarati side matches the romanised register used by the other guides.
const SECTIONS: Record<Lang, GuideSection[]> = {
  en: [
    {
      id: 'overview',
      title: 'Overview',
      body: (
        <>
          <p>
            Business is a property-trading board game for 2–4 players. Roll the dice,
            move around the 36-tile board, and buy the tiles you land on. Charge rent
            when rivals land on what you own — the last player left un-bankrupt wins.
          </p>
        </>
      ),
    },
    {
      id: 'buy',
      title: 'Buying tiles',
      body: (
        <>
          <p>
            Land on an unowned city, station or utility and you may <strong>buy</strong>
            it from the bank for its listed price. Once you own a tile, every other
            player who lands on it must <strong>pay you rent</strong>.
          </p>
        </>
      ),
    },
    {
      id: 'build',
      title: 'Building',
      body: (
        <>
          <p>
            Own <strong>all three tiles of one colour group</strong> and you can start
            building houses on them, then a hotel. Each house — and the hotel — sharply
            raises the rent you collect from that tile.
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
            A player who cannot pay a debt goes <strong>bankrupt</strong> and is out.
            The <strong>last player standing</strong> wins the game.
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
            Business 2–4 khiladi maate ni property-trading board game che. Dice
            naakho, 36-tile na board par firo, ane je tile par utaro te kharido.
            Biija khiladi tamari tile par utare tyare <strong>bhaadu</strong> lo —
            chhelle sudhi je bankrupt na thay te jite che.
          </p>
        </>
      ),
    },
    {
      id: 'buy',
      title: 'Tile Kharidvi',
      body: (
        <>
          <p>
            Koi malik vagar ni city, station ke utility par utaro to tame te bank
            paase thi teni kimmat e <strong>kharidi</strong> shako. Ek vaar tamari
            thay pachhi, je pan biijo khiladi te par utare te tamne{' '}
            <strong>bhaadu aape</strong>.
          </p>
        </>
      ),
    },
    {
      id: 'build',
      title: 'Bandhkaam',
      body: (
        <>
          <p>
            Ek j color na <strong>traney tile</strong> tamari paase hoy to tame te par
            gharo (house) ane pachhi hotel bandhi shako. Dareky ghar ane hotel te tile
            nu bhaadu ghanu vadhaari de che.
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
            Je khiladi karj na chukavi shake te <strong>bankrupt</strong> thai ne baahar
            thay che. <strong>Chhello bacho khiladi</strong> game jite che.
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
