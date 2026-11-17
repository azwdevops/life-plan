import { useEffect, useState } from 'react';
import {
  ActivityIndicator,
  KeyboardAvoidingView,
  Modal,
  Pressable,
  StyleSheet,
  Text,
  TextInput,
  View,
  useColorScheme,
} from 'react-native';
import { colors } from '../theme';
import { useAuth } from '../contexts/AuthContext';
import { createAzwBookChapter, getCurrentUser } from '../api';
import { toHtml } from '../htmlContent';

// Global "capture a book idea" entry point, reachable from every page's
// header (mounted once in App.tsx, not per-screen) - mirrors the web app's
// header-accessible "View Book Ideas" sidebar. Which book it saves to is
// read-only here too (set from the web app), same as BookIdeasScreen.
// Dictation itself is just the keyboard's own mic button on the TextInput -
// no custom speech recognition needed, and nothing to conflict with it.
export function QuickDictateModal({ visible, onClose }: { visible: boolean; onClose: () => void }) {
  const isDarkMode = useColorScheme() === 'dark';
  const c = isDarkMode ? colors.dark : colors.light;
  const auth = useAuth();

  const [bookId, setBookId] = useState<number | null>(null);
  const [loadingBook, setLoadingBook] = useState(true);
  const [text, setText] = useState('');
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!visible) return;
    setText('');
    setError(null);
    if (!auth.token) {
      setLoadingBook(false);
      return;
    }
    setLoadingBook(true);
    getCurrentUser(auth.backendUrl, auth.token)
      .then(me => setBookId(me.book_ideas_book_id))
      .catch(() => setBookId(null))
      .finally(() => setLoadingBook(false));
  }, [visible, auth.token, auth.backendUrl]);

  const save = async () => {
    if (!auth.token || bookId == null) return;
    const trimmed = text.trim();
    if (!trimmed) {
      setError('Write or dictate something first.');
      return;
    }
    setSaving(true);
    setError(null);
    try {
      await createAzwBookChapter(auth.backendUrl, auth.token, bookId, toHtml(trimmed));
      onClose();
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to save idea.');
    } finally {
      setSaving(false);
    }
  };

  const styles = makeStyles(c);

  return (
    <Modal visible={visible} animationType="slide" transparent onRequestClose={onClose}>
      <KeyboardAvoidingView style={styles.overlay} behavior="height">
        <Pressable style={StyleSheet.absoluteFill} onPress={onClose} />
        <View style={styles.sheet}>
          <View style={styles.header}>
            <Text style={styles.title}>New book idea</Text>
            <Pressable onPress={onClose} hitSlop={8}>
              <Text style={styles.closeLink}>Close</Text>
            </Pressable>
          </View>

          {!auth.token ? (
            <Text style={styles.message}>Log in from the Book Ideas page first.</Text>
          ) : loadingBook ? (
            <ActivityIndicator color={c.accent} style={styles.loading} />
          ) : bookId == null ? (
            <Text style={styles.message}>
              No book is set up for ideas yet. Pick one from "View Book Ideas" in the web app first.
            </Text>
          ) : (
            <>
              <TextInput
                value={text}
                onChangeText={setText}
                placeholder="Type, or tap the keyboard's mic to dictate…"
                placeholderTextColor={c.textMuted}
                multiline
                autoFocus
                style={styles.textArea}
              />
              {error ? <Text style={styles.error}>{error}</Text> : null}
              <View style={styles.actions}>
                <Pressable onPress={() => void save()} disabled={saving} style={styles.saveButton}>
                  {saving ? (
                    <ActivityIndicator color="#ffffff" />
                  ) : (
                    <Text style={styles.saveButtonText}>Save</Text>
                  )}
                </Pressable>
              </View>
            </>
          )}
        </View>
      </KeyboardAvoidingView>
    </Modal>
  );
}

function makeStyles(c: typeof colors.light) {
  return StyleSheet.create({
    overlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.4)', justifyContent: 'flex-end' },
    sheet: {
      backgroundColor: c.background,
      borderTopLeftRadius: 16,
      borderTopRightRadius: 16,
      padding: 16,
      gap: 10,
      maxHeight: '80%',
    },
    header: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
    title: { color: c.text, fontSize: 16, fontWeight: '700' },
    closeLink: { color: c.accent, fontSize: 14, fontWeight: '600' },
    message: { color: c.textMuted, fontSize: 14, paddingVertical: 24, textAlign: 'center' },
    loading: { marginVertical: 24 },
    textArea: {
      borderWidth: StyleSheet.hairlineWidth,
      borderColor: c.border,
      borderRadius: 8,
      paddingHorizontal: 10,
      paddingVertical: 8,
      color: c.text,
      backgroundColor: c.surface,
      minHeight: 160,
      textAlignVertical: 'top',
    },
    error: { color: c.danger, fontSize: 13 },
    actions: { flexDirection: 'row', justifyContent: 'flex-end', gap: 12 },
    saveButton: {
      backgroundColor: c.accent,
      borderRadius: 8,
      paddingVertical: 8,
      paddingHorizontal: 16,
      justifyContent: 'center',
      minWidth: 72,
      alignItems: 'center',
    },
    saveButtonText: { color: '#ffffff', fontWeight: '600' },
  });
}
