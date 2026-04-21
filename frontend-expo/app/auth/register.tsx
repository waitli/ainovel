import { useState } from 'react';
import { View, Text, TextInput, TouchableOpacity, StyleSheet, Alert } from 'react-native';
import { useRouter } from 'expo-router';
import { useTranslation } from 'react-i18next';
import { api } from '../../lib/api';

export default function RegisterScreen() {
  const { t } = useTranslation();
  const router = useRouter();
  const [username, setUsername] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');

  const handleRegister = async () => {
    try {
      await api.register(username, email, password);
      router.back();
    } catch (e: any) {
      Alert.alert('Error', e.message);
    }
  };

  return (
    <View style={styles.container}>
      <Text style={styles.title}>{t('auth.register')}</Text>
      <TextInput style={styles.input} placeholder={t('auth.username')} placeholderTextColor="#555" value={username} onChangeText={setUsername} />
      <TextInput style={styles.input} placeholder={t('auth.email')} placeholderTextColor="#555" value={email} onChangeText={setEmail} keyboardType="email-address" autoCapitalize="none" />
      <TextInput style={styles.input} placeholder={t('auth.password')} placeholderTextColor="#555" value={password} onChangeText={setPassword} secureTextEntry />
      <TouchableOpacity style={styles.btn} onPress={handleRegister}>
        <Text style={styles.btnText}>{t('auth.register')}</Text>
      </TouchableOpacity>
      <TouchableOpacity onPress={() => router.replace('/auth/login')}>
        <Text style={styles.link}>{t('auth.login')}</Text>
      </TouchableOpacity>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#0a0a0a', padding: 24, justifyContent: 'center' },
  title: { fontSize: 28, fontWeight: '700', color: '#e4e4e4', marginBottom: 32, textAlign: 'center' },
  input: {
    backgroundColor: '#1a1a1a', borderRadius: 10, padding: 14,
    color: '#e4e4e4', fontSize: 16, marginBottom: 12, borderWidth: 1, borderColor: '#2a2a2a',
  },
  btn: { backgroundColor: '#7c6aef', borderRadius: 10, padding: 16, alignItems: 'center', marginTop: 8 },
  btnText: { color: '#fff', fontSize: 16, fontWeight: '600' },
  link: { color: '#7c6aef', textAlign: 'center', marginTop: 20, fontSize: 14 },
});
