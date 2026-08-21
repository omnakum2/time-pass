// Mobile-native popup for Bid Club — a non-dismissable, titled Modal.
import React from 'react';
import { Modal } from './Modal';

interface Props {
  visible: boolean;
  title: string;
  children: React.ReactNode;
}

export function Popup({ visible, title, children }: Props) {
  return (
    <Modal open={visible} title={title} dismissable={false}>
      {children}
    </Modal>
  );
}
