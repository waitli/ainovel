import { useEffect, useState } from 'react';
import { View, Text, FlatList, TouchableOpacity, StyleSheet, ActivityIndicator, Alert } from 'react-native';
import { useRouter } from 'expo-router';
import { useTranslation } from 'react-i18next';
import { api } from '../../lib/api';

export default function AdminPendingScreen() {
  const { t } = useTranslation();
  const router = useRouter();
  const [subs, setSubs] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  const load = () => {
    setLoading(true);
    api.getSubmissions('pending')
      .then(data => setSubs(data.books || []))
      .catch(console.error)
      .finally(() => setLoading(false));
  };

  useEffect(load, []);

  const handleApprove = async (id: string) => {
    try {
      await api.approveSubmission(id);
      Alert.alert('Success', 'Book approved! AI generating Chapter 1...');
      load();
    } catch (e: any) {
      Alert.alert('Error', e.message);
    }
  };

  const handleReject = async (id: string) => {
    try {
      await api.rejectSubmission(id, 'Rejected by admin');
      load();
    } catch (e: any) {
      Alert.alert('Error', e.message);
    }
  };

  const riskColor: Record<string, string> = { low: '#22c55e', medium: '#eab308', high: '#ef4444' };

  return (
    <View style={styles.container}>
      <TouchableOpacity onPress={() => router.back()}>
        <Text style={styles.back}>← {t('common.back')}</Text>
      </TouchableOpacity>
      <Text style={styles.header}>{t('admin.pending')}</Text>

      {loading ? (
        <ActivityIndicator size="large" color="#7c6aef" />
      ) : (
        <FlatList
          data={subs}
          keyExtractor={item => item.id}
          contentContainerStyle={styles.list}
          renderItem={({ item }) => {
            let aiReview: any = {};
            try { aiReview = item.ai_review ? JSON.parse(item.ai_review) : {}; } catch {}

            return (
              <View style={styles.card}>
                <Text style={styles.title}>{item.title}</Text>
                <Text style={styles.meta}>{item.genre}</Text>

                {aiReview.suggestion && (
                  <View style={styles.aiBox}>
                    <Text style={styles.aiLabel}>{t('admin.aiReview')}</Text>
                    <View style={styles.aiRow}>
                      <Text style={[styles.aiRisk, { color: riskColor[aiReview.risk_level] || '#888' }]}>
                        {aiReview.risk_level?.toUpperCase()}
                      </Text>
                      <Text style={styles.aiSuggestion}>→ {aiReview.suggestion}</Text>
                    </View>
                    {aiReview.reason && <Text style={styles.aiReason}>{aiReview.reason}</Text>}
                  </View>
                )}

                <View style={styles.actions}>
                  <TouchableOpacity style={styles.approveBtn} onPress={() => handleApprove(item.id)}>
                    <Text style={styles.btnText}>{t('admin.approve')}</Text>
                  </TouchableOpacity>
                  <TouchableOpacity style={styles.rejectBtn} onPress={() => handleReject(item.id)}>
                    <Text style={styles.btnText}>{t('admin.reject')}</Text>
                  </TouchableOpacity>
                </View>
              </View>
            );
          }}
        />
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#0a0a0a', padding: 16 },
  back: { color: '#7c6aef', fontSize: 16, marginBottom: 12 },
  header: { fontSize: 24, fontWeight: '700', color: '#e4e4e4', marginBottom: 16 },
  list: { gap: 12 },
  card: { backgroundColor: '#141414', borderRadius: 12, padding: 16, borderWidth: 1, borderColor: '#2a2a2a' },
  title: { fontSize: 18, fontWeight: '600', color: '#e4e4e4', marginBottom: 4 },
  meta: { color: '#888', fontSize: 13, marginBottom: 12 },
  aiBox: { backgroundColor: '#1a1a1a', borderRadius: 8, padding: 12, marginBottom: 12 },
  aiLabel: { color: '#7c6aef', fontSize: 12, fontWeight: '600', marginBottom: 6 },
  aiRow: { flexDirection: 'row', gap: 8, marginBottom: 4 },
  aiRisk: { fontSize: 13, fontWeight: '700' },
  aiSuggestion: { color: '#aaa', fontSize: 13 },
  aiReason: { color: '#888', fontSize: 12, lineHeight: 18 },
  actions: { flexDirection: 'row', gap: 10 },
  approveBtn: { flex: 1, backgroundColor: '#22c55e', borderRadius: 8, padding: 12, alignItems: 'center' },
  rejectBtn: { flex: 1, backgroundColor: '#ef4444', borderRadius: 8, padding: 12, alignItems: 'center' },
  btnText: { color: '#fff', fontSize: 14, fontWeight: '600' },
});
