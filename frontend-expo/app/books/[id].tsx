import { useEffect, useState } from 'react';
import { View, Text, FlatList, TouchableOpacity, StyleSheet, ActivityIndicator, ScrollView } from 'react-native';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { useTranslation } from 'react-i18next';
import { api } from '../../lib/api';

export default function BookDetailScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const { t } = useTranslation();
  const router = useRouter();
  const [book, setBook] = useState<any>(null);
  const [chapters, setChapters] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    Promise.all([
      api.getBook(id!),
      api.getChapters(id!),
    ]).then(([b, c]) => {
      setBook(b);
      setChapters(c.chapters || []);
    }).catch(console.error).finally(() => setLoading(false));
  }, [id]);

  if (loading) return <View style={styles.center}><ActivityIndicator size="large" color="#7c6aef" /></View>;
  if (!book) return <View style={styles.center}><Text style={styles.error}>Book not found</Text></View>;

  return (
    <ScrollView style={styles.container}>
      <TouchableOpacity onPress={() => router.back()}>
        <Text style={styles.back}>← {t('common.back')}</Text>
      </TouchableOpacity>

      <Text style={styles.title}>{book.title}</Text>
      <View style={styles.tagRow}>
        <Text style={styles.tag}>{book.genre}</Text>
        <Text style={styles.meta}>{book.current_chapter} {t('book.chapters')} · {book.total_words}字</Text>
      </View>

      {book.synopsis && <Text style={styles.synopsis}>{book.synopsis}</Text>}

      <Text style={styles.sectionTitle}>目录</Text>
      {chapters.map((ch) => (
        <TouchableOpacity
          key={ch.chapter_number}
          style={styles.chapterItem}
          onPress={() => router.push(`/books/${id}/chapters/${ch.chapter_number}`)}
        >
          <Text style={styles.chapterTitle}>第{ch.chapter_number}章 {ch.title}</Text>
          <Text style={styles.chapterMeta}>{ch.word_count}字</Text>
        </TouchableOpacity>
      ))}

      <TouchableOpacity style={styles.charBtn} onPress={() => {}}>
        <Text style={styles.charBtnText}>{t('book.applyCharacter')}</Text>
      </TouchableOpacity>

      <View style={{ height: 40 }} />
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#0a0a0a', padding: 16 },
  center: { flex: 1, backgroundColor: '#0a0a0a', justifyContent: 'center', alignItems: 'center' },
  error: { color: '#ef4444' },
  back: { color: '#7c6aef', fontSize: 16, marginBottom: 12 },
  title: { fontSize: 24, fontWeight: '700', color: '#e4e4e4', marginBottom: 8 },
  tagRow: { flexDirection: 'row', gap: 10, marginBottom: 12, alignItems: 'center' },
  tag: { backgroundColor: '#7c6aef', color: '#fff', fontSize: 12, paddingHorizontal: 10, paddingVertical: 3, borderRadius: 10 },
  meta: { color: '#888', fontSize: 13 },
  synopsis: { color: '#aaa', fontSize: 14, lineHeight: 22, marginBottom: 20 },
  sectionTitle: { color: '#e4e4e4', fontSize: 18, fontWeight: '600', marginBottom: 12 },
  chapterItem: {
    flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center',
    paddingVertical: 12, borderBottomWidth: 1, borderBottomColor: '#1a1a1a',
  },
  chapterTitle: { color: '#e4e4e4', fontSize: 15, flex: 1 },
  chapterMeta: { color: '#666', fontSize: 12 },
  charBtn: { backgroundColor: '#1a1a1a', borderRadius: 10, padding: 14, alignItems: 'center', marginTop: 20, borderWidth: 1, borderColor: '#7c6aef' },
  charBtnText: { color: '#7c6aef', fontSize: 15, fontWeight: '600' },
});
