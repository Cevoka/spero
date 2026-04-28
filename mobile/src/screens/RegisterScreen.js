import React, { useState } from 'react';
import {
  View, Text, TextInput, TouchableOpacity, StyleSheet,
  KeyboardAvoidingView, Platform, ScrollView, Alert, ActivityIndicator,
} from 'react-native';
import { Auth } from '../lib/auth';
import { colors, spacing, radius, fontSizes } from '../lib/theme';

export default function RegisterScreen({ navigation }) {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);

  async function handleRegister() {
    setLoading(true);
    try {
      await Auth.register(email, password);
      Alert.alert(
        'Onay e-postası gönderildi',
        'E-posta adresinize gelen linki onayladıktan sonra giriş yapabilirsiniz.',
        [{ text: 'Tamam', onPress: () => navigation.goBack() }]
      );
    } catch (e) {
      Alert.alert('Kayıt başarısız', e.message || 'Bilinmeyen hata.');
    } finally {
      setLoading(false);
    }
  }

  return (
    <KeyboardAvoidingView
      style={styles.root}
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}
    >
      <ScrollView contentContainerStyle={styles.scroll} keyboardShouldPersistTaps="handled">
        <Text style={styles.title}>Kayıt Ol</Text>
        <Text style={styles.subtitle}>JESSE ile manevi yolculuğuna başla</Text>

        <View style={styles.card}>
          <Text style={styles.label}>E-posta</Text>
          <TextInput
            style={styles.input}
            placeholder="ornek@eposta.com"
            placeholderTextColor={colors.textMuted}
            autoCapitalize="none"
            autoCorrect={false}
            keyboardType="email-address"
            value={email}
            onChangeText={setEmail}
          />

          <Text style={styles.label}>Şifre (en az 6 karakter)</Text>
          <TextInput
            style={styles.input}
            placeholder="••••••"
            placeholderTextColor={colors.textMuted}
            secureTextEntry
            value={password}
            onChangeText={setPassword}
          />

          <TouchableOpacity
            style={[styles.button, loading && styles.buttonDisabled]}
            onPress={handleRegister}
            disabled={loading}
          >
            {loading ? (
              <ActivityIndicator color={colors.bgDeep} />
            ) : (
              <Text style={styles.buttonText}>Hesap Oluştur</Text>
            )}
          </TouchableOpacity>

          <TouchableOpacity onPress={() => navigation.goBack()} style={styles.linkRow}>
            <Text style={styles.linkText}>Hesabın var mı? </Text>
            <Text style={[styles.linkText, styles.linkBold]}>Giriş yap</Text>
          </TouchableOpacity>
        </View>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: colors.bg },
  scroll: { flexGrow: 1, justifyContent: 'center', padding: spacing.xl },
  title: {
    color: colors.primary, fontSize: fontSizes.xxl, fontWeight: '700',
    textAlign: 'center', marginBottom: spacing.xs,
  },
  subtitle: {
    color: colors.textLight, fontSize: fontSizes.md,
    textAlign: 'center', marginBottom: spacing.xxl,
  },
  card: {
    backgroundColor: colors.surface, borderRadius: radius.lg,
    padding: spacing.xl, borderWidth: 1, borderColor: colors.border,
    shadowColor: '#000', shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.35, shadowRadius: 32, elevation: 10,
  },
  label: {
    color: colors.textMuted, fontSize: fontSizes.sm,
    marginBottom: spacing.xs, marginTop: spacing.md,
  },
  input: {
    backgroundColor: colors.surfaceAlt, color: colors.text,
    borderRadius: radius.md, padding: spacing.md,
    fontSize: fontSizes.md, borderWidth: 1, borderColor: colors.border,
  },
  button: {
    backgroundColor: colors.primary, padding: spacing.md,
    borderRadius: radius.md, alignItems: 'center', marginTop: spacing.xl,
    shadowColor: colors.primary, shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.35, shadowRadius: 12, elevation: 6,
  },
  buttonDisabled: { opacity: 0.6 },
  buttonText: { color: colors.bgDeep, fontSize: fontSizes.md, fontWeight: '700', letterSpacing: 1 },
  linkRow: { flexDirection: 'row', justifyContent: 'center', marginTop: spacing.lg },
  linkText: { color: colors.textMuted, fontSize: fontSizes.sm },
  linkBold: { color: colors.primary, fontWeight: '600' },
});
