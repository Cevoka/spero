import React, { useEffect, useState } from 'react';
import {
  View, Text, StyleSheet, TouchableOpacity, Alert,
} from 'react-native';
import { Auth } from '../lib/auth';
import { Storage } from '../lib/storage';
import { colors, spacing, radius, fontSizes } from '../lib/theme';

export default function SettingsScreen({ onLogout }) {
  const [username, setUsername] = useState('');
  const [email, setEmail] = useState('');

  useEffect(() => {
    (async () => {
      const u = await Storage.getCurrentUser();
      setUsername(u || '');
      const userId = await Auth.getUserId();
      if (userId) {
        try {
          const { Supabase } = await import('../lib/supabase');
          const s = await Supabase.getSession();
          if (s?.user?.email) setEmail(s.user.email);
        } catch {}
      }
    })();
  }, []);

  function confirmLogout() {
    Alert.alert('Cikis yap', 'Hesabindan cikis yapmak istiyor musun?', [
      { text: 'Vazgec', style: 'cancel' },
      {
        text: 'Cikis yap',
        style: 'destructive',
        onPress: async () => {
          await Auth.logout();
          await Storage.removeCurrentUser();
          onLogout && onLogout();
        },
      },
    ]);
  }

  return (
    <View style={styles.root}>
      <View style={styles.card}>
        <Text style={styles.label}>Kullanici</Text>
        <Text style={styles.value}>{username || '—'}</Text>
        {email ? (
          <>
            <Text style={[styles.label, { marginTop: spacing.md }]}>E-posta</Text>
            <Text style={styles.value}>{email}</Text>
          </>
        ) : null}
      </View>

      <View style={styles.card}>
        <Text style={styles.infoText}>
          JESSE, manevi rehberlik icin uc ilahi gelenegten ve tasavvuf ustadlarindan
          alintilar ile size yol arkadasligi eder.
        </Text>
        <Text style={[styles.infoText, { marginTop: spacing.md }]}>
          Sorularin icin: cevoka.github.io/spero
        </Text>
      </View>

      <TouchableOpacity style={styles.logoutBtn} onPress={confirmLogout}>
        <Text style={styles.logoutText}>Cikis yap</Text>
      </TouchableOpacity>
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: colors.bg, padding: spacing.xl },
  card: {
    backgroundColor: colors.surface, borderRadius: radius.lg,
    padding: spacing.xl, borderWidth: 1, borderColor: colors.border,
    marginBottom: spacing.lg,
  },
  label: { color: colors.textMuted, fontSize: fontSizes.sm, marginBottom: 2 },
  value: { color: colors.text, fontSize: fontSizes.md, fontWeight: '600' },
  infoText: { color: colors.textMuted, fontSize: fontSizes.sm, lineHeight: 20 },
  logoutBtn: {
    padding: spacing.md, borderRadius: radius.md,
    borderWidth: 1, borderColor: colors.danger, alignItems: 'center',
    marginTop: spacing.md,
  },
  logoutText: { color: colors.danger, fontWeight: '700', fontSize: fontSizes.md },
});
