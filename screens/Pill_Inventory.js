import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  SafeAreaView,
  TouchableOpacity,
  Alert,
  RefreshControl,
} from 'react-native';
import { MaterialIcons, Ionicons, Feather } from '@expo/vector-icons';
import { db, auth } from '../services/firebaseConfig';
import { collection, query, where, onSnapshot, doc, updateDoc } from 'firebase/firestore';

export default function Inventory({ navigation }) {
  const [medications, setMedications] = useState([]);
  const [refreshing, setRefreshing] = useState(false);
  const user = auth.currentUser;

  useEffect(() => {
    if (!user) {
      navigation.navigate('Login');
      return;
    }

    const q = query(
      collection(db, 'medications'),
      where('userId', '==', user.uid)
    );

    const unsubscribe = onSnapshot(q, (querySnapshot) => {
      const meds = [];
      querySnapshot.forEach((doc) => {
        const data = doc.data();
        if (data.pillQuantity && data.pillQuantity > 0) {
          meds.push({
            id: doc.id,
            ...data,
          });
        }
      });
      setMedications(meds);
      setRefreshing(false);
    });

    return () => unsubscribe();
  }, [user]);

  const onRefresh = () => {
    setRefreshing(true);
  };

  const updateQuantity = async (medId, currentQty, change) => {
    const newQty = currentQty + change;
    
    if (newQty < 0) {
      Alert.alert('Error', 'Quantity cannot be negative');
      return;
    }
    
    // Calculate total pills across all medications (excluding current one being updated)
    const totalPillsOthers = medications
      .filter(m => m.id !== medId)
      .reduce((sum, m) => sum + (m.currentQuantity || 0), 0);
    
    const totalAfterUpdate = totalPillsOthers + newQty;
    
    // Check global 7-pill limit
    if (totalAfterUpdate > 7) {
      const available = 7 - totalPillsOthers;
      Alert.alert(
        'Device Capacity Limit', 
        `Your watch device has only 7 compartments total. Currently ${totalPillsOthers} slots are used by other medications. You can add up to ${available} more pill(s).`
      );
      return;
    }

    try {
      const medRef = doc(db, 'medications', medId);
      await updateDoc(medRef, {
        currentQuantity: newQty,
      });
    } catch (error) {
      console.error('Error updating quantity:', error);
      Alert.alert('Error', 'Failed to update quantity');
    }
  };

  const updateRefillReminder = async (medId, currentRefill, change) => {
    const newRefill = currentRefill + change;
    
    if (newRefill < 1) return;
    if (newRefill > 7) {
      Alert.alert('Limit Reached', 'Refill reminder cannot exceed 7 pills (device capacity)');
      return;
    }

    try {
      const medRef = doc(db, 'medications', medId);
      await updateDoc(medRef, {
        refillReminder: newRefill,
      });
    } catch (error) {
      console.error('Error updating refill reminder:', error);
      Alert.alert('Error', 'Failed to update refill reminder');
    }
  };

  const getProgressColor = (current, total) => {
    const percentage = (current / total) * 100;
    if (percentage <= 25) return '#FF6B6B';
    if (percentage <= 50) return '#FFB84D';
    return '#51CF66';
  };

  const getProgressWidth = (current, total) => {
    return `${Math.min((current / total) * 100, 100)}%`;
  };

  const handleEditMedicine = (medicine) => {
    navigation.navigate('AddMedicine', { medicine, fromInventory: true });
  };

  const getMedicineIcon = (name) => {
    if (name.includes('Vitamin')) return '💊';
    if (name.includes('Melatonin')) return '🌙';
    if (name.includes('Aspirin')) return '💊';
    if (name.includes('Magnesium')) return '⚡';
    return '💊';
  };

  const renderMedicineCard = (medicine) => {
    const currentQty = medicine.currentQuantity || 0;
    const totalQty = 7; 
    const refillAt = medicine.refillReminder || 1;
    const needsRefill = currentQty <= refillAt;
    const progressColor = getProgressColor(currentQty, totalQty);

    return (
      <View key={medicine.id} style={styles.medicineCard}>
        {/* Header */}
        <View style={styles.cardHeader}>
          <View style={styles.medicineInfo}>
            <View style={styles.iconContainer}>
              <Text style={styles.medicineIcon}>{getMedicineIcon(medicine.name)}</Text>
            </View>
            <View style={styles.medicineDetails}>
              <Text style={styles.medicineName}>{medicine.name}</Text>
              <Text style={styles.medicineDosage}>{medicine.dosage}</Text>
            </View>
          </View>
          <TouchableOpacity
            style={styles.editButton}
            onPress={() => handleEditMedicine(medicine)}
          >
            <Feather name="edit-2" size={20} color="#6C63FF" />
          </TouchableOpacity>
        </View>

        {/* Progress Bar */}
        <View style={styles.progressSection}>
          <View style={styles.progressHeader}>
            <Text style={styles.quantityLabel}>Current Stock</Text>
            <Text style={styles.progressText}>
              {currentQty}/{totalQty} pills
            </Text>
          </View>
          <View style={styles.progressBarBackground}>
            <View
              style={[
                styles.progressBarFill,
                {
                  width: getProgressWidth(currentQty, totalQty),
                  backgroundColor: progressColor,
                },
              ]}
            />
          </View>
        </View>

        {/* Quantity Controls */}
        <View style={styles.controlsSection}>
          <Text style={styles.sectionLabel}>Adjust Quantity</Text>
          <View style={styles.quantityControls}>
            <TouchableOpacity
              style={styles.quantityButton}
              onPress={() => updateQuantity(medicine.id, currentQty, -1)}
            >
              <Text style={styles.quantityButtonText}>-1</Text>
            </TouchableOpacity>

            <View style={styles.quantityDisplayContainer}>
              <Text style={styles.quantityDisplay}>{currentQty}</Text>
            </View>

            <TouchableOpacity
              style={styles.quantityButton}
              onPress={() => updateQuantity(medicine.id, currentQty, 1)}
            >
              <Text style={styles.quantityButtonText}>+1</Text>
            </TouchableOpacity>
          </View>
        </View>

        {/* Refill Reminder */}
        <View style={styles.refillSection}>
          <View style={styles.refillHeader}>
            <Ionicons
              name="notifications-outline"
              size={18}
              color={needsRefill ? '#FF6B6B' : '#6C63FF'}
            />
            <Text style={styles.refillLabel}>Refill Reminder</Text>
          </View>
          <View style={styles.refillControls}>
            <TouchableOpacity
              style={styles.refillButton}
              onPress={() => updateRefillReminder(medicine.id, refillAt, -1)}
            >
             <Text style={styles.quantityButtonText}>-1</Text>
            </TouchableOpacity>
            <Text style={styles.refillValue}>{refillAt} pills</Text>
            <TouchableOpacity
              style={styles.refillButton}
              onPress={() => updateRefillReminder(medicine.id, refillAt, 1)}
            >
              <Text style={styles.quantityButtonText}>+1</Text>
            </TouchableOpacity>
          </View>
        </View>

        {/* Refill Warning */}
        {needsRefill && (
          <View style={styles.warningBanner}>
            <Ionicons name="alert-circle-outline" size={16} color="#FF6B6B" />
            <Text style={styles.warningText}>Time to refill your medication!</Text>
          </View>
        )}
      </View>
    );
  };

  return (
    <SafeAreaView style={styles.container}>
      {/* Header */}
      <View style={styles.header}>
        <TouchableOpacity
          style={styles.backButton}
          onPress={() => navigation.goBack()}
        >
          <Ionicons name="arrow-back" size={24} color="#2D3748" />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Inventory</Text>
        <View style={styles.placeholder} />
      </View>

      {/* Content */}
      <ScrollView
        style={styles.scrollView}
        showsVerticalScrollIndicator={false}
        refreshControl={
          <RefreshControl refreshing={refreshing} onRefresh={onRefresh} />
        }
      >
        {medications.length > 0 && (
          <View style={styles.capacityIndicator}>
            <View style={styles.capacityHeader}>
              <MaterialIcons name="inventory" size={20} color="#6C63FF" />
              <Text style={styles.capacityTitle}>Device Capacity</Text>
            </View>
            <View style={styles.capacityContent}>
              <Text style={styles.capacityText}>
                {medications.reduce((sum, m) => sum + (m.currentQuantity || 0), 0)} / 7 compartments used
              </Text>
              <View style={styles.capacityBar}>
                <View 
                  style={[
                    styles.capacityBarFill, 
                    { 
                      width: `${Math.min((medications.reduce((sum, m) => sum + (m.currentQuantity || 0), 0) / 7) * 100, 100)}%`,
                      backgroundColor: medications.reduce((sum, m) => sum + (m.currentQuantity || 0), 0) >= 7 ? '#FF6B6B' : '#6C63FF'
                    }
                  ]} 
                />
              </View>
            </View>
          </View>
        )}
        
        {medications.length === 0 ? (
          <View style={styles.emptyState}>
            <View style={styles.emptyIconContainer}>
              <MaterialIcons name="inventory-2" size={64} color="#CBD5E0" />
            </View>
            <Text style={styles.emptyStateTitle}>No Medications Yet</Text>
            <Text style={styles.emptyStateText}>
              Add medications with pill quantities to track your inventory
            </Text>
            <TouchableOpacity
              style={styles.addButton}
              onPress={() => navigation.navigate('AddMedicine')}
            >
              <MaterialIcons name="add" size={20} color="#fff" />
              <Text style={styles.addButtonText}>Add Medication</Text>
            </TouchableOpacity>
          </View>
        ) : (
          <View style={styles.medicineList}>
            {medications.map((medicine) => renderMedicineCard(medicine))}
          </View>
        )}

        <View style={styles.bottomSpacing} />
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#F7FAFC',
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    padding: 16,
    backgroundColor: '#FFFFFF',
    borderBottomWidth: 1,
    borderBottomColor: '#E2E8F0',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.05,
    shadowRadius: 3,
    elevation: 3,
  },
  backButton: {
    padding: 8,
  },
  headerTitle: {
    fontSize: 20,
    fontWeight: '700',
    color: '#2D3748',
  },
  placeholder: {
    width: 40,
  },
  scrollView: {
    flex: 1,
  },
  capacityIndicator: {
    backgroundColor: '#FFFFFF',
    margin: 16,
    marginBottom: 8,
    padding: 16,
    borderRadius: 16,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.08,
    shadowRadius: 8,
    elevation: 3,
  },
  capacityHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginBottom: 12,
  },
  capacityTitle: {
    fontSize: 16,
    fontWeight: '700',
    color: '#2D3748',
  },
  capacityContent: {
    gap: 8,
  },
  capacityText: {
    fontSize: 14,
    fontWeight: '600',
    color: '#4A5568',
  },
  capacityBar: {
    height: 8,
    backgroundColor: '#E2E8F0',
    borderRadius: 4,
    overflow: 'hidden',
  },
  capacityBarFill: {
    height: '100%',
    borderRadius: 4,
  },
  medicineList: {
    padding: 16,
    paddingTop: 8,
  },
  medicineCard: {
    backgroundColor: '#FFFFFF',
    borderRadius: 16,
    padding: 20,
    marginBottom: 16,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.08,
    shadowRadius: 8,
    elevation: 3,
  },
  cardHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 20,
  },
  medicineInfo: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    flex: 1,
  },
  iconContainer: {
    width: 48,
    height: 48,
    borderRadius: 12,
    backgroundColor: '#F0F4FF',
    justifyContent: 'center',
    alignItems: 'center',
  },
  medicineIcon: {
    fontSize: 24,
  },
  medicineDetails: {
    flex: 1,
    gap: 4,
  },
  medicineName: {
    fontSize: 17,
    fontWeight: '700',
    color: '#2D3748',
  },
  medicineDosage: {
    fontSize: 14,
    color: '#718096',
  },
  editButton: {
    padding: 10,
    backgroundColor: '#F0F4FF',
    borderRadius: 10,
  },
  progressSection: {
    marginBottom: 20,
  },
  progressHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 10,
  },
  quantityLabel: {
    fontSize: 14,
    fontWeight: '600',
    color: '#4A5568',
  },
  progressBarBackground: {
    height: 12,
    backgroundColor: '#E2E8F0',
    borderRadius: 6,
    overflow: 'hidden',
  },
  progressBarFill: {
    height: '100%',
    borderRadius: 6,
  },
  progressText: {
    fontSize: 14,
    fontWeight: '700',
    color: '#6C63FF',
  },
  controlsSection: {
    marginBottom: 16,
  },
  sectionLabel: {
    fontSize: 13,
    fontWeight: '600',
    color: '#718096',
    marginBottom: 12,
  },
  quantityControls: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
  },
  quantityButton: {
    paddingHorizontal: 16,
    paddingVertical: 12,
    backgroundColor: '#F0F4FF',
    borderRadius: 10,
    minWidth: 50,
    alignItems: 'center',
    justifyContent: 'center',
  },
  quantityButtonText: {
    fontSize: 14,
    fontWeight: '700',
    color: '#6C63FF',
  },
  quantityDisplayContainer: {
    paddingHorizontal: 24,
    paddingVertical: 12,
    backgroundColor: '#F0F4FF',
    borderRadius: 10,
    borderWidth: 2,
    borderColor: '#6C63FF',
    minWidth: 70,
  },
  quantityDisplay: {
    fontSize: 20,
    fontWeight: '700',
    color: '#6C63FF',
    textAlign: 'center',
  },
  refillSection: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    backgroundColor: '#F7FAFC',
    padding: 14,
    borderRadius: 10,
    marginBottom: 12,
  },
  refillHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  refillLabel: {
    fontSize: 14,
    fontWeight: '600',
    color: '#4A5568',
  },
  refillControls: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  refillButton: {
    width: 32,
    height: 32,
    borderRadius: 8,
    backgroundColor: '#F0F4FF',
    justifyContent: 'center',
    alignItems: 'center',
  },
  refillValue: {
    fontSize: 15,
    fontWeight: '700',
    color: '#2D3748',
    minWidth: 60,
    textAlign: 'center',
  },
  warningBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    backgroundColor: '#FFF5F5',
    padding: 14,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: '#FED7D7',
  },
  warningText: {
    fontSize: 14,
    color: '#FF6B6B',
    fontWeight: '600',
    flex: 1,
  },
  emptyState: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 100,
    paddingHorizontal: 32,
  },
  emptyIconContainer: {
    width: 120,
    height: 120,
    borderRadius: 60,
    backgroundColor: '#F7FAFC',
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 24,
  },
  emptyStateTitle: {
    fontSize: 22,
    fontWeight: '700',
    color: '#2D3748',
    marginBottom: 8,
  },
  emptyStateText: {
    fontSize: 15,
    color: '#718096',
    textAlign: 'center',
    lineHeight: 22,
    marginBottom: 32,
  },
  addButton: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    paddingHorizontal: 28,
    paddingVertical: 14,
    backgroundColor: '#6C63FF',
    borderRadius: 12,
    shadowColor: '#6C63FF',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 8,
    elevation: 4,
  },
  addButtonText: {
    fontSize: 16,
    fontWeight: '600',
    color: '#FFFFFF',
  },
  bottomSpacing: {
    height: 40,
  },
});
