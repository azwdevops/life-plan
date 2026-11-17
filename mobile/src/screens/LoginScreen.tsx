import { useState } from 'react';
import {
  ActivityIndicator,
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
import { useAuth } from '../contexts/AuthContext';
import { login } from '../api';

export function LoginScreen() {
  const auth = useAuth();
  const isDarkMode = useColorScheme() === 'dark';
  const c = isDarkMode ? colors.dark : colors.light;
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const styles = makeStyles(c);

  if (!auth.backendUrl) {
    return (
      <View style={styles.container}>
        <Text style={styles.message}>
          Set a backend server URL in Settings first, then come back here to log in.
        </Text>
      </View>
    );
  }

  const submit = async () => {
    if (!email.trim() || !password) {
      setError('Enter your email and password.');
      return;
    }
    setSubmitting(true);
    setError(null);
    try {
      const token = await login(auth.backendUrl, email.trim(), password);
      auth.login(token);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Login failed.');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <KeyboardAvoidingView style={styles.container} behavior="height">
      <ScrollView
        contentContainerStyle={styles.scrollContent}
        keyboardShouldPersistTaps="handled"
      >
        <Text style={styles.title}>Log in</Text>
        <Text style={styles.subtitle}>Connects to {auth.backendUrl}</Text>
        <View style={styles.field}>
          <Text style={styles.inputLabel}>Email</Text>
          <TextInput
            value={email}
            onChangeText={setEmail}
            autoCapitalize="none"
            autoCorrect={false}
            keyboardType="email-address"
            style={styles.input}
          />
        </View>
        <View style={styles.field}>
          <Text style={styles.inputLabel}>Password</Text>
          <View style={styles.passwordRow}>
            <TextInput
              value={password}
              onChangeText={setPassword}
              secureTextEntry={!showPassword}
              style={styles.passwordInput}
            />
            <Pressable onPress={() => setShowPassword(s => !s)} style={styles.passwordToggle} hitSlop={8}>
              <Text style={styles.passwordToggleText}>{showPassword ? 'Hide' : 'Show'}</Text>
            </Pressable>
          </View>
        </View>
        {error ? <Text style={styles.error}>{error}</Text> : null}
        <Pressable onPress={() => void submit()} disabled={submitting} style={styles.submitButton}>
          {submitting ? <ActivityIndicator color="#ffffff" /> : <Text style={styles.submitButtonText}>Log in</Text>}
        </Pressable>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

function makeStyles(c: typeof colors.light) {
  return StyleSheet.create({
    container: { flex: 1, backgroundColor: c.background },
    scrollContent: { padding: 20, gap: 12, flexGrow: 1, justifyContent: 'center' },
    title: { color: c.text, fontSize: 20, fontWeight: '700' },
    subtitle: { color: c.textMuted, fontSize: 12, marginBottom: 8 },
    message: { color: c.textMuted, fontSize: 14, textAlign: 'center' },
    field: { gap: 4 },
    inputLabel: { color: c.textMuted, fontSize: 12 },
    input: {
      borderWidth: StyleSheet.hairlineWidth,
      borderColor: c.border,
      borderRadius: 8,
      paddingHorizontal: 10,
      paddingVertical: 8,
      color: c.text,
      backgroundColor: c.surface,
    },
    passwordRow: {
      flexDirection: 'row',
      alignItems: 'center',
      borderWidth: StyleSheet.hairlineWidth,
      borderColor: c.border,
      borderRadius: 8,
      backgroundColor: c.surface,
    },
    passwordInput: {
      flex: 1,
      paddingHorizontal: 10,
      paddingVertical: 8,
      color: c.text,
    },
    passwordToggle: { paddingHorizontal: 10 },
    passwordToggleText: { color: c.accent, fontSize: 13, fontWeight: '600' },
    error: { color: c.danger, fontSize: 13 },
    submitButton: {
      marginTop: 4,
      backgroundColor: c.accent,
      borderRadius: 8,
      paddingVertical: 10,
      alignItems: 'center',
    },
    submitButtonText: { color: '#ffffff', fontWeight: '600' },
  });
}
