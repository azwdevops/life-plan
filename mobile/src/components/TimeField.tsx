import { Pressable, StyleSheet, Text, TextInput, View } from 'react-native';
import { colors } from '../theme';

function clamp(n: number, max: number): number {
  if (Number.isNaN(n)) return 0;
  return Math.min(Math.max(n, 0), max);
}

function pad(n: number): string {
  return String(n).padStart(2, '0');
}

interface Props {
  value: string;
  onChange: (next: string) => void;
  c: typeof colors.light;
}

export function TimeField({ value, onChange, c }: Props) {
  const parts = value.split(':');
  const h = clamp(parseInt(parts[0], 10) || 0, 23);
  const m = clamp(parseInt(parts[1], 10) || 0, 59);
  const s = clamp(parseInt(parts[2], 10) || 0, 59);

  const set = (hh: number, mm: number, ss: number) => {
    onChange(`${pad(clamp(hh, 23))}:${pad(clamp(mm, 59))}:${pad(clamp(ss, 59))}`);
  };

  const now = () => {
    const d = new Date();
    set(d.getHours(), d.getMinutes(), d.getSeconds());
  };

  const styles = makeStyles(c);

  const segment = (label: string, val: number, max: number, onSet: (n: number) => void) => (
    <View style={styles.segment}>
      <Pressable onPress={() => onSet(val >= max ? 0 : val + 1)} hitSlop={8}>
        <Text style={styles.stepper}>▲</Text>
      </Pressable>
      <TextInput
        value={pad(val)}
        onChangeText={t => onSet(clamp(parseInt(t, 10) || 0, max))}
        keyboardType="number-pad"
        maxLength={2}
        selectTextOnFocus
        style={styles.segmentInput}
        accessibilityLabel={label}
      />
      <Pressable onPress={() => onSet(val <= 0 ? max : val - 1)} hitSlop={8}>
        <Text style={styles.stepper}>▼</Text>
      </Pressable>
    </View>
  );

  return (
    <View style={styles.row}>
      {segment('Hours', h, 23, hh => set(hh, m, s))}
      <Text style={styles.colon}>:</Text>
      {segment('Minutes', m, 59, mm => set(h, mm, s))}
      <Text style={styles.colon}>:</Text>
      {segment('Seconds', s, 59, ss => set(h, m, ss))}
      <Pressable onPress={now} style={styles.nowButton}>
        <Text style={styles.nowButtonText}>Now</Text>
      </Pressable>
    </View>
  );
}

function makeStyles(c: typeof colors.light) {
  return StyleSheet.create({
    row: { flexDirection: 'row', alignItems: 'center', gap: 4 },
    segment: { alignItems: 'center' },
    stepper: { color: c.accent, fontSize: 12, paddingVertical: 2 },
    segmentInput: {
      width: 40,
      textAlign: 'center',
      borderWidth: StyleSheet.hairlineWidth,
      borderColor: c.border,
      borderRadius: 6,
      paddingVertical: 4,
      color: c.text,
      backgroundColor: c.background,
      fontVariant: ['tabular-nums'],
    },
    colon: { color: c.textMuted, fontWeight: '600' },
    nowButton: {
      marginLeft: 8,
      borderWidth: StyleSheet.hairlineWidth,
      borderColor: c.accent,
      borderRadius: 6,
      paddingHorizontal: 10,
      paddingVertical: 6,
    },
    nowButtonText: { color: c.accent, fontSize: 12, fontWeight: '600' },
  });
}
