import React, { useState, useEffect } from 'react';
import { View, Text, TextInput, TouchableOpacity, ActivityIndicator, StyleSheet, Dimensions, ImageBackground, KeyboardAvoidingView, Platform } from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { useNavigation } from '@react-navigation/native';
import { StackNavigationProp } from '@react-navigation/stack';

const { width } = Dimensions.get('window');

type RootStackParamList = {
  Login: undefined;
  Dashboard: undefined;
  Logout: undefined;
  Inventory: undefined;
  TransactionIndex: undefined;
  TransactionCreate: undefined;
  Monitoring: undefined;
};

type LoginNavigationProp = StackNavigationProp<RootStackParamList, 'Login'>;

interface LoginResponse {
  pesan: string;
  user: {
    id: number;
    nama: string;
    email: string;
    role: string;
  };
  token: string;
}

const Login: React.FC = () => {
  const [email, setEmail] = useState<string>('');
  const [password, setPassword] = useState<string>('');
  const [error, setError] = useState<string>('');
  const [loading, setLoading] = useState<boolean>(false);
  const [showPassword, setShowPassword] = useState<boolean>(false);
  const [rememberMe, setRememberMe] = useState<boolean>(false);
  const navigation = useNavigation<LoginNavigationProp>();

  // Load saved credentials on component mount
  useEffect(() => {
    const loadCredentials = async () => {
      try {
        const savedEmail = await AsyncStorage.getItem('savedEmail');
        const savedPassword = await AsyncStorage.getItem('savedPassword');
        const savedRememberMe = await AsyncStorage.getItem('rememberMe');

        if (savedEmail && savedPassword && savedRememberMe === 'true') {
          setEmail(savedEmail);
          setPassword(savedPassword);
          setRememberMe(true);
        }
      } catch (err) {
        console.error('Error loading credentials:', err);
      }
    };
    loadCredentials();
  }, []);

  const handleLogin = async () => {
    setLoading(true);
    setError('');

    try {
      const response = await fetch('https://testingaplikasi.tokosepatusovan.com/api/login', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          email,
          password,
        }),
      });

      const data: LoginResponse = await response.json();

      if (response.ok) {
        console.log(data.pesan); // "Login sukses"
        console.log(data.user); // Data user: id, nama, email, role
        await AsyncStorage.setItem('token', data.token);
        await AsyncStorage.setItem('user', JSON.stringify(data.user));

        // Save credentials if "Remember Me" is checked
        if (rememberMe) {
          await AsyncStorage.setItem('savedEmail', email);
          await AsyncStorage.setItem('savedPassword', password);
          await AsyncStorage.setItem('rememberMe', 'true');
        } else {
          // Clear saved credentials if "Remember Me" is unchecked
          await AsyncStorage.removeItem('savedEmail');
          await AsyncStorage.removeItem('savedPassword');
          await AsyncStorage.removeItem('rememberMe');
        }

        navigation.navigate('Dashboard');
      } else {
        throw new Error(data.pesan || 'Login gagal');
      }
    } catch (err) {
      setError('Login gagal. Periksa email atau password.');
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  return (
    <KeyboardAvoidingView
      style={styles.container}
      behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
      keyboardVerticalOffset={Platform.OS === 'ios' ? 0 : 20}
    >
      <ImageBackground source={require('../../assets/bglogin.png')} style={styles.backgroundImage}>
        <View style={styles.loginCard}>
          <View style={styles.brandCircle}>
            <Text style={styles.brandText}>SEPATU BY{'\n'}SOVAN</Text>
          </View>
          <Text style={styles.loginTitle}>LOGIN</Text>
          <Text style={styles.welcomeText}>Welcome back! Please login to your account</Text>

          <Text style={styles.fieldLabel}>Username</Text>
          <TextInput
            style={styles.input}
            placeholder="Masukkan email"
            placeholderTextColor="#8892B0"
            value={email}
            onChangeText={setEmail}
            autoCapitalize="none"
            keyboardType="email-address"
          />

          <Text style={styles.fieldLabel}>Password</Text>
          <View style={styles.passwordContainer}>
            <TextInput
              style={styles.passwordInput}
              placeholder="Masukkan password"
              placeholderTextColor="#8892B0"
              value={password}
              onChangeText={setPassword}
              secureTextEntry={!showPassword}
            />
            <TouchableOpacity
              style={styles.eyeIcon}
              onPress={() => setShowPassword(!showPassword)}
            >
              <Text style={styles.eyeText}>{showPassword ? '👁️' : '👁️‍🗨️'}</Text>
            </TouchableOpacity>
          </View>

          <View style={styles.rememberMeContainer}>
            <TouchableOpacity
              style={[styles.checkbox, rememberMe && styles.checkboxChecked]}
              onPress={() => setRememberMe(!rememberMe)}
            >
              {rememberMe && <Text style={styles.checkboxText}>✓</Text>}
            </TouchableOpacity>
            <Text style={styles.rememberMeText}>Remember Me</Text>
          </View>

          {error ? <Text style={styles.errorText}>{error}</Text> : null}

          <TouchableOpacity style={styles.forgotPassword}>
            <Text style={styles.forgotText}>
              Lupa sandi? <Text style={styles.clickHere}>Klik disini</Text>
            </Text>
          </TouchableOpacity>

          <TouchableOpacity
            style={[styles.loginButton, loading && styles.loginButtonDisabled]}
            onPress={handleLogin}
            disabled={loading}
          >
            <Text style={styles.loginButtonText}>
              {loading ? 'Loading...' : 'LOGIN'}
            </Text>
            {loading && <ActivityIndicator size="small" color="#FFFFFF" style={{ marginLeft: 10 }} />}
          </TouchableOpacity>
        </View>
      </ImageBackground>
    </KeyboardAvoidingView>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#2A3441',
  },
  backgroundImage: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  loginCard: {
    backgroundColor: '#1E2A3A',
    borderRadius: 20,
    padding: 30,
    width: width * 0.85,
    maxWidth: 400,
    alignItems: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 4.65,
    elevation: 8,
  },
  brandCircle: {
    width: 80,
    height: 80,
    borderRadius: 40,
    backgroundColor: '#4A90E2',
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 20,
  },
  brandText: {
    color: '#FF6B35',
    fontSize: 10,
    fontWeight: 'bold',
    textAlign: 'center',
    lineHeight: 12,
  },
  loginTitle: {
    fontSize: 28,
    fontWeight: 'bold',
    color: '#FF6B35',
    marginBottom: 8,
  },
  welcomeText: {
    fontSize: 14,
    color: '#8892B0',
    marginBottom: 30,
    textAlign: 'center',
  },
  fieldLabel: {
    fontSize: 16,
    color: '#FF6B35',
    alignSelf: 'flex-start',
    marginBottom: 8,
    marginLeft: 5,
  },
  input: {
    width: '100%',
    height: 50,
    backgroundColor: '#E8E8E8',
    borderRadius: 8,
    paddingHorizontal: 15,
    fontSize: 14,
    color: '#2A3441',
    marginBottom: 20,
  },
  passwordContainer: {
    width: '100%',
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 15,
  },
  passwordInput: {
    flex: 1,
    height: 50,
    backgroundColor: '#E8E8E8',
    borderRadius: 8,
    paddingHorizontal: 15,
    fontSize: 14,
    color: '#2A3441',
    paddingRight: 50,
  },
  eyeIcon: {
    position: 'absolute',
    right: 15,
    height: 50,
    justifyContent: 'center',
    alignItems: 'center',
    width: 30,
  },
  eyeText: {
    fontSize: 18,
    color: '#FF6B35',
  },
  rememberMeContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    alignSelf: 'flex-start',
    marginBottom: 15,
    marginLeft: 5,
  },
  checkbox: {
    width: 20,
    height: 20,
    borderWidth: 2,
    borderColor: '#8892B0',
    borderRadius: 4,
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 8,
  },
  checkboxChecked: {
    backgroundColor: '#FF6B35',
    borderColor: '#FF6B35',
  },
  checkboxText: {
    color: '#FFFFFF',
    fontSize: 12,
    fontWeight: 'bold',
  },
  rememberMeText: {
    fontSize: 14,
    color: '#8892B0',
  },
  errorText: {
    fontSize: 14,
    color: 'red',
    marginBottom: 15,
    alignSelf: 'flex-start',
    marginLeft: 5,
  },
  forgotPassword: {
    alignSelf: 'flex-start',
    marginBottom: 30,
    marginLeft: 5,
  },
  forgotText: {
    fontSize: 14,
    color: '#8892B0',
  },
  clickHere: {
    color: '#FF6B35',
    textDecorationLine: 'underline',
  },
  loginButton: {
    width: '100%',
    height: 50,
    backgroundColor: '#FF6B35',
    borderRadius: 8,
    justifyContent: 'center',
    alignItems: 'center',
    flexDirection: 'row',
  },
  loginButtonDisabled: {
    backgroundColor: '#FF8C66',
  },
  loginButtonText: {
    fontSize: 16,
    fontWeight: 'bold',
    color: '#FFFFFF',
    letterSpacing: 1,
  },
});

export default Login;