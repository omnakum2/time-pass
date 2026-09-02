import { useState } from 'react';
import { Link } from 'react-router-dom';
import { Surface } from './Surface';

export type Lang = 'en' | 'gu';

export interface GuideSection {
  id: string;
  title: string;
  body: JSX.Element;
}

export interface GuideData {
  title: Record<Lang, string>;
  sections: Record<Lang, GuideSection[]>;
}

// Shared bilingual (English + Gujarati) guide shell. Individual games supply only the
// DATA (per-language page title + sections); the language toggle, TOC, layout classes
// (guide-title / guide-lang / guide-layout / guide-toc / guide-content / guide-section)
// and the optional home-link CTA all live here so every game's guide renders identically.
export function Guide({
  data,
  showHomeLink = false,
}: {
  data: GuideData;
  showHomeLink?: boolean;
}) {
  const [lang, setLang] = useState<Lang>('en');
  const sections = data.sections[lang];

  return (
    <>
      <h1 className="guide-title">{data.title[lang]}</h1>
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
