import React, { useEffect, useRef } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  Modal,
  Animated,
  Image,
} from 'react-native';

const CustomNotificationModal = ({ 
  visible, 
  medicationData, 
  onDismiss, 
  onWait, 
  showWaitOption 
}) => {
  const scaleAnim = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    if (visible) {
      Animated.spring(scaleAnim, {
        toValue: 1,
        tension: 50,
        friction: 7,
        useNativeDriver: true,
      }).start();
    } else {
      scaleAnim.setValue(0);
    }
  }, [visible]);

  return (
    <Modal
      transparent
      visible={visible}
      animationType="fade"
      onRequestClose={onDismiss}
    >
      <View style={styles.overlay}>
        <Animated.View 
          style={[
            styles.container,
            {
              transform: [{ scale: scaleAnim }]
            }
          ]}
        >
          <View style={styles.iconContainer}>
            <View style={styles.bellCircle}>
              <Image 
              source={require('../assets/bell.png')} 
              style={styles.menuIcon}
              resizeMode="contain"
              />
            </View>
            <View style={styles.badge}>
              <Text style={styles.badgeText}>1</Text>
            </View>
          </View>

          <Text style={styles.title}>Reminder</Text>
          <Text style={styles.medicineName}>
            💊 {medicationData?.title || 'Time to take your medication'}
          </Text>
          <Text style={styles.description}>
            {medicationData?.message || ''}
          </Text>

          <View style={styles.buttonContainer}>
            <TouchableOpacity 
              style={styles.dismissButton}
              onPress={onDismiss}
            >
              <Text style={styles.dismissButtonText}>Dismiss</Text>
            </TouchableOpacity>

            {showWaitOption && (
              <TouchableOpacity 
                style={styles.waitButton}
                onPress={onWait}
              >
                <Text style={styles.waitButtonText}>Wait 10 min</Text>
              </TouchableOpacity>
            )}

            <TouchableOpacity 
              style={styles.okButton}
              onPress={onDismiss}
            >
              <Text style={styles.okButtonText}>OK</Text>
            </TouchableOpacity>
          </View>
        </Animated.View>
      </View>
    </Modal>
  );
};

const styles = StyleSheet.create({
  overlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.6)',
    justifyContent: 'center',
    alignItems: 'center',
    padding: 20,
  },
  container: {
    backgroundColor: '#fff',
    borderRadius: 24,
    padding: 24,
    width: '90%',
    maxWidth: 400,
    alignItems: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 10 },
    shadowOpacity: 0.3,
    shadowRadius: 20,
    elevation: 10,
  },
  iconContainer: {
    position: 'relative',
    marginBottom: 16,
  },
  bellCircle: {
    width: 80,
    height: 80,
    borderRadius: 40,
    backgroundColor: '#4A5568',
    justifyContent: 'center',
    alignItems: 'center',
  },
  badge: {
    position: 'absolute',
    top: 0,
    right: 0,
    backgroundColor: '#ff3b30',
    width: 24,
    height: 24,
    borderRadius: 12,
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 2,
    borderColor: '#fff',
  },
  badgeText: {
    color: '#fff',
    fontSize: 12,
    fontWeight: 'bold',
  },
  title: {
    fontSize: 24,
    fontWeight: 'bold',
    color: '#1a202c',
    marginBottom: 8,
  },
  medicineName: {
    fontSize: 16,
    fontWeight: '600',
    color: '#2d3748',
    marginBottom: 8,
    textAlign: 'center',
  },
  description: {
    fontSize: 14,
    color: '#4a5568',
    textAlign: 'center',
    marginBottom: 24,
    lineHeight: 20,
  },
  buttonContainer: {
    flexDirection: 'row',
    justifyContent: 'center',
    gap: 12,
    width: '100%',
  },
  dismissButton: {
    flex: 1,
    paddingVertical: 12,
    borderRadius: 12,
    backgroundColor: '#4A5568',
    alignItems: 'center',
  },
  dismissButtonText: {
    color: '#fff',
    fontSize: 15,
    fontWeight: '600',
  },
  waitButton: {
    flex: 1,
    paddingVertical: 12,
    borderRadius: 12,
    backgroundColor: '#4A5568',
    alignItems: 'center',
  },
  waitButtonText: {
    color: '#fff',
    fontSize: 15,
    fontWeight: '600',
  },
  okButton: {
    flex: 1,
    paddingVertical: 12,
    borderRadius: 12,
    backgroundColor: '#4A5568',
    alignItems: 'center',
  },
  okButtonText: {
    color: '#fff',
    fontSize: 15,
    fontWeight: '600',
  },
});

export default CustomNotificationModal;