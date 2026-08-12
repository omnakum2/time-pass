import { useEffect, useRef, useState } from 'react';

export function InfoTooltip({ text, label = 'Info' }: { text: string; label?: string }) {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLSpanElement>(null);
  useEffect(() => {
    if (!open) return;
    const onDown = (e: MouseEvent) => { if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false); };
    document.addEventListener('mousedown', onDown);
    return () => document.removeEventListener('mousedown', onDown);
  }, [open]);
  return (
    <span className="info-tip" ref={ref}>
      <button
        type="button"
        className="info-tip__btn"
        aria-label={label}
        title={text}
        onClick={(e) => { e.stopPropagation(); setOpen(o => !o); }}
      >
        i
      </button>
      {open && <span className="info-tip__bubble" role="tooltip">{text}</span>}
    </span>
  );
}
