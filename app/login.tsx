import React, { useState, useEffect } from 'react';
import { 
  View, 
  TextInput, 
  StyleSheet, 
  Text, 
  TouchableOpacity, 
  KeyboardAvoidingView, 
  Platform,
  ActivityIndicator,
  Image,
  Alert
} from 'react-native';
import { useAuth } from '@/hooks/useAuth';
import { useRouter, useSegments } from 'expo-router';
import { FontAwesome } from '@expo/vector-icons';
import { BlurView } from 'expo-blur';
import * as Haptics from 'expo-haptics';

enum AuthMode {
  LOGIN = 'login',
  REGISTER = 'register',
  FORGOT_PASSWORD = 'forgot_password'
}

export default function LoginScreen() {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [authMode, setAuthMode] = useState<AuthMode>(AuthMode.LOGIN);
  const [loading, setLoading] = useState(false);
  
  const { signIn, signUp, resetPassword, user, isLoading } = useAuth();
  const router = useRouter();
  const segments = useSegments();

  // Redirect if user is already logged in, but only after everything is mounted
  useEffect(() => {
    if (!isLoading && user) {
      // Use setTimeout to ensure this happens after rendering cycle
      setTimeout(() => {
        router.replace('/(tabs)');
      }, 0);
    }
  }, [user, isLoading, segments]);

  const handleAuth = async () => {
    if (!email.trim()) {
      Alert.alert('Error', 'Please enter your email');
      return;
    }

    if (authMode === AuthMode.FORGOT_PASSWORD) {
      try {
        setLoading(true);
        await resetPassword(email);
        Alert.alert('Success', 'Password reset email has been sent.');
        setAuthMode(AuthMode.LOGIN);
      } catch (error: any) {
        Alert.alert('Error', error.message || 'Failed to send reset email');
      } finally {
        setLoading(false);
      }
      return;
    }

    if (!password.trim()) {
      Alert.alert('Error', 'Please enter your password');
      return;
    }

    if (authMode === AuthMode.REGISTER) {
      if (password !== confirmPassword) {
        Alert.alert('Error', 'Passwords do not match');
        return;
      }
      if (password.length < 6) {
        Alert.alert('Error', 'Password must be at least 6 characters');
        return;
      }
    }

    try {
      setLoading(true);
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
      
      if (authMode === AuthMode.LOGIN) {
        await signIn(email, password);
      } else {
        await signUp(email, password);
      }
    } catch (error: any) {
      Alert.alert('Authentication Error', error.message);
    } finally {
      setLoading(false);
    }
  };

  const toggleAuthMode = () => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    setAuthMode(authMode === AuthMode.LOGIN ? AuthMode.REGISTER : AuthMode.LOGIN);
  };

  const handleForgotPassword = () => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    setAuthMode(AuthMode.FORGOT_PASSWORD);
  };

  return (
    <KeyboardAvoidingView
      style={styles.container}
      behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
    >
      <View style={styles.innerContainer}>
        <View style={styles.logoContainer}>
          <Image 
            source={require('@/assets/images/logo.png')} 
            style={styles.logo}
            resizeMode="contain"
          />
          <Text style={styles.title}>LiteCal</Text>
          <Text style={styles.subtitle}>Your AI Assistant</Text>
        </View>

        <BlurView intensity={40} style={styles.formContainer}>
          <Text style={styles.formTitle}>
            {authMode === AuthMode.LOGIN ? 'Welcome Back' : 
             authMode === AuthMode.REGISTER ? 'Create Account' : 'Reset Password'}
          </Text>

          <TextInput
            style={styles.input}
            placeholder="Email"
            value={email}
            onChangeText={setEmail}
            autoCapitalize="none"
            keyboardType="email-address"
            placeholderTextColor="#888"
          />

          {authMode !== AuthMode.FORGOT_PASSWORD && (
            <TextInput
              style={styles.input}
              placeholder="Password"
              value={password}
              onChangeText={setPassword}
              secureTextEntry
              placeholderTextColor="#888"
            />
          )}

          {authMode === AuthMode.REGISTER && (
            <TextInput
              style={styles.input}
              placeholder="Confirm Password"
              value={confirmPassword}
              onChangeText={setConfirmPassword}
              secureTextEntry
              placeholderTextColor="#888"
            />
          )}

          <TouchableOpacity 
            style={styles.authButton} 
            onPress={handleAuth}
            disabled={loading}
          >
            {loading ? (
              <ActivityIndicator color="#fff" />
            ) : (
              <Text style={styles.authButtonText}>
                {authMode === AuthMode.LOGIN ? 'Sign In' : 
                 authMode === AuthMode.REGISTER ? 'Sign Up' : 'Send Reset Link'}
              </Text>
            )}
          </TouchableOpacity>

          {authMode !== AuthMode.FORGOT_PASSWORD && (
            <TouchableOpacity style={styles.toggleButton} onPress={toggleAuthMode}>
              <Text style={styles.toggleButtonText}>
                {authMode === AuthMode.LOGIN ? 'Create an account' : 'Already have an account?'}
              </Text>
            </TouchableOpacity>
          )}

          {authMode === AuthMode.LOGIN && (
            <TouchableOpacity style={styles.forgotButton} onPress={handleForgotPassword}>
              <Text style={styles.forgotButtonText}>Forgot Password?</Text>
            </TouchableOpacity>
          )}

          {authMode === AuthMode.FORGOT_PASSWORD && (
            <TouchableOpacity style={styles.toggleButton} onPress={() => setAuthMode(AuthMode.LOGIN)}>
              <Text style={styles.toggleButtonText}>Back to Sign In</Text>
            </TouchableOpacity>
          )}
        </BlurView>
      </View>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#121212',
  },
  innerContainer: {
    flex: 1,
    justifyContent: 'center',
    padding: 20,
  },
  logoContainer: {
    alignItems: 'center',
    marginBottom: 30,
  },
  logo: {
    width: 100,
    height: 100,
    marginBottom: 10,
  },
  title: {
    fontSize: 32,
    fontWeight: 'bold',
    color: '#fff',
    marginBottom: 5,
  },
  subtitle: {
    fontSize: 16,
    color: '#aaa',
    marginBottom: 20,
  },
  formContainer: {
    borderRadius: 15,
    padding: 20,
    paddingVertical: 30,
    overflow: 'hidden',
  },
  formTitle: {
    fontSize: 24,
    fontWeight: 'bold',
    color: '#fff',
    marginBottom: 20,
    textAlign: 'center',
  },
  input: {
    backgroundColor: 'rgba(255, 255, 255, 0.1)',
    borderRadius: 10,
    padding: 15,
    marginBottom: 15,
    color: '#fff',
    fontSize: 16,
  },
  authButton: {
    backgroundColor: '#4a6fff',
    borderRadius: 10,
    padding: 15,
    alignItems: 'center',
    marginTop: 5,
  },
  authButtonText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: 'bold',
  },
  toggleButton: {
    marginTop: 20,
    alignItems: 'center',
  },
  toggleButtonText: {
    color: '#4a6fff',
    fontSize: 14,
  },
  forgotButton: {
    marginTop: 15,
    alignItems: 'center',
  },
  forgotButtonText: {
    color: '#999',
    fontSize: 14,
  },
}); 