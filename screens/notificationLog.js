import React, { useEffect, useState } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  ScrollView,
  SafeAreaView,
  RefreshControl,
  Alert,
} from 'react-native';
import { AntDesign } from '@expo/vector-icons';
import { getAuth } from 'firebase/auth';
import { db } from '../services/firebaseConfig';
import { collection, query, where, onSnapshot } from 'firebase/firestore';
import FirestoreDataService from '../services/FirestoreDataService';

export default function NotificationLog({ navigation }) {
  const [notifications, setNotifications] = useState([]);
  const [selectedCategory, setSelectedCategory] = useState('all');
  const [isLoading, setIsLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const auth = getAuth();

  useEffect(() => {
    loadNotifications();
  }, []);

  const loadNotifications = async () => {
    try {
      const user = auth.currentUser;
      if (!user) {
        setIsLoading(false);
        return;
      }

      // Load all notifications from Firestore
      const allNotifications = await FirestoreDataService.getNotificationHistory(user.uid, 100);
      
      // Transform Firestore timestamp to JavaScript timestamp
      const transformedNotifications = allNotifications.map(notif => ({
        ...notif,
        time: notif.timestamp?.toDate ? notif.timestamp.toDate().getTime() : Date.now()
      }));
      
      setNotifications(transformedNotifications);

      // Set up real-time listener for medicines to create triggered notifications
      const medsQuery = query(
        collection(db, 'medications'),
        where('userId', '==', user.uid)
      );

      const unsubscribe = onSnapshot(medsQuery, async (snapshot) => {
        const medicineData = snapshot.docs.map(doc => ({
          id: doc.id,
          ...doc.data(),
        }));

        await checkAndCreateNotifications(medicineData, user.uid);
        
        // Reload notifications after checking
        const updatedNotifications = await FirestoreDataService.getNotificationHistory(user.uid, 100);
        const transformed = updatedNotifications.map(notif => ({
          ...notif,
          time: notif.timestamp?.toDate ? notif.timestamp.toDate().getTime() : Date.now()
        }));
        setNotifications(transformed);
        setIsLoading(false);
      });

      setIsLoading(false);
      return () => unsubscribe?.();
    } catch (error) {
      console.error('Error loading notifications:', error);
      setIsLoading(false);
    }
  };

  const onRefresh = async () => {
    setRefreshing(true);
    await loadNotifications();
    setRefreshing(false);
  };

  const checkAndCreateNotifications = async (medicines, userId) => {
    const now = new Date();
    const dateKey = now.toISOString().split('T')[0];

    // Get existing notifications to avoid duplicates
    const existingNotifications = await FirestoreDataService.getNotificationHistory(userId, 1000);
    const existingNotifIds = new Set(existingNotifications.map(n => n.notificationId));

    for (const med of medicines) {
      if (!med.reminderTimes || med.reminderTimes.length === 0) continue;

      for (const reminderTime of med.reminderTimes) {
        const [time, meridiem] = reminderTime.split(' ');
        if (!time || !meridiem) continue;

        let [hours, minutes] = time.split(':').map(Number);
        if (meridiem.toLowerCase() === 'pm' && hours < 12) hours += 12;
        if (meridiem.toLowerCase() === 'am' && hours === 12) hours = 0;

        const reminderDate = new Date();
        reminderDate.setHours(hours, minutes, 0, 0);

        // Check if we should log this as triggered
        if (now >= reminderDate) {
          const notificationId = `${med.id}_${dateKey}_${reminderTime}`;
          
          if (!existingNotifIds.has(notificationId)) {
            await FirestoreDataService.logNotification(
              userId,
              med.id,
              med.name,
              med.dosage,
              'triggered',
              reminderTime
            );
            console.log(`Auto-logged triggered notification for ${med.name} at ${reminderTime}`);
          }
        }
      }
    }
  };

  const formatTime = (timestamp) => {
    const date = new Date(timestamp);
    const now = new Date();
    const diffInMinutes = Math.floor((now - date) / (1000 * 60));

    if (diffInMinutes < 1) return 'Just now';
    if (diffInMinutes < 60) return `${diffInMinutes}m ago`;

    const diffInHours = Math.floor(diffInMinutes / 60);
    if (diffInHours < 24) return `${diffInHours}h ago`;

    const diffInDays = Math.floor(diffInHours / 24);
    if (diffInDays === 1) return 'Yesterday';
    if (diffInDays < 7) return `${diffInDays}d ago`;

    return date.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
  };

  const getFullTimestamp = (timestamp) => {
    const date = new Date(timestamp);
    return date.toLocaleString('en-US', {
      month: 'short',
      day: 'numeric',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
      hour12: true,
    });
  };

  const categorizeNotifications = (notifications) => {
    const now = new Date();
    const categories = {
      latest: [],
      missed: [],
      taken: [],
      notifications: [],
      read: [],
    };

    notifications.forEach(notification => {
      const notifDate = new Date(notification.time);
      const hoursDiff = (now - notifDate) / (1000 * 60 * 60);

      if (notification.action === 'taken') {
        categories.taken.push(notification);
      } else if (notification.action === 'missed') {
        categories.missed.push(notification);
      } else if (notification.action === 'dismissed') {
        categories.read.push(notification);
      } else if (notification.action === 'triggered') {
        if (hoursDiff < 24) categories.notifications.push(notification);
        else categories.read.push(notification);
      } else {
        if (hoursDiff < 24) categories.latest.push(notification);
        else categories.read.push(notification);
      }
    });

    return categories;
  };

  const getStatusIcon = (action) => {
    switch (action) {
      case 'taken':
        return { name: 'checkcircle', color: '#10B981' };
      case 'dismissed':
        return { name: 'closecircle', color: '#9CA3AF' };
      case 'missed':
        return { name: 'exclamationcircle', color: '#EF4444' };
      case 'triggered':
        return { name: 'bells', color: '#3B82F6' };
      default:
        return { name: 'clockcircle', color: '#6B7280' };
    }
  };

  const getStatusText = (action) => {
    switch (action) {
      case 'taken':
        return 'Taken';
      case 'dismissed':
        return 'Dismissed';
      case 'missed':
        return 'Missed';
      case 'triggered':
        return 'Notification Sent';
      default:
        return 'Pending';
    }
  };

  const handleClearOldNotifications = async () => {
    const user = auth.currentUser;
    if (!user) return;

    Alert.alert(
      'Clear Old Notifications',
      'Clear notifications older than 30 days?',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Clear',
          style: 'destructive',
          onPress: async () => {
            const cleared = await FirestoreDataService.clearOldNotifications(user.uid, 30);
            if (cleared > 0) {
              Alert.alert('Success', `Cleared ${cleared} old notifications`);
              await loadNotifications();
            } else {
              Alert.alert('Info', 'No old notifications to clear');
            }
          }
        }
      ]
    );
  };

  const categorizedNotifications = categorizeNotifications(notifications);
  const displayNotifications =
    selectedCategory === 'all'
      ? [
          ...categorizedNotifications.latest,
          ...categorizedNotifications.notifications,
          ...categorizedNotifications.taken,
          ...categorizedNotifications.missed,
          ...categorizedNotifications.read,
        ]
      : categorizedNotifications[selectedCategory];

  const latestCount = categorizedNotifications.latest.length;
  const missedCount = categorizedNotifications.missed.length;
  const takenCount = categorizedNotifications.taken.length;
  const notificationsCount = categorizedNotifications.notifications.length;
  const readCount = categorizedNotifications.read.length;

  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.header}>
        <TouchableOpacity style={styles.backButton} onPress={() => navigation.goBack()}>
          <AntDesign name="arrowleft" size={22} color="#1F2937" />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Notifications</Text>
        <TouchableOpacity 
          style={styles.clearButton} 
          onPress={handleClearOldNotifications}
        >
          <AntDesign name="delete" size={20} color="#EF4444" />
        </TouchableOpacity>
      </View>

      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        style={styles.categoryContainer}
        contentContainerStyle={styles.categoryContent}
      >
        {[
          { key: 'all', label: `All (${notifications.length})` },
          { key: 'notifications', label: `Notif (${notificationsCount})` },
          { key: 'missed', label: `Missed (${missedCount})` },
          { key: 'taken', label: `Taken (${takenCount})` },
          { key: 'read', label: `Other (${readCount})` },
        ].map(tab => (
          <TouchableOpacity
            key={tab.key}
            style={[
              styles.categoryTab,
              selectedCategory === tab.key && styles.categoryTabActive,
            ]}
            onPress={() => setSelectedCategory(tab.key)}
          >
            <Text
              style={[
                styles.categoryText,
                selectedCategory === tab.key && styles.categoryTextActive,
              ]}
            >
              {tab.label}
            </Text>
          </TouchableOpacity>
        ))}
      </ScrollView>

      <ScrollView
        style={styles.scrollView}
        showsVerticalScrollIndicator={false}
        contentContainerStyle={styles.scrollContent}
        refreshControl={
          <RefreshControl refreshing={refreshing} onRefresh={onRefresh} />
        }
      >
        {isLoading ? (
          <View style={styles.emptyContainer}>
            <AntDesign name="loading1" size={56} color="#E5E7EB" />
            <Text style={styles.emptyTitle}>Loading...</Text>
          </View>
        ) : displayNotifications.length > 0 ? (
          displayNotifications.map((notification, index) => {
            const statusIcon = getStatusIcon(notification.action);
            const statusText = getStatusText(notification.action);
            return (
              <View key={notification.id || index} style={styles.notificationCard}>
                <View style={styles.cardLeft}>
                  <View style={styles.iconCircle}>
                    <Text style={styles.medicineIcon}>💊</Text>
                  </View>
                </View>
                <View style={styles.cardCenter}>
                  <Text style={styles.medicineName}>{notification.medicineName}</Text>
                  <Text style={styles.dosageText}>{notification.dosage}</Text>
                  <View style={styles.statusRow}>
                    <Text style={styles.statusLabel}>{statusText}</Text>
                    {notification.scheduledTime && notification.scheduledTime !== 'N/A' && (
                      <Text style={styles.scheduledTime}>
                        • Scheduled: {notification.scheduledTime}
                      </Text>
                    )}
                  </View>
                  <Text style={styles.timestampText}>
                    {getFullTimestamp(notification.time)}
                  </Text>
                </View>
                <View style={styles.cardRight}>
                  <Text style={styles.timeAgo}>{formatTime(notification.time)}</Text>
                  <AntDesign
                    name={statusIcon.name}
                    size={20}
                    color={statusIcon.color}
                    style={styles.statusIcon}
                  />
                </View>
              </View>
            );
          })
        ) : (
          <View style={styles.emptyContainer}>
            <AntDesign name="inbox" size={56} color="#E5E7EB" />
            <Text style={styles.emptyTitle}>No notifications</Text>
            <Text style={styles.emptySubtitle}>
              {selectedCategory === 'all'
                ? 'Your notification history will appear here'
                : `No ${selectedCategory} notifications yet`}
            </Text>
          </View>
        )}
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#F5F5F5',
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingVertical: 14,
    backgroundColor: '#FFFFFF',
    borderBottomWidth: 1,
    borderBottomColor: '#EEEEEE',
  },
  backButton: {
    width: 36,
    height: 36,
    justifyContent: 'center',
    alignItems: 'center',
  },
  headerTitle: {
    fontSize: 17,
    fontWeight: '600',
    color: '#1F2937',
    letterSpacing: -0.3,
  },
  clearButton: {
    width: 36,
    height: 36,
    justifyContent: 'center',
    alignItems: 'center',
  },
  categoryContainer: {
    backgroundColor: '#FFFFFF',
    borderBottomWidth: 1,
    borderBottomColor: '#EEEEEE',
    maxHeight: 55,
  },
  categoryContent: {
    paddingHorizontal: 16,
    paddingVertical: 10,
  },
  categoryTab: {
    paddingVertical: 8,
    paddingHorizontal: 16,
    marginRight: 8,
    borderRadius: 20,
    backgroundColor: '#F3F4F6',
  },
  categoryTabActive: {
    backgroundColor: '#9D4EDD',
  },
  categoryText: {
    fontSize: 13,
    fontWeight: '500',
    color: '#6B7280',
  },
  categoryTextActive: {
    color: '#FFFFFF',
  },
  scrollView: {
    flex: 1,
  },
  scrollContent: {
    paddingVertical: 8,
  },
  notificationCard: {
    flexDirection: 'row',
    backgroundColor: '#FFFFFF',
    padding: 14,
    borderBottomWidth: 1,
    borderBottomColor: '#F3F4F6',
    alignItems: 'center',
  },
  cardLeft: {
    marginRight: 10,
  },
  iconCircle: {
    width: 38,
    height: 38,
    borderRadius: 19,
    backgroundColor: '#F9FAFB',
    justifyContent: 'center',
    alignItems: 'center',
  },
  medicineIcon: {
    fontSize: 18,
  },
  cardCenter: {
    flex: 1,
  },
  medicineName: {
    fontSize: 14,
    fontWeight: '600',
    color: '#1F2937',
  },
  dosageText: {
    fontSize: 13,
    color: '#6B7280',
  },
  statusRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: 4,
    flexWrap: 'wrap',
  },
  statusLabel: {
    fontSize: 12,
    color: '#3B82F6',
  },
  scheduledTime: {
    fontSize: 11,
    color: '#9CA3AF',
    marginLeft: 4,
  },
  timestampText: {
    fontSize: 11,
    color: '#9CA3AF',
    marginTop: 2,
  },
  cardRight: {
    alignItems: 'flex-end',
  },
  timeAgo: {
    fontSize: 11,
    color: '#9CA3AF',
    marginBottom: 4,
  },
  statusIcon: {
    marginTop: 2,
  },
  emptyContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingVertical: 120,
  },
  emptyTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: '#1F2937',
    marginTop: 12,
  },
  emptySubtitle: {
    fontSize: 14,
    color: '#6B7280',
    marginTop: 4,
    textAlign: 'center',
    paddingHorizontal: 40,
  },
});
