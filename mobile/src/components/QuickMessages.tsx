import { useState } from 'react';
import { View, Text, Pressable } from 'react-native';
import { QUICK_MESSAGES } from 'shared';
import { Modal } from './Modal';
import { sendMsg } from '../net/socket';
import { colors } from '../theme';
import { scale } from '../lib/scale';

// Quick-chat control: a chat-bubble button that opens a modal of preset
// messages, split into Default / Meme tabs. Picking one sends it and closes.
export function QuickMessages() {
  const [open, setOpen] = useState(false);
  const [tab, setTab] = useState<'default' | 'meme'>('default');

  return (
    <>
      {/* Trigger */}
      <Pressable onPress={() => setOpen(true)} accessibilityLabel="Quick messages">
        <Text style={{ fontSize: scale(20) }}>💬</Text>
      </Pressable>

      <Modal open={open} onClose={() => setOpen(false)} title="Quick messages">
        {/* Tabs */}
        <View style={{ flexDirection: 'row', gap: scale(20), marginBottom: scale(6) }}>
          {(['default', 'meme'] as const).map((t) => (
            <Pressable key={t} onPress={() => setTab(t)}>
              <Text
                style={{
                  color: tab === t ? colors.gold : colors.creamMuted,
                  fontWeight: '700',
                  fontSize: scale(14),
                  paddingBottom: scale(4),
                  borderBottomWidth: tab === t ? 2 : 0,
                  borderBottomColor: colors.gold,
                }}
              >
                {t === 'default' ? 'Default' : 'Meme'}
              </Text>
            </Pressable>
          ))}
        </View>

        {/* Messages for the active tab */}
        {QUICK_MESSAGES.filter((m) => m.tab === tab).map((m) => (
          <Pressable
            key={m.id}
            onPress={() => {
              sendMsg({ type: 'quickMessage', id: m.id });
              setOpen(false);
            }}
            style={{ paddingVertical: scale(10), borderBottomWidth: 1, borderBottomColor: colors.goldBorder }}
          >
            <Text style={{ color: colors.cream, fontSize: scale(15) }}>{m.text}</Text>
          </Pressable>
        ))}
      </Modal>
    </>
  );
}
