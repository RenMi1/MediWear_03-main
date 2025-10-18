// NotificationLogger.js - Helper utility for logging notifications
import AsyncStorage from '@react-native-async-storage/async-storage';

const NOTIFICATION_LOG_KEY = 'notification_log_';

class NotificationLogger {
  /**
   * Log a notification action
   * @param {Object} params - Notification parameters
   * @param {string} params.medicineId - Medicine ID
   * @param {string} params.medicineName - Medicine name
   * @param {string} params.dosage - Medicine dosage
   * @param {string} params.scheduledTime - Scheduled time (optional)
   * @param {string} params.action - Action type: 'triggered', 'taken', 'missed', 'dismissed', 'acknowledged'
   * @param {string} params.type - Notification type: 'reminder', 'manual', 'system'
   */
  static async logNotification({
    medicineId,
    medicineName,
    dosage,
    scheduledTime = null,
    action,
    type = 'manual'
  }) {
    try {
      const now = new Date();
      const dateKey = now.toISOString().split('T')[0];
      const storageKey = `${NOTIFICATION_LOG_KEY}${dateKey}`;
      
      const notificationId = `${medicineId}_${dateKey}_${scheduledTime || now.getTime()}`;
      
      const notification = {
        notificationId,
        medicineId,
        medicineName,
        dosage,
        time: now.toISOString(),
        scheduledTime,
        action,
        type
      };
      
      const existing = await AsyncStorage.getItem(storageKey);
      const notifications = existing ? JSON.parse(existing) : [];
      
      // Check if this exact notification already exists
      const existingIndex = notifications.findIndex(
        n => n.notificationId === notificationId && n.action === action
      );
      
      if (existingIndex >= 0) {
        // Update existing notification
        notifications[existingIndex] = notification;
      } else {
        // Add new notification
        notifications.push(notification);
      }
      
      await AsyncStorage.setItem(storageKey, JSON.stringify(notifications));
      
      console.log(`Notification logged: ${action} for ${medicineName}`);
      return true;
    } catch (error) {
      console.error('Error logging notification:', error);
      return false;
    }
  }

  /**
   * Log when medication is marked as taken
   */
  static async logTaken(medicineId, medicineName, dosage, scheduledTime = null) {
    return await this.logNotification({
      medicineId,
      medicineName,
      dosage,
      scheduledTime,
      action: 'taken',
      type: 'manual'
    });
  }

  /**
   * Log when medication is marked as missed
   */
  static async logMissed(medicineId, medicineName, dosage, scheduledTime) {
    return await this.logNotification({
      medicineId,
      medicineName,
      dosage,
      scheduledTime,
      action: 'missed',
      type: 'system'
    });
  }

  /**
   * Log when notification is triggered/sent
   */
  static async logTriggered(medicineId, medicineName, dosage, scheduledTime) {
    return await this.logNotification({
      medicineId,
      medicineName,
      dosage,
      scheduledTime,
      action: 'triggered',
      type: 'reminder'
    });
  }

  /**
   * Log when notification is dismissed
   */
  static async logDismissed(medicineId, medicineName, dosage, scheduledTime) {
    return await this.logNotification({
      medicineId,
      medicineName,
      dosage,
      scheduledTime,
      action: 'dismissed',
      type: 'manual'
    });
  }

  /**
   * Get all notifications for a specific date
   */
  static async getNotificationsForDate(date) {
    try {
      const dateKey = date.toISOString().split('T')[0];
      const storageKey = `${NOTIFICATION_LOG_KEY}${dateKey}`;
      const data = await AsyncStorage.getItem(storageKey);
      return data ? JSON.parse(data) : [];
    } catch (error) {
      console.error('Error getting notifications for date:', error);
      return [];
    }
  }

  /**
   * Get all notifications
   */
  static async getAllNotifications() {
    try {
      const keys = await AsyncStorage.getAllKeys();
      const notificationKeys = keys.filter(key => key.startsWith(NOTIFICATION_LOG_KEY));
      
      const allNotifications = [];
      for (const key of notificationKeys) {
        const data = await AsyncStorage.getItem(key);
        if (data) {
          const parsed = JSON.parse(data);
          allNotifications.push(...parsed);
        }
      }
      
      return allNotifications.sort((a, b) => new Date(b.time) - new Date(a.time));
    } catch (error) {
      console.error('Error getting all notifications:', error);
      return [];
    }
  }

  /**
   * Clear old notifications (older than specified days)
   */
  static async clearOldNotifications(daysToKeep = 30) {
    try {
      const keys = await AsyncStorage.getAllKeys();
      const notificationKeys = keys.filter(key => key.startsWith(NOTIFICATION_LOG_KEY));
      
      const cutoffDate = new Date();
      cutoffDate.setDate(cutoffDate.getDate() - daysToKeep);
      const cutoffKey = cutoffDate.toISOString().split('T')[0];
      
      const keysToRemove = notificationKeys.filter(key => {
        const dateFromKey = key.replace(NOTIFICATION_LOG_KEY, '');
        return dateFromKey < cutoffKey;
      });
      
      if (keysToRemove.length > 0) {
        await AsyncStorage.multiRemove(keysToRemove);
        console.log(`Cleared ${keysToRemove.length} old notification logs`);
      }
      
      return keysToRemove.length;
    } catch (error) {
      console.error('Error clearing old notifications:', error);
      return 0;
    }
  }
}

export default NotificationLogger;