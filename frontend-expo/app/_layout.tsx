import { useEffect, useState } from 'react';
import { Stack } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { api } from '../lib/api';
import '../i18n';

export default function RootLayout() {
  const [ready, setReady] = useState(false);

  useEffect(() => {
    api.init().then(() => setReady(true));
  }, []);

  if (!ready) return null;

  return (
    <>
      <StatusBar style="auto" />
      <Stack screenOptions={{ headerShown: false }}>
        <Stack.Screen name="(tabs)" />
        <Stack.Screen name="auth/login" options={{ title: 'Login' }} />
        <Stack.Screen name="auth/register" options={{ title: 'Register' }} />
        <Stack.Screen name="books/[id]" options={{ title: 'Book' }} />
        <Stack.Screen name="books/[id]/chapters/[num]" options={{ title: 'Chapter' }} />
        <Stack.Screen name="submit" options={{ title: 'Submit' }} />
      </Stack>
    </>
  );
}
