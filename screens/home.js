import React, { useState, useEffect } from 'react';
import { View, Text, TouchableOpacity, StyleSheet, ScrollView, SafeAreaView, Alert, Image } from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { useFocusEffect } from '@react-navigation/native';
import { AntDesign, Entypo, FontAwesome5 } from "@expo/vector-icons";
import BluetoothService from '../services/BluetoothService';


import { db, auth } from '../services/firebaseConfig';
import { collection, query, where, onSnapshot } from 'firebase/firestore';
import { onAuthStateChanged } from 'firebase/auth';


export default function Home({ navigation }) {
  const [userId, setUserId] = useState(null);
  const [todayMedicines, setTodayMedicines] = useState([]);
  const [medicineStats, setMedicineStats] = useState({
    totalDoses: 0,
    takenDoses: 0,
    missedDoses: 0,
    completionPercentage: 0
  });
  const [weeklyProgress, setWeeklyProgress] = useState(0);
  const [streak, setStreak] = useState(0);
  const [isLoading, setIsLoading] = useState(true);
  const [watchAdherenceData, setWatchAdherenceData] = useState(null);
  const [hasNotification, setHasNotification] = useState(false);
  const [notificationLog, setNotificationLog] = useState([]);


  // USER-SPECIFIC KEYS - Include userId
  const getStatusStorageKey = (uid) => `medicine_status_${uid}_`;
  const getDailyStatusKey = (uid) => `daily_status_${uid}_`;
  const getWatchAdherenceKey = (uid) => `watch_adherence_data_${uid}`;
  const getNotificationLogKey = (uid) => `notification_log_${uid}_`;


  const [userData, setUserData] = useState({
    name: 'User',
    email: 'user@example.com',
  });


  useEffect(() => {
    loadUserData();
   
    const unsubscribe = navigation.addListener('focus', () => {
      loadUserData();
    });


    return unsubscribe;
  }, [navigation]);


  const loadUserData = async () => {
    try {
      const storedData = await AsyncStorage.getItem('userData');
      if (storedData) {
        const parsedData = JSON.parse(storedData);
        setUserData({
          name: parsedData.name || 'User',
          email: parsedData.email || 'user@example.com',
        });
      }
    } catch (error) {
      console.error('Error loading user data:', error);
    }
  };


  const getFirstName = (fullName) => {
    if (!fullName) return 'User';
    const names = fullName.trim().split(' ');
    return names[0];
  };


  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, (user) => {
      if (user) {
        setUserId(user.uid);
      } else {
        setUserId(null);
        setTodayMedicines([]);
        setMedicineStats({ totalDoses: 0, takenDoses: 0, missedDoses: 0, completionPercentage: 0 });
        setWeeklyProgress(0);
        setStreak(0);
        setNotificationLog([]);
        setHasNotification(false);
        setWatchAdherenceData(null);
      }
      setIsLoading(false);
    });


    return unsubscribe;
  }, []);


  // Load notification log when userId changes
  useEffect(() => {
    if (userId) {
      loadNotificationLog(userId);
    }
  }, [userId]);


  const loadNotificationLog = async (uid) => {
    if (!uid) return;


    try {
      const NOTIFICATION_LOG_KEY = getNotificationLogKey(uid);
      const allKeys = await AsyncStorage.getAllKeys();
      const notificationKeys = allKeys.filter(key => key.startsWith(NOTIFICATION_LOG_KEY));
     
      const allNotifications = [];
      for (const key of notificationKeys) {
        const data = await AsyncStorage.getItem(key);
        if (data) {
          const parsed = JSON.parse(data);
          allNotifications.push(...parsed);
        }
      }


      setNotificationLog(allNotifications);
      const hasUnread = allNotifications.some(notif => !notif.read);
      setHasNotification(hasUnread);
    } catch (error) {
      console.error('Failed to load notification log:', error);
    }
  };


  const saveNotificationLog = async (notification, uid) => {
    if (!uid) return;


    try {
      const NOTIFICATION_LOG_KEY = getNotificationLogKey(uid);
      const dateKey = new Date(notification.time).toISOString().split('T')[0];
      const storageKey = `${NOTIFICATION_LOG_KEY}${dateKey}`;
     
      const existing = await AsyncStorage.getItem(storageKey);
      const notifications = existing ? JSON.parse(existing) : [];
      notifications.push(notification);
      await AsyncStorage.setItem(storageKey, JSON.stringify(notifications));
    } catch (error) {
      console.error('Failed to save notification log:', error);
    }
  };


  const addNotificationToLog = async (medicineData, action) => {
    if (!userId) return;


    const newNotification = {
      notificationId: `${medicineData.id}_${Date.now()}`,
      medicineId: medicineData.id,
      medicineName: medicineData.name || 'Unknown Medicine',
      dosage: medicineData.dosage,
      time: new Date().toISOString(),
      action: action,
      type: 'manual',
      read: false,
    };


    await saveNotificationLog(newNotification, userId);
    await loadNotificationLog(userId);
  };


  const handleBellPress = () => {
    navigation.navigate('NotificationLog');
  };


  useEffect(() => {
    if (userId) {
      loadWatchAdherenceData(userId);
    }
  }, [userId]);


  const loadWatchAdherenceData = async (uid) => {
  if (!uid) {
    setWatchAdherenceData(null);
    return;
  }

  try {
    const WATCH_ADHERENCE_KEY = getWatchAdherenceKey(uid);
    const savedData = await AsyncStorage.getItem(WATCH_ADHERENCE_KEY);
    
    if (savedData) {
      const parsedData = JSON.parse(savedData);
      setWatchAdherenceData(parsedData);
      console.log('Loaded saved watch adherence:', parsedData);
    } else {
      // No data found for this user - set to null
      setWatchAdherenceData(null);
      console.log('No watch adherence data found for user:', uid);
    }
  } catch (error) {
    console.error('Failed to load watch adherence data:', error);
    setWatchAdherenceData(null);
  }
};
  const saveWatchAdherenceData = async (data, uid) => {
    if (!uid) return;


    try {
      const WATCH_ADHERENCE_KEY = getWatchAdherenceKey(uid);
      await AsyncStorage.setItem(WATCH_ADHERENCE_KEY, JSON.stringify(data));
      console.log('Saved watch adherence data:', data);
    } catch (error) {
      console.error('Failed to save watch adherence data:', error);
    }
  };


  const getCurrentDateKey = () => {
    const today = new Date();
    return today.toISOString().split('T')[0];
  };


  const calculateStreak = async (uid) => {
    if (!uid) {
      setStreak(0);
      return;
    }


    try {
      const DAILY_STATUS_KEY = getDailyStatusKey(uid);
      const allKeys = await AsyncStorage.getAllKeys();
      const dailyStatusKeys = allKeys.filter(key => key.startsWith(DAILY_STATUS_KEY));
     
      if (dailyStatusKeys.length === 0) {
        setStreak(0);
        return;
      }


      const sortedDates = dailyStatusKeys
        .map(key => key.replace(DAILY_STATUS_KEY, ''))
        .sort((a, b) => new Date(b) - new Date(a));


      let currentStreak = 0;
      const today = getCurrentDateKey();


      for (const date of sortedDates) {
        const progressKey = `${DAILY_STATUS_KEY}${date}`;
        const progressData = await AsyncStorage.getItem(progressKey);
       
        if (progressData) {
          const progress = JSON.parse(progressData);
          const statuses = Object.values(progress);
          const takenCount = statuses.filter(item => item.status === 'taken').length;
          const totalCount = statuses.length;
         
          const completionRate = totalCount > 0 ? (takenCount / totalCount) : 0;
         
          if (completionRate >= 0.8) {
            currentStreak++;
          } else {
            break;
          }
        } else if (date === today) {
          continue;
        } else {
          break;
        }
      }


      setStreak(currentStreak);
    } catch (error) {
      console.error('Failed to calculate streak:', error);
      setStreak(0);
    }
  };


  const calculateWeeklyProgress = async (uid) => {
    if (!uid) {
      setWeeklyProgress(0);
      return;
    }


    try {
      const DAILY_STATUS_KEY = getDailyStatusKey(uid);
      const today = new Date();
      let totalExpectedDoses = 0;
      let totalTakenDoses = 0;


      for (let i = 0; i < 7; i++) {
        const checkDate = new Date(today.getTime() - i * 24 * 60 * 60 * 1000);
        const dateKey = checkDate.toISOString().split('T')[0];
        const progressKey = `${DAILY_STATUS_KEY}${dateKey}`;
       
        const progressData = await AsyncStorage.getItem(progressKey);
        if (progressData) {
          const progress = JSON.parse(progressData);
          const statuses = Object.values(progress);
         
          totalExpectedDoses += statuses.length;
          totalTakenDoses += statuses.filter(item => item.status === 'taken').length;
        }
      }


      const weeklyPercentage = totalExpectedDoses > 0 ? Math.round((totalTakenDoses / totalExpectedDoses) * 100) : 0;
      setWeeklyProgress(weeklyPercentage);
    } catch (error) {
      console.error('Failed to calculate weekly progress:', error);
      setWeeklyProgress(0);
    }
  };


  const isMedicineScheduledForToday = (medicine) => {
    const today = new Date();
    const dayOfWeek = today.getDay();


    if (!medicine.days) return true;


    switch (medicine.days) {
      case 'Daily':
        return true;
      case 'Weekdays':
        return dayOfWeek >= 1 && dayOfWeek <= 5;
      case 'Weekends':
        return dayOfWeek === 0 || dayOfWeek === 6;
      case 'Mon-Wed-Fri':
        return dayOfWeek === 1 || dayOfWeek === 3 || dayOfWeek === 5;
      case 'Tue-Thu-Sat':
        return dayOfWeek === 2 || dayOfWeek === 4 || dayOfWeek === 6;
      default:
        return true;
    }
  };


  const checkMissedDoses = async (medicines, uid) => {
    if (!uid) return { updatedMedicines: medicines, hasChanges: false };


    const STATUS_STORAGE_KEY = getStatusStorageKey(uid);
    const now = new Date();
    const dateKey = getCurrentDateKey();
    let hasChanges = false;
   
    const updatedMedicines = await Promise.all(
      medicines.map(async (med) => {
        if (med.status === 'pending' && med.reminderTimes && med.reminderTimes.length > 0) {
          for (const reminderTime of med.reminderTimes) {
            const [time, meridiem] = reminderTime.split(' ');
            if (!time || !meridiem) continue;
           
            let [hours, minutes] = time.split(':').map(Number);
           
            if (meridiem.toLowerCase() === 'pm' && hours < 12) {
              hours += 12;
            }
            if (meridiem.toLowerCase() === 'am' && hours === 12) {
              hours = 0;
            }
           
            const doseTime = new Date();
            doseTime.setHours(hours, minutes, 0, 0);
           
            const tenMinutesAfterDose = new Date(doseTime.getTime() + 10 * 60000);
           
            if (now > tenMinutesAfterDose && med.status === 'pending') {
              const statusKey = `${STATUS_STORAGE_KEY}${med.id}_${dateKey}`;
              await AsyncStorage.setItem(statusKey, 'missed');
              med.status = 'missed';
              hasChanges = true;
             
              await addNotificationToLog(med, 'missed');
             
              break;
            }
          }
        }
        return med;
      })
    );


    return { updatedMedicines, hasChanges };
  };


  const loadTodayMedicines = async () => {
    if (!userId) {
      setTodayMedicines([]);
      setMedicineStats({ totalDoses: 0, takenDoses: 0, missedDoses: 0, completionPercentage: 0 });
      return () => {};
    }


    try {
      const STATUS_STORAGE_KEY = getStatusStorageKey(userId);
      const DAILY_STATUS_KEY = getDailyStatusKey(userId);
      const dateKey = getCurrentDateKey();
     
      const q = query(
        collection(db, "medications"),
        where("userId", "==", userId)
      );
     
      const unsubscribe = onSnapshot(q, async (querySnapshot) => {
        const allMedicines = querySnapshot.docs.map(doc => ({
          id: doc.id,
          ...doc.data(),
        }));
       
        const filteredMedicines = allMedicines.filter(med =>
          med.reminderTimes &&
          med.reminderTimes.length > 0 &&
          med.reminderEnabled !== false &&
          isMedicineScheduledForToday(med)
        );
       
        const medicinesWithStatus = await Promise.all(
          filteredMedicines.map(async (med) => {
            const statusKey = `${STATUS_STORAGE_KEY}${med.id}_${dateKey}`;
            const status = await AsyncStorage.getItem(statusKey);
            return {
              ...med,
              status: status || 'pending',
            };
          })
        );
       
        const { updatedMedicines } = await checkMissedDoses(medicinesWithStatus, userId);
       
        setTodayMedicines(updatedMedicines);


        const totalDoses = updatedMedicines.length;
        const takenDoses = updatedMedicines.filter(med => med.status === 'taken').length;
        const missedDoses = updatedMedicines.filter(med => med.status === 'missed').length;
        const completionPercentage = totalDoses > 0 ? Math.round((takenDoses / totalDoses) * 100) : 0;
       
        setMedicineStats({
          totalDoses: totalDoses,
          takenDoses: takenDoses,
          missedDoses: missedDoses,
          completionPercentage: completionPercentage
        });


        if (totalDoses > 0) {
          const progressKey = `${DAILY_STATUS_KEY}${dateKey}`;
          const progressData = {};
         
          updatedMedicines.forEach(med => {
            progressData[med.id] = {
              status: med.status,
              timestamp: new Date().toISOString(),
              medicineName: med.name || 'Unknown Medicine'
            };
          });
         
          await AsyncStorage.setItem(progressKey, JSON.stringify(progressData));
        }
      }, (error) => {
        console.error('Failed to load today\'s medicines from Firestore:', error);
        Alert.alert("Error", "Could not load medicine schedule. Check your internet or login status.");
        setTodayMedicines([]);
        setMedicineStats({ totalDoses: 0, takenDoses: 0, missedDoses: 0, completionPercentage: 0 });
      });


      return unsubscribe;
    } catch (error) {
      console.error('Failed to set up Firestore listener:', error);
      Alert.alert("Error", "Could not load medicine schedule.");
      setTodayMedicines([]);
      setMedicineStats({ totalDoses: 0, takenDoses: 0, missedDoses: 0, completionPercentage: 0 });
      return () => {};
    }
  };


  const handleTaken = async (medicineId) => {
    if (!userId) return;


    const STATUS_STORAGE_KEY = getStatusStorageKey(userId);
    const DAILY_STATUS_KEY = getDailyStatusKey(userId);
    const dateKey = getCurrentDateKey();
    const statusKey = `${STATUS_STORAGE_KEY}${medicineId}_${dateKey}`;
   
    try {
      await AsyncStorage.setItem(statusKey, 'taken');
     
      const progressKey = `${DAILY_STATUS_KEY}${dateKey}`;
      const existingProgress = await AsyncStorage.getItem(progressKey);
      const progress = existingProgress ? JSON.parse(existingProgress) : {};
     
      const medicine = todayMedicines.find(med => med.id === medicineId);
      progress[medicineId] = {
        status: 'taken',
        timestamp: new Date().toISOString(),
        medicineName: medicine ? medicine.name : 'Unknown'
      };
     
      await AsyncStorage.setItem(progressKey, JSON.stringify(progress));
     
      if (medicine) {
        await addNotificationToLog(medicine, 'taken');
      }
     
      setTodayMedicines(prevMeds =>
        prevMeds.map(med =>
          med.id === medicineId ? { ...med, status: 'taken' } : med
        )
      );


      const updatedMeds = todayMedicines.map(med =>
        med.id === medicineId ? { ...med, status: 'taken' } : med
      );
      const totalDoses = updatedMeds.length;
      const takenDoses = updatedMeds.filter(med => med.status === 'taken').length;
      const missedDoses = updatedMeds.filter(med => med.status === 'missed').length;
      const completionPercentage = totalDoses > 0 ? Math.round((takenDoses / totalDoses) * 100) : 0;
     
      setMedicineStats({
        totalDoses,
        takenDoses,
        missedDoses,
        completionPercentage
      });
     
      await calculateWeeklyProgress(userId);
     
      Alert.alert('Success', 'Medicine marked as taken!');
    } catch (error) {
      console.error('Failed to update medicine status:', error);
      Alert.alert('Error', 'Failed to update status.');
    }
  };


  useFocusEffect(
    React.useCallback(() => {
      if (!userId) return;
     
      let unsubscribe;
     
      const loadData = async () => {
        unsubscribe = await loadTodayMedicines();
        await calculateStreak(userId);
        await calculateWeeklyProgress(userId);
        await loadWatchAdherenceData(userId);
        await loadNotificationLog(userId);
      };
     
      loadData();


      return () => {
        if (unsubscribe && typeof unsubscribe === 'function') {
          unsubscribe();
        }
      };
    }, [userId])
  );


  useEffect(() => {
    if (!userId) return;
   
    const interval = setInterval(async () => {
      if (todayMedicines.length > 0) {
        const { updatedMedicines, hasChanges } = await checkMissedDoses(todayMedicines, userId);
        if (hasChanges) {
          setTodayMedicines(updatedMedicines);
         
          const totalDoses = updatedMedicines.length;
          const takenDoses = updatedMedicines.filter(med => med.status === 'taken').length;
          const missedDoses = updatedMedicines.filter(med => med.status === 'missed').length;
          const completionPercentage = totalDoses > 0 ? Math.round((takenDoses / totalDoses) * 100) : 0;
         
          setMedicineStats({
            totalDoses,
            takenDoses,
            missedDoses,
            completionPercentage
          });
        }
      }
    }, 60000);


    return () => clearInterval(interval);
  }, [userId, todayMedicines]);


  const getCurrentDate = () => {
    const today = new Date();
    const options = {
      weekday: 'long',
      year: 'numeric',
      month: 'long',
      day: 'numeric'
    };
    return today.toLocaleDateString('en-US', options);
  };


  const getCurrentTime = () => {
    const now = new Date();
    const hours = now.getHours();
   
    if (hours < 12) return 'Good Morning';
    if (hours < 17) return 'Good Afternoon';
    return 'Good Evening';
  };


  const formatReminderTimes = (reminderTimes) => {
    if (!reminderTimes || reminderTimes.length === 0) return '';
    if (reminderTimes.length === 1) return reminderTimes[0];
    return `${reminderTimes[0]} (+${reminderTimes.length - 1} more)`;
  };
 
  const getStatusStyle = (status) => {
    switch (status) {
      case 'taken':
        return { text: 'Taken', color: '#fff', backgroundColor: '#5cb85c' };
      case 'missed':
        return { text: 'Missed', color: '#fff', backgroundColor: '#d9534f' };
      default:
        return { text: 'Take Now', color: '#fff', backgroundColor: '#007bff' };
    }
  };


  useEffect(() => {
    const unsubscribe = BluetoothService.subscribe((data) => {
      if (data.type === 'ADHERENCE_DATA' && userId) {
        console.log('Watch Adherence received:', data.data);
       
        const adherenceDataWithTimestamp = {
          ...data.data,
          lastUpdated: new Date().toISOString()
        };
       
        setWatchAdherenceData(adherenceDataWithTimestamp);
        saveWatchAdherenceData(adherenceDataWithTimestamp, userId);
      }
    });


    return () => unsubscribe();
  }, [userId]);


  const getAdherenceStatus = (percentage) => {
  const roundedPercentage = Math.round(percentage || 0); // Added Math.round() and || 0
  
  if (roundedPercentage >= 90) {
    return { text: 'Excellent Adherence', color: '#28a745', percentage: roundedPercentage };
  } else if (roundedPercentage >= 70) {
    return { text: 'Good Adherence', color: '#ffc107', percentage: roundedPercentage };
  } else if (roundedPercentage >= 50) {
    return { text: 'Needs Improvement', color: '#fd7e14', percentage: roundedPercentage };
  } else {
    return { text: 'Poor Adherence', color: '#dc3545', percentage: roundedPercentage };
  }
};



  const adherenceStatus = getAdherenceStatus(medicineStats.completionPercentage);


  const watchAdherenceStatus = (watchAdherenceData && typeof watchAdherenceData.percentage === 'number')
  ? getAdherenceStatus(watchAdherenceData.percentage)
  : { text: 'No Data', color: '#999', percentage: 0 };
 
  if (isLoading) {
    return (
      <SafeAreaView style={styles.container}>
        <View style={styles.loadingContainer}>
          <Text style={styles.loadingText}>Loading...</Text>
        </View>
      </SafeAreaView>
    );
  }


  if (!userId) {
    return (
      <SafeAreaView style={styles.container}>
        <View style={styles.emptyContainer}>
          <Text style={styles.emptyIcon}>🔒</Text>
          <Text style={styles.emptyTitle}>Please Log In</Text>
          <Text style={styles.emptySubtitle}>Your medication schedule is private. Log in to access it.</Text>
          <TouchableOpacity
            style={styles.loginButton}
            onPress={() => navigation.navigate("Login")}
          >
            <Text style={styles.loginButtonText}>Go to Login</Text>
          </TouchableOpacity>
        </View>
      </SafeAreaView>
    );
  }


  return (
    <SafeAreaView style={styles.container}>
      <ScrollView
        style={styles.scrollView}
        showsVerticalScrollIndicator={false}
        contentContainerStyle={{ paddingBottom: 120 }}
      >


          <View style={styles.headerCard}>
            <View style={styles.headerContent}>
             
              <View style={styles.headerTopRow}>
                  <View style={styles.menuAndGreeting}>
                  <TouchableOpacity
                    style={styles.menuButton}
                    onPress={() => navigation.openDrawer()}
                  >
                    <Image
                      source={require('../assets/menu-icon.png')}
                      style={styles.menuIcon}
                      resizeMode="contain"
                    />
                  </TouchableOpacity>
                 
                 <Text style={styles.helloUsername}>
                <Text style={styles.helloNormal}>  Hello, </Text>
                <Text style={styles.helloBold}>{getFirstName(userData.name)}!</Text>
              </Text>
            </View>


                <TouchableOpacity
                  style={styles.bellButton}
                  onPress={handleBellPress}
                >
                  <Image
                    source={require('../assets/bell.png')}
                    style={styles.menuIcon}
                    resizeMode="contain"
                  />
                  {hasNotification && <View style={styles.notificationDot} />}
                </TouchableOpacity>
              </View>
             
              <Text style={styles.greeting}>{getCurrentTime()}</Text>
              <Text style={styles.date}>{getCurrentDate()}</Text>


              <View style={styles.headerRow}>
                <View style={styles.streakContainer}>
                  <FontAwesome5
                    name="fire"
                    size={24}
                    color={streak > 0 ? "#ff6b35" : "white"}
                    style={styles.streakIcon}
                  />
                  <Text style={styles.streakText}>{streak} Days Streak</Text>
                </View>
              </View>


            </View>
          </View>


        <View style={styles.progressSection}>
          <Text style={styles.sectionTitle}>Today's Progress</Text>
          <View style={styles.progressCard}>
            <View style={styles.circularProgress}>
              <View style={styles.progressCircle}>
                <Text style={styles.progressNumber}>{medicineStats.takenDoses}/{medicineStats.totalDoses}</Text>
                <Text style={styles.progressLabel}>taken</Text>
              </View>
            </View>
            <View style={styles.progressStats}>
              <View style={styles.statItem}>
                <Text style={styles.statValue}>{medicineStats.completionPercentage}%</Text>
                <Text style={styles.statLabel}>Today</Text>
              </View>
              <View style={styles.statItem}>
                <Text style={[styles.statValue, { color: 'green' }]}>{weeklyProgress}%</Text>
                <Text style={styles.statLabel}>Weekly</Text>
              </View>
              {medicineStats.missedDoses > 0 && (
                <View style={styles.statItem}>
                  <Text style={[styles.statValue, { color: '#dc3545' }]}>{medicineStats.missedDoses}</Text>
                  <Text style={styles.statLabel}>Missed</Text>
                </View>
              )}
            </View>
          </View>
        </View>


        <View style={styles.adherenceSection}>
  <Text style={styles.sectionTitle}>System Adherence</Text>
  <View style={styles.adherenceRow}>
    <View style={[styles.adherenceCard, { backgroundColor: '#fff' }]}>
      <View style={[styles.connectionDot, { backgroundColor: adherenceStatus.color }]}></View>
      <Text style={styles.adherencePercentage}>
        {adherenceStatus.percentage}%
      </Text>
      <Text style={styles.adherenceLabel}>App Adherence</Text>
    </View>
    
    <View style={[styles.adherenceCard, { backgroundColor: '#fff' }]}>
      <View style={[
        styles.connectionDot, 
        { backgroundColor: watchAdherenceData ? watchAdherenceStatus.color : '#E0E0E0' }
      ]}></View>
      <Text style={styles.adherencePercentage}>
        {watchAdherenceData ? watchAdherenceStatus.percentage : 0}%
      </Text>
      <Text style={styles.adherenceLabel}>MediWear Adherence</Text>
      {!watchAdherenceData && (
        <Text style={styles.noDataText}>Not synced</Text>
      )}
    </View>
  </View>
</View>


        <View style={styles.medicationsSection}>
          <View style={styles.medicationsHeader}>
            <Text style={styles.sectionTitle}>Today's Medications</Text>
            <TouchableOpacity onPress={() => navigation.navigate("MedList")}>
              <Text style={styles.viewAllText}>View All</Text>
            </TouchableOpacity>
          </View>


          {todayMedicines.length > 0 ? (
            <View style={styles.medicationContainer}>
              {todayMedicines.slice(0, 3).map((item, index) => {
                const statusStyle = getStatusStyle(item.status);
                return (
                  <View key={item.id || index} style={styles.medicationCard}>
                    <View style={styles.medicationHeader}>
                      <View style={styles.medicationInfo}>
                        <Text style={styles.medicationName}>{item.name || 'Unknown Medicine'}</Text>
                        <Text style={styles.medicationDetails}>
                          {item.dosage || 'Unknown dosage'} • {item.frequency || 'Unknown frequency'}
                        </Text>
                        <Text style={styles.medicationTime}>
                          Take at {formatReminderTimes(item.reminderTimes)}
                        </Text>
                      </View>
                      <TouchableOpacity
                        style={[styles.statusButton, { backgroundColor: statusStyle.backgroundColor }]}
                        onPress={() => item.status === 'pending' ? handleTaken(item.id) : null}
                        disabled={item.status !== 'pending'}
                      >
                        <Text style={[styles.statusButtonText, { color: statusStyle.color }]}>
                          {statusStyle.text}
                        </Text>
                      </TouchableOpacity>
                    </View>
                   
                    {item.takeWithFood && (
                      <View style={styles.foodReminder}>
                        <Text style={styles.foodReminderIcon}>🍽️</Text>
                        <Text style={styles.foodReminderText}>Take with meal</Text>
                      </View>
                    )}
                   
                    {item.specialInstructions && (
                      <View style={styles.instructionReminder}>
                        <Text style={styles.instructionIcon}>⚠️</Text>
                        <Text style={styles.instructionText}>{item.specialInstructions}</Text>
                      </View>
                    )}
                  </View>
                );
              })}
             
              <View style={styles.medicationsPending}>
                <Text style={styles.pendingText}>
                  {medicineStats.totalDoses - medicineStats.takenDoses === 0 ?
                    'All medications taken for today!' :
                    `${medicineStats.totalDoses - medicineStats.takenDoses} medications pending`
                  }
                </Text>
              </View>
            </View>
          ) : (
            <View style={styles.emptyCard}>
              <Text style={styles.emptyIcon}>💊</Text>
              <Text style={styles.emptyText}>No medications for today</Text>
              <Text style={styles.emptySubtext}>Tap "Add" to create your schedule</Text>
              <TouchableOpacity
                style={styles.addButton}
                onPress={() => navigation.navigate("AddMedicine")}
              >
                <Text style={styles.addButtonText}>Add Medicine</Text>
              </TouchableOpacity>
            </View>
          )}
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}


const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#f8f9fa',
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  loadingText: {
    fontSize: 16,
    color: '#666',
  },
  emptyContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: 40,
  },
  emptyIcon: {
    fontSize: 48,
    marginBottom: 16,
  },
  emptyTitle: {
    fontSize: 20,
    fontWeight: '600',
    color: '#333',
    marginBottom: 8,
    textAlign: 'center',
  },
  emptySubtitle: {
    fontSize: 16,
    color: '#666',
    textAlign: 'center',
    lineHeight: 22,
    marginBottom: 24,
  },
  loginButton: {
    backgroundColor: '#007bff',
    paddingHorizontal: 24,
    paddingVertical: 12,
    borderRadius: 8,
  },
  loginButtonText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '600',
  },
  scrollView: {
    flex: 1,
  },
  headerCard: {
    backgroundColor: '#9D4EDD',
    borderBottomLeftRadius: 20,
    borderBottomRightRadius: 20,
    paddingTop: 15,
    paddingBottom: 30,
    paddingHorizontal: 20,
  },
  headerContent: {
    flex: 1,
  },
  headerTopRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 20,
  },
  menuButton: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: 'rgba(255, 255, 255, 0.2)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  menuIcon: {
    width: 30,
    height: 30,
    tintColor: '#fff',
  },
  bellButton: {
    width: 60,
    height: 60,
    borderRadius: 30,
    justifyContent: 'center',
    alignItems: 'center',
    position: 'relative',
  },
  notificationDot: {
    position: 'absolute',
    top: 8,
    right: 8,
    width: 12,
    height: 12,
    borderRadius: 6,
    backgroundColor: '#ff3b30',
    borderWidth: 2,
    borderColor: '#9D4EDD',
  },
  menuAndGreeting: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  helloUsername: {
    flexDirection: 'row',
    alignItems: 'baseline',
  },
  helloNormal: {
    fontWeight: '400',
    fontSize: 24,
    color: 'white',
  },
  helloBold: {
    fontWeight: '700',
    fontSize: 30,
    color: 'white',
  },
  greeting: {
    paddingTop: 15,
    fontSize: 24,
    fontWeight: 'bold',
    color: '#fff',
    marginBottom: 4,
  },
  date: {
    fontSize: 16,
    color: '#E8D5F2',
    marginBottom: 20,
  },
  headerRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  streakContainer: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  streakIcon: {
    marginRight: 8,
  },
  streakText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '500',
  },
  progressSection: {
    margin: 20,
    marginTop: 0,
  },
  sectionTitle: {
    fontSize: 20,
    fontWeight: 'bold',
    color: '#333',
    marginBottom: 16,
    paddingTop: 20,
  },
  progressCard: {
    backgroundColor: '#fff',
    borderRadius: 16,
    padding: 15,
    flexDirection: 'row',
    alignItems: 'center',
    shadowColor: '#000',
    shadowOffset: {
      width: 0,
      height: 2,
    },
    shadowOpacity: 0.1,
    shadowRadius: 3.84,
    elevation: 5,
  },
  circularProgress: {
    marginRight: 20,
  },
  progressCircle: {
    width: 80,
    height: 80,
    borderRadius: 40,
    backgroundColor: '#f0f8ff',
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 4,
    borderColor: '#9D4EDD',
  },
  progressNumber: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#9D4EDD',
  },
  progressLabel: {
    fontSize: 12,
    color: '#9D4EDD',
  },
  progressStats: {
    flex: 1,
    flexDirection: 'row',
    justifyContent: 'space-around',
  },
  statItem: {
    alignItems: 'center',
  },
  statValue: {
    fontSize: 20,
    fontWeight: 'bold',
    color: '#333',
  },
  statLabel: {
    fontSize: 12,
    color: '#666',
    marginTop: 4,
  },
  adherenceSection: {
    marginBottom: 12,
    paddingHorizontal: 20,
  },
  adherenceRow: {
    flexDirection: 'row',
    gap: 12,
    marginBottom: 12,
  },
  adherenceCard: {
    flex: 1,
    aspectRatio: 1,
    padding: 20,
    borderRadius: 16,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#fff',
    shadowColor: '#000',
    shadowOffset: {
      width: 0,
      height: 2,
    },
    shadowOpacity: 0.1,
    shadowRadius: 3.84,
    elevation: 5,
  },
  connectionDot: {
    width: 12,
    height: 12,
    borderRadius: 6,
    marginBottom: 10,
  },
  adherencePercentage: {
    fontSize: 32,
    fontWeight: 'bold',
    marginBottom: 5,
  },
  noDataText: {
  fontSize: 10,
  color: '#999',
  marginTop: 4,
  fontStyle: 'italic',
},
  adherenceLabel: {
    fontSize: 12,
    color: '#030303ff',
    marginTop: 5,
  },
  medicationsSection: {
    margin: 20,
    marginTop: 0,
  },
  medicationsHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 16,
  },
  viewAllText: {
    fontSize: 16,
    color: '#9D4EDD',
    fontWeight: '500',
  },
  medicationContainer: {
    gap: 12,
  },
  medicationCard: {
    backgroundColor: '#fff',
    borderRadius: 16,
    padding: 16,
    shadowColor: '#000',
    shadowOffset: {
      width: 0,
      height: 2,
    },
    shadowOpacity: 0.1,
    shadowRadius: 3.84,
    elevation: 5,
  },
  medicationHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    marginBottom: 12,
  },
  medicationInfo: {
    flex: 1,
    marginRight: 16,
  },
  medicationName: {
    fontSize: 18,
    fontWeight: '600',
    color: '#333',
    marginBottom: 4,
  },
  medicationDetails: {
    fontSize: 14,
    color: '#666',
    marginBottom: 4,
  },
  medicationTime: {
    fontSize: 14,
    color: '#9D4EDD',
  },
  statusButton: {
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 20,
  },
  statusButtonText: {
    fontSize: 14,
    fontWeight: '600',
  },
  foodReminder: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#f8f9fa',
    padding: 8,
    borderRadius: 8,
    marginBottom: 8,
  },
  foodReminderIcon: {
    marginRight: 8,
  },
  foodReminderText: {
    fontSize: 14,
    color: '#666',
  },
  instructionReminder: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#fff3cd',
    padding: 8,
    borderRadius: 8,
  },
  instructionIcon: {
    marginRight: 8,
  },
  instructionText: {
    fontSize: 14,
    color: '#856404',
    flex: 1,
  },
  medicationsPending: {
    backgroundColor: '#E8D5F2',
    borderRadius: 12,
    padding: 16,
    alignItems: 'center',
  },
  pendingText: {
    fontSize: 16,
    color: '#9D4EDD',
    fontWeight: '500',
  },
  emptyCard: {
    backgroundColor: '#fff',
    borderRadius: 16,
    padding: 40,
    alignItems: 'center',
    shadowColor: '#000',
    shadowOffset: {
      width: 0,
      height: 2,
    },
    shadowOpacity: 0.1,
    shadowRadius: 3.84,
    elevation: 5,
  },
  emptyText: {
    fontSize: 18,
    fontWeight: '600',
    color: '#333',
    marginBottom: 8,
  },
  emptySubtext: {
    fontSize: 14,
    color: '#666',
    marginBottom: 20,
  },
  addButton: {
    backgroundColor: '#9D4EDD',
    paddingHorizontal: 24,
    paddingVertical: 12,
    borderRadius: 8,
  },
  addButtonText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '600',
  },
});

