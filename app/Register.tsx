import { useRouter } from "expo-router";
import React, { useState } from "react";
import { YStack, Text, Button, Input } from "tamagui";
import useAuthStore from "../store/authStore";
import { supabase } from "../utils/supabase";

export default function Register() {
  const router = useRouter();
  const setUser = useAuthStore((state) => state.setUser);
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [errorMessage, setErrorMessage] = useState("");

  const handleRegister = async () => {
    setLoading(true);
    setErrorMessage("");
    try {
      const { data, error } = await supabase.auth.signUp({ email, password });
      if (error) throw error;
      alert("Pendaftaran berhasil! Silakan cek email untuk verifikasi.");
      router.push("/Login");
    } catch (err) {
      setErrorMessage(err.message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <YStack flex={1} jc="center" ai="center" space>
      <Text fontSize="$5" fontWeight="bold">Daftar Akun</Text>
      <Input placeholder="Email" value={email} onChangeText={setEmail} size="$4" w="80%" />
      <Input placeholder="Password" secureTextEntry value={password} onChangeText={setPassword} size="$4" w="80%" />
      {errorMessage ? <Text color="red" fontSize="$3">{errorMessage}</Text> : null}
      <Button onPress={handleRegister} disabled={loading} mt="$3">{loading ? "Loading..." : "Register"}</Button>
      <Button onPress={() => router.push("/Login")} mt="$2">Sudah punya akun? Login</Button>
    </YStack>
  );
}
