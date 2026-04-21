import { useEffect, useState } from 'react';
import { View, Text, TouchableOpacity, StyleSheet, Alert } from 'react-native';
import { useRouter } from 'expo-router';
import { useTranslation } from 'react-i18next';
import { api } from '../../lib/api';

export default function ProfileScreen() {
  const { t, i18n } = useTranslation();
  const router = useRouter();
  const [user, setUser] = useState<any>(null);

  useEffect(() => {
    if (api.getToken()) {
      api.getMe().then(setUser).catch(() => setUser(null));
    }
  }, []);

  const handleLogout = async () => {
    await api.logout();
    setUser(null);
  };

  const toggleLang = () => {
    i18n.changeLanguage(i18n.language === 'zh' ? 'en' : 'zh');
  };

  if (!user) {
    return (
      <View style={styles.container}>
        <Text style={styles.header}>{t('nav.profile')}</Text>
        <TouchableOpacity style={styles.btn} onPress={() => router.push('/auth/login')}>
          <Text style={styles.btnText}>{t('auth.login')}</Text>
        </TouchableOpacity>
        <TouchableOpacity style={[styles.btn, styles.btnOutline]} onPress={() => router.push('/auth/register')}>
          <Text style={[styles.btnText, styles.btnOutlineText]}>{t('auth.register')}</Text>
        </TouchableOpacity>
        <TouchableOpacity style={styles.langBtn} onPress={toggleLang}>
          <Text style={styles.langText}>🌐 {i18n.language === 'zh' ? 'English' : '中文'}</Text>
        </TouchableOpacity>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <Text style={styles.header}>{user.username}</Text>
      <Text style={styles.meta}>{user.email}</Text>
      <Text style={[styles.meta, styles.role]}>{user.role === 'admin' ? '👑 Admin' : '📖 Reader'}</Text>

      {user.role === 'admin' && (
        <TouchableOpacity style={styles.btn} onPress={() => router.push('/admin/pending')}>
          <Text style={styles.btnText}>{t('admin.pending')}</Text>
        </TouchableOpacity>
      )}

      <TouchableOpacity style={styles.langBtn} onPress={toggleLang}>
        <Text style={styles.langText}>🌐 {i18n.language === 'zh' ? 'Switch to English' : '切换中文'}</Text>
      </TouchableOpacity>

      <TouchableOpacity style={[styles.btn, styles.btnDanger]} onPress={handleLogout}>
        <Text style={styles.btnText}>{t('auth.logout')}</Text>
      </TouchableOpacity>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#0a0a0a', padding: 16, alignItems: 'center', paddingTop: 60 },
  header: { fontSize: 28, fontWeight: '700', color: '#e4e4e4', marginBottom: 8 },
  meta: { color: '#888', fontSize: 14, marginBottom: 4 },
  role: { color: '#7c6aef', fontSize: 16, marginBottom: 24 },
  btn: {
    backgroundColor: '#7c6aef', borderRadius: 10, paddingVertical: 14,
    paddingHorizontal: 32, marginBottom: 12, width: '100%', alignItems: 'center',
  },
  btnOutline: { backgroundColor: 'transparent', borderWidth: 1, borderColor: '#7c6aef' },
  btnOutlineText: { color: '#7c6aef' },
  btnDanger: { backgroundColor: '#ef4444', marginTop: 20 },
  btnText: { color: '#fff', fontSize: 16, fontWeight: '600' },
  langBtn: { marginTop: 20, padding: 12 },
  langText: { color: '#7c6aef', fontSize: 14 },
});
