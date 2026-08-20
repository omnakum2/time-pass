import { Modal } from './Modal';
import { DailyRewardCard } from './DailyRewardCard';

/** Daily Reward modal: the existing 7-day streak card in a dismissable overlay. */
export function DailyRewardModal({ onClose }: { onClose: () => void }) {
  return (
    <Modal open title="Daily Reward" onClose={onClose}>
      <DailyRewardCard />
    </Modal>
  );
}
