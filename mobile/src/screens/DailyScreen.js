import React, { useEffect, useState, useCallback } from 'react';
import {
  View, Text, StyleSheet, ScrollView, TouchableOpacity,
  ActivityIndicator, RefreshControl,
} from 'react-native';
import { Storage } from '../lib/storage';
import { generateDailyContent } from '../lib/api';
import { colors, spacing, radius, fontSizes } from '../lib/theme';

export default function DailyScreen() {
  const [loading, setLoading] = useState(true);
  const [content, setContent] = useState(null);
  const [error, setError] = useState(null);

  const load = useCallback(async (force = false) => {
    setError(null);
    const username = await Storage.getCurrentUser();
    if (!username) return;
    const today = new Date().toISOString().split('T')[0];

    if (!force) {
      const cached = await Storage.getDailyContent(username);
      if (cached && cached.date === today) {
        setContent(cached);
        setLoading(false);
        return;
      }
    }

    setLoading(true);
    try {
      const generated = await generateDailyContent();
      if (generated) {
        const record = {
          date: today,
          content: generated.content,
          verses: generated.verse ? [generated.verse] : [],
          generated: true,
        };
        await Storage.setDailyContent(username, record);
        setContent(record);
      } else {
        setError('Bugun icin icerik alinamadi.');
      }
    } catch (e) {
      setError(e.message || 'Hata olustu.');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { load(false); }, [load]);

  const today = new Date().toLocaleDateString('tr-TR', {
    weekday: 'long', day: 'numeric', month: 'long', year: 'numeric',
  });

  return (
    <ScrollView
      style={styles.root}
      contentContainerStyle={styles.content}
      refreshControl={
        <RefreshControl
          refreshing={loading}
          onRefresh={() => load(true)}
          tintColor={colors.primary}
        />
      }
    >
      <Text style={styles.dateText}>{today}</Text>
      <Text style={styles.title}>Gunun Ilhami</Text>

      {loading && !content ? (
        <ActivityIndicator color={colors.primary} style={{ marginTop: spacing.xxl }} />
      ) : error && !content ? (
        <View style={styles.errorBox}>
          <Text style={styles.errorText}>{error}</Text>
          <TouchableOpacity style={styles.retryBtn} onPress={() => load(true)}>
            <Text style={styles.retryText}>Tekrar dene</Text>
          </TouchableOpacity>
        </View>
      ) : content ? (
        <>
          <View style={styles.card}>
            <Text style={styles.contentText}>{content.content}</Text>
          </View>

          {content.verses && content.verses.length > 0 && content.verses.map((v, i) => (
            <View key={i} style={styles.verseCard}>
              <Text style={styles.verseSource}>{v.source}</Text>
              <Text style={styles.verseRef}>{v.reference}</Text>
              <Text style={styles.verseText}>"{v.text}"</Text>
            </View>
          ))}

          <TouchableOpacity style={styles.refreshBtn} onPress={() => load(true)}>
            <Text style={styles.refreshText}>Yeni bir ilham al</Text>
          </TouchableOpacity>
        </>
      ) : null}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: colors.bg },
  content: { padding: spacing.xl },
  dateText: {
    color: colors.textMuted, fontSize: fontSizes.sm,
    textAlign: 'center', marginBottom: spacing.xs,
  },
  title: {
    color: colors.primary, fontSize: fontSizes.xl, fontWeight: '700',
    textAlign: 'center', marginBottom: spacing.xl,
  },
  card: {
    backgroundColor: colors.surface, borderRadius: radius.lg,
    padding: spacing.xl, borderWidth: 1, borderColor: colors.border,
    marginBottom: spacing.lg,
  },
  contentText: { color: colors.text, fontSize: fontSizes.md, lineHeight: 24 },
  verseCard: {
    backgroundColor: colors.surfaceAlt, borderRadius: radius.lg,
    padding: spacing.lg, borderLeftWidth: 3, borderLeftColor: colors.primary,
    marginBottom: spacing.md,
  },
  verseSource: {
    color: colors.primary, fontSize: fontSizes.xs, fontWeight: '700',
    letterSpacing: 1, marginBottom: 2,
  },
  verseRef: {
    color: colors.textMuted, fontSize: fontSizes.sm, marginBottom: spacing.sm,
  },
  verseText: {
    color: colors.text, fontSize: fontSizes.md, fontStyle: 'italic', lineHeight: 22,
  },
  refreshBtn: {
    marginTop: spacing.lg, padding: spacing.md,
    borderWidth: 1, borderColor: colors.primary, borderRadius: radius.md,
    alignItems: 'center',
  },
  refreshText: { color: colors.primary, fontWeight: '600' },
  errorBox: { marginTop: spacing.xxl, alignItems: 'center' },
  errorText: { color: colors.textMuted, textAlign: 'center', marginBottom: spacing.md },
  retryBtn: {
    paddingHorizontal: spacing.xl, paddingVertical: spacing.sm,
    backgroundColor: colors.primary, borderRadius: radius.md,
  },
  retryText: { color: colors.bg, fontWeight: '600' },
});
