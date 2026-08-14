import { AnimatePresence, motion } from 'framer-motion';
import type { Announcement as Ann } from 'shared';
import { Icon } from './Icon';

/**
 * Center announcement ribbon shown during the DEALING window (mode intros + Up & Down
 * milestones). Visibility is server-driven — it shows while `announcement` is set and
 * animates out when the server clears it (~5s later). One consistent gold ribbon for
 * every variant (Summit / Last Stand just get a subtle glow via CSS). It sweeps in
 * from the left, drifts slowly rightward while it holds, then exits to the right.
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
          <motion.div
            className={`announce-ribbon announce-ribbon--${announcement.variant}`}
            initial={{ x: '-110%', opacity: 0 }}
            animate={{ x: ['-110%', '0%', '10%'], opacity: 1 }}
            exit={{ x: '120%', opacity: 0 }}
            transition={{
              x: { duration: 5, times: [0, 0.08, 1], ease: ['easeOut', 'linear'] }, // fast entry, then slow drift right
              opacity: { duration: 0.3 },
            }}
          >
            {announcement.icon && (
              <span className="announce-ribbon__icon"><Icon name={announcement.icon} size={34} /></span>
            )}
            <span className="announce-ribbon__text">
              <span className="announce-ribbon__title">{announcement.title}</span>
              {announcement.subtitle && <span className="announce-ribbon__sub">{announcement.subtitle}</span>}
            </span>
            {announcement.multiplier !== undefined && (
              <span className="announce-ribbon__mult">×{announcement.multiplier}</span>
            )}
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
