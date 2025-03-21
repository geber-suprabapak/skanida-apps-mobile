// app/register.tsx
import { useRouter } from 'expo-router';
import React, { useState } from 'react';
import { View, Text, TextInput, TouchableOpacity } from 'react-native';

import useAuthStore from '../../store/authStore';

import { supabase } from '~/utils/supabase';

export default function RegisterScreen() {
  const router = useRouter();
  const setUser = useAuthStore((state) => state.setUser);

  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [errorMessage, setErrorMessage] = useState('');

  const handleRegister = async () => {
    setLoading(true);
    setErrorMessage('');
    const { data, error } = await supabase.auth.signUp({
      email,
      password,
      // Jika Anda menggunakan "magic link" atau email verification yang dikirim otomatis,
      // Supabase akan mengirim link verifikasi ke email pengguna.
    });
    setLoading(false);

    if (error) {
      setErrorMessage(error.message);
      return;
    }

    // Berhasil signUp
    if (data?.user) {
      // Cek apakah email sudah terverifikasi
      if (data.user.email_confirmed_at) {
        // Jika email sudah terverifikasi (mungkin user sudah pernah daftar, dll.)
        setUser(data.user);
        router.replace('/auth/AuthSelector');
      } else {
        alert(
          'Pendaftaran berhasil, namun email Anda belum terverifikasi. Silakan cek inbox untuk memverifikasi email.'
        );
      }
    }
  };

  return (
    <View className="flex-1 items-center justify-center space-y-4 p-4">
      <Text className="text-xl font-bold">Daftar Akun</Text>
      <TextInput
        placeholder="Email"
        value={email}
        onChangeText={setEmail}
        className="w-4/5 rounded border border-gray-300 p-3"
      />
      <TextInput
        placeholder="Password"
        secureTextEntry
        value={password}
        onChangeText={setPassword}
        className="w-4/5 rounded border border-gray-300 p-3"
      />
      {errorMessage ? <Text className="text-sm text-red-500">{errorMessage}</Text> : null}
      <TouchableOpacity
        onPress={handleRegister}
        disabled={loading}
        className="mt-3 rounded bg-blue-500 px-4 py-2">
        <Text className="font-medium text-white">{loading ? 'Loading...' : 'Register'}</Text>
      </TouchableOpacity>
      <TouchableOpacity onPress={() => router.push('/auth/Login')} className="mt-2">
        <Text className="text-blue-500">Sudah punya akun? Login</Text>
      </TouchableOpacity>
    </View>
  );
}
