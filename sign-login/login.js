import React, { useState } from 'react';
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  StyleSheet,
  Alert,
  KeyboardAvoidingView,
  Platform,
  ScrollView,
  Keyboard,
  TouchableWithoutFeedback,
  ActivityIndicator,
  Modal,
  Image,
} from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { auth } from '../services/firebaseConfig';
import { 
  signInWithEmailAndPassword, 
  sendPasswordResetEmail,
  sendEmailVerification,
} from 'firebase/auth';

export default function Login({ navigation }) {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [emailFocused, setEmailFocused] = useState(false);
  const [passwordFocused, setPasswordFocused] = useState(false);
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  
  const [resetModalVisible, setResetModalVisible] = useState(false);
  const [resetEmail, setResetEmail] = useState('');
  const [resetLoading, setResetLoading] = useState(false);

  const handleLogin = async () => {
    Keyboard.dismiss();
    
    if (!email.trim() || !password) {
      Alert.alert('Error', 'Please fill in all fields');
      return;
    }

    setLoading(true);

    try {
      // Sign in the user
      const userCredential = await signInWithEmailAndPassword(
        auth, 
        email.trim(), 
        password
      );
      
      let user = userCredential.user;

      // Force reload to get the latest emailVerified status from Firebase
      await user.reload();
      user = auth.currentUser; // Get the refreshed user object

      console.log('User email verified status:', user.emailVerified);

      // Check if email is verified
      if (!user.emailVerified) {
        // Sign out immediately if email is not verified
        await auth.signOut();
        setLoading(false);
        
        // Show alert with option to resend verification email
        Alert.alert(
          'Email Not Verified',
          'Please verify your email address before logging in. Check your inbox for the verification link.\n\nWould you like us to resend the verification email?',
          [
            { 
              text: 'Cancel', 
              style: 'cancel' 
            },
            {
              text: 'Resend Email',
              onPress: async () => {
                setLoading(true);
                try {
                  // Sign in again temporarily to send verification email
                  const tempCredential = await signInWithEmailAndPassword(
                    auth,
                    email.trim(),
                    password
                  );
                  await sendEmailVerification(tempCredential.user);
                  await auth.signOut();
                  setLoading(false);
                  Alert.alert(
                    'Verification Email Sent',
                    'A new verification email has been sent to your inbox. Please check your email and click the verification link.'
                  );
                } catch (error) {
                  console.error('Error resending verification email:', error);
                  setLoading(false);
                  Alert.alert('Error', 'Failed to send verification email. Please try again later.');
                }
              }
            }
          ]
        );
        return;
      }
      
      // User is verified, proceed with login
      // Get or create user data in AsyncStorage
      let userData = await AsyncStorage.getItem('userData');
      
      if (userData) {
        // Update existing data
        const existingData = JSON.parse(userData);
        const updatedData = {
          ...existingData,
          email: user.email,
          uid: user.uid,
          name: existingData.name || user.displayName || 'User',
          emailVerified: user.emailVerified,
        };
        await AsyncStorage.setItem('userData', JSON.stringify(updatedData));
      } else {
        // Create new user data
        const newUserData = {
          name: user.displayName || 'User',
          age: '',
          email: user.email,
          uid: user.uid,
          emailVerified: user.emailVerified,
        };
        await AsyncStorage.setItem('userData', JSON.stringify(newUserData));
      }

      setLoading(false);
      // Navigation will be handled by auth state listener in your App.js

    } catch (error) {
      console.error('Login error:', error);
      setLoading(false);
      
      let errorMessage = 'Login failed. Please try again.';

      switch (error.code) {
        case 'auth/invalid-credential':
        case 'auth/wrong-password':
          errorMessage = 'Invalid email or password. Please check your credentials and try again.';
          break;
        case 'auth/user-not-found':
          errorMessage = 'No account found with this email address. Please sign up first.';
          break;
        case 'auth/user-disabled':
          errorMessage = 'This account has been disabled. Please contact support.';
          break;
        case 'auth/too-many-requests':
          errorMessage = 'Too many failed login attempts. Please try again later or reset your password.';
          break;
        case 'auth/network-request-failed':
          errorMessage = 'Network error. Please check your internet connection and try again.';
          break;
        case 'auth/invalid-email':
          errorMessage = 'Invalid email format. Please enter a valid email address.';
          break;
      }
      Alert.alert('Login Failed', errorMessage);
    }
  };

  const handleForgotPassword = () => {
    setResetEmail(email);
    setResetModalVisible(true);
  };

  const handleSendPasswordReset = async () => {
    if (!resetEmail.trim()) {
      Alert.alert('Error', 'Please enter your email address');
      return;
    }

    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(resetEmail.trim())) {
      Alert.alert('Error', 'Please enter a valid email address');
      return;
    }

    setResetLoading(true);

    try {
      await sendPasswordResetEmail(auth, resetEmail.trim());
      setResetModalVisible(false);
      setResetEmail('');
      setResetLoading(false);
      Alert.alert(
        'Password Reset Email Sent',
        'A password reset link has been sent to your email address. Please check your inbox.'
      );
    } catch (error) {
      console.error('Password reset error:', error);
      setResetLoading(false);
      
      let errorMessage = 'Failed to send reset email. Please try again.';
      switch (error.code) {
        case 'auth/user-not-found':
          errorMessage = 'No account found with this email address.';
          break;
        case 'auth/invalid-email':
          errorMessage = 'Invalid email address format.';
          break;
        case 'auth/too-many-requests':
          errorMessage = 'Too many requests. Please try again later.';
          break;
        case 'auth/network-request-failed':
          errorMessage = 'Network error. Please check your connection.';
          break;
      }
      Alert.alert('Reset Failed', errorMessage);
    }
  };

  const closeResetModal = () => {
    setResetModalVisible(false);
    setResetEmail('');
  };

  return (
    <KeyboardAvoidingView 
      style={styles.container} 
      behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
      keyboardVerticalOffset={Platform.OS === 'ios' ? 64 : 0}
    >
      <TouchableWithoutFeedback onPress={Keyboard.dismiss}>
        <ScrollView 
          style={styles.scrollView}
          showsVerticalScrollIndicator={false}
          contentContainerStyle={styles.scrollContent}
          keyboardShouldPersistTaps="handled"
          bounces={false}
        >
          <View style={styles.loginContainer}>
            <View style={styles.logoContainer}>
              <View style={styles.logoCircle}>
                <Image
                  source={require('../assets/logos.png')}
                  style={{ width: 150, height: 150, tintColor: '#9D4EDD' }}
                  resizeMode="contain"
                />
              </View>
            </View>
            <Text style={styles.title}>Welcome Back</Text>
            <Text style={styles.subtitle}>Sign in to manage your medications</Text>
            
            <View style={styles.inputContainer}>
              <Text style={styles.label}>Email</Text>
              <View style={[
                styles.inputWrapper,
                emailFocused && styles.inputWrapperFocused
              ]}>
                <TextInput
                  style={styles.input}
                  placeholder="Enter your email"
                  placeholderTextColor="#999"
                  value={email}
                  onChangeText={setEmail}
                  onFocus={() => setEmailFocused(true)}
                  onBlur={() => setEmailFocused(false)}
                  keyboardType="email-address"
                  autoCapitalize="none"
                  autoCorrect={false}
                  returnKeyType="next"
                  editable={!loading}
                />
              </View>
            </View>

            <View style={styles.inputContainer}>
              <Text style={styles.label}>Password</Text>
              <View style={[
                styles.inputWrapper,
                passwordFocused && styles.inputWrapperFocused
              ]}>
                <TextInput
                  style={styles.inputWithIcon}
                  placeholder="Enter your password"
                  placeholderTextColor="#999"
                  value={password}
                  onChangeText={setPassword}
                  onFocus={() => setPasswordFocused(true)}
                  onBlur={() => setPasswordFocused(false)}
                  secureTextEntry={!showPassword}
                  autoCapitalize="none"
                  returnKeyType="done"
                  onSubmitEditing={handleLogin}
                  editable={!loading}
                />
                <TouchableOpacity
                  style={styles.eyeIcon}
                  onPress={() => setShowPassword(!showPassword)}
                  disabled={loading}
                >
                  <Image
                    source={showPassword 
                      ? require('../assets/eye-open.png') 
                      : require('../assets/eye-closed.png')
                    }
                    style={styles.eyeIconImage}
                  />
                </TouchableOpacity>
              </View>
            </View>

            <TouchableOpacity
              style={styles.forgotPasswordButton}
              onPress={handleForgotPassword}
              disabled={loading}
            >
              <Text style={styles.forgotPasswordText}>Forgot Password?</Text>
            </TouchableOpacity>

            <TouchableOpacity
              style={[styles.loginButton, loading && styles.loginButtonDisabled]}
              onPress={handleLogin}
              activeOpacity={0.8}
              disabled={loading}
            >
              {loading ? (
                <ActivityIndicator color="#fff" />
              ) : (
                <Text style={styles.loginButtonText}>Login</Text>
              )}
            </TouchableOpacity>

            <View style={styles.signupContainer}>
              <Text style={styles.signupText}>Don't have an account? </Text>
              <TouchableOpacity 
                onPress={() => navigation.navigate('SignUp')}
                disabled={loading}
              >
                <Text style={styles.signupLink}>Create Account</Text>
              </TouchableOpacity>
            </View>
          </View>
        </ScrollView>
      </TouchableWithoutFeedback>

      <Modal
        animationType="fade"
        transparent={true}
        visible={resetModalVisible}
        onRequestClose={closeResetModal}
      >
        <TouchableWithoutFeedback onPress={closeResetModal}>
          <View style={styles.modalOverlay}>
            <TouchableWithoutFeedback>
              <View style={styles.modalContent}>
                <Text style={styles.modalTitle}>Reset Password</Text>
                <Text style={styles.modalSubtitle}>
                  Enter your email address and we'll send you a link to reset your password.
                </Text>

                <View style={styles.modalInputContainer}>
                  <Text style={styles.modalLabel}>Email Address</Text>
                  <TextInput
                    style={styles.modalInput}
                    placeholder="Enter your email"
                    placeholderTextColor="#999"
                    value={resetEmail}
                    onChangeText={setResetEmail}
                    keyboardType="email-address"
                    autoCapitalize="none"
                    autoCorrect={false}
                    editable={!resetLoading}
                  />
                </View>

                <View style={styles.modalButtons}>
                  <TouchableOpacity
                    style={[styles.modalButton, styles.modalButtonCancel]}
                    onPress={closeResetModal}
                    disabled={resetLoading}
                  >
                    <Text style={styles.modalButtonTextCancel}>Cancel</Text>
                  </TouchableOpacity>

                  <TouchableOpacity
                    style={[styles.modalButton, styles.modalButtonSend]}
                    onPress={handleSendPasswordReset}
                    disabled={resetLoading}
                  >
                    {resetLoading ? (
                      <ActivityIndicator color="#fff" size="small" />
                    ) : (
                      <Text style={styles.modalButtonTextSend}>Send Link</Text>
                    )}
                  </TouchableOpacity>
                </View>
              </View>
            </TouchableWithoutFeedback>
          </View>
        </TouchableWithoutFeedback>
      </Modal>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#F3F0FF',
  },
  scrollView: {
    flex: 1,
  },
  scrollContent: {
    flexGrow: 1,
    justifyContent: 'center',
    padding: 20,
    paddingBottom: 40,
  },
  loginContainer: {
    backgroundColor: 'white',
    borderRadius: 24,
    padding: 32,
    shadowColor: '#9D4EDD',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.1,
    shadowRadius: 12,
    elevation: 8,
  },
  logoContainer: {
    alignItems: 'center',
    marginBottom: 5,
  },
  title: {
    fontSize: 32,
    fontWeight: 'bold',
    color: '#1A1A1A',
    marginBottom: 8,
    textAlign: 'center',
  },
  subtitle: {
    fontSize: 15,
    color: '#666',
    marginBottom: 32,
    textAlign: 'center',
  },
  inputContainer: {
    marginBottom: 20,
  },
  label: {
    fontSize: 14,
    fontWeight: '600',
    color: '#1A1A1A',
    marginBottom: 10,
  },
  inputWrapper: {
    backgroundColor: '#F8F8F8',
    borderRadius: 12,
    borderWidth: 2,
    borderColor: '#F8F8F8',
    flexDirection: 'row',
    alignItems: 'center',
  },
  inputWrapperFocused: {
    backgroundColor: '#FFFFFF',
    borderColor: '#9D4EDD',
  },
  input: {
    padding: 16,
    fontSize: 16,
    color: '#1A1A1A',
    flex: 1,
  },
  inputWithIcon: {
    padding: 16,
    paddingRight: 50,
    fontSize: 16,
    color: '#1A1A1A',
    flex: 1,
  },
  eyeIcon: {
    position: 'absolute',
    right: 16,
    padding: 4,
  },
  eyeIconImage: {
    width: 24,
    height: 24,
    tintColor: '#666',
  },
  forgotPasswordButton: {
    alignSelf: 'flex-end',
    marginBottom: 24,
    marginTop: 4,
    paddingVertical: 4,
  },
  forgotPasswordText: {
    color: '#9D4EDD',
    fontSize: 14,
    fontWeight: '600',
  },
  loginButton: {
    backgroundColor: '#9D4EDD',
    borderRadius: 12,
    padding: 18,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 20,
    shadowColor: '#9D4EDD',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 8,
    elevation: 4,
    minHeight: 56,
  },
  loginButtonDisabled: {
    opacity: 0.7,
  },
  loginButtonText: {
    color: 'white',
    fontSize: 17,
    fontWeight: 'bold',
    letterSpacing: 0.5,
  },
  signupContainer: {
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
    marginTop: 8,
  },
  signupText: {
    color: '#666',
    fontSize: 15,
  },
  signupLink: {
    color: '#9D4EDD',
    fontSize: 15,
    fontWeight: 'bold',
  },
  // Modal Styles
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
    justifyContent: 'center',
    alignItems: 'center',
    padding: 20,
  },
  modalContent: {
    backgroundColor: 'white',
    borderRadius: 20,
    padding: 24,
    width: '100%',
    maxWidth: 400,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.25,
    shadowRadius: 4,
    elevation: 5,
  },
  modalTitle: {
    fontSize: 24,
    fontWeight: 'bold',
    color: '#1A1A1A',
    marginBottom: 8,
    textAlign: 'center',
  },
  modalSubtitle: {
    fontSize: 14,
    color: '#666',
    marginBottom: 24,
    textAlign: 'center',
    lineHeight: 20,
  },
  modalInputContainer: {
    marginBottom: 24,
  },
  modalLabel: {
    fontSize: 14,
    fontWeight: '600',
    color: '#1A1A1A',
    marginBottom: 8,
  },
  modalInput: {
    backgroundColor: '#F8F8F8',
    borderRadius: 12,
    padding: 16,
    fontSize: 16,
    color: '#1A1A1A',
    borderWidth: 2,
    borderColor: '#F8F8F8',
  },
  modalButtons: {
    flexDirection: 'row',
    gap: 12,
  },
  modalButton: {
    flex: 1,
    padding: 16,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
    minHeight: 50,
  },
  modalButtonCancel: {
    backgroundColor: '#F0F0F0',
  },
  modalButtonSend: {
    backgroundColor: '#9D4EDD',
  },
  modalButtonTextCancel: {
    color: '#666',
    fontSize: 16,
    fontWeight: '600',
  },
  modalButtonTextSend: {
    color: 'white',
    fontSize: 16,
    fontWeight: 'bold',
  },
});