import React, { useEffect, useRef } from 'react';
import { View, Animated, StyleSheet, Dimensions } from 'react-native';
import { Image, Text } from 'react-native';

export default function SplashScreen({ onAnimationComplete }) {
  const logoScale = useRef(new Animated.Value(0)).current;
  const textSlide = useRef(new Animated.Value(-Dimensions.get('window').width)).current;
  const fadeIn = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    // Logo pop-up animation
    Animated.spring(logoScale, {
      toValue: 1,
      tension: 50,
      friction: 7,
      useNativeDriver: true,
    }).start(() => {
      // Text slide and fade animation starts after logo animation completes
      Animated.parallel([
        Animated.timing(textSlide, {
          toValue: 0,
          duration: 600,
          useNativeDriver: true,
        }),
        Animated.timing(fadeIn, {
          toValue: 1,
          duration: 600,
          useNativeDriver: true,
        }),
      ]).start(() => {
        // Optional: Call callback when animations complete
        if (onAnimationComplete) {
          setTimeout(onAnimationComplete, 500);
        }
      });
    });
  }, []);

  return (
    <View style={styles.container}>
      {/* Logo Section */}
      <Animated.View
        style={[
          styles.logoContainer,
          {
            transform: [{ scale: logoScale }],
          },
        ]}
      >
        <View style={styles.logoWrapper}>
          <Image
            source={require('../assets/logos.png')}
            style={styles.logo}
            resizeMode="contain"
          />
        </View>
      </Animated.View>

      {/* Text Section */}
      <Animated.View
        style={[
          styles.textContainer,
          {
            transform: [{ translateX: textSlide }],
            opacity: fadeIn,
          },
        ]}
      >
        <Text style={styles.text}>MEDIWEAR</Text>
        <View style={styles.divider} />
        <Text style={styles.subtitle}>Medicine Adherence</Text>
      </Animated.View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#FFFFFF',
    justifyContent: 'center',
    alignItems: 'center',
  },
  logoContainer: {
    marginBottom: 50,
  },
  logoWrapper: {
    backgroundColor: '#F8F4FD',
    borderRadius: 30,
    padding: 30,
    shadowColor: '#9D4EDD',
    shadowOffset: {
      width: 0,
      height: 8,
    },
    shadowOpacity: 0.15,
    shadowRadius: 16,
    elevation: 12,
  },
  logo: {
    width: 200,
    height: 200,
  },
  textContainer: {
    alignItems: 'center',
    paddingHorizontal: 40,
  },
  text: {
    fontSize: 36,
    fontWeight: '800',
    color: '#9D4EDD',
    letterSpacing: 2,
    marginBottom: 12,
  },
  divider: {
    width: 60,
    height: 3,
    backgroundColor: '#9D4EDD',
    borderRadius: 2,
    marginBottom: 12,
  },
  subtitle: {
    fontSize: 16,
    color: '#757575',
    letterSpacing: 1,
    fontWeight: '400',
  },
});