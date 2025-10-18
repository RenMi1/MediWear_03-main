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
  ActivityIndicator,
  TouchableWithoutFeedback,
  Keyboard,
  Image,
} from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { auth } from '../services/firebaseConfig';
import { 
  createUserWithEmailAndPassword, 
  updateProfile, 
  sendEmailVerification
} from 'firebase/auth';

export default function SignUp({ navigation, route }) {
  const [formData, setFormData] = useState({
    fullName: '',
    age: '',
    email: '',
    password: '',
    confirmPassword: '',
  });
  const [acceptedTerms, setAcceptedTerms] = useState(false);
  const [loading, setLoading] = useState(false);
  const [focusedField, setFocusedField] = useState(null);
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);

  const validateForm = () => {
    const { fullName, age, email, password, confirmPassword } = formData;
    
    if (!fullName.trim()) {
      Alert.alert('Error', 'Please enter your full name');
      return false;
    }
    if (!age || isNaN(age) || parseInt(age) < 1 || parseInt(age) > 120) {
      Alert.alert('Error', 'Please enter a valid age (1-120)');
      return false;
    }
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(email)) {
      Alert.alert('Error', 'Please enter a valid email address');
      return false;
    }
    if (password.length < 6) {
      Alert.alert('Error', 'Password must be at least 6 characters long');
      return false;
    }
    if (password !== confirmPassword) {
      Alert.alert('Error', 'Passwords do not match');
      return false;
    }
    if (!acceptedTerms) {
      Alert.alert('Error', 'Please accept the Terms and Conditions');
      return false;
    }
    return true;
  };

  const updateFormData = (field, value) => {
    setFormData(prev => ({ ...prev, [field]: value }));
  };

  const handleSignUp = async () => {
    Keyboard.dismiss();
    if (!validateForm()) return;
    setLoading(true);

    try {
      // Create user account
      const userCredential = await createUserWithEmailAndPassword(
        auth,
        formData.email.trim(),
        formData.password
      );
      const user = userCredential.user;

      // Update profile with display name
      await updateProfile(user, { displayName: formData.fullName.trim() });
      
      // Send verification email
      await sendEmailVerification(user);

      // Store user data locally (with emailVerified: false)
      const userData = {
        name: formData.fullName.trim(),
        age: formData.age,
        email: formData.email.trim(),
        uid: user.uid,
        emailVerified: false,
      };
      await AsyncStorage.setItem('userData', JSON.stringify(userData));

      // Sign out the user so they must verify email before logging in
      await auth.signOut();

      // Clear form
      setFormData({
        fullName: '',
        age: '',
        email: '',
        password: '',
        confirmPassword: '',
      });
      setAcceptedTerms(false);
      setLoading(false);

      // Show success message and navigate to login
      Alert.alert(
        'Account Created Successfully!',
        'A verification email has been sent to your email address. Please verify your email before logging in.',
        [
          { 
            text: 'OK', 
            onPress: () => {
              // Navigate to Login screen
              navigation.reset({
                index: 0,
                routes: [{ name: 'Login' }],
              });
            }
          }
        ],
        { cancelable: false }
      );
    } catch (error) {
      console.error('Signup error:', error);
      setLoading(false);
      
      let errorMessage = 'Failed to create account. Please try again.';
      switch (error.code) {
        case 'auth/email-already-in-use':
          errorMessage = 'This email address is already registered. Please login or use a different email.';
          break;
        case 'auth/invalid-email':
          errorMessage = 'Invalid email address format.';
          break;
        case 'auth/operation-not-allowed':
          errorMessage = 'Email/password accounts are not enabled. Please contact support.';
          break;
        case 'auth/weak-password':
          errorMessage = 'Password is too weak. Please use a stronger password.';
          break;
        case 'auth/network-request-failed':
          errorMessage = 'Network error. Please check your internet connection.';
          break;
      }
      Alert.alert('Sign Up Failed', errorMessage);
    }
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
          <View style={styles.signupContainer}>
            <View style={styles.logoContainer}>
              <View style={styles.logoCircle}>
                <Text style={styles.logoText}>💊</Text>
              </View>
            </View>
            <Text style={styles.title}>Create Account</Text>
            <Text style={styles.subtitle}>Join us to manage your medications</Text>

            {/* Full Name */}
            <View style={styles.inputContainer}>
              <Text style={styles.label}>Full Name</Text>
              <View style={[styles.inputWrapper, focusedField === 'fullName' && styles.inputWrapperFocused]}>
                <TextInput
                  style={styles.input}
                  placeholder="Enter your full name"
                  placeholderTextColor="#999"
                  value={formData.fullName}
                  onChangeText={(text) => updateFormData('fullName', text)}
                  onFocus={() => setFocusedField('fullName')}
                  onBlur={() => setFocusedField(null)}
                  autoCapitalize="words"
                  returnKeyType="next"
                  editable={!loading}
                />
              </View>
            </View>

            {/* Age */}
            <View style={styles.inputContainer}>
              <Text style={styles.label}>Age</Text>
              <View style={[styles.inputWrapper, focusedField === 'age' && styles.inputWrapperFocused]}>
                <TextInput
                  style={styles.input}
                  placeholder="Enter your age"
                  placeholderTextColor="#999"
                  value={formData.age}
                  onChangeText={(text) => updateFormData('age', text)}
                  onFocus={() => setFocusedField('age')}
                  onBlur={() => setFocusedField(null)}
                  keyboardType="numeric"
                  editable={!loading}
                />
              </View>
            </View>

            {/* Email */}
            <View style={styles.inputContainer}>
              <Text style={styles.label}>Email</Text>
              <View style={[styles.inputWrapper, focusedField === 'email' && styles.inputWrapperFocused]}>
                <TextInput
                  style={styles.input}
                  placeholder="Enter your email"
                  placeholderTextColor="#999"
                  value={formData.email}
                  onChangeText={(text) => updateFormData('email', text)}
                  onFocus={() => setFocusedField('email')}
                  onBlur={() => setFocusedField(null)}
                  keyboardType="email-address"
                  autoCapitalize="none"
                  autoCorrect={false}
                  editable={!loading}
                />
              </View>
            </View>

            {/* Password */}
            <View style={styles.inputContainer}>
              <Text style={styles.label}>Password</Text>
              <View style={[styles.inputWrapper, focusedField === 'password' && styles.inputWrapperFocused]}>
                <TextInput
                  style={styles.inputWithIcon}
                  placeholder="Enter password (min 6 characters)"
                  placeholderTextColor="#999"
                  value={formData.password}
                  onChangeText={(text) => updateFormData('password', text)}
                  onFocus={() => setFocusedField('password')}
                  onBlur={() => setFocusedField(null)}
                  secureTextEntry={!showPassword}
                  autoCapitalize="none"
                  editable={!loading}
                />
                <TouchableOpacity
                  style={styles.eyeIcon}
                  onPress={() => setShowPassword(!showPassword)}
                  disabled={loading}
                >
                  <Image
                    source={
                      showPassword
                        ? require('../assets/eye-open.png')
                        : require('../assets/eye-closed.png')
                    }
                    style={styles.eyeIconImage}
                  />
                </TouchableOpacity>
              </View>
            </View>

            {/* Confirm Password */}
            <View style={styles.inputContainer}>
              <Text style={styles.label}>Confirm Password</Text>
              <View style={[styles.inputWrapper, focusedField === 'confirmPassword' && styles.inputWrapperFocused]}>
                <TextInput
                  style={styles.inputWithIcon}
                  placeholder="Re-enter your password"
                  placeholderTextColor="#999"
                  value={formData.confirmPassword}
                  onChangeText={(text) => updateFormData('confirmPassword', text)}
                  onFocus={() => setFocusedField('confirmPassword')}
                  onBlur={() => setFocusedField(null)}
                  secureTextEntry={!showConfirmPassword}
                  autoCapitalize="none"
                  onSubmitEditing={handleSignUp}
                  editable={!loading}
                />
                <TouchableOpacity
                  style={styles.eyeIcon}
                  onPress={() => setShowConfirmPassword(!showConfirmPassword)}
                  disabled={loading}
                >
                  <Image
                    source={
                      showConfirmPassword
                        ? require('../assets/eye-open.png')
                        : require('../assets/eye-closed.png')
                    }
                    style={styles.eyeIconImage}
                  />
                </TouchableOpacity>
              </View>
            </View>

            {/* Terms and Conditions */}
            <TouchableOpacity
              style={styles.checkboxContainer}
              onPress={() => setAcceptedTerms(!acceptedTerms)}
              disabled={loading}
            >
              <View style={[styles.checkbox, acceptedTerms && styles.checkboxChecked]}>
                {acceptedTerms && <Text style={styles.checkmark}>✓</Text>}
              </View>
              <Text style={styles.checkboxText}>
                I agree to the <Text style={styles.linkText}>Terms and Conditions</Text> and{' '}
                <Text style={styles.linkText}>Privacy Policy</Text>
              </Text>
            </TouchableOpacity>

            {/* Sign Up Button */}
            <TouchableOpacity
              style={[styles.signupButton, (!acceptedTerms || loading) && styles.signupButtonDisabled]}
              onPress={handleSignUp}
              disabled={!acceptedTerms || loading}
            >
              {loading ? (
                <ActivityIndicator color="#fff" />
              ) : (
                <Text style={styles.signupButtonText}>Create Account</Text>
              )}
            </TouchableOpacity>

            {/* Navigate to Login */}
            <View style={styles.loginContainer}>
              <Text style={styles.loginText}>Already have an account? </Text>
              <TouchableOpacity onPress={() => navigation.navigate('Login')} disabled={loading}>
                <Text style={styles.loginLink}>Sign In</Text>
              </TouchableOpacity>
            </View>
          </View>
        </ScrollView>
      </TouchableWithoutFeedback>
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
  signupContainer: {
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
    marginBottom: 24,
  },
  logoCircle: {
    width: 70,
    height: 70,
    borderRadius: 35,
    backgroundColor: '#F3F0FF',
    justifyContent: 'center',
    alignItems: 'center',
  },
  logoText: {
    fontSize: 36,
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
  checkboxContainer: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    marginBottom: 24,
    marginTop: 4,
  },
  checkbox: {
    width: 22,
    height: 22,
    borderWidth: 2,
    borderColor: '#ddd',
    borderRadius: 6,
    marginRight: 12,
    justifyContent: 'center',
    alignItems: 'center',
    marginTop: 2,
  },
  checkboxChecked: {
    backgroundColor: '#9D4EDD',
    borderColor: '#9D4EDD',
  },
  checkmark: {
    color: '#fff',
    fontSize: 14,
    fontWeight: 'bold',
  },
  checkboxText: {
    flex: 1,
    fontSize: 14,
    color: '#666',
    lineHeight: 20,
  },
  linkText: {
    color: '#9D4EDD',
    fontWeight: '600',
  },
  signupButton: {
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
  signupButtonDisabled: {
    backgroundColor: '#ccc',
    opacity: 0.7,
    shadowOpacity: 0,
  },
  signupButtonText: {
    color: 'white',
    fontSize: 17,
    fontWeight: 'bold',
    letterSpacing: 0.5,
  },
  loginContainer: {
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
    marginTop: 8,
  },
  loginText: {
    color: '#666',
    fontSize: 15,
  },
  loginLink: {
    color: '#9D4EDD',
    fontSize: 15,
    fontWeight: 'bold',
  },
});