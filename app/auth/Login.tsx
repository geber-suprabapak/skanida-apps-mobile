// app/Login.tsx
import { useRouter } from 'expo-router';
import React, { useState } from 'react';
import { View, Text, TouchableOpacity, TextInput } from 'react-native';

import useAuthStore from '../../store/authStore';
import { supabase } from '../../utils/supabase';

export default function Login() {
  const router = useRouter();
  const setUser = useAuthStore((state) => state.setUser);

  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [errorMessage, setErrorMessage] = useState('');

  const handleLogin = async () => {
    setLoading(true);
    setErrorMessage('');
    const { data, error } = await supabase.auth.signInWithPassword({
      email,
      password,
    });
    setLoading(false);
    if (error) {
      setErrorMessage(error.message);
    } else {
      setUser(data.user);
      router.replace('/Home');
    }
  };

  return (
    <>
      <View className="flex-1 items-center justify-center space-y-4">
        <Text className="mb-3 text-xl">Login</Text>
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
        {errorMessage ? <Text className="text-red-500">{errorMessage}</Text> : null}
        <TouchableOpacity
          onPress={handleLogin}
          disabled={loading}
          className="mt-3 rounded bg-blue-500 px-4 py-2">
          <Text className="font-medium text-white">{loading ? 'Loading...' : 'Login'}</Text>
        </TouchableOpacity>
              <TouchableOpacity onPress={() => router.push('/auth/Register')} className="mt-2">
                <Text className="text-blue-500">Belum punya akun? Register</Text>
              </TouchableOpacity>
      </View>
    </>
  );
}
