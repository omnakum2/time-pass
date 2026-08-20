// Mobile-native labelled text field for Bid Club.
// Label + TextInput (+ optional hint) stacked in a column.
import React from 'react';
import { View, Text, TextInput, StyleProp, TextStyle } from 'react-native';
import { colors, radius } from '../theme';
import { scale } from '../lib/scale';

export interface FieldProps {
  label: string;
  hint?: string;
  value: string;
  onChangeText: (t: string) => void;
  placeholder?: string;
  maxLength?: number;
  autoFocus?: boolean;
  autoCapitalize?: 'none' | 'sentences' | 'words' | 'characters';
  onSubmitEditing?: () => void;
  style?: StyleProp<TextStyle>;
}

export default function Field({
  label,
  hint,
  value,
  onChangeText,
  placeholder,
  maxLength,
  autoFocus,
  autoCapitalize,
  onSubmitEditing,
  style,
}: FieldProps) {
  return (
    <View style={{ marginBottom: scale(14) }}>
      <Text
        style={{
          color: colors.cream,
          fontWeight: '600',
          fontSize: scale(13),
          marginBottom: scale(6),
        }}
      >
        {label}
      </Text>

      <TextInput
        value={value}
        onChangeText={onChangeText}
        placeholder={placeholder}
        placeholderTextColor={colors.creamMuted}
        maxLength={maxLength}
        autoFocus={autoFocus}
        autoCapitalize={autoCapitalize}
        onSubmitEditing={onSubmitEditing}
        style={[
          {
            backgroundColor: 'rgba(0,0,0,0.25)',
            borderWidth: 1,
            borderColor: colors.goldBorder,
            borderRadius: radius,
            paddingHorizontal: scale(12),
            paddingVertical: scale(10),
            color: colors.cream,
            fontSize: scale(16),
          },
          style,
        ]}
      />

      {hint ? (
        <Text
          style={{
            color: colors.creamMuted,
            fontSize: scale(11),
            marginTop: scale(4),
          }}
        >
          {hint}
        </Text>
      ) : null}
    </View>
  );
}
