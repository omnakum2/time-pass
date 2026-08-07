import type { InputHTMLAttributes } from 'react';

interface Props extends InputHTMLAttributes<HTMLInputElement> {
  label: string;
  hint?: string;
}

/** A labelled text input with an optional hint line. */
export function Field({ label, hint, className, ...rest }: Props) {
  return (
    <div className="flex-col gap-sm">
      <label className="field-label">{label}</label>
      <input className={['input', className ?? ''].filter(Boolean).join(' ')} {...rest} />
      {hint && <span className="field-hint">{hint}</span>}
    </div>
  );
}
