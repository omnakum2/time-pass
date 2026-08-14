import { AnimatePresence, motion } from 'framer-motion';
import type { Announcement as Ann } from 'shared';
import { Icon } from './Icon';

/**
 * Center announcement shown during the DEALING window (mode intros + Up & Down
 * milestones). Visibility is server-driven — it shows while `announcement` is set
 * and animates out when the server clears it (~4s later). Two layouts, chosen by
 * variant:
 *   • Ribbon (intro / stakesUp / stakesDown) — a full-width band that sweeps in
 *     from the left, holds center, then exits to the right.
 *   • Flash  (summit / lastStand)           — a dramatic scale-in card with a
 *     giant ×N hero.
 * The overlay keeps `pointer-events: none` so it never blocks play (no skip).
 */
export function Announcement({ announcement }: { announcement: Ann | null }) {
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
          {announcement.variant === 'summit' || announcement.variant === 'lastStand'
            ? <Flash a={announcement} />
            : <Ribbon a={announcement} />}
        </motion.div>
      )}
    </AnimatePresence>
  );
}

function Ribbon({ a }: { a: Ann }) {
  return (
    <motion.div
      className={`announce-ribbon announce-ribbon--${a.variant}`}
      initial={{ x: '-110%', opacity: 0 }}
      animate={{ x: 0, opacity: 1 }}
      exit={{ x: '110%', opacity: 0 }}
      transition={{ type: 'spring', stiffness: 120, damping: 18 }}
    >
      {a.icon && (
        <span className="announce-ribbon__icon"><Icon name={a.icon} size={34} /></span>
      )}
      <span className="announce-ribbon__text">
        <span className="announce-ribbon__title">{a.title}</span>
        {a.subtitle && <span className="announce-ribbon__sub">{a.subtitle}</span>}
      </span>
      {a.multiplier !== undefined && (
        <span className="announce-ribbon__mult">×{a.multiplier}</span>
      )}
    </motion.div>
  );
}

function Flash({ a }: { a: Ann }) {
  return (
    <motion.div
      className={`announce-flash announce-flash--${a.variant}`}
      initial={{ scale: 0.8, opacity: 0 }}
      animate={{ scale: 1, opacity: 1 }}
      exit={{ scale: 0.8, opacity: 0 }}
      transition={{ type: 'spring', stiffness: 260, damping: 22 }}
    >
      <span className="announce-flash__title">
        {a.icon && <Icon name={a.icon} size={28} />}
        {a.title}
      </span>
      {a.multiplier !== undefined && (
        <span className="announce-flash__mult">×{a.multiplier}</span>
      )}
      {a.subtitle && <span className="announce-flash__sub">{a.subtitle}</span>}
    </motion.div>
  );
}
