import React, { useEffect, useState, useCallback } from 'react';
import {
  View, Text, StyleSheet, FlatList, TouchableOpacity, Alert,
} from 'react-native';
import { Storage } from '../lib/storage';
import { colors, spacing, radius, fontSizes } from '../lib/theme';

export default function HistoryScreen({ navigation }) {
  const [username, setUsername] = useState(null);
  const [items, setItems] = useState([]);

  const reload = useCallback(async () => {
    const u = await Storage.getCurrentUser();
    setUsername(u);
    if (!u) { setItems([]); return; }
    const list = await Storage.getConversations(u);
    setItems(list);
  }, []);

  useEffect(() => {
    const unsub = navigation.addListener('focus', reload);
    return unsub;
  }, [navigation, reload]);

  async function openConvo(id) {
    navigation.navigate('Sohbet', { convoId: id });
  }

  function deleteConvo(id) {
    Alert.alert('Sil', 'Bu sohbeti silmek istiyor musun?', [
      { text: 'Vazgec', style: 'cancel' },
      {
        text: 'Sil', style: 'destructive',
        onPress: async () => {
          if (!username) return;
          await Storage.deleteConversation(username, id);
          reload();
        },
      },
    ]);
  }

  async function startNew() {
    navigation.navigate('Sohbet', { newConvo: true });
  }

  function formatDate(iso) {
    try {
      const d = new Date(iso);
      return d.toLocaleDateString('tr-TR', { day: '2-digit', month: 'short', year: 'numeric' });
    } catch { return ''; }
  }

  return (
    <View style={styles.root}>
      <TouchableOpacity style={styles.newBtn} onPress={startNew}>
        <Text style={styles.newBtnText}>+ Yeni sohbet</Text>
      </TouchableOpacity>

      {items.length === 0 ? (
        <View style={styles.empty}>
          <Text style={styles.emptyText}>Henuz sohbet yok.</Text>
        </View>
      ) : (
        <FlatList
          data={items}
          keyExtractor={(i) => i.id}
          contentContainerStyle={{ padding: spacing.md, paddingTop: 0 }}
          renderItem={({ item }) => (
            <TouchableOpacity
              style={styles.item}
              onPress={() => openConvo(item.id)}
              onLongPress={() => deleteConvo(item.id)}
            >
              <Text style={styles.itemTitle} numberOfLines={1}>
                {item.preview || 'Sohbet'}
              </Text>
              <View style={styles.itemMeta}>
                <Text style={styles.itemMetaText}>
                  {item.messages?.length || 0} mesaj
                </Text>
                <Text style={styles.itemMetaText}>
                  {formatDate(item.updatedAt || item.createdAt)}
                </Text>
              </View>
            </TouchableOpacity>
          )}
        />
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: colors.bg },
  newBtn: {
    margin: spacing.md, padding: spacing.md,
    backgroundColor: colors.primary, borderRadius: radius.md,
    alignItems: 'center',
  },
  newBtnText: { color: colors.bg, fontWeight: '700', fontSize: fontSizes.md },
  empty: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  emptyText: { color: colors.textMuted, fontSize: fontSizes.md },
  item: {
    backgroundColor: colors.surface, borderRadius: radius.md,
    padding: spacing.md, marginBottom: spacing.sm,
    borderWidth: 1, borderColor: colors.border,
  },
  itemTitle: {
    color: colors.text, fontSize: fontSizes.md, fontWeight: '600',
    marginBottom: spacing.xs,
  },
  itemMeta: { flexDirection: 'row', justifyContent: 'space-between' },
  itemMetaText: { color: colors.textMuted, fontSize: fontSizes.xs },
});
