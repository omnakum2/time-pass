import { useEffect, useState } from 'react';
import { AnimatePresence, motion, useReducedMotion } from 'framer-motion';
import type { Announcement as Ann } from 'shared';
import { Icon } from './Icon';

/**
 * Center announcement ribbon shown during the DEALING window (mode intros + Up & Down
 * milestones). Visibility is server-driven — it shows while `announcement` is set and
 * animates out when the server clears it (~5s later). One consistent gold ribbon for
 * every variant (Summit / Last Stand just get a subtle glow via CSS). It drops in from
 * above the screen with a spring bounce that overshoots then settles, flashes a one-shot
 * gold glow as it lands (CSS `announceLand`), and a slow specular gleam keeps sweeping
 * across the gold while it holds; the ×N multiplier counts up from 0 to its target. It
 * exits with a quick fall + fade, and honours prefers-reduced-motion (plain fade). The
 * overlay keeps `pointer-events: none` so it never blocks play (no skip).
 */
export function Announcement({ announcement }: { announcement: Ann | null }) {
  const target = announcement?.multiplier;
  const [count, setCount] = useState(0);

  // Stable primitive keys so the count-up restarts only when the announcement content
  // actually changes — not when gameState.announcement is re-parsed into a new object
  // reference on an unrelated 'state' broadcast (which would snap ×N back to 0 / flicker).
  const variant = announcement?.variant;
  const title = announcement?.title;

  // Count the ×N multiplier up from 0 → target (~0.6s), restarting on each announcement.
  useEffect(() => {
    if (target === undefined) { setCount(0); return; }
    const duration = 600;
    const start = performance.now();
    let raf = 0;
    const tick = (now: number) => {
      const t = Math.min(1, (now - start) / duration);
      setCount(Math.round(t * target));
      if (t < 1) raf = requestAnimationFrame(tick);
    };
    setCount(0);
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, [variant, title, target]);

  const reduce = useReducedMotion();

  return (
    <AnimatePresence>
      {announcement && (
        <motion.div
          className="announce-overlay"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          transition={{ duration: 0.2 }}
        >
          <motion.div
            className={`announce-ribbon announce-ribbon--${announcement.variant}`}
            initial={reduce ? { opacity: 0 } : { y: '-160%', opacity: 0 }}
            animate={reduce ? { opacity: 1 } : { y: 0, opacity: 1 }}
            exit={reduce ? { opacity: 0 } : { y: 24, opacity: 0, scale: 0.97 }}
            transition={reduce
              ? { duration: 0.2 }
              : {
                  y: { type: 'spring', stiffness: 220, damping: 14 }, // falls from top, overshoots, settles
                  opacity: { duration: 0.2 },
                }}
          >
            {announcement.icon && (
              <span className="announce-ribbon__icon"><Icon name={announcement.icon} size={34} /></span>
            )}
            <span className="announce-ribbon__text">
              <span className="announce-ribbon__title">{announcement.title}</span>
              {announcement.subtitle && <span className="announce-ribbon__sub">{announcement.subtitle}</span>}
            </span>
            {target !== undefined && (
              <span className="announce-ribbon__mult">×{count}</span>
            )}
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
