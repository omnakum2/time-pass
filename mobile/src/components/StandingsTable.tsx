import type { ReactNode } from 'react';
import { View, Text } from 'react-native';
import { colors } from '../theme';
import { scale } from '../lib/scale';

// Mobile-native data table. Callers supply header labels and rows of cells
// (strings/numbers render as text; anything else — e.g. <Delta/> — renders
// as-is). `highlight` tints a row (used for the round leader).
interface Row {
  key: string;
  cells: ReactNode[];
  highlight?: boolean;
}

export function StandingsTable({ headers, rows }: { headers: string[]; rows: Row[] }) {
  return (
    <View>
      {/* Header row */}
      <View
        style={{
          flexDirection: 'row',
          borderBottomWidth: 1,
          borderBottomColor: colors.goldBorder,
          paddingVertical: scale(6),
        }}
      >
        {headers.map((h, i) => (
          <Text
            key={i}
            style={{ flex: 1, color: colors.creamMuted, fontSize: scale(12), fontWeight: '700', textAlign: 'center' }}
          >
            {h}
          </Text>
        ))}
      </View>

      {/* Data rows */}
      {rows.map((row) => (
        <View
          key={row.key}
          style={{
            flexDirection: 'row',
            paddingVertical: scale(6),
            backgroundColor: row.highlight ? 'rgba(233,184,74,0.12)' : 'transparent',
            borderRadius: row.highlight ? scale(6) : 0,
          }}
        >
          {row.cells.map((cell, i) => (
            <View key={i} style={{ flex: 1, alignItems: 'center' }}>
              {typeof cell === 'string' || typeof cell === 'number' ? (
                <Text style={{ color: colors.cream, fontSize: scale(13) }}>{cell}</Text>
              ) : (
                cell
              )}
            </View>
          ))}
        </View>
      ))}
    </View>
  );
}
