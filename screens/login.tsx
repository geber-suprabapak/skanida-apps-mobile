import { View, Text, TextInput, TouchableOpacity, StyleSheet } from 'react-native';
import Logo from '../components/logo'; // Import Logo

export default function LoginScreen() {
  return (
    <View style={styles.container}>
      {/* Logo */}
      <Logo />

      {/* Judul */}
      <Text style={styles.title}>SKANIDA</Text>
      <Text style={styles.subtitle}>APPS</Text>

      {/* Input Nama */}
      <TextInput style={styles.input} placeholder="Masukkan nama" placeholderTextColor="#aaa" />

      {/* Input Password */}
      <TextInput
        style={styles.input}
        placeholder="Masukkan password"
        placeholderTextColor="#aaa"
        secureTextEntry
      />

      {/* Link Register & Ganti Password */}
      <View style={styles.linkContainer}>
        <TouchableOpacity>
          <Text style={styles.register}>register?</Text>
        </TouchableOpacity>
        <TouchableOpacity>
          <Text style={styles.forgotPassword}>Ganti password</Text>
        </TouchableOpacity>
      </View>

      {/* Tombol Login */}
      <TouchableOpacity style={styles.loginButton}>
        <Text style={styles.loginText}>LOGIN</Text>
      </TouchableOpacity>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#fff',
    alignItems: 'center',
    justifyContent: 'center',
    padding: 20,
  },
  title: {
    fontSize: 24,
    fontWeight: 'bold',
    color: '#F7A400',
  },
  subtitle: {
    fontSize: 18,
    color: '#666',
    marginBottom: 20,
  },
  input: {
    width: '100%',
    height: 50,
    borderWidth: 1,
    borderColor: '#FFD700',
    borderRadius: 10,
    paddingHorizontal: 15,
    marginBottom: 15,
    fontSize: 16,
  },
  linkContainer: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    width: '100%',
    marginBottom: 20,
  },
  register: {
    color: '#007BFF',
    fontSize: 14,
  },
  forgotPassword: {
    fontSize: 14,
    fontStyle: 'italic',
    color: '#333',
  },
  loginButton: {
    backgroundColor: '#FFD700',
    width: '100%',
    paddingVertical: 15,
    alignItems: 'center',
    borderRadius: 10,
  },
  loginText: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#000',
  },
});
