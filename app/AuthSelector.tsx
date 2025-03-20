// app/login.tsx
import { useRouter, Stack } from 'expo-router';
import React from 'react';
import { View, Text, TouchableOpacity } from 'react-native';

export default function LoginScreen() {
  const router = useRouter();

  return (
    <>
      <Stack.Screen
        options={{
          headerShown: false, // Jika Anda ingin menghilangkan seluruh header, bisa pakai ini
        }}
      />
      <View className="flex-1 items-center justify-center space-y-4 p-4">
        <Text className="mb-3 text-xl font-medium">Silahkan Login atau Register</Text>
        <TouchableOpacity
          className="w-40 items-center rounded-md bg-blue-500 px-4 py-2"
          onPress={() => router.push('/Login')}>
          <Text className="font-medium text-white">Login</Text>
        </TouchableOpacity>
        <TouchableOpacity
          className="w-40 items-center rounded-md bg-blue-500 px-4 py-2"
          onPress={() => router.push('/Register')}>
          <Text className="font-medium text-white">Register</Text>
        </TouchableOpacity>
        <TouchableOpacity
          className="w-40 items-center rounded-md bg-blue-500 px-4 py-2"
          onPress={() => router.push('/AbsenceReport')}>
          <Text className="font-medium text-white">TO REPORT</Text>
        </TouchableOpacity>
      </View>
    </>
  );
}
