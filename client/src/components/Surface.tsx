import type { HTMLAttributes } from 'react';

/** The dark-wine gradient surface shared by panels, cards and popups (`.surface`). */
export function Surface({ className, ...rest }: HTMLAttributes<HTMLDivElement>) {
  return <div className={['surface', className ?? ''].filter(Boolean).join(' ')} {...rest} />;
}
