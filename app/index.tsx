import { useRouter, Stack } from 'expo-router';
import { useEffect, useState } from 'react';
import { View, Text, ActivityIndicator } from 'react-native';

import useAuthStore from '../store/authStore';
import { supabase } from '../utils/supabase';

export default function Home() {
  const setUser = useAuthStore((state) => state.setUser);
  const router = useRouter();
  const [isLoading, setIsLoading] = useState(true);
  const [loadingMessage, setLoadingMessage] = useState('Loading...');

  useEffect(() => {
    const checkAuth = async () => {
      try {
        // Initial loading message
        setLoadingMessage('Loading...');

        // Show initial loading for 1 second
        await new Promise((resolve) => setTimeout(resolve, 1000));

        // Update message to indicate checking session
        setLoadingMessage('Checking session...');

        // Wait another second before actual check
        await new Promise((resolve) => setTimeout(resolve, 1000));

        // Memanggil Supabase untuk cek session
        const {
          data: { session },
          error,
        } = await supabase.auth.getSession();

        if (error) {
          console.log('Terjadi error saat mengambil session:', error.message);
        }

        console.log('Session =>', session);
        if (session?.user) {
          // Jika ada user
          setLoadingMessage('Session found, redirecting...');
          setUser(session.user);
          router.replace('/Home');
          console.log('welcome back');
        } else {
          // Jika tidak ada session
          setLoadingMessage('No session found, redirecting...');
          router.replace('/AuthSelector');
          console.log('welcome to auth selector');
        }
      } catch (err) {
        // Tangani error tak terduga
        console.log('Error tak terduga:', err);
        setLoadingMessage('Error occurred while checking session');
      } finally {
        setIsLoading(false);
      }
    };

    checkAuth();
  }, [router, setUser]);

  return (
    <>
      <Stack.Screen options={{ title: 'Index' }} />
      <View className="flex-1 items-center justify-center p-4">
        <Text className="mb-4 text-xl font-bold">{loadingMessage}</Text>
        <ActivityIndicator size="large" color="#0000ff" />
      </View>
    </>
  );
}
