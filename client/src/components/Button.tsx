import type { ButtonHTMLAttributes } from 'react';

type Variant = 'primary' | 'secondary' | 'danger';
type Size = 'sm' | 'md';

interface Props extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: Variant;
  size?: Size;
  block?: boolean;
}

/** The game's HUD button. Renders `.btn .btn--{variant} [.btn--sm] [.btn--block]`. */
export function Button({ variant = 'primary', size = 'md', block, className, ...rest }: Props) {
  const cls = [
    'btn',
    `btn--${variant}`,
    size === 'sm' ? 'btn--sm' : '',
    block ? 'btn--block' : '',
    className ?? '',
  ].filter(Boolean).join(' ');
  return <button className={cls} {...rest} />;
}
