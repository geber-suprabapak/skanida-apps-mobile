import React, { useEffect, useRef } from 'react';
import { Animated, View, Text, Image, StyleSheet } from 'react-native';

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
      navigation.replace('Login');
    }, 3000);
  }, []);

  return (
    <View style={styles.container}>
      <Animated.Image
        source={require('../assets/logo.png')}
        style={[styles.logo, { opacity: fadeAnim }]}
      />
      <Text style={styles.text}>SKANIDA APPS</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#fff',
    alignItems: 'center',
    justifyContent: 'center',
  },
  logo: {
    width: 120,
    height: 120,
  },
  text: {
    marginTop: 10,
    fontSize: 20,
    fontWeight: 'bold',
    color: '#F7A400',
  },
});
