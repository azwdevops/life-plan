import { useRef, useState } from 'react';
import { Dimensions, Modal, Pressable, StyleSheet, Text, View } from 'react-native';
import { colors } from '../theme';

export interface RowActionsMenuItem {
  label: string;
  onPress: () => void;
  danger?: boolean;
}

export function RowActionsMenu({ items, c }: { items: RowActionsMenuItem[]; c: typeof colors.light }) {
  const triggerRef = useRef<View>(null);
  const [open, setOpen] = useState(false);
  const [position, setPosition] = useState<{ top: number; right: number } | null>(null);

  const openMenu = () => {
    triggerRef.current?.measureInWindow((x, y, width, height) => {
      const screenWidth = Dimensions.get('window').width;
      setPosition({ top: y + height + 4, right: screenWidth - (x + width) });
      setOpen(true);
    });
  };

  const styles = makeStyles(c);

  return (
    <>
      <View ref={triggerRef} collapsable={false}>
        <Pressable onPress={openMenu} hitSlop={8} style={styles.trigger}>
          <Text style={styles.triggerText}>⋮</Text>
        </Pressable>
      </View>
      <Modal visible={open} transparent animationType="fade" onRequestClose={() => setOpen(false)}>
        <Pressable style={StyleSheet.absoluteFill} onPress={() => setOpen(false)} />
        {position ? (
          <View style={[styles.menu, { top: position.top, right: position.right }]}>
            {items.map(item => (
              <Pressable
                key={item.label}
                onPress={() => {
                  setOpen(false);
                  item.onPress();
                }}
                style={styles.menuItem}
              >
                <Text style={[styles.menuItemText, item.danger && styles.menuItemTextDanger]}>
                  {item.label}
                </Text>
              </Pressable>
            ))}
          </View>
        ) : null}
      </Modal>
    </>
  );
}

function makeStyles(c: typeof colors.light) {
  return StyleSheet.create({
    trigger: {
      width: 32,
      height: 32,
      alignItems: 'center',
      justifyContent: 'center',
    },
    triggerText: { color: c.textMuted, fontSize: 20, fontWeight: '700' },
    menu: {
      position: 'absolute',
      minWidth: 140,
      borderRadius: 10,
      borderWidth: StyleSheet.hairlineWidth,
      borderColor: c.border,
      backgroundColor: c.surface,
      paddingVertical: 4,
      elevation: 6,
      shadowColor: '#000',
      shadowOpacity: 0.25,
      shadowRadius: 8,
      shadowOffset: { width: 0, height: 4 },
    },
    menuItem: { paddingVertical: 10, paddingHorizontal: 14 },
    menuItemText: { color: c.text, fontSize: 14 },
    menuItemTextDanger: { color: c.danger },
  });
}
