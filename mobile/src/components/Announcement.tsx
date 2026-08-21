import { useEffect, useState } from 'react';
import { View, Text } from 'react-native';
import { MotiView, AnimatePresence } from 'moti';
import type { Announcement as Ann } from 'shared';
import Icon from './Icon';
import { colors } from '../theme';
import { scale } from '../lib/scale';

// Center ribbon shown during the DEALING window (mode intros + Up & Down
// milestones). Server-driven: visible while `announcement` is set, animates out
// when cleared. The ×N multiplier counts up from 0 to its target on entry.
export function Announcement({ announcement }: { announcement: Ann | null }) {
  const target = announcement?.multiplier;
  // Primitive keys so the count-up restarts only on real content changes, not on
  // an unrelated re-parse producing a new object reference.
  const variant = announcement?.variant;
  const title = announcement?.title;
  const [count, setCount] = useState(0);

  // Count ×N up from 0 → target over ~600ms; restart on content change, clear on cleanup.
  useEffect(() => {
    if (target === undefined) {
      setCount(0);
      return;
    }
    const duration = 600;
    const stepMs = duration / Math.max(1, target);
    let current = 0;
    setCount(0);
    const id = setInterval(() => {
      current += 1;
      setCount(current);
      if (current >= target) clearInterval(id);
    }, stepMs);
    return () => clearInterval(id);
  }, [variant, title, target]);

  return (
    <AnimatePresence>
      {announcement && (
        <MotiView
          key={announcement.title} // stable key so exit animation runs on swap
          from={{ opacity: 0, translateY: -40 }}
          animate={{ opacity: 1, translateY: 0 }}
          exit={{ opacity: 0, translateY: 20 }}
          style={{ position: 'absolute', top: scale(70), left: 0, right: 0, alignItems: 'center', zIndex: 200 }}
          pointerEvents="none"
        >
          <View
            style={{
              flexDirection: 'row',
              alignItems: 'center',
              gap: scale(10),
              backgroundColor: colors.gold,
              borderRadius: scale(12),
              paddingHorizontal: scale(16),
              paddingVertical: scale(10),
              maxWidth: '90%',
            }}
          >
            {announcement.icon ? <Icon name={announcement.icon} size={30} color="#2E1720" /> : null}
            <View style={{ flexShrink: 1 }}>
              <Text style={{ color: '#2E1720', fontWeight: '800', fontSize: scale(16) }}>{announcement.title}</Text>
              {announcement.subtitle ? (
                <Text style={{ color: '#2E1720', fontSize: scale(12) }}>{announcement.subtitle}</Text>
              ) : null}
            </View>
            {announcement.multiplier !== undefined ? (
              <Text style={{ color: '#2E1720', fontWeight: '800', fontSize: scale(20) }}>×{count}</Text>
            ) : null}
          </View>
        </MotiView>
      )}
    </AnimatePresence>
  );
}
