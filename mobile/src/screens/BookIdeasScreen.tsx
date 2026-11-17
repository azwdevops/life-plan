import { useCallback, useEffect, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  KeyboardAvoidingView,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
  useColorScheme,
} from 'react-native';
import { colors } from '../theme';
import { RowActionsMenu } from '../components/RowActionsMenu';
import { useAuth } from '../contexts/AuthContext';
import { useHeaderTitle } from '../contexts/HeaderActionContext';
import { clearScreenBackHandler, setScreenBackHandler } from '../screenBackHandler';
import {
  createAzwBookChapter,
  deleteAzwBookChapter,
  getAzwBookChapters,
  getCurrentUser,
  updateAzwBookChapter,
  type AzwBookChapter,
} from '../api';
import { stripHtml, toHtml } from '../htmlContent';
import { LoginScreen } from './LoginScreen';

export function BookIdeasScreen() {
  const isDarkMode = useColorScheme() === 'dark';
  const c = isDarkMode ? colors.dark : colors.light;
  const auth = useAuth();
  useHeaderTitle('Book Ideas');

  const [bookId, setBookId] = useState<number | null>(null);
  const [meLoaded, setMeLoaded] = useState(false);

  const [chapters, setChapters] = useState<AzwBookChapter[]>([]);
  const [chaptersLoading, setChaptersLoading] = useState(false);
  const [chaptersError, setChaptersError] = useState<string | null>(null);

  const [viewingId, setViewingId] = useState<number | null>(null);
  const [formOpen, setFormOpen] = useState(false);
  const [editingId, setEditingId] = useState<number | null>(null);
  const [text, setText] = useState('');
  const [saving, setSaving] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);

  // Which book holds ideas is read-only here - it's picked (and changed) only
  // from the web app's "Book Ideas" sidebar, stored on the user's profile, so
  // mobile just reflects whatever is set there.
  useEffect(() => {
    if (!auth.token) return;
    setMeLoaded(false);
    getCurrentUser(auth.backendUrl, auth.token)
      .then(me => setBookId(me.book_ideas_book_id))
      .catch(() => setBookId(null))
      .finally(() => setMeLoaded(true));
  }, [auth.token, auth.backendUrl]);

  const reloadChapters = useCallback(() => {
    if (!auth.token || bookId == null) return;
    setChaptersLoading(true);
    setChaptersError(null);
    getAzwBookChapters(auth.backendUrl, auth.token, bookId)
      .then(setChapters)
      .catch(e => setChaptersError(e instanceof Error ? e.message : 'Failed to load ideas.'))
      .finally(() => setChaptersLoading(false));
  }, [auth.backendUrl, auth.token, bookId]);

  useEffect(() => {
    reloadChapters();
  }, [reloadChapters]);

  const openAddForm = () => {
    setEditingId(null);
    setText('');
    setFormError(null);
    setFormOpen(true);
  };

  const openEditForm = (chapter: AzwBookChapter) => {
    setEditingId(chapter.id);
    setText(stripHtml(chapter.content));
    setFormError(null);
    setFormOpen(true);
  };

  const closeForm = useCallback(() => {
    setFormOpen(false);
    setEditingId(null);
    setFormError(null);
  }, []);

  useEffect(() => {
    if (!formOpen && viewingId == null) return;
    const handler = () => {
      closeForm();
      setViewingId(null);
      return true;
    };
    setScreenBackHandler(handler);
    return () => clearScreenBackHandler(handler);
  }, [formOpen, viewingId, closeForm]);

  const saveForm = async () => {
    if (!auth.token || bookId == null) return;
    const trimmed = text.trim();
    if (!trimmed) {
      setFormError('Write or dictate something first.');
      return;
    }
    setSaving(true);
    setFormError(null);
    try {
      const html = toHtml(trimmed);
      if (editingId != null) {
        await updateAzwBookChapter(auth.backendUrl, auth.token, editingId, html);
      } else {
        await createAzwBookChapter(auth.backendUrl, auth.token, bookId, html);
      }
      closeForm();
      reloadChapters();
    } catch (e) {
      setFormError(e instanceof Error ? e.message : 'Failed to save idea.');
    } finally {
      setSaving(false);
    }
  };

  const deleteIdea = (chapter: AzwBookChapter) => {
    Alert.alert('Delete idea?', 'This book idea will be permanently deleted.', [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Delete',
        style: 'destructive',
        onPress: () => {
          if (!auth.token) return;
          deleteAzwBookChapter(auth.backendUrl, auth.token, chapter.id)
            .then(reloadChapters)
            .catch(e => Alert.alert('Delete failed', e instanceof Error ? e.message : 'Please try again.'));
        },
      },
    ]);
  };

  const styles = makeStyles(c);

  if (!auth.token) return <LoginScreen />;

  if (bookId == null) {
    return (
      <View style={styles.container}>
        {!meLoaded ? (
          <ActivityIndicator style={styles.loading} color={c.accent} />
        ) : (
          <Text style={styles.empty}>
            No book is set up for ideas yet. Open "View Book Ideas" in the web app's header
            menu and pick a book there - it'll show up here automatically.
          </Text>
        )}
      </View>
    );
  }

  const viewingChapter = viewingId != null ? chapters.find(c2 => c2.id === viewingId) ?? null : null;

  return (
    <KeyboardAvoidingView style={styles.container} behavior="height">
      {viewingChapter ? (
        <View style={styles.form}>
          <View style={styles.viewHeader}>
            <Text style={styles.formTitle}>Book idea</Text>
            <Pressable onPress={() => setViewingId(null)}>
              <Text style={styles.closeLink}>Close</Text>
            </Pressable>
          </View>
          <ScrollView>
            <Text style={styles.viewText}>{stripHtml(viewingChapter.content) || '(empty)'}</Text>
          </ScrollView>
        </View>
      ) : formOpen ? (
        <View style={styles.form}>
          <Text style={styles.formTitle}>{editingId != null ? 'Edit idea' : 'New idea'}</Text>
          <TextInput
            value={text}
            onChangeText={setText}
            placeholder="Type, or tap the keyboard's mic to dictate…"
            placeholderTextColor={c.textMuted}
            multiline
            autoFocus
            style={styles.textArea}
          />
          {formError ? <Text style={styles.error}>{formError}</Text> : null}
          <View style={styles.formActions}>
            <Pressable onPress={closeForm} style={styles.cancelButton}>
              <Text style={styles.cancelButtonText}>Cancel</Text>
            </Pressable>
            <Pressable onPress={() => void saveForm()} disabled={saving} style={styles.addButton}>
              {saving ? (
                <ActivityIndicator color="#ffffff" />
              ) : (
                <Text style={styles.addButtonText}>Save</Text>
              )}
            </Pressable>
          </View>
        </View>
      ) : (
        <>
          {chaptersError ? <Text style={styles.error}>{chaptersError}</Text> : null}
          <ScrollView contentContainerStyle={styles.list}>
            {chaptersLoading ? (
              <ActivityIndicator style={styles.loading} color={c.accent} />
            ) : chapters.length === 0 ? (
              <Text style={styles.empty}>No ideas yet - tap "+" to add your first one.</Text>
            ) : (
              chapters.map(chapter => (
                <IdeaRow
                  key={chapter.id}
                  chapter={chapter}
                  c={c}
                  onView={() => setViewingId(chapter.id)}
                  onEdit={() => openEditForm(chapter)}
                  onDelete={() => deleteIdea(chapter)}
                />
              ))
            )}
          </ScrollView>
          <Pressable onPress={openAddForm} style={styles.fab} accessibilityLabel="Add idea">
            <Text style={styles.fabIcon}>+</Text>
          </Pressable>
        </>
      )}
    </KeyboardAvoidingView>
  );
}

function IdeaRow({
  chapter,
  c,
  onView,
  onEdit,
  onDelete,
}: {
  chapter: AzwBookChapter;
  c: typeof colors.light;
  onView: () => void;
  onEdit: () => void;
  onDelete: () => void;
}) {
  const preview = stripHtml(chapter.content) || '(empty)';
  const styles = makeStyles(c);

  return (
    <View style={styles.row}>
      <View style={styles.rowMain}>
        <Text style={styles.rowText} numberOfLines={2}>
          {preview}
        </Text>
      </View>
      <RowActionsMenu
        c={c}
        items={[
          { label: 'View', onPress: onView },
          { label: 'Edit', onPress: onEdit },
          { label: 'Delete', onPress: onDelete, danger: true },
        ]}
      />
    </View>
  );
}

function makeStyles(c: typeof colors.light) {
  return StyleSheet.create({
    container: { flex: 1, backgroundColor: c.background },
    loading: { marginTop: 32 },
    empty: { color: c.textMuted, textAlign: 'center', marginTop: 32, paddingHorizontal: 16 },
    error: { color: c.danger, fontSize: 13, marginHorizontal: 16, marginTop: 12 },
    list: { padding: 16, paddingBottom: 96, gap: 10 },
    row: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 8,
      backgroundColor: c.surface,
      borderRadius: 10,
      borderWidth: StyleSheet.hairlineWidth,
      borderColor: c.border,
      padding: 12,
    },
    rowMain: { flex: 1 },
    rowText: { color: c.text, fontSize: 14 },
    fab: {
      position: 'absolute',
      right: 16,
      bottom: 16,
      width: 56,
      height: 56,
      borderRadius: 28,
      backgroundColor: c.accent,
      alignItems: 'center',
      justifyContent: 'center',
      elevation: 4,
      shadowColor: '#000',
      shadowOpacity: 0.2,
      shadowRadius: 6,
      shadowOffset: { width: 0, height: 3 },
    },
    fabIcon: { fontSize: 24 },
    form: { margin: 16, padding: 14, borderRadius: 10, backgroundColor: c.surface, borderWidth: StyleSheet.hairlineWidth, borderColor: c.border, gap: 10, flex: 1 },
    formTitle: { color: c.text, fontSize: 14, fontWeight: '700' },
    viewHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
    closeLink: { color: c.accent, fontSize: 13, fontWeight: '600' },
    viewText: { color: c.text, fontSize: 15, lineHeight: 22 },
    textArea: {
      borderWidth: StyleSheet.hairlineWidth,
      borderColor: c.border,
      borderRadius: 8,
      paddingHorizontal: 10,
      paddingVertical: 8,
      color: c.text,
      backgroundColor: c.background,
      minHeight: 140,
      textAlignVertical: 'top',
      flex: 1,
    },
    formActions: { flexDirection: 'row', justifyContent: 'flex-end', alignItems: 'center', gap: 12 },
    cancelButton: { paddingVertical: 8, paddingHorizontal: 12, justifyContent: 'center' },
    cancelButtonText: { color: c.textMuted },
    addButton: {
      backgroundColor: c.accent,
      borderRadius: 8,
      paddingVertical: 8,
      paddingHorizontal: 16,
      justifyContent: 'center',
    },
    addButtonText: { color: '#ffffff', fontWeight: '600' },
  });
}
