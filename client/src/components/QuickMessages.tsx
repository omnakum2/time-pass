import { useState } from 'react';
import { QUICK_MESSAGES } from 'shared';
import { sendMsg } from '../net/socket';

/**
 * Quick-chat control: a small Message button in the my-strip. Tapping it opens
 * an anchored popover (opens UPWARD so it stays on-screen on mobile). Picking a
 * message sends it; every client shows it as a bubble above the sender's chip.
 */
export function QuickMessages() {
  const [open, setOpen] = useState(false);
  const [tab, setTab] = useState<'default' | 'meme'>('default');

  const send = (id: string) => {
    sendMsg({ type: 'quickMessage', id });
    setOpen(false);
  };

  return (
    <div className="quick-messages">
      {open && (
        <>
          <div className="quick-messages__backdrop" onClick={() => setOpen(false)} />
          <div className="quick-messages__menu" role="menu">
            <div className="quick-messages__tabs" role="tablist">
              {(['default', 'meme'] as const).map(t => (
                <button
                  key={t}
                  className={`quick-messages__tab${tab === t ? ' quick-messages__tab--active' : ''}`}
                  role="tab"
                  aria-selected={tab === t}
                  onClick={() => setTab(t)}
                >
                  {t === 'default' ? 'Default' : 'Meme'}
                </button>
              ))}
            </div>
            {QUICK_MESSAGES.filter(m => m.tab === tab).map(m => (
              <button
                key={m.id}
                className="quick-messages__item"
                role="menuitem"
                onClick={() => send(m.id)}
              >
                {m.text}
              </button>
            ))}
          </div>
        </>
      )}
      <button
        className="quick-messages__btn"
        onClick={() => setOpen(o => !o)}
        aria-label="Quick messages"
        aria-expanded={open}
        title="Quick messages"
      >
        💬
      </button>
    </div>
  );
}
