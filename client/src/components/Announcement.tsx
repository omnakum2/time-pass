import { AnimatePresence, motion } from 'framer-motion';
import type { Announcement as Ann } from 'shared';
import { Icon } from './Icon';

/**
 * Full-width center banner that sweeps in during the DEALING window (mode intros +
 * Up & Down milestones). Visibility is server-driven — the banner shows while
 * `announcement` is set and animates out when the server clears it (~4s later).
 * Deliberately a horizontal sweep so it reads differently from the Modal cards.
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
            className={`announce-banner announce-banner--${announcement.variant ?? 'intro'}`}
            initial={{ x: '-120%', opacity: 0 }}
            animate={{ x: 0, opacity: 1 }}
            exit={{ x: '120%', opacity: 0 }}
            transition={{ type: 'spring', stiffness: 120, damping: 18 }}
          >
            {announcement.icon && (
              <span className="announce-banner__icon"><Icon name={announcement.icon} size={40} /></span>
            )}
            <span className="announce-banner__text">
              <span className="announce-banner__title">{announcement.title}</span>
              {announcement.subtitle && <span className="announce-banner__sub">{announcement.subtitle}</span>}
            </span>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
