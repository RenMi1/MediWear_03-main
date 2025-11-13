// screens/MedicineList.js - Updated to use Firestore
import React, { useState, useEffect } from "react";
import {
    View,
    Text,
    TouchableOpacity,
    StyleSheet,
    Alert,
    SafeAreaView,
    ScrollView,
    Platform,
    Image,
} from "react-native";
import { MaterialIcons, Ionicons } from "@expo/vector-icons";
import LoggingService from '../services/LoggingService';
import FirestoreDataService from '../services/FirestoreDataService';
import { useFocusEffect } from '@react-navigation/native';
import BluetoothService from '../services/BluetoothService';

import { getAuth, onAuthStateChanged } from "firebase/auth";
import { db } from '../services/firebaseConfig';

import { 
    collection, 
    query, 
    where, 
    onSnapshot, 
    doc, 
    deleteDoc,
    updateDoc,
    getDoc
} from 'firebase/firestore';

export default function MedicineList({ navigation }) {
    const [medicines, setMedicines] = useState([]);
    const [medicineStatus, setMedicineStatus] = useState({});
    const [currentDate, setCurrentDate] = useState('');
    const [isLoading, setIsLoading] = useState(true);
    const [user, setUser] = useState(null);
    const [syncingMedicines, setSyncingMedicines] = useState({});

    const auth = getAuth();

    const getCurrentDateKey = () => {
        const today = new Date();
        return today.toISOString().split('T')[0];
    };

    const getFormattedDate = () => {
        const today = new Date();
        const options = {
            weekday: 'long',
            year: 'numeric',
            month: 'long',
            day: 'numeric'
        };
        return today.toLocaleDateString('en-US', options);
    };

    const isMedicationActiveToday = (medicine) => {
        const today = new Date();
        today.setHours(0, 0, 0, 0); 
        
        if (medicine.startDate) {
            const startDate = new Date(medicine.startDate);
            startDate.setHours(0, 0, 0, 0);
            
            if (startDate > today) {
                return false;
            }
        }
        
        if (medicine.endDate) {
            const endDate = new Date(medicine.endDate);
            endDate.setHours(0, 0, 0, 0);
            
            if (endDate < today) {
                return false;
            }
        }
        
        return true;
    };

    const cleanupOldData = async () => {
        try {
            if (!user || !user.uid) return;
            
            // Clean up old daily progress and notifications
            await FirestoreDataService.cleanupOldDailyProgress(user.uid);
            await FirestoreDataService.clearOldNotifications(user.uid, 30);
            
            console.log('Cleaned up old data');
        } catch (error) {
            console.error('Failed to cleanup old data:', error);
        }
    };
    
    const loadMedicineStatuses = async (meds) => {
        if (!user || !user.uid) return;

        try {
            const dailyProgress = await FirestoreDataService.getDailyProgress(user.uid);
            const initialStatus = {};

            for (const med of meds) {
                if (!isMedicationActiveToday(med)) {
                    initialStatus[med.id] = 'scheduled';
                    continue;
                }
                
                initialStatus[med.id] = dailyProgress[med.id]?.status || 'pending';
            }
            
            setMedicineStatus(initialStatus);
        } catch (error) {
            console.error('Error loading statuses:', error);
        }
    };

    const loadMedicines = (userId) => {
        if (!userId) {
            setMedicines([]);
            setIsLoading(false);
            return () => {};
        }
        
        cleanupOldData();
        
        const medsQuery = query(
            collection(db, "medications"),
            where("userId", "==", userId)
        );

        const unsubscribe = onSnapshot(medsQuery, async (snapshot) => {
            try {
                const fetchedMedicines = snapshot.docs.map(doc => ({
                    id: doc.id,
                    ...doc.data(),
                }));
                
                if (fetchedMedicines.length > 0 && medicines.length === 0) {
                    await LoggingService.addLog(
                        'system',
                        `Loaded ${fetchedMedicines.length} medicines from Firestore`,
                        `User ID: ${userId}`
                    );
                }
                
                setMedicines(fetchedMedicines);
                await loadMedicineStatuses(fetchedMedicines);

                setCurrentDate(getFormattedDate());
                setIsLoading(false);

            } catch (error) {
                console.error("Error processing Firestore data:", error);
                setIsLoading(false);
            }
        }, (error) => {
            console.error("Firestore subscription failed:", error);
            setIsLoading(false);
        });

        return unsubscribe;
    };

    useEffect(() => {
        const authUnsubscribe = onAuthStateChanged(auth, firebaseUser => {
            setUser(firebaseUser);
            
            if (firebaseUser) {
                const firestoreUnsubscribe = loadMedicines(firebaseUser.uid);
                return () => {
                    if (firestoreUnsubscribe) firestoreUnsubscribe();
                };
            } else {
                setMedicines([]);
                setMedicineStatus({});
                setIsLoading(false);
            }
        });

        return () => authUnsubscribe();
    }, []); 

    useFocusEffect(
        React.useCallback(() => {
            if (user && user.uid && medicines.length > 0) {
                loadMedicineStatuses(medicines);
            }
        }, [user, medicines])
    );

    const getNextReminderTime = (medicine) => {
        if (!isMedicationActiveToday(medicine)) {
            if (medicine.startDate) {
                const startDate = new Date(medicine.startDate);
                return `Starts ${startDate.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })}`;
            }
            return 'Not yet active';
        }

        if (!medicine.reminderTimes || medicine.reminderTimes.length === 0) {
            return 'No reminders set';
        }

        const now = new Date();
        const currentTime = now.getHours() * 60 + now.getMinutes();

        const reminderMinutes = medicine.reminderTimes.map(timeStr => {
            const [time, meridiem] = timeStr.split(' ');
            if (!time || !meridiem) return null;

            let [hours, minutes] = time.split(':').map(Number);

            if (meridiem.toUpperCase() === 'PM' && hours < 12) {
                hours += 12;
            } else if (meridiem.toUpperCase() === 'AM' && hours === 12) {
                hours = 0;
            }

            return hours * 60 + minutes;
        }).filter(time => time !== null);

        const nextReminder = reminderMinutes
            .filter(time => time > currentTime)
            .sort((a, b) => a - b)[0];

        if (nextReminder) {
            const hours = Math.floor(nextReminder / 60);
            const minutes = nextReminder % 60;
            const displayHours = hours > 12 ? hours - 12 : (hours === 0 ? 12 : hours);
            const meridiem = hours >= 12 ? 'PM' : 'AM';
            return `${displayHours.toString().padStart(2, '0')}:${minutes.toString().padStart(2, '0')} ${meridiem}`;
        }

        if (reminderMinutes.length > 0) {
            const firstReminder = Math.min(...reminderMinutes);
            const hours = Math.floor(firstReminder / 60);
            const minutes = firstReminder % 60;
            const displayHours = hours > 12 ? hours - 12 : (hours === 0 ? 12 : hours);
            const meridiem = hours >= 12 ? 'PM' : 'AM';
            return `${displayHours.toString().padStart(2, '0')}:${minutes.toString().padStart(2, '0')} ${meridiem} (Tomorrow)`;
        }

        return 'No valid reminders';
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

    useEffect(() => {
        const checkMissedDoses = async () => {
            if (!user || !user.uid) return;

            const now = new Date();
            let hasChanges = false;
            const newStatus = { ...medicineStatus };

            for (const med of medicines) {
                if (!isMedicationActiveToday(med)) {
                    continue;
                }

                if (!isMedicineScheduledForToday(med)) continue;

                if (newStatus[med.id] === 'pending' && med.reminderTimes && med.reminderTimes.length > 0) {
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

                        const fiveMinutesAfterDose = new Date(doseTime.getTime() + 5 * 60000);

                        if (now > fiveMinutesAfterDose && newStatus[med.id] === 'pending') {
                            newStatus[med.id] = 'missed';
                            hasChanges = true;

                            // Save to Firestore
                            await FirestoreDataService.saveDailyProgress(
                                user.uid,
                                med.id,
                                'missed',
                                med.name
                            );

                            const currentTimeStr = now.toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit' });
                            const minutesLate = Math.floor((now - fiveMinutesAfterDose) / 60000);
                            
                            await LoggingService.addLog(
                                'missed',
                                `Missed dose detected: ${med.name}`,
                                `Scheduled: ${reminderTime}, Detected at: ${currentTimeStr} (${minutesLate} minutes late)`
                            );

                            await FirestoreDataService.logNotification(
                                user.uid,
                                med.id,
                                med.name,
                                med.dosage,
                                'missed',
                                reminderTime
                            );
                            
                            break;
                        }
                    }
                }
            }

            if (hasChanges) {
                setMedicineStatus(newStatus);
            }
        };

        if (medicines.length > 0) {
            checkMissedDoses();
            const intervalId = setInterval(checkMissedDoses, 60000);
            return () => clearInterval(intervalId);
        }
    }, [medicines, medicineStatus, user]);

    const handleDelete = async (id) => {
        Alert.alert(
            "Delete Medicine",
            "Are you sure you want to delete this medicine? This action cannot be undone.",
            [
                {
                    text: "Cancel",
                    style: "cancel"
                },
                {
                    text: "Delete",
                    onPress: async () => {
                        try {
                            const medicine = medicines.find(m => m.id === id);
                            const medRef = doc(db, "medications", id);
                            await deleteDoc(medRef);

                            await LoggingService.addLog(
                                'system',
                                `Medicine deleted: ${medicine?.name || 'Unknown'}`,
                                `Medicine ID: ${id}, Dosage: ${medicine?.dosage || 'N/A'}`
                            );

                            setMedicineStatus(prevStatus => {
                                const newStatus = { ...prevStatus };
                                delete newStatus[id];
                                return newStatus;
                            });

                            Alert.alert('Success', 'Medicine deleted successfully');
                        } catch (error) {
                            console.error('Failed to delete medicine:', error);
                            Alert.alert('Error', 'Failed to delete medicine. Please check your network connection.');
                        }
                    },
                    style: "destructive"
                },
            ]
        );
    };

    const decreaseInventoryQuantity = async (medicineId, medicineName) => {
        try {
            const medRef = doc(db, "medications", medicineId);
            const medDoc = await getDoc(medRef);
            
            if (medDoc.exists()) {
                const currentData = medDoc.data();
                const currentQty = currentData.currentQuantity || 0;
                
                if (currentQty > 0) {
                    const newQty = currentQty - 1;
                    await updateDoc(medRef, {
                        currentQuantity: newQty
                    });
                    
                    console.log(`Inventory decreased for ${medicineName}: ${currentQty} -> ${newQty}`);
                    
                    await LoggingService.addLog(
                        'inventory',
                        `Inventory decreased for ${medicineName}`,
                        `Quantity: ${currentQty} -> ${newQty} pills`
                    );
                    
                    const refillReminder = currentData.refillReminder || 3;
                    if (newQty <= refillReminder) {
                        await LoggingService.addLog(
                            'inventory',
                            `Refill reminder triggered for ${medicineName}`,
                            `Current quantity: ${newQty} pills (Reminder set at: ${refillReminder})`
                        );
                    }
                } else {
                    console.log(`No inventory to decrease for ${medicineName}`);
                    Alert.alert(
                        'Low Inventory',
                        `${medicineName} has no pills left in inventory. Please refill.`,
                        [{ text: 'OK' }]
                    );
                }
            }
        } catch (error) {
            console.error('Failed to decrease inventory:', error);
        }
    };

    const handleTaken = async (medicineId) => {
    if (!user || !user.uid) return;

    try {
      // ✅ Get current status from Firestore first
      const dailyProgress = await FirestoreDataService.getDailyProgress(user.uid);
      const currentStatus = dailyProgress[medicineId]?.status || medicineStatus[medicineId];
      
      if (currentStatus === 'taken') {
        Alert.alert('Info', 'This medicine is already marked as taken for today.');
        return;
      }

      const medicine = medicines.find(med => med.id === medicineId);
      const medicineName = medicine ? medicine.name : 'Unknown';
      const medicineDosage = medicine ? medicine.dosage : 'N/A';
      const scheduledTime = getNextReminderTime(medicine);

      // ✅ Save to Firestore (primary source of truth)
      await FirestoreDataService.saveDailyProgress(
        user.uid,
        medicineId,
        'taken',
        medicineName
      );

      await LoggingService.addLog(
        'taken',
        `Medicine marked as taken: ${medicineName}`,
        `Dosage: ${medicineDosage}, Time: ${new Date().toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit' })}, Status: ${currentStatus === 'missed' ? 'late (was missed)' : 'on-time'}`
      );

      await FirestoreDataService.logNotification(
        user.uid,
        medicineId,
        medicineName,
        medicineDosage,
        'taken',
        scheduledTime !== 'No reminders set' && scheduledTime !== 'Not yet active' ? scheduledTime : null
      );

      await decreaseInventoryQuantity(medicineId, medicineName);

      // ✅ Update local state immediately
      setMedicineStatus(prevStatus => ({
        ...prevStatus,
        [medicineId]: 'taken',
      }));

      console.log('Medicine marked as taken, data saved to Firestore');
      
      Alert.alert('Success', 'Medicine marked as taken! Inventory updated.');
      
      // ✅ Force reload to sync with Firestore
      await loadMedicineStatuses(medicines);
      
    } catch (error) {
      console.error('Failed to update medicine status:', error);
      Alert.alert('Error', 'Failed to update status.');
    }
  };

    const handleSyncToDevice = async (medicine) => {
        try {
            const connectionStatus = BluetoothService.getConnectionStatus();
            
            if (!connectionStatus.isConnected) {
                Alert.alert(
                    'No Device Connected',
                    'Please connect to your MediWear device first.',
                    [
                        { text: 'Cancel', style: 'cancel' },
                        { text: 'Connect', onPress: () => navigation.navigate('Device') }
                    ]
                );
                return;
            }

            setSyncingMedicines(prev => ({ ...prev, [medicine.id]: true }));

            await LoggingService.addLog(
                'sync',
                `Syncing medication to device: ${medicine.name}`,
                `Dosage: ${medicine.dosage}, Time: ${medicine.reminderTimes?.[0] || 'N/A'}`
            );

            const response = await BluetoothService.syncMedicationToDevice(medicine);
            
            setSyncingMedicines(prev => ({ ...prev, [medicine.id]: false }));

            if (response && response.accepted) {
                Alert.alert(
                    'Sync Successful ✓',
                    `${medicine.name} has been synced to your MediWear device.`,
                    [{ text: 'OK' }]
                );
                
                await LoggingService.addLog(
                    'sync',
                    `Successfully synced: ${medicine.name}`,
                    'Device accepted the medication'
                );
            } else {
                Alert.alert(
                    'Sync Declined',
                    'The device user declined the medication sync.',
                    [{ text: 'OK' }]
                );
                
                await LoggingService.addLog(
                    'sync',
                    `Sync declined for: ${medicine.name}`,
                    'Device user rejected the medication'
                );
            }
        } catch (error) {
            setSyncingMedicines(prev => ({ ...prev, [medicine.id]: false }));
            
            console.error('Sync failed:', error);
            Alert.alert(
                'Sync Failed',
                `Failed to sync ${medicine.name}: ${error.message}`,
                [{ text: 'OK' }]
            );
            
            await LoggingService.addLog(
                'sync',
                `Failed to sync: ${medicine.name}`,
                `Error: ${error.message}`
            );
        }
    };

    const getStatusBadge = (status) => {
        switch (status) {
            case 'taken':
                return {
                    icon: 'check-circle',
                    color: '#10B981',
                    bg: '#D1FAE5',
                    text: 'Taken'
                };
            case 'missed':
                return {
                    icon: 'cancel',
                    color: '#EF4444',
                    bg: '#FEE2E2',
                    text: 'Missed'
                };
            case 'scheduled':
                return {
                    icon: 'schedule',
                    color: '#6366F1',
                    bg: '#E0E7FF',
                    text: 'Scheduled'
                };
            default:
                return {
                    icon: 'schedule',
                    color: '#F59E0B',
                    bg: '#FEF3C7',
                    text: 'Pending'
                };
        }
    };

    return (
        <SafeAreaView style={styles.container}>
            <ScrollView
                style={styles.scrollView}
                showsVerticalScrollIndicator={false}
                contentContainerStyle={styles.scrollContent}
            >
                <View style={styles.header}>
                    <View style={styles.headerTopRow}>
                        <Text style={styles.headerTitle}>My Medications</Text>
                        <View style={styles.buttonContainer}>
                            <TouchableOpacity
                                style={styles.inventoryButton}
                                onPress={() => navigation.navigate('Inventory')}
                            >
                                <Image
                                    source={require('../assets/pill_bottle.png')}
                                    style={{ width: 40, height: 40, tintColor: '#fff' }}
                                    resizeMode="contain"
                                />
                            </TouchableOpacity>
                        </View>
                    </View>

                    <Text style={styles.headerDate}>{currentDate}</Text>

                    <View style={styles.headerBadge}>
                        <MaterialIcons name="event-note" size={16} color="#2563EB" />
                        <Text style={styles.headerBadgeText}>
                            {medicines.length} total medicines
                        </Text>
                    </View>
                </View>

                {isLoading ? (
                    <View style={styles.emptyState}>
                        <MaterialIcons name="hourglass-empty" size={64} color="#9CA3AF" />
                        <Text style={styles.emptyTitle}>Loading...</Text>
                        <Text style={styles.emptySubtitle}>
                            Fetching your medications data
                        </Text>
                    </View>
                ) : !user ? (
                    <View style={styles.emptyState}>
                        <MaterialIcons name="lock-outline" size={64} color="#9CA3AF" />
                        <Text style={styles.emptyTitle}>Please Log In</Text>
                        <Text style={styles.emptySubtitle}>
                            Sign in to view your medications
                        </Text>
                        <TouchableOpacity
                            style={styles.primaryButton}
                            onPress={() => navigation.navigate("Login")}
                        >
                            <Text style={styles.primaryButtonText}>Go to Login</Text>
                        </TouchableOpacity>
                    </View>
                ) : medicines.length === 0 ? (
                    <View style={styles.emptyState}>
                        <MaterialIcons name="medical-services" size={64} color="#9CA3AF" />
                        <Text style={styles.emptyTitle}>No Medications</Text>
                        <Text style={styles.emptySubtitle}>
                            Add your first medication to get started.
                        </Text>
                    </View>
                ) : (
                    <View style={styles.listContainer}>
                        {medicines.map((item) => {
                            const isActive = isMedicationActiveToday(item);
                            const status = medicineStatus[item.id] || (isActive ? 'pending' : 'scheduled');
                            const statusBadge = getStatusBadge(status);
                            const currentQty = item.currentQuantity || 0;
                            const nextReminderText = getNextReminderTime(item);
                            const isLow = currentQty <= (item.refillReminder || 3);
                            const isSyncing = syncingMedicines[item.id] || false;

                            return (
                                <View key={item.id} style={styles.medicineCard}>
                                    <View style={styles.cardHeader}>
                                        <View
                                            style={[
                                                styles.statusChip,
                                                { backgroundColor: statusBadge.bg }
                                            ]}
                                        >
                                            <Text style={[styles.statusChipText, { color: statusBadge.color }]}>
                                                {statusBadge.text}
                                            </Text>
                                        </View>

                                        <TouchableOpacity
                                            style={[
                                                styles.syncButtonTopRight,
                                                isSyncing && styles.syncButtonDisabled
                                            ]}
                                            onPress={() => handleSyncToDevice(item)}
                                            disabled={isSyncing}
                                        >
                                            <Ionicons 
                                                name={isSyncing ? "hourglass-outline" : "sync"} 
                                                size={20} 
                                                color="#9D4EDD" 
                                            />
                                        </TouchableOpacity>
                                    </View>

                                    <Text style={styles.medicineName}>{item.name}</Text>
                                    <Text style={styles.medicineDosage}>{item.dosage}</Text>

                                    <View style={styles.detailsGrid}>
                                        <View style={styles.detailBox}>
                                            <Image
                                                source={require('../assets/clock.png')}
                                                style={{ width: 25, height: 25, tintColor: '#9D4EDD' }}
                                                resizeMode="contain"
                                            />
                                            <Text style={styles.detailLabel}>Next Dose</Text>
                                            <Text style={styles.detailValue}>{nextReminderText}</Text>
                                        </View>

                                        <View style={styles.detailBox}>
                                            <Image
                                                source={require('../assets/pill_bottle.png')}
                                                style={{ width: 30, height: 30, tintColor: '#9D4EDD' }}
                                                resizeMode="contain"
                                            />
                                            <Text style={styles.detailLabel}>Inventory</Text>
                                            <Text style={[styles.detailValue, isLow && { color: '#EF4444' }]}>
                                                {currentQty} pill{currentQty !== 1 ? 's' : ''}
                                            </Text>
                                        </View>
                                    </View>

                                    {item.takeWithFood && (
                                        <View style={styles.foodTag}>
                                            <Ionicons name="restaurant-outline" size={16} color="#F59E0B" />
                                            <Text style={styles.foodText}>Take with food</Text>
                                        </View>
                                    )}

                                    <View style={styles.actionRow}>
                                        {isActive && status !== 'taken' && (
                                            <TouchableOpacity
                                                style={[
                                                    styles.actionButton,
                                                    { backgroundColor: status === 'missed' ? '#F59E0B' : '#2563EB' }
                                                ]}
                                                onPress={() => handleTaken(item.id)}
                                            >
                                                <Text style={styles.actionButtonText}>
                                                    {status === 'missed' ? 'Late Take' : 'Mark Taken'}
                                                </Text>
                                            </TouchableOpacity>
                                        )}

                                        <TouchableOpacity
                                            style={[styles.actionButton, styles.detailsButton]}
                                            onPress={() => navigation.navigate('MedicineDetails', { medicine: item })}
                                        >
                                            <Text style={styles.detailsButtonText}>Details</Text>
                                        </TouchableOpacity>

                                        <TouchableOpacity
                                            style={[styles.actionButton, styles.deleteButton]}
                                            onPress={() => handleDelete(item.id)}
                                        >
                                            <Text style={styles.deleteButtonText}>Delete</Text>
                                        </TouchableOpacity>
                                    </View>
                                </View>
                            );
                        })}
                    </View>
                )}
            </ScrollView>

            {user && (
                <TouchableOpacity
                    style={styles.fab}
                    onPress={() => navigation.navigate("AddMedicine")}
                >
                    <Image
                        source={require('../assets/plus-sign.png')}
                        style={{ width: 28, height: 28, tintColor: '#fff' }}
                        resizeMode="contain"
                    />
                </TouchableOpacity>
            )}
        </SafeAreaView>
    );
}

// Keep all the existing styles...
const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: "#F9FAFB",
  },
  scrollContent: {
    paddingBottom: 120,
  },
  header: {
    backgroundColor: "#fff",
    paddingHorizontal: 20,
    paddingTop: Platform.OS === "ios" ? 50 : 30,
    paddingBottom: 20,
    borderBottomWidth: 1,
    borderBottomColor: "#E5E7EB",
  },
  headerTitle: {
    fontSize: 28,
    fontWeight: "700",
    color: "#1E293B",
  },
  headerDate: {
    fontSize: 15,
    color: "#6B7280",
    marginTop: 4,
  },
  headerBadge: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "#EEF2FF",
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: 20,
    marginTop: 10,
    gap: 6,
    alignSelf: "flex-start",
  },
  headerBadgeText: {
    fontSize: 13,
    fontWeight: "600",
    color: "#2563EB",
  },
  headerTopRow: {
    flexDirection: 'row',
    justifyContent: 'space-between', 
    alignItems: 'center',
    marginBottom: 8,
    paddingHorizontal: 16,          
  },
  buttonContainer: {
    marginLeft: 20, 
    marginRight: 20,
    paddingRight: 25, 
    paddingTop: 12,
    width: 45,
    height: 45,
  },
  inventoryButton: {
    backgroundColor: '#9D4EDD',
    width: 60,
    height: 60,
    borderRadius: 18,
    justifyContent: 'center',
    alignItems: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.2,
    shadowRadius: 1.41,
    elevation: 2,
  },
  listContainer: {
    padding: 16,
  },
  medicineCard: {
    backgroundColor: "#fff",
    borderRadius: 16,
    padding: 16,
    marginBottom: 16,
    borderWidth: 1,
    borderColor: "#E5E7EB",
    shadowColor: '#000',
    shadowOffset: {
      width: 0,
      height: 2,
    },
    shadowOpacity: 0.1,
    shadowRadius: 3.84,
    elevation: 5,
  },
  cardHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: 10,
  },
  statusChip: {
    flexDirection: "row",
    alignItems: "center",
    borderRadius: 16,
    paddingHorizontal: 10,
    paddingVertical: 5,
    gap: 4,
  },
  statusChipText: {
    fontSize: 13,
    fontWeight: "600",
  },
  syncButtonTopRight: {
    backgroundColor: "#F3E8FF",
    borderWidth: 1,
    borderColor: "#9D4EDD",
    borderRadius: 10,
    width: 40,
    height: 40,
    justifyContent: "center",
    alignItems: "center",
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.1,
    shadowRadius: 2,
    elevation: 2,
  },
  syncButtonDisabled: {
    opacity: 0.6,
  },
  medicineName: {
    fontSize: 20,
    fontWeight: "700",
    color: "#111827",
  },
  medicineDosage: {
    fontSize: 14,
    color: "#6B7280",
    marginBottom: 12,
  },
  detailsGrid: {
    flexDirection: "row",
    gap: 10,
  },
  detailBox: {
    flex: 1,
    backgroundColor: "#F3F4F6", 
    borderRadius: 10,
    paddingVertical: 10,
    paddingHorizontal: 12,
    alignItems: "flex-start",
    justifyContent: "center",
  },
  detailLabel: {
    fontSize: 12,
    color: "#6B7280",
    marginTop: 2,
  },
  detailValue: {
    fontSize: 14,
    fontWeight: "600",
    color: "#1E293B",
    marginTop: 2,
  },
  foodTag: {
    flexDirection: "row",
    backgroundColor: "#FFFBEB",
    padding: 8,
    borderRadius: 8,
    alignItems: "center",
    gap: 6,
    marginTop: 10,
  },
  foodText: {
    color: "#D97706",
    fontSize: 13,
    fontWeight: "500",
  },
  actionRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    gap: 8,
    marginTop: 10,
  },
  actionButton: {
    flex: 1,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    borderRadius: 8,
    paddingVertical: 10,
    gap: 6,
  },
  actionButtonText: {
    color: "#fff",
    fontSize: 14,
    fontWeight: "600",
  },
  detailsButton: {
    backgroundColor: "#F3F4F6",
    borderWidth: 1,
    borderColor: "#E5E7EB",
  },
  detailsButtonText: {
    color: "#2563EB",
    fontSize: 14,
    fontWeight: "600",
  },
  deleteButton: {
    backgroundColor: "#F3F4F6",
    borderWidth: 1,
    borderColor: "#E5E7EB",
  },
  deleteButtonText: {
    color: "#EF4444",
    fontSize: 14,
    fontWeight: "600",
  },
  primaryButton: {
    flex: 1,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "#2563EB",
    paddingVertical: 12,
    borderRadius: 10,
    gap: 6,
  },
  primaryButtonText: {
    color: "#fff",
    fontSize: 14,
    fontWeight: "600",
  },
  emptyState: {
    alignItems: "center",
    justifyContent: "center",
    padding: 40,
    marginTop: 80,
  },
  emptyTitle: {
    fontSize: 22,
    fontWeight: "700",
    color: "#111827",
    marginTop: 10,
  },
  emptySubtitle: {
    fontSize: 15,
    color: "#6B7280",
    textAlign: "center",
    marginTop: 4,
  },
  fab: {
    position: "absolute",
    bottom: 25,
    right: 20,
    width: 60,
    height: 60,
    borderRadius: 40,
    backgroundColor: "#9D4EDD",
    alignItems: "center",
    justifyContent: "center",
    shadowColor: "#8c18d4ff",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.15,
    shadowRadius: 5,
  },
});
