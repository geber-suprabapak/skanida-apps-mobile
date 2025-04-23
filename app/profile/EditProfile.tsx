import { useRouter, Stack } from "expo-router";
import React, { useState } from "react";
import { View, Text, TextInput, Alert } from "react-native";

import { Button } from "~/components/Button";
import useAuthStore from "~/store/authStore";
import { supabase } from "~/utils/supabase";

export default function EditProfile() {
  const user = useAuthStore((state) => state.user);
  const setUser = useAuthStore((state) => state.setUser);
  const router = useRouter();

  const [name, setName] = useState(user?.user_metadata?.name || "");
  const [phone, setPhone] = useState(user?.user_metadata?.phone || "");
  const [loading, setLoading] = useState(false);

  const handleSave = async () => {
    if (!name) {
      Alert.alert("Error", "Nama tidak boleh kosong");
      return;
    }
    setLoading(true);
    try {
      // Update profile di Supabase
      const { error } = await supabase.auth.updateUser({
        data: { name, phone },
      });
      if (error) {
        Alert.alert("Error", error.message);
        return;
      }
      // Ambil ulang user terbaru dari Supabase
      const { data: userData, error: userError } =
        await supabase.auth.getUser();
      if (userError || !userData?.user) {
        Alert.alert("Error", "Gagal mengambil data user terbaru");
        return;
      }
      setUser(userData.user);
      Alert.alert("Sukses", "Profil berhasil diperbarui", [
        { text: "OK", onPress: () => router.back() },
      ]);
      // eslint-disable-next-line @typescript-eslint/no-unused-vars
    } catch (err) {
      Alert.alert("Error", "Gagal memperbarui profil");
    } finally {
      setLoading(false);
    }
  };

  return (
    <View className="flex-1 p-6 bg-white justify-center">
      <Stack.Screen options={{ title: "Edit Profil" }} />
      <Text className="text-2xl font-bold mb-6 text-center">Edit Profil</Text>
      <View className="mb-4">
        <Text className="mb-2 text-gray-700">Nama</Text>
        <TextInput
          className="border border-gray-300 rounded-lg px-4 py-2.5"
          placeholder="Nama lengkap"
          value={name}
          onChangeText={setName}
        />
      </View>
      <View className="mb-6">
        <Text className="mb-2 text-gray-700">No. Telepon</Text>
        <TextInput
          className="border border-gray-300 rounded-lg px-4 py-2.5"
          placeholder="Nomor telepon"
          value={phone}
          onChangeText={setPhone}
          keyboardType="phone-pad"
        />
      </View>
      <Button
        variant="primary"
        size="large"
        loading={loading}
        onPress={handleSave}
        className="mb-4"
      >
        Simpan
      </Button>
      <Button variant="outline" size="large" onPress={() => router.back()}>
        Batal
      </Button>
    </View>
  );
}
