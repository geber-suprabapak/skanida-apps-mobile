// app/home.tsx
import { Stack, useRouter } from 'expo-router';
import { Alert, View, Text, TouchableOpacity } from 'react-native';

import useAuthStore from '~/store/authStore';
import { supabase } from '~/utils/supabase';

export default function HomeScreen() {
  const user = useAuthStore((state) => state.user);
  const setUser = useAuthStore((state) => state.setUser);
  const router = useRouter();

  const handleLogout = async () => {
    await supabase.auth.signOut();
    setUser(null);
    Alert.alert('Logout', 'Berhasil Logout', [
      { text: 'OK', onPress: () => router.replace('/auth/AuthSelector') },
    ]);
  };

  return (
    <>
      <Stack.Screen
        options={{
          headerShown: false,
        }}
      />
      <View className="flex-1 items-center justify-center space-y-3">
        <Text className="gap-5 text-xl">Selamat datang, {user?.email || 'User'}!</Text>
        <TouchableOpacity
          onPress={() => router.push('/attendance/AbsenceReport')}
          className="gap-3 rounded bg-blue-500 px-4 py-2">
          <Text className="font-medium text-white">Absen</Text>
        </TouchableOpacity>
        <TouchableOpacity onPress={handleLogout} className="rounded bg-blue-500 px-4 py-2">
          <Text className="font-medium text-white">Logout</Text>
        </TouchableOpacity>
      </View>
    </>
  );
}
