import { useEffect, useState } from 'react';
import { View, Text, FlatList, TouchableOpacity, StyleSheet, ActivityIndicator } from 'react-native';
import { useRouter } from 'expo-router';
import { useTranslation } from 'react-i18next';
import { api } from '../../lib/api';

export default function HomeScreen() {
  const { t } = useTranslation();
  const router = useRouter();
  const [books, setBooks] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    api.getBooks({ status: 'active' })
      .then(data => setBooks(data.books || []))
      .catch(console.error)
      .finally(() => setLoading(false));
  }, []);

  const renderBook = ({ item }: { item: any }) => (
    <TouchableOpacity
      style={styles.card}
      onPress={() => router.push(`/books/${item.id}`)}
    >
      <Text style={styles.title}>{item.title}</Text>
      <View style={styles.tagRow}>
        <Text style={styles.tag}>{item.genre}</Text>
        <Text style={styles.chapterCount}>
          {item.current_chapter} {t('book.chapters')}
        </Text>
      </View>
      {item.synopsis && <Text style={styles.synopsis} numberOfLines={2}>{item.synopsis}</Text>}
    </TouchableOpacity>
  );

  return (
    <View style={styles.container}>
      <Text style={styles.header}>{t('home.title')}</Text>
      <Text style={styles.subheader}>{t('home.subtitle')}</Text>

      <Text style={styles.sectionTitle}>{t('home.latest')}</Text>

      {loading ? (
        <ActivityIndicator size="large" color="#7c6aef" />
      ) : books.length === 0 ? (
        <Text style={styles.empty}>{t('home.empty')}</Text>
      ) : (
        <FlatList
          data={books}
          renderItem={renderBook}
          keyExtractor={item => item.id}
          contentContainerStyle={styles.list}
        />
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#0a0a0a', padding: 16 },
  header: { fontSize: 28, fontWeight: '700', color: '#e4e4e4', marginBottom: 4 },
  subheader: { fontSize: 14, color: '#888', marginBottom: 24 },
  sectionTitle: { fontSize: 20, fontWeight: '600', color: '#e4e4e4', marginBottom: 12 },
  list: { gap: 12 },
  card: {
    backgroundColor: '#141414',
    borderRadius: 12,
    padding: 16,
    borderWidth: 1,
    borderColor: '#2a2a2a',
  },
  title: { fontSize: 18, fontWeight: '600', color: '#e4e4e4', marginBottom: 8 },
  tagRow: { flexDirection: 'row', gap: 8, marginBottom: 8 },
  tag: {
    backgroundColor: '#7c6aef',
    color: '#fff',
    fontSize: 12,
    paddingHorizontal: 10,
    paddingVertical: 3,
    borderRadius: 10,
    overflow: 'hidden',
  },
  chapterCount: { color: '#888', fontSize: 12, lineHeight: 20 },
  synopsis: { color: '#999', fontSize: 13 },
  empty: { color: '#888', textAlign: 'center', marginTop: 40 },
});
