import type { ElementType, HTMLAttributes } from 'react';

type SurfaceProps = HTMLAttributes<HTMLElement> & { as?: ElementType };

/** The dark-wine gradient surface shared by panels, cards and popups (`.surface`).
 *  Pass `as` to render a different element (e.g. `as="article"`). */
export function Surface({ as: Tag = 'div', className, ...rest }: SurfaceProps) {
  return <Tag className={['surface', className ?? ''].filter(Boolean).join(' ')} {...rest} />;
}
