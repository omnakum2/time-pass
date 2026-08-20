// Mobile-native icon primitive for Bid Club.
// Thin wrapper over MaterialCommunityIcons with a stable, semantic name set.
import React from 'react';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { colors } from '../theme';

export type IconName =
  | 'copy'
  | 'check'
  | 'close'
  | 'crown'
  | 'swords'
  | 'trendingUp'
  | 'trendingDown'
  | 'lock'
  | 'pushed'
  | 'deciding'
  | 'table';

// Semantic name → MaterialCommunityIcons glyph.
const MAP: Record<IconName, keyof typeof MaterialCommunityIcons.glyphMap> = {
  copy: 'content-copy',
  check: 'check',
  close: 'close',
  crown: 'crown',
  swords: 'sword-cross',
  trendingUp: 'trending-up',
  trendingDown: 'trending-down',
  lock: 'lock',
  pushed: 'chevron-double-up',
  deciding: 'dots-horizontal',
  table: 'table',
};

export interface IconProps {
  name: IconName;
  size?: number;
  color?: string;
}

export default function Icon({ name, size = 16, color = colors.cream }: IconProps) {
  return <MaterialCommunityIcons name={MAP[name]} size={size} color={color} />;
}
