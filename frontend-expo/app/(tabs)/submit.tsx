import { useState } from 'react';
import { View, Text, TextInput, TouchableOpacity, StyleSheet, ScrollView, Alert } from 'react-native';
import { useRouter } from 'expo-router';
import { useTranslation } from 'react-i18next';
import { api } from '../../lib/api';

const GENRES = ['玄幻', '仙侠', '科幻', '都市', '历史', '武侠', '悬疑', '奇幻', '言情', 'Fantasy', 'Sci-Fi', 'Romance', 'Thriller'];

export default function SubmitScreen() {
  const { t } = useTranslation();
  const router = useRouter();
  const [title, setTitle] = useState('');
  const [genre, setGenre] = useState('玄幻');
  const [worldview, setWorldview] = useState('');
  const [outline, setOutline] = useState('');
  const [conflict, setConflict] = useState('');
  const [tone, setTone] = useState('');
  const [charName, setCharName] = useState('');
  const [charAppearance, setCharAppearance] = useState('');
  const [charPersonality, setCharPersonality] = useState('');
  const [charMotivation, setCharMotivation] = useState('');
  const [charBackstory, setCharBackstory] = useState('');
  const [submitting, setSubmitting] = useState(false);

  const handleSubmit = async () => {
    if (!api.getToken()) {
      router.push('/auth/login');
      return;
    }
    if (!title || !worldview || !outline || !conflict || !charName) {
      Alert.alert('Error', 'Please fill all required fields');
      return;
    }

    setSubmitting(true);
    try {
      const result = await api.submitBook({
        title, genre, worldview, outline,
        core_conflict: conflict, tone,
        characters: [{
          name: charName, role: 'protagonist',
          appearance: charAppearance, personality: charPersonality,
          motivation: charMotivation, backstory: charBackstory,
        }],
      });
      Alert.alert('Success', `Submitted! AI will review your submission.\nSuggestion: ${result.ai_suggestion}\nRisk: ${result.ai_risk}`);
      router.back();
    } catch (e: any) {
      Alert.alert('Error', e.message);
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <ScrollView style={styles.container}>
      <Text style={styles.header}>{t('submit.title')}</Text>

      <Text style={styles.label}>{t('submit.bookTitle')} *</Text>
      <TextInput style={styles.input} value={title} onChangeText={setTitle} placeholder="Novel title" placeholderTextColor="#555" />

      <Text style={styles.label}>{t('submit.genre')}</Text>
      <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.genreRow}>
        {GENRES.map(g => (
          <TouchableOpacity
            key={g}
            style={[styles.genreTag, genre === g && styles.genreTagActive]}
            onPress={() => setGenre(g)}
          >
            <Text style={[styles.genreText, genre === g && styles.genreTextActive]}>{g}</Text>
          </TouchableOpacity>
        ))}
      </ScrollView>

      <Text style={styles.label}>{t('submit.worldview')} *</Text>
      <TextInput style={[styles.input, styles.multiline]} value={worldview} onChangeText={setWorldview} multiline placeholder="World setting, rules, factions..." placeholderTextColor="#555" />

      <Text style={styles.label}>{t('submit.outline')} *</Text>
      <TextInput style={[styles.input, styles.multiline]} value={outline} onChangeText={setOutline} multiline placeholder="Main plot from beginning to end..." placeholderTextColor="#555" />

      <Text style={styles.label}>{t('submit.conflict')} *</Text>
      <TextInput style={[styles.input, styles.multiline]} value={conflict} onChangeText={setConflict} multiline placeholder="Core conflict driving the story..." placeholderTextColor="#555" />

      <Text style={styles.label}>{t('submit.tone')}</Text>
      <TextInput style={styles.input} value={tone} onChangeText={setTone} placeholder="e.g. Dark, Comedic, Epic" placeholderTextColor="#555" />

      <Text style={styles.sectionTitle}>{t('submit.characters')}</Text>

      <Text style={styles.label}>{t('submit.characterName')} *</Text>
      <TextInput style={styles.input} value={charName} onChangeText={setCharName} placeholder="Character name" placeholderTextColor="#555" />

      <Text style={styles.label}>{t('submit.appearance')}</Text>
      <TextInput style={styles.input} value={charAppearance} onChangeText={setCharAppearance} placeholder="Physical description" placeholderTextColor="#555" />

      <Text style={styles.label}>{t('submit.personality')}</Text>
      <TextInput style={styles.input} value={charPersonality} onChangeText={setCharPersonality} placeholder="Personality traits" placeholderTextColor="#555" />

      <Text style={styles.label}>{t('submit.motivation')}</Text>
      <TextInput style={styles.input} value={charMotivation} onChangeText={setCharMotivation} placeholder="What drives them" placeholderTextColor="#555" />

      <Text style={styles.label}>{t('submit.backstory')}</Text>
      <TextInput style={[styles.input, styles.multiline]} value={charBackstory} onChangeText={setCharBackstory} multiline placeholder="Background story" placeholderTextColor="#555" />

      <TouchableOpacity style={styles.submitBtn} onPress={handleSubmit} disabled={submitting}>
        <Text style={styles.submitText}>{submitting ? '...' : t('submit.submit')}</Text>
      </TouchableOpacity>

      <View style={{ height: 40 }} />
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#0a0a0a', padding: 16 },
  header: { fontSize: 24, fontWeight: '700', color: '#e4e4e4', marginBottom: 20 },
  label: { color: '#aaa', fontSize: 13, marginBottom: 6, marginTop: 12 },
  input: {
    backgroundColor: '#1a1a1a', borderRadius: 8, padding: 12,
    color: '#e4e4e4', fontSize: 14, borderWidth: 1, borderColor: '#2a2a2a',
  },
  multiline: { minHeight: 80, textAlignVertical: 'top' },
  sectionTitle: { color: '#7c6aef', fontSize: 18, fontWeight: '600', marginTop: 20, marginBottom: 8 },
  genreRow: { flexDirection: 'row', marginBottom: 8 },
  genreTag: {
    paddingHorizontal: 14, paddingVertical: 6, borderRadius: 16,
    backgroundColor: '#1a1a1a', borderWidth: 1, borderColor: '#2a2a2a', marginRight: 8,
  },
  genreTagActive: { backgroundColor: '#7c6aef', borderColor: '#7c6aef' },
  genreText: { color: '#888', fontSize: 13 },
  genreTextActive: { color: '#fff' },
  submitBtn: {
    backgroundColor: '#7c6aef', borderRadius: 10, padding: 16,
    alignItems: 'center', marginTop: 24,
  },
  submitText: { color: '#fff', fontSize: 16, fontWeight: '600' },
});
