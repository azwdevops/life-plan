import { useEffect, useRef } from 'react';
import { Animated, Dimensions, Pressable, StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { colors } from '../theme';

export interface SidebarItem {
  key: string;
  label: string;
  icon: string;
  color?: keyof typeof colors.light;
}

interface Props {
  open: boolean;
  onClose: () => void;
  items: SidebarItem[];
  activeKey: string;
  onSelect: (key: string) => void;
  c: typeof colors.light;
}

const WIDTH = Math.min(280, Dimensions.get('window').width * 0.78);

export function LeftSidebar({ open, onClose, items, activeKey, onSelect, c }: Props) {
  const insets = useSafeAreaInsets();
  const translateX = useRef(new Animated.Value(-WIDTH)).current;
  const backdropOpacity = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    Animated.parallel([
      Animated.timing(translateX, {
        toValue: open ? 0 : -WIDTH,
        duration: 220,
        useNativeDriver: true,
      }),
      Animated.timing(backdropOpacity, {
        toValue: open ? 1 : 0,
        duration: 220,
        useNativeDriver: true,
      }),
    ]).start();
  }, [open, translateX, backdropOpacity]);

  const styles = makeStyles(c, insets.top, insets.bottom);

  return (
    <View style={StyleSheet.absoluteFill} pointerEvents={open ? 'auto' : 'none'}>
      <Animated.View style={[styles.backdrop, { opacity: backdropOpacity }]}>
        <Pressable style={StyleSheet.absoluteFill} onPress={onClose} accessibilityLabel="Close menu" />
      </Animated.View>
      <Animated.View style={[styles.panel, { transform: [{ translateX }] }]}>
        <Text style={styles.brand}>Life Plan</Text>
        {items.map(item => {
          const active = item.key === activeKey;
          return (
            <Pressable
              key={item.key}
              onPress={() => {
                onSelect(item.key);
                onClose();
              }}
              style={[
                styles.item,
                active && {
                  backgroundColor: `${c[item.color ?? 'accent']}1f`,
                },
              ]}
            >
              <Text style={styles.itemIcon}>{item.icon}</Text>
              <Text
                style={[
                  styles.itemLabel,
                  active && { color: c[item.color ?? 'accent'], fontWeight: '700' },
                ]}
              >
                {item.label}
              </Text>
            </Pressable>
          );
        })}
      </Animated.View>
    </View>
  );
}

function makeStyles(c: typeof colors.light, topInset: number, bottomInset: number) {
  return StyleSheet.create({
    backdrop: { flex: 1, backgroundColor: 'rgba(0,0,0,0.45)' },
    panel: {
      position: 'absolute',
      top: 0,
      bottom: 0,
      left: 0,
      width: WIDTH,
      backgroundColor: c.surface,
      paddingTop: topInset + 24,
      paddingBottom: bottomInset + 16,
      paddingHorizontal: 14,
      gap: 2,
      borderRightWidth: StyleSheet.hairlineWidth,
      borderRightColor: c.border,
    },
    brand: { color: c.text, fontSize: 20, fontWeight: '700', marginBottom: 18, marginLeft: 10 },
    item: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 14,
      paddingVertical: 12,
      paddingHorizontal: 10,
      borderRadius: 10,
    },
    itemIcon: { fontSize: 18, width: 24, textAlign: 'center' },
    itemLabel: { color: c.textMuted, fontSize: 15, fontWeight: '500' },
  });
}
