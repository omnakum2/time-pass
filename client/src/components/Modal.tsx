import { useEffect, type ReactNode } from 'react';
import { AnimatePresence, motion } from 'framer-motion';
import { Icon } from './Icon';

interface Props {
  open: boolean;
  onClose?: () => void;
  title?: string;
  /** When true (default), the backdrop click closes and a close button is shown. */
  dismissable?: boolean;
  children: ReactNode;
}

/** One backdrop-dimmed, centered, spring-animated modal for every overlay. */
export function Modal({ open, onClose, title, dismissable = true, children }: Props) {
  // Close on Esc while open (only when dismissable and a handler is provided).
  useEffect(() => {
    if (!open || !dismissable || !onClose) return;
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose(); };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [open, dismissable, onClose]);

  return (
    <AnimatePresence>
      {open && (
        <motion.div
          className="modal-overlay"
          onClick={dismissable ? onClose : undefined}
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          transition={{ duration: 0.18 }}
        >
          <motion.div
            className="modal-panel"
            onClick={(e) => e.stopPropagation()}
            initial={{ scale: 0.9, opacity: 0 }}
            animate={{ scale: 1, opacity: 1 }}
            exit={{ scale: 0.9, opacity: 0 }}
            transition={{ type: 'spring', stiffness: 340, damping: 28 }}
          >
            {dismissable && onClose && (
              <button className="modal-close" onClick={onClose} aria-label="Close">
                <Icon name="close" />
              </button>
            )}
            {title && <p className="modal-title">{title}</p>}
            {children}
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
