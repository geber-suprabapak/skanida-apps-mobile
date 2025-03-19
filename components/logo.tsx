import { Image, StyleSheet } from 'react-native';

export default function Logo() {
  return <Image source={require('../assets/logo.png')} style={styles.logo} />;
}

const styles = StyleSheet.create({
  logo: {
    width: 300, // Bisa diubah sesuai kebutuhan
    height: 300,
    marginBottom: 5,
    resizeMode: 'contain', // Agar gambar tidak terpotong
  },
});
