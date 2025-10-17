import * as Notifications from 'expo-notifications';
import * as Device from 'expo-device';
import { Platform, Alert } from 'react-native';
import { db } from './firebaseConfig';
import { 
  collection, 
  query, 
  where, 
  onSnapshot,
  doc,
  updateDoc,
  serverTimestamp 
} from 'firebase/firestore';

// Configure notification behavior (updated API)
Notifications.setNotificationHandler({
  handleNotification: async () => ({
    shouldShowBanner: true,
    shouldShowList: true,
    shouldPlaySound: true,
    shouldSetBadge: true,
  }),
});

class NotificationService {
  constructor() {
    this.notificationListener = null;
    this.responseListener = null;
    this.medicationListener = null;
  }

  // Request notification permissions
  async registerForPushNotificationsAsync() {
    let token;

    if (Platform.OS === 'android') {
      await Notifications.setNotificationChannelAsync('medication-alerts', {
        name: 'Medication Alerts',
        importance: Notifications.AndroidImportance.MAX,
        vibrationPattern: [0, 250, 250, 250],
        lightColor: '#9D4EDD',
        sound: 'default',
      });
    }

    if (Device.isDevice) {
      const { status: existingStatus } = await Notifications.getPermissionsAsync();
      let finalStatus = existingStatus;
      
      if (existingStatus !== 'granted') {
        const { status } = await Notifications.requestPermissionsAsync();
        finalStatus = status;
      }
      
      if (finalStatus !== 'granted') {
        Alert.alert(
          'Notification Permission Required',
          'Please enable notifications in your device settings to receive medication reminders.',
          [{ text: 'OK' }]
        );
        return;
      }
      
      token = (await Notifications.getExpoPushTokenAsync()).data;
      console.log('📱 Expo Push Token:', token);
    } else {
      console.log('⚠️ Must use physical device for Push Notifications');
    }

    return token;
  }

  // Send local notification
  async sendMedicationNotification(medicationData) {
    try {
      const notificationId = await Notifications.scheduleNotificationAsync({
        content: {
          title: medicationData.alertSettings?.earlyReminder 
            ? `⏰ Upcoming: ${medicationData.name}`
            : `💊 Time to take ${medicationData.name}`,
          body: `${medicationData.dosage}${medicationData.takeWithFood ? '\n🍽️ Take with food' : ''}`,
          sound: 'default',
          priority: Notifications.AndroidNotificationPriority.MAX,
          vibrate: [0, 250, 250, 250],
          data: { 
            medicationId: medicationData.id,
            medicationName: medicationData.name,
            type: 'medication_reminder'
          },
          badge: 1,
        },
        trigger: null, // Send immediately
      });

      console.log('✅ Notification sent:', notificationId);
      return notificationId;
    } catch (error) {
      console.error('❌ Error sending notification:', error);
      throw error;
    }
  }

  // Schedule notification for specific time
  async scheduleMedicationNotification(medicationData, scheduledTime) {
    try {
      const now = new Date();
      const triggerTime = new Date(scheduledTime);
      const seconds = Math.floor((triggerTime - now) / 1000);

      if (seconds <= 0) {
        console.log('⏭️ Skipping past notification time');
        return null;
      }

      const notificationId = await Notifications.scheduleNotificationAsync({
        content: {
          title: medicationData.alertSettings?.earlyReminder 
            ? `⏰ Upcoming: ${medicationData.name}`
            : `💊 Time to take ${medicationData.name}`,
          body: `${medicationData.dosage}${medicationData.takeWithFood ? '\n🍽️ Take with food' : ''}`,
          sound: 'default',
          priority: Notifications.AndroidNotificationPriority.MAX,
          vibrate: [0, 250, 250, 250],
          data: { 
            medicationId: medicationData.id,
            medicationName: medicationData.name,
            type: 'medication_reminder'
          },
          badge: 1,
        },
        trigger: { seconds },
      });

      console.log(`📅 Notification scheduled for ${triggerTime.toLocaleString()}`);
      return notificationId;
    } catch (error) {
      console.error('❌ Error scheduling notification:', error);
      throw error;
    }
  }

  // Schedule repeating daily notification (works even when app is closed)
  async scheduleDailyMedicationNotification(medicationData, hour, minute) {
    try {
      const notificationId = await Notifications.scheduleNotificationAsync({
        content: {
          title: medicationData.alertSettings?.earlyReminder 
            ? `⏰ Upcoming: ${medicationData.name}`
            : `💊 Time to take ${medicationData.name}`,
          body: `${medicationData.dosage}${medicationData.takeWithFood ? '\n🍽️ Take with food' : ''}`,
          sound: 'default',
          priority: Notifications.AndroidNotificationPriority.MAX,
          vibrate: [0, 250, 250, 250],
          data: { 
            medicationId: medicationData.id,
            medicationName: medicationData.name,
            type: 'medication_reminder',
            repeating: true
          },
          badge: 1,
        },
        trigger: {
          hour: hour,
          minute: minute,
          repeats: true, // This makes it repeat daily
        },
      });

      console.log(`🔄 Daily notification scheduled for ${hour}:${minute}`);
      return notificationId;
    } catch (error) {
      console.error('❌ Error scheduling daily notification:', error);
      throw error;
    }
  }

  // Setup notification listeners
  setupAlarmListener() {
    // Listener for when notification is received while app is foregrounded
    this.notificationListener = Notifications.addNotificationReceivedListener(notification => {
      console.log('🔔 Notification received:', notification);
    });

    // Listener for when user taps on notification
    this.responseListener = Notifications.addNotificationResponseReceivedListener(response => {
      console.log('👆 Notification tapped:', response);
      const data = response.notification.request.content.data;
      
      if (data.type === 'medication_reminder') {
        // Handle notification tap - you can navigate to specific screen here
        console.log('Opening medication:', data.medicationName);
      }
    });
  }

  // Listen to Firebase for real-time medication updates
  startListeningToFirebase(userId) {
    if (this.medicationListener) {
      this.medicationListener();
    }

    const medicationsRef = collection(db, 'medications');
    const q = query(medicationsRef, where('userId', '==', userId));

    this.medicationListener = onSnapshot(q, (snapshot) => {
      snapshot.docChanges().forEach((change) => {
        if (change.type === 'added' || change.type === 'modified') {
          const medicationData = { id: change.doc.id, ...change.doc.data() };
          
          if (medicationData.reminderEnabled && medicationData.reminderTimes) {
            this.scheduleAllReminders(medicationData);
          }
        }
      });
    });
  }

  // Schedule all reminders for a medication
  scheduleAllReminders(medicationData) {
    if (!medicationData.reminderTimes || medicationData.reminderTimes.length === 0) {
      return;
    }

    medicationData.reminderTimes.forEach((timeString, index) => {
      try {
        const [time, meridiem] = timeString.split(' ');
        const [hours, minutes] = time.split(':').map(Number);

        let hour24 = hours;
        if (meridiem === 'PM' && hours !== 12) {
          hour24 = hours + 12;
        } else if (meridiem === 'AM' && hours === 12) {
          hour24 = 0;
        }

        // Adjust for early reminder
        let finalHour = hour24;
        let finalMinute = minutes;
        if (medicationData.alertSettings?.earlyReminder) {
          finalMinute -= 5;
          if (finalMinute < 0) {
            finalMinute += 60;
            finalHour -= 1;
            if (finalHour < 0) finalHour = 23;
          }
        }

        // Schedule as daily repeating notification (works when app is closed)
        this.scheduleDailyMedicationNotification(medicationData, finalHour, finalMinute);
        
      } catch (error) {
        console.error('Error scheduling reminder:', error);
      }
    });
  }

  // Cancel all scheduled notifications for a medication
  async cancelMedicationNotifications(medicationId) {
    try {
      const scheduledNotifications = await Notifications.getAllScheduledNotificationsAsync();
      
      for (const notification of scheduledNotifications) {
        if (notification.content.data?.medicationId === medicationId) {
          await Notifications.cancelScheduledNotificationAsync(notification.identifier);
          console.log('🚫 Cancelled notification:', notification.identifier);
        }
      }
    } catch (error) {
      console.error('❌ Error cancelling notifications:', error);
    }
  }

  // Cancel all notifications
  async cancelAllNotifications() {
    try {
      await Notifications.cancelAllScheduledNotificationsAsync();
      console.log('🚫 All notifications cancelled');
    } catch (error) {
      console.error('❌ Error cancelling all notifications:', error);
    }
  }

  // Get all scheduled notifications
  async getScheduledNotifications() {
    try {
      const notifications = await Notifications.getAllScheduledNotificationsAsync();
      console.log('📋 Scheduled notifications:', notifications.length);
      return notifications;
    } catch (error) {
      console.error('❌ Error getting scheduled notifications:', error);
      return [];
    }
  }

  // Dismiss all notifications
  async dismissAllNotifications() {
    try {
      await Notifications.dismissAllNotificationsAsync();
      console.log('👋 All notifications dismissed');
    } catch (error) {
      console.error('❌ Error dismissing notifications:', error);
    }
  }

  // Cleanup listeners
  cleanup() {
    if (this.notificationListener) {
      Notifications.removeNotificationSubscription(this.notificationListener);
    }
    if (this.responseListener) {
      Notifications.removeNotificationSubscription(this.responseListener);
    }
    if (this.medicationListener) {
      this.medicationListener();
    }
  }
}

export default new NotificationService();