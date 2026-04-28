import React, { useEffect, useRef, useState, useCallback } from 'react';
import {
  View, Text, TextInput, TouchableOpacity, StyleSheet, FlatList,
  KeyboardAvoidingView, Platform, ActivityIndicator, Alert,
} from 'react-native';
import { Storage } from '../lib/storage';
import { loadScriptures, findRelevantVerses, sendMessage } from '../lib/api';
import { colors, spacing, radius, fontSizes } from '../lib/theme';

function newConvoId() {
  return 'conv_' + Date.now().toString(36) + '_' + Math.random().toString(36).slice(2, 8);
}

export default function ChatScreen({ route, navigation }) {
  const [username, setUsername] = useState(null);
  const [conversation, setConversation] = useState(null);
  const [input, setInput] = useState('');
  const [sending, setSending] = useState(false);
  const listRef = useRef(null);

  const openOrCreate = useCallback(async (convoId) => {
    const u = await Storage.getCurrentUser();
    if (!u) {
      navigation.reset({ index: 0, routes: [{ name: 'Login' }] });
      return;
    }
    setUsername(u);

    let convo = null;
    if (convoId) convo = await Storage.getConversation(u, convoId);
    if (!convo) {
      const activeId = await Storage.getActiveConvoId(u);
      if (activeId) convo = await Storage.getConversation(u, activeId);
    }
    if (!convo) {
      convo = {
        id: newConvoId(),
        preview: 'Yeni sohbet',
        messages: [],
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      };
      await Storage.saveConversation(u, convo);
    }
    await Storage.setActiveConvoId(u, convo.id);
    setConversation(convo);
  }, [navigation]);

  useEffect(() => {
    const convoId = route?.params?.convoId;
    openOrCreate(convoId);
  }, [route?.params?.convoId, openOrCreate]);

  // Yeni sohbet butonu için param dinleme
  useEffect(() => {
    const unsub = navigation.addListener('focus', () => {
      if (route?.params?.newConvo) {
        startNewConversation();
        navigation.setParams({ newConvo: false });
      }
    });
    return unsub;
  }, [navigation, route?.params?.newConvo]);

  async function startNewConversation() {
    if (!username) return;
    const convo = {
      id: newConvoId(),
      preview: 'Yeni sohbet',
      messages: [],
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };
    await Storage.saveConversation(username, convo);
    await Storage.setActiveConvoId(username, convo.id);
    setConversation(convo);
  }

  async function handleSend() {
    const text = input.trim();
    if (!text || sending || !conversation) return;
    setInput('');
    setSending(true);

    const userMsg = { role: 'user', content: text, timestamp: new Date().toISOString() };
    const updated = {
      ...conversation,
      messages: [...conversation.messages, userMsg],
      preview: conversation.messages.length === 0 ? text.slice(0, 80) : conversation.preview,
      updatedAt: new Date().toISOString(),
    };
    setConversation(updated);
    await Storage.saveConversation(username, updated);

    try {
      const scriptures = loadScriptures();
      const verses = findRelevantVerses(text, scriptures);
      const reply = await sendMessage(updated.messages, verses);
      const aiMsg = { role: 'assistant', content: reply, timestamp: new Date().toISOString() };
      const withReply = {
        ...updated,
        messages: [...updated.messages, aiMsg],
        updatedAt: new Date().toISOString(),
      };
      setConversation(withReply);
      await Storage.saveConversation(username, withReply);
    } catch (e) {
      Alert.alert('Hata', e.message || 'Cevap alinamadi.');
    } finally {
      setSending(false);
    }
  }

  if (!conversation) {
    return (
      <View style={styles.loader}>
        <ActivityIndicator color={colors.primary} />
      </View>
    );
  }

  return (
    <KeyboardAvoidingView
      style={styles.root}
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      keyboardVerticalOffset={Platform.OS === 'ios' ? 90 : 0}
    >
      {conversation.messages.length === 0 ? (
        <View style={styles.empty}>
          <Text style={styles.emptyTitle}>JESSE'e hos geldin</Text>
          <Text style={styles.emptyText}>
            Icinden gecen her seyi paylasabilirsin. Sana kutsal kitaplardan
            ve tasavvuf ustadlarindan esligiyle cevap verecegim.
          </Text>
        </View>
      ) : (
        <FlatList
          ref={listRef}
          data={conversation.messages}
          keyExtractor={(_, i) => String(i)}
          renderItem={({ item }) => <Bubble msg={item} />}
          contentContainerStyle={{ padding: spacing.md }}
          onContentSizeChange={() => listRef.current?.scrollToEnd({ animated: true })}
        />
      )}

      {sending && (
        <View style={styles.typing}>
          <ActivityIndicator color={colors.primary} />
          <Text style={styles.typingText}>JESSE yaziyor…</Text>
        </View>
      )}

      <View style={styles.inputBar}>
        <TextInput
          style={styles.input}
          placeholder="Mesajin…"
          placeholderTextColor={colors.textMuted}
          value={input}
          onChangeText={setInput}
          multiline
          editable={!sending}
        />
        <TouchableOpacity
          style={[styles.sendBtn, (!input.trim() || sending) && styles.sendBtnDisabled]}
          onPress={handleSend}
          disabled={!input.trim() || sending}
        >
          <Text style={styles.sendBtnText}>Gonder</Text>
        </TouchableOpacity>
      </View>
    </KeyboardAvoidingView>
  );
}

function Bubble({ msg }) {
  const isUser = msg.role === 'user';
  return (
    <View style={[styles.bubbleRow, isUser ? styles.rowRight : styles.rowLeft]}>
      <View style={[styles.bubble, isUser ? styles.userBubble : styles.aiBubble]}>
        {!isUser && <Text style={styles.aiLabel}>JESSE</Text>}
        <Text style={[styles.bubbleText, isUser && styles.userBubbleText]}>{msg.content}</Text>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: colors.bg },
  loader: { flex: 1, alignItems: 'center', justifyContent: 'center', backgroundColor: colors.bg },
  empty: {
    flex: 1, alignItems: 'center', justifyContent: 'center',
    padding: spacing.xl,
  },
  emptyTitle: {
    color: colors.primary, fontSize: fontSizes.xl, fontWeight: '700',
    marginBottom: spacing.md,
  },
  emptyText: {
    color: colors.textMuted, fontSize: fontSizes.md,
    textAlign: 'center', lineHeight: 22,
  },
  bubbleRow: { marginVertical: spacing.xs, flexDirection: 'row' },
  rowLeft: { justifyContent: 'flex-start' },
  rowRight: { justifyContent: 'flex-end' },
  bubble: {
    maxWidth: '85%', padding: spacing.md, borderRadius: radius.lg,
  },
  userBubble: {
    backgroundColor: colors.userBubble, borderTopRightRadius: 4,
  },
  aiBubble: {
    backgroundColor: colors.aiBubble, borderTopLeftRadius: 4,
    borderWidth: 1, borderColor: colors.border,
  },
  aiLabel: {
    color: colors.primary, fontSize: fontSizes.xs, fontWeight: '700',
    marginBottom: spacing.xs, letterSpacing: 1,
  },
  bubbleText: { color: colors.text, fontSize: fontSizes.md, lineHeight: 22 },
  userBubbleText: { color: colors.userBubbleText, fontWeight: '500' },
  typing: {
    flexDirection: 'row', alignItems: 'center', paddingHorizontal: spacing.lg,
    paddingVertical: spacing.sm, gap: spacing.sm,
  },
  typingText: { color: colors.textMuted, fontSize: fontSizes.sm, marginLeft: spacing.sm },
  inputBar: {
    flexDirection: 'row', alignItems: 'flex-end',
    padding: spacing.md, gap: spacing.sm,
    borderTopWidth: 1, borderTopColor: colors.border,
    backgroundColor: colors.surface,
  },
  input: {
    flex: 1, backgroundColor: colors.surfaceAlt, color: colors.text,
    borderRadius: radius.lg, paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm, fontSize: fontSizes.md,
    maxHeight: 120, borderWidth: 1, borderColor: colors.border,
  },
  sendBtn: {
    backgroundColor: colors.primary, paddingHorizontal: spacing.lg,
    paddingVertical: spacing.md - 1, borderRadius: radius.lg,
  },
  sendBtnDisabled: { opacity: 0.4 },
  sendBtnText: { color: colors.bgDeep, fontWeight: '700', fontSize: fontSizes.md },
});
