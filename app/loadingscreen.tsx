import React, { useEffect, useRef } from 'react';
import { Animated, View, Text } from 'react-native';

export default function LoadingScreen({ navigation }: any) {
  const fadeAnim = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    // Animasi fade-in logo
    Animated.timing(fadeAnim, {
      toValue: 1,
      duration: 1500,
      useNativeDriver: true,
    }).start();

    // Setelah 3 detik, navigasi ke halaman utama (misal Login)
    setTimeout(() => {
      navigation.replace('index');
    }, 1000);
  }, []);

  return (
    <View className="flex-1 items-center justify-center bg-white">
      <Animated.Image
        source={require('../assets/splash.png')}
        style={[{ width: 120, height: 120, opacity: fadeAnim }]}
      />
      <Text className="mt-2.5 text-xl font-bold text-[#F7A400]">SKANIDA APPS</Text>
    </View>
  );
}
