import React, { useState, useCallback } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  ScrollView,
  SafeAreaView,
  Alert,
  Switch,
  Image,
} from 'react-native';
import { AntDesign } from '@expo/vector-icons';
import BluetoothService from '../services/BluetoothService';
import { db, auth } from '../services/firebaseConfig';
import { collection, doc, setDoc, updateDoc, serverTimestamp } from 'firebase/firestore';
import * as Haptics from 'expo-haptics';
import CustomNotificationModal from '../components/CustomNotificationModal';
import NotificationService from '../services/NotificationService';
import FirestoreDataService from '../services/FirestoreDataService';

import phoneIcon from '../assets/iphone.png';
import watchIcon from '../assets/watch.png';
import bothIcon from '../assets/mobile.png';

export default function AlertSettings({ navigation, route }) {
  const medicineData = route?.params?.medicineData;
  const user = auth.currentUser;

  const [alertType, setAlertType] = useState('both');
  const [earlyReminder, setEarlyReminder] = useState(false);
  const [waitOption, setWaitOption] = useState(false);
  const [showNotificationModal, setShowNotificationModal] = useState(false);
  const [currentMedicationAlert, setCurrentMedicationAlert] = useState(null);

  const triggerAlertHaptics = async () => {
    await Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    await new Promise(r => setTimeout(r, 200));
    await Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Heavy);
    await new Promise(r => setTimeout(r, 200));
    await Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Heavy);
  };

  const scheduleAlarmAlerts = useCallback(async (medicationData) => {
    if (!medicationData.reminderEnabled || !medicationData.reminderTimes?.length) return;
    if (!user) return;

    for (let i = 0; i < medicationData.reminderTimes.length; i++) {
      const timeString = medicationData.reminderTimes[i];
      const dateString = medicationData.reminderDates?.[i] || medicationData.startDate;
      try {
        const date = new Date(dateString);
        const [time, meridiem] = timeString.split(' ');
        const [hours, minutes] = time.split(':').map(Number);
        const hour24 =
          meridiem === 'PM' && hours !== 12 ? hours + 12 :
          meridiem === 'AM' && hours === 12 ? 0 : hours;

        date.setHours(hour24, minutes, 0, 0);

        const alertTime = new Date(date);
        if (medicationData.alertSettings?.earlyReminder) alertTime.setMinutes(alertTime.getMinutes() - 5);

        const timeUntil = alertTime - new Date();
        if (timeUntil > 0) {
          setTimeout(async () => {
            await triggerAlertHaptics();
            await NotificationService.sendMedicationNotification(medicationData);
            
            // Log notification as triggered to Firestore
            await FirestoreDataService.logNotification(
              user.uid,
              medicationData.id,
              medicationData.name,
              medicationData.dosage,
              'triggered',
              timeString
            );
            
            setCurrentMedicationAlert({
              title: medicationData.alertSettings?.earlyReminder
                ? `⏰ Upcoming: ${medicationData.name}`
                : `Time to take ${medicationData.name}`,
              message: `${medicationData.dosage} - ${timeString}${medicationData.takeWithFood ? '\n🍽️ Take with food' : ''}`,
              ...medicationData
            });
            setShowNotificationModal(true);
          }, timeUntil);
        }
      } catch (err) {
        console.error('Error scheduling alarm:', err);
      }
    }
  }, [user]);

  const handleDismissNotification = async (medicationData) => {
    setShowNotificationModal(false);
    
    if (medicationData && user) {
      // Log the notification as dismissed to Firestore
      const scheduledTime = medicationData.reminderTimes?.[0] || null;
      await FirestoreDataService.logNotification(
        user.uid,
        medicationData.id,
        medicationData.name,
        medicationData.dosage,
        'dismissed',
        scheduledTime
      );
    }
  };

  const handleWait10Minutes = async (medicationData) => {
    setShowNotificationModal(false);
    
    if (user) {
      // Log as dismissed (waiting)
      const scheduledTime = medicationData.reminderTimes?.[0] || null;
      await FirestoreDataService.logNotification(
        user.uid,
        medicationData.id,
        medicationData.name,
        medicationData.dosage,
        'dismissed',
        scheduledTime
      );
    }

    setTimeout(async () => {
      await Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      await NotificationService.sendMedicationNotification({
        ...medicationData,
        name: `Reminder: ${medicationData.name}`
      });
      
      if (user) {
        // Log the follow-up notification as triggered
        await FirestoreDataService.logNotification(
          user.uid,
          medicationData.id,
          `Reminder: ${medicationData.name}`,
          medicationData.dosage,
          'triggered',
          scheduledTime
        );
      }
      
      setCurrentMedicationAlert(medicationData);
      setShowNotificationModal(true);
    }, 10 * 60 * 1000);
  };

  const saveToFirestore = async (data) => {
    if (!user) throw new Error('User not logged in');

    const { alertSettings, isEditing, id, ...medData } = data;
    const firestoreData = {
      userId: user.uid,
      ...medData,
      alertSettings,
      reminderEnabled: medData.reminderEnabled,
      updatedAt: serverTimestamp(),
    };

    if (isEditing && id) {
      const medicineRef = doc(db, 'medications', id);
      await updateDoc(medicineRef, firestoreData);
      return id;
    } else {
      const newMedRef = doc(collection(db, 'medications'));
      await setDoc(newMedRef, {
        ...firestoreData,
        createdAt: serverTimestamp(),
        id: newMedRef.id,
      });
      return newMedRef.id;
    }
  };

  const handlePhoneOnly = async (medicationData) => {
    try {
      const finalId = await saveToFirestore(medicationData);
      const medicationWithId = { ...medicationData, id: finalId };
      scheduleAlarmAlerts(medicationWithId);
      Alert.alert('Success!', `Medication ${medicineData.isEditing ? 'updated' : 'added'}`, [
        { text: 'OK', onPress: () => navigation.navigate('Home') },
      ]);
    } catch (error) {
      console.error('Phone only setup failed:', error);
      Alert.alert('Error', 'Failed to save medication.');
    }
  };

  const handleWatchOnly = async (medicationData) => {
    try {
      const connectionStatus = BluetoothService.getConnectionStatus();
      if (!connectionStatus.isConnected) {
        Alert.alert('No Device Connected', 'Connect to your MediWear device first.');
        return;
      }
      Alert.alert('Syncing...', 'Sending to MediWear device.');
      const response = await BluetoothService.syncMedicationToDevice(medicationData);
      if (response.success) {
        Alert.alert('Synced ✓', 'Medication synced to your MediWear device.', [
          { text: 'OK', onPress: () => navigation.navigate('Home') },
        ]);
      } else {
        Alert.alert('Sync Declined', 'Please try again.');
      }
    } catch (error) {
      Alert.alert('Sync Failed', `Error: ${error.message}`);
    }
  };

  const syncToDeviceForBoth = async (medicationData) => {
    try {
      const connectionStatus = BluetoothService.getConnectionStatus();
      if (!connectionStatus.isConnected) {
        Alert.alert(
          'No Device Connected',
          'Medication saved on phone. Connect to MediWear later.',
          [{ text: 'OK', onPress: () => navigation.navigate('Home') }]
        );
        return;
      }

      Alert.alert('Syncing...', 'Sending to MediWear device.');
      const response = await BluetoothService.syncMedicationToDevice(medicationData);

      if (response) {
        Alert.alert('Sync Completed ✓', 'Medication synced to MediWear device.', [
          { text: 'OK', onPress: () => navigation.navigate('Home') },
        ]);
      } else {
        Alert.alert('Sync Timeout', 'Device did not respond. Medication saved on your phone.', [
          { text: 'OK', onPress: () => navigation.navigate('Home') },
        ]);
      }
    } catch {
      Alert.alert('Sync Failed', 'Medication saved on your phone.');
    }
  };

  const handleBothDevices = async (medicationData) => {
    try {
      const finalId = await saveToFirestore(medicationData);
      const medicationWithId = { ...medicationData, id: finalId };
      scheduleAlarmAlerts(medicationWithId);
      Alert.alert('Sync to MediWear?', 'Medication saved. Sync now?', [
        { text: 'Cancel', style: 'cancel', onPress: () => navigation.navigate('Home') },
        { text: 'Sync Now', onPress: () => syncToDeviceForBoth(medicationWithId) },
      ]);
    } catch (error) {
      Alert.alert('Error', 'Failed to save medication.');
    }
  };

  const handleCompleteSetup = async () => {
    if (!medicineData) return Alert.alert('Error', 'Medicine data missing.');
    if (!user) {
      Alert.alert('Authentication Error', 'You must be logged in');
      navigation.navigate('Login');
      return;
    }

    const finalMedicineData = {
      ...medicineData,
      alertSettings: { alertType, earlyReminder, waitOption },
    };

    switch (alertType) {
      case 'phone':
        await handlePhoneOnly(finalMedicineData);
        break;
      case 'watch':
        await handleWatchOnly(finalMedicineData);
        break;
      case 'both':
        await handleBothDevices(finalMedicineData);
        break;
      default:
        Alert.alert('Error', 'Invalid alert type');
    }
  };

  const handleBack = () => {
    navigation.navigate('AddMedicine', {
      medicine: medicineData,
      fromAlertSettings: true,
    });
  };

  const alertTypeOptions = [
    { id: 'phone', icon: phoneIcon, title: '  Phone Only ', subtitle: '  Alerts on your phone' },
    { id: 'watch', icon: watchIcon, title: '  Watch Only ', subtitle: '  Alerts on your smart watch' },
    {
      id: 'both',
      icon: bothIcon,
      title: '  Both Devices',
      subtitle: '  Alerts on phone and watch',
      recommended: true,
    },
  ];

  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.header}>
        <TouchableOpacity style={styles.backButton} onPress={handleBack}>
          <AntDesign name="arrowleft" size={24} color="#333" />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Alert Settings</Text>
        <View style={styles.headerSpacer} />
      </View>

      <ScrollView style={styles.scrollView} showsVerticalScrollIndicator={false}>
        <View style={styles.medicineCard}>
          <View style={styles.medicineIcon}><Text style={styles.medicineIconText}>💊</Text></View>
          <Text style={styles.medicineName}>{medicineData?.name || 'Medicine Name'}</Text>
          <Text style={styles.medicineDosage}>Take: {medicineData?.dosage || 'dosage'}</Text>
          <Text style={styles.medicineFrequency}>{medicineData?.frequency || 'frequency'}</Text>
          {medicineData?.reminderTimes?.length > 0 && (
            <View style={styles.timeContainer}>
              <Text style={styles.timeIcon}>🕘</Text>
              <Text style={styles.timeText}>{medicineData.reminderTimes.join(', ')}</Text>
            </View>
          )}
        </View>

        <View style={styles.section}>
          <Text style={styles.sectionTitle}>How would you like to be reminded?</Text>
          {alertTypeOptions.map(option => (
            <TouchableOpacity
              key={option.id}
              style={[styles.optionCard, alertType === option.id && styles.optionCardSelected]}
              onPress={() => setAlertType(option.id)}
            >
              <View style={styles.optionLeft}>
                <Image source={option.icon} style={{ width: 28, height: 28, resizeMode: 'contain' }} />
                <View style={styles.optionContent}>
                  <Text style={styles.optionTitle}>{option.title}</Text>
                  <Text style={styles.optionSubtitle}>{option.subtitle}</Text>
                  {option.recommended && <View style={styles.recommendedBadge}><Text style={styles.recommendedText}>Recommended</Text></View>}
                </View>
              </View>
              {alertType === option.id && <View style={styles.checkmark}><Text style={styles.checkmarkText}>✓</Text></View>}
            </TouchableOpacity>
          ))}
        </View>

        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Additional Options</Text>

          <TouchableOpacity
            style={[styles.toggleOptionCard, earlyReminder && styles.toggleOptionCardActive]}
            onPress={() => setEarlyReminder(!earlyReminder)}
          >
            <View style={styles.optionLeft}>
              <Text style={styles.optionIcon}>🔔</Text>
              <View style={styles.optionContent}>
                <Text style={styles.optionTitle}>  Early Reminder</Text>
                <Text style={styles.optionSubtitle}>  Get a gentle alert 5 minutes early</Text>
              </View>
            </View>
            <Switch
              value={earlyReminder}
              onValueChange={setEarlyReminder}
              thumbColor={earlyReminder ? '#9D4EDD' : '#f4f3f4'}
              trackColor={{ false: '#767577', true: '#E8D5F2' }}
            />
          </TouchableOpacity>

          <TouchableOpacity
            style={[styles.toggleOptionCard, waitOption && styles.toggleOptionCardActive]}
            onPress={() => setWaitOption(!waitOption)}
          >
            <View style={styles.optionLeft}>
              <Text style={styles.optionIcon}>⏰</Text>
              <View style={styles.optionContent}>
                <Text style={styles.optionTitle}>  Allow "Wait 10 Minutes"</Text>
                <Text style={styles.optionSubtitle}>  Option to delay if you're busy</Text>
              </View>
            </View>
            <Switch
              value={waitOption}
              onValueChange={setWaitOption}
              thumbColor={waitOption ? '#9D4EDD' : '#f4f3f4'}
              trackColor={{ false: '#767577', true: '#E8D5F2' }}
            />
          </TouchableOpacity>
        </View>

        <View style={styles.bottomSpacing} />
      </ScrollView>

      <View style={styles.bottomContainer}>
        <TouchableOpacity style={styles.backBottomButton} onPress={handleBack}>
          <Text style={styles.backBottomButtonText}>Back</Text>
        </TouchableOpacity>
        <TouchableOpacity style={styles.completeButton} onPress={handleCompleteSetup}>
          <Text style={styles.completeButtonText}>
            {medicineData?.isEditing ? 'Update Meds' : 'Add Meds'}
          </Text>
        </TouchableOpacity>
      </View>

      <CustomNotificationModal
        visible={showNotificationModal}
        medicationData={currentMedicationAlert}
        onDismiss={() => handleDismissNotification(currentMedicationAlert)}
        onWait={() => handleWait10Minutes(currentMedicationAlert)}
        showWaitOption={waitOption}
      />
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#F8F9FA',
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingVertical: 12,
    backgroundColor: '#fff',
    borderBottomWidth: 1,
    borderBottomColor: '#E5E5E5',
  },
  backButton: {
    padding: 8,
  },
  headerTitle: {
    fontSize: 18,
    fontWeight: '600',
    color: '#333',
  },
  headerSpacer: {
    width: 40,
  },
  scrollView: {
    flex: 1,
  },
  medicineCard: {
    backgroundColor: '#fff',
    margin: 16,
    padding: 20,
    borderRadius: 16,
    alignItems: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 3,
  },
  medicineIcon: {
    width: 60,
    height: 60,
    borderRadius: 30,
    backgroundColor: '#F3E8FF',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 12,
  },
  medicineIconText: {
    fontSize: 30,
  },
  medicineName: {
    fontSize: 20,
    fontWeight: '700',
    color: '#333',
    marginBottom: 4,
  },
  medicineDosage: {
    fontSize: 14,
    color: '#666',
    marginBottom: 2,
  },
  medicineFrequency: {
    fontSize: 14,
    color: '#666',
    marginBottom: 8,
  },
  timeContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: 8,
    paddingHorizontal: 12,
    paddingVertical: 6,
    backgroundColor: '#F8F9FA',
    borderRadius: 8,
  },
  timeIcon: {
    fontSize: 16,
    marginRight: 6,
  },
  timeText: {
    fontSize: 14,
    color: '#333',
    fontWeight: '500',
  },
  section: {
    marginHorizontal: 16,
    marginBottom: 24,
  },
  sectionTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: '#333',
    marginBottom: 12,
  },
  optionCard: {
    backgroundColor: '#fff',
    padding: 16,
    borderRadius: 12,
    marginBottom: 12,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    borderWidth: 2,
    borderColor: '#E5E5E5',
  },
  optionCardSelected: {
    borderColor: '#9D4EDD',
    backgroundColor: '#F9F5FF',
  },
  optionLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    flex: 1,
  },
  optionIcon: {
    fontSize: 24,
  },
  optionContent: {
    flex: 1,
  },
  optionTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: '#333',
    marginBottom: 2,
  },
  optionSubtitle: {
    fontSize: 13,
    color: '#666',
  },
  recommendedBadge: {
    backgroundColor: '#9D4EDD',
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: 4,
    alignSelf: 'flex-start',
    marginTop: 4,
  },
  recommendedText: {
    color: '#fff',
    fontSize: 11,
    fontWeight: '600',
  },
  checkmark: {
    width: 28,
    height: 28,
    borderRadius: 14,
    backgroundColor: '#9D4EDD',
    alignItems: 'center',
    justifyContent: 'center',
  },
  checkmarkText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '700',
  },
  toggleOptionCard: {
    backgroundColor: '#fff',
    padding: 16,
    borderRadius: 12,
    marginBottom: 12,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    borderWidth: 1,
    borderColor: '#E5E5E5',
  },
  toggleOptionCardActive: {
    borderColor: '#9D4EDD',
    backgroundColor: '#F9F5FF',
  },
  bottomSpacing: {
    height: 20,
  },
  bottomContainer: {
    flexDirection: 'row',
    padding: 16,
    backgroundColor: '#fff',
    borderTopWidth: 1,
    borderTopColor: '#E5E5E5',
    gap: 12,
  },
  backBottomButton: {
    flex: 1,
    paddingVertical: 14,
    borderRadius: 12,
    backgroundColor: '#F8F9FA',
    alignItems: 'center',
    borderWidth: 1,
    borderColor: '#E5E5E5',
  },
  backBottomButtonText: {
    fontSize: 16,
    fontWeight: '600',
    color: '#333',
  },
  completeButton: {
    flex: 2,
    paddingVertical: 14,
    borderRadius: 12,
    backgroundColor: '#9D4EDD',
    alignItems: 'center',
  },
  completeButtonText: {
    fontSize: 16,
    fontWeight: '600',
    color: '#fff',
  },
});
