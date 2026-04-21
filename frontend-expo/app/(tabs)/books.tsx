import { useEffect, useState } from 'react';
import { View, Text, FlatList, TouchableOpacity, StyleSheet, ActivityIndicator } from 'react-native';
import { useRouter } from 'expo-router';
import { useTranslation } from 'react-i18next';
import { api } from '../../lib/api';

export default function BooksScreen() {
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

  return (
    <View style={styles.container}>
      <Text style={styles.header}>{t('nav.books')}</Text>
      {loading ? (
        <ActivityIndicator size="large" color="#7c6aef" />
      ) : (
        <FlatList
          data={books}
          keyExtractor={item => item.id}
          contentContainerStyle={styles.list}
          renderItem={({ item }) => (
            <TouchableOpacity
              style={styles.card}
              onPress={() => router.push(`/books/${item.id}`)}
            >
              <Text style={styles.title}>{item.title}</Text>
              <Text style={styles.meta}>
                {item.genre} · {item.current_chapter} {t('book.chapters')} · {item.total_words}字
              </Text>
            </TouchableOpacity>
          )}
        />
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#0a0a0a', padding: 16 },
  header: { fontSize: 24, fontWeight: '700', color: '#e4e4e4', marginBottom: 16 },
  list: { gap: 10 },
  card: {
    backgroundColor: '#141414',
    borderRadius: 10,
    padding: 14,
    borderWidth: 1,
    borderColor: '#2a2a2a',
  },
  title: { fontSize: 16, fontWeight: '600', color: '#e4e4e4', marginBottom: 6 },
  meta: { color: '#888', fontSize: 13 },
});
