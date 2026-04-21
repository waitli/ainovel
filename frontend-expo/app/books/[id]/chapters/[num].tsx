import { useEffect, useState } from 'react';
import { View, Text, ScrollView, TouchableOpacity, StyleSheet, ActivityIndicator, Alert } from 'react-native';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { useTranslation } from 'react-i18next';
import { api } from '../../../../lib/api';

export default function ChapterScreen() {
  const { id, num } = useLocalSearchParams<{ id: string; num: string }>();
  const { t } = useTranslation();
  const router = useRouter();
  const [data, setData] = useState<any>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    api.getChapter(id!, parseInt(num!))
      .then(setData)
      .catch(console.error)
      .finally(() => setLoading(false));
  }, [id, num]);

  const handleVote = async (directionId: string) => {
    if (!api.getToken()) {
      router.push('/auth/login');
      return;
    }
    try {
      const result = await api.vote(directionId);
      Alert.alert('Vote', result.triggered ? 'Next chapter is being generated!' : `Vote recorded (${result.current_votes}/${result.threshold})`);
    } catch (e: any) {
      Alert.alert('Error', e.message);
    }
  };

  if (loading) return <View style={styles.center}><ActivityIndicator size="large" color="#7c6aef" /></View>;
  if (!data) return <View style={styles.center}><Text style={styles.error}>Chapter not found</Text></View>;

  const { chapter, content, summary, directions } = data;

  return (
    <ScrollView style={styles.container}>
      <TouchableOpacity onPress={() => router.back()}>
        <Text style={styles.back}>← {t('common.back')}</Text>
      </TouchableOpacity>

      <Text style={styles.chapterTitle}>第{chapter.number}章 {chapter.title}</Text>
      <Text style={styles.meta}>{chapter.word_count}字</Text>

      {summary && (
        <View style={styles.summaryBox}>
          <Text style={styles.summaryTitle}>前情提要</Text>
          <Text style={styles.summaryText}>{summary.slice(0, 200)}</Text>
        </View>
      )}

      <Text style={styles.content}>{content}</Text>

      {directions && directions.length > 0 && (
        <View style={styles.directionsSection}>
          <Text style={styles.dirTitle}>{t('book.directions')}</Text>
          {directions.map((d: any) => (
            <TouchableOpacity
              key={d.id}
              style={[styles.dirCard, d.status === 'won' && styles.dirWon]}
              onPress={() => d.status === 'voting' && handleVote(d.id)}
              disabled={d.status !== 'voting'}
            >
              <Text style={styles.dirName}>方向{d.direction_number}: {d.title}</Text>
              <Text style={styles.dirDesc}>{d.description}</Text>
              {d.status === 'voting' && (
                <Text style={styles.dirVote}>{t('book.vote')} ({d.vote_count}票)</Text>
              )}
              {d.status === 'won' && <Text style={styles.dirWonText}>✓ 已选择</Text>}
            </TouchableOpacity>
          ))}
        </View>
      )}

      <View style={{ height: 60 }} />
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#0a0a0a', padding: 16 },
  center: { flex: 1, backgroundColor: '#0a0a0a', justifyContent: 'center', alignItems: 'center' },
  error: { color: '#ef4444' },
  back: { color: '#7c6aef', fontSize: 16, marginBottom: 12 },
  chapterTitle: { fontSize: 22, fontWeight: '700', color: '#e4e4e4', marginBottom: 4 },
  meta: { color: '#666', fontSize: 13, marginBottom: 16 },
  summaryBox: { backgroundColor: '#1a1a1a', borderRadius: 10, padding: 14, marginBottom: 20 },
  summaryTitle: { color: '#7c6aef', fontSize: 14, fontWeight: '600', marginBottom: 6 },
  summaryText: { color: '#aaa', fontSize: 13, lineHeight: 20 },
  content: { color: '#d4d4d4', fontSize: 16, lineHeight: 28, marginBottom: 24 },
  directionsSection: { marginTop: 16 },
  dirTitle: { color: '#e4e4e4', fontSize: 18, fontWeight: '600', marginBottom: 12 },
  dirCard: {
    backgroundColor: '#141414', borderRadius: 10, padding: 14,
    marginBottom: 10, borderWidth: 1, borderColor: '#2a2a2a',
  },
  dirWon: { borderColor: '#7c6aef', backgroundColor: '#1a1a2e' },
  dirName: { color: '#e4e4e4', fontSize: 15, fontWeight: '600', marginBottom: 4 },
  dirDesc: { color: '#999', fontSize: 13, lineHeight: 20, marginBottom: 8 },
  dirVote: { color: '#7c6aef', fontSize: 13, fontWeight: '600' },
  dirWonText: { color: '#22c55e', fontSize: 13, fontWeight: '600' },
});
