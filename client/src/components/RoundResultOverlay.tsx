import { motion, AnimatePresence } from 'framer-motion';
import { MsgRoundResult } from 'shared';

interface Props {
  result: MsgRoundResult | null;
  visible: boolean;
}

export function RoundResultOverlay({ result, visible }: Props) {
  return (
    <AnimatePresence>
      {visible && result && (
        <motion.div
          initial={{ opacity: 0, scale: 0.9 }}
          animate={{ opacity: 1, scale: 1 }}
          exit={{ opacity: 0, scale: 0.9 }}
          style={{
            position: 'fixed', inset: 0,
            background: 'rgba(0,0,0,0.7)',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            zIndex: 500,
          }}
        >
          <div className="panel flex-col gap-md" style={{ maxWidth: 360, width: '90%' }}>
            <h2 style={{ textAlign: 'center', color: 'var(--gold)' }}>Round {result.round} Over</h2>
            {result.perPlayer.map(p => (
              <div key={p.playerId} style={{ display: 'flex', justifyContent: 'space-between' }}>
                <span>{p.name}</span>
                <span>
                  bid {p.bid}, won {p.won} →{' '}
                  <strong style={{ color: p.delta >= 0 ? '#4caf50' : '#ef5350' }}>
                    {p.delta >= 0 ? `+${p.delta}` : p.delta}
                  </strong>
                  {' '}({p.total})
                </span>
              </div>
            ))}
          </div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
