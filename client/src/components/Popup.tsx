import { ReactNode } from 'react';
import { Modal } from './Modal';

interface Props {
  visible: boolean;
  title: string;
  children: ReactNode;
}

export function Popup({ visible, title, children }: Props) {
  return (
    <Modal open={visible} title={title} dismissable={false}>
      {children}
    </Modal>
  );
}
