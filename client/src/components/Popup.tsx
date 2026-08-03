import { ReactNode } from 'react';
import { AnimatePresence, motion } from 'framer-motion';

interface Props {
  visible: boolean;
  title: string;
  children: ReactNode;
}

export function Popup({ visible, title, children }: Props) {
  return (
    <AnimatePresence>
      {visible && (
        <motion.div
          className="popup-overlay"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          transition={{ duration: 0.18 }}
        >
          <motion.div
            className="popup"
            initial={{ scale: 0.88, opacity: 0 }}
            animate={{ scale: 1,    opacity: 1 }}
            exit={{ scale: 0.88,    opacity: 0 }}
            transition={{ type: 'spring', stiffness: 340, damping: 28 }}
          >
            <p className="popup-title">{title}</p>
            {children}
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
