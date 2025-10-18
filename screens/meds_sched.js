import React, { useState, useEffect } from 'react';
import {
  View, Text, TextInput, TouchableOpacity, StyleSheet, ScrollView, SafeAreaView, Alert,
  Switch,
  Platform,
} from 'react-native';
import DateTimePicker from '@react-native-community/datetimepicker';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { Dropdown } from 'react-native-element-dropdown';
import { AntDesign } from '@expo/vector-icons';
import { db, auth } from '../services/firebaseConfig'; 
import { collection, doc, setDoc, updateDoc, serverTimestamp } from 'firebase/firestore';

export default function AddMedicine({ navigation, route }) {
  const editingMedicine = route?.params?.medicine;
  const fromAlertSettings = route?.params?.fromAlertSettings;
  const isEditing = editingMedicine !== undefined && !fromAlertSettings;
  const [showTimePicker, setShowTimePicker] = useState(false);
  const [showDatePicker, setShowDatePicker] = useState(false);
  const [currentTimeIndex, setCurrentTimeIndex] = useState(0);
  const [currentDateIndex, setCurrentDateIndex] = useState(0);
  const user = auth.currentUser;

  // NEW: Pill quantity state (max 7 pills for watch device)
  const [pillQuantity, setPillQuantity] = useState(editingMedicine?.pillQuantity?.toString() || '');
  const [refillReminder, setRefillReminder] = useState(editingMedicine?.refillReminder || 5);

  const getCurrentDate = () => {
    return new Date();
  };

  const getInitialTimesAndDates = (times, startDate) => {
    const currentDate = getCurrentDate();
    
    if (!times || times.length === 0) {
      return { 
        formattedTimes: [], 
        reminderDates: [],
        timeObjects: []
      };
    }
    
    const timeObjects = times.map(timeStr => {
      try {
        const [time, meridiem] = timeStr.split(' ');
        const [hours, minutes] = time.split(':');
        let hour24 = parseInt(hours, 10);
        
        if (meridiem === 'PM' && hour24 !== 12) {
          hour24 += 12;
        } else if (meridiem === 'AM' && hour24 === 12) {
          hour24 = 0;
        }
        
        const dateObj = new Date();
        dateObj.setHours(hour24, parseInt(minutes, 10), 0, 0);
        return dateObj;
      } catch (error) {
        console.warn('Error parsing time:', timeStr, error);
        const defaultTime = new Date();
        defaultTime.setHours(9, 0, 0, 0);
        return defaultTime;
      }
    });
    
    const reminderDates = times.map(() => startDate || currentDate);
    
    return { 
      timeObjects, 
      reminderDates,
      formattedTimes: times.map(time => {
        try {
          return time.split(' ')[0] || '9:00';
        } catch (error) {
          return '9:00';
        }
      })
    };
  };

  const { timeObjects, reminderDates } = getInitialTimesAndDates(
    editingMedicine?.reminderTimes, 
    editingMedicine?.startDate ? new Date(editingMedicine.startDate) : null
  );

  const [selectedMedicine, setSelectedMedicine] = useState(editingMedicine?.name || '');
  const [isMedicineFocus, setIsMedicineFocus] = useState(false);
  const [selectedDosage, setSelectedDosage] = useState(editingMedicine?.dosage || '');
  const [isDosageFocus, setIsDosageFocus] = useState(false);
  const [dosageOptions, setDosageOptions] = useState([]);
  const [frequency, setFrequency] = useState(editingMedicine?.frequency || 'Once daily');
  const [isFrequencyFocus, setIsFrequencyFocus] = useState(false);
  const [days, setDays] = useState(editingMedicine?.days || 'Daily');
  const [isDaysFocus, setIsDaysFocus] = useState(false);
  const [reminderEnabled, setReminderEnabled] = useState(editingMedicine?.reminderEnabled ?? true);
  const [takeWithFood, setTakeWithFood] = useState(editingMedicine?.takeWithFood || false);
  const [specialInstructions, setSpecialInstructions] = useState(editingMedicine?.specialInstructions || '');
  
  const [reminderTimes, setReminderTimes] = useState(() => {
    if (timeObjects.length > 0) {
      return timeObjects;
    }
    const defaultTime = new Date();
    defaultTime.setHours(9, 0, 0, 0);
    return [defaultTime];
  });
  
  const [reminderDatesList, setReminderDatesList] = useState(() => {
    if (reminderDates.length > 0) {
      return reminderDates;
    }
    return [getCurrentDate()];
  });

  const frequencyOptions = [
    { label: 'Once daily', value: 'Once daily' },
    { label: 'Twice daily', value: 'Twice daily' },
    { label: 'Three times daily', value: 'Three times daily' },
    { label: 'Four times daily', value: 'Four times daily' },
    { label: 'Every other day', value: 'Every other day' },
    { label: 'Weekly', value: 'Weekly' },
    { label: 'As needed', value: 'As needed' },
  ];

  const daysOptions = [
    { label: 'Daily', value: 'Daily' },
    { label: 'Weekends', value: 'Weekends' },
    { label: 'Weekdays', value: 'Weekdays' },
    { label: 'Mon-Wed-Fri', value: 'Mon-Wed-Fri' },
    { label: 'Tue-Thu-Sat', value: 'Tue-Thu-Sat' },
  ];

  const medicineList = [
    { name: 'Biotin', dosages: ['10mcg', '500mcg'] },
    { name: 'Melatonin', dosages: ['1mg', '10mg'] },
    { name: 'Vitamin D3 (Forti-D)', dosages: ['400 IU', '2000 IU'] },
    { name: 'Aspirin (Low Dose)', dosages: ['81mg', '325mg'] },
    { name: 'Isotretinoin', dosages: ['10mg', '20mg'] },
    { name: 'Cetirizine (Allerta)', dosages: ['5mg', '10mg'] },
    { name: 'Folic Acid (Folart)', dosages: ['400mcg', '5mg'] },
    { name: 'Loratadine (Claritin)', dosages: ['10mg'] },
    { name: 'Glimepiride', dosages: ['1mg', '4mg'] },
    { name: 'Metoprolol (Betaloc)', dosages: ['25mg', '100mg'] },
    { name: 'Loperamide (Imodium)', dosages: ['2mg', '4mg'] },
    { name: 'Neurobion Mini', dosages: ['500mg'] },
    { name: 'Simvastatin (Zocor)', dosages: ['10mg', '40mg'] },
    { name: 'Amlodipine (Norvasc)', dosages: ['2.5mg', '10mg'] },
    { name: 'Clopidogrel', dosages: ['75mg', '300mg'] },
    { name: 'Salbutamol', dosages: ['2mg', '4mg'] },
    { name: 'Ranitidine (Zantac)', dosages: ['150mg', '300mg'] },
    { name: 'Folicare (Iron + Folic Acid)', dosages: ['60mg Iron + 400mcg FA'] },
    { name: 'Zinc Sulfate', dosages: ['10mg', '50mg'] }
  ];

  const medicineOptions = medicineList.map(medicine => ({
    label: medicine.name,
    value: medicine.name
  }));

  const getDosageOptions = (medicineName) => {
    const medicine = medicineList.find(med => med.name === medicineName);
    if (!medicine) return [];
    return medicine.dosages.map(dosage => ({
      label: dosage,
      value: dosage
    }));
  };

  useEffect(() => {
    if (selectedMedicine) {
      const options = getDosageOptions(selectedMedicine);
      setDosageOptions(options);
      if (!isEditing) {
        setSelectedDosage('');
      }
    } else {
      setDosageOptions([]);
      setSelectedDosage('');
    }
  }, [selectedMedicine, isEditing]);

  const handleMedicineChange = (item) => {
    setSelectedMedicine(item.value);
    setIsMedicineFocus(false);
  };

  const handleDosageChange = (item) => {
    setSelectedDosage(item.value);
    setIsDosageFocus(false);
  };

  const createTimeFromHourMinute = (hour, minute) => {
    const time = new Date();
    time.setHours(hour, minute, 0, 0);
    return time;
  };

  const validateDateTime = (date, time) => {
    try {
      if (!date || !time) return false;
      
      const validDate = date instanceof Date ? date : new Date(date);
      const validTime = time instanceof Date ? time : new Date(time);
      
      if (isNaN(validDate.getTime()) || isNaN(validTime.getTime())) {
        return false;
      }
      
      const combinedDateTime = new Date(validDate);
      combinedDateTime.setHours(
        validTime.getHours(), 
        validTime.getMinutes(), 
        validTime.getSeconds(), 
        validTime.getMilliseconds()
      );
      
      const now = new Date();
      return combinedDateTime > now;
    } catch (error) {
      console.warn('Error validating datetime:', error);
      return false;
    }
  };

  const handleFrequencyChange = (item) => {
    const selectedFrequency = item.value;
    setFrequency(selectedFrequency);
    setIsFrequencyFocus(false);

    const currentDate = getCurrentDate();
    
    switch (selectedFrequency) {
      case 'Once daily':
        setReminderTimes([createTimeFromHourMinute(9, 0)]);
        setReminderDatesList([currentDate]);
        break;
      case 'Twice daily':
        setReminderTimes([
          createTimeFromHourMinute(9, 0),
          createTimeFromHourMinute(21, 0)
        ]);
        setReminderDatesList([currentDate, currentDate]);
        break;
      case 'Three times daily':
        setReminderTimes([
          createTimeFromHourMinute(8, 0),
          createTimeFromHourMinute(14, 0),
          createTimeFromHourMinute(20, 0)
        ]);
        setReminderDatesList([currentDate, currentDate, currentDate]);
        break;
      case 'Four times daily':
        setReminderTimes([
          createTimeFromHourMinute(8, 0),
          createTimeFromHourMinute(12, 0),
          createTimeFromHourMinute(16, 0),
          createTimeFromHourMinute(20, 0)
        ]);
        setReminderDatesList([currentDate, currentDate, currentDate, currentDate]);
        break;
      case 'Every other day':
        setReminderTimes([createTimeFromHourMinute(9, 0)]);
        setReminderDatesList([currentDate]);
        break;
      case 'Weekly':
        setReminderTimes([createTimeFromHourMinute(9, 0)]);
        setReminderDatesList([currentDate]);
        break;
      case 'As needed':
        setReminderTimes([]);
        setReminderDatesList([]);
        break;
      default:
        setReminderTimes([createTimeFromHourMinute(9, 0)]);
        setReminderDatesList([currentDate]);
    }
  };

  const handleDaysChange = (item) => {
    setDays(item.value);
    setIsDaysFocus(false);
  };

  const onTimeChange = (event, selectedTime) => {
    setShowTimePicker(false);
    if (selectedTime && event.type === 'set') {
      const currentDate = reminderDatesList[currentTimeIndex];
      
      if (!validateDateTime(currentDate, selectedTime)) {
        Alert.alert('Error', 'Please select a future date and time');
        return;
      }
      
      const newTimes = [...reminderTimes];
      newTimes[currentTimeIndex] = selectedTime;
      setReminderTimes(newTimes);
    }
  };

  const onDateChange = (event, selectedDate) => {
    setShowDatePicker(false);
    if (selectedDate && event.type === 'set') {
      const currentTime = reminderTimes[currentDateIndex];
      
      if (!validateDateTime(selectedDate, currentTime)) {
        Alert.alert('Error', 'Please select a future date and time');
        return;
      }
      
      const newDates = [...reminderDatesList];
      newDates[currentDateIndex] = selectedDate;
      setReminderDatesList(newDates);
    }
  };

  const showTimePickerForIndex = (index) => {
    setCurrentTimeIndex(index);
    setShowTimePicker(true);
  };

  const showDatePickerForIndex = (index) => {
    setCurrentDateIndex(index);
    setShowDatePicker(true);
  };

  const formatTime12Hour = (date) => {
    try {
      if (!date || !(date instanceof Date) || isNaN(date.getTime())) {
        return '12:00 PM';
      }
      return date.toLocaleTimeString('en-US', {
        hour: '2-digit',
        minute: '2-digit',
        hour12: true
      });
    } catch (error) {
      console.warn('Error formatting time:', error);
      return '12:00 PM';
    }
  };

  const formatDate = (date) => {
    try {
      if (!date || !(date instanceof Date) || isNaN(date.getTime())) {
        return 'Select Date';
      }
      return date.toLocaleDateString('en-US', {
        weekday: 'short',
        year: 'numeric',
        month: 'short',
        day: 'numeric'
      });
    } catch (error) {
      console.warn('Error formatting date:', error);
      return 'Select Date';
    }
  };

  const addReminderTime = () => {
    if (reminderTimes.length < 6) {
      const newTime = createTimeFromHourMinute(12, 0);
      const currentDate = getCurrentDate();
      
      const now = new Date();
      if (currentDate.toDateString() === now.toDateString()) {
        const futureTime = new Date(now.getTime() + 60 * 60 * 1000);
        newTime.setHours(futureTime.getHours(), futureTime.getMinutes(), 0, 0);
      }
      
      setReminderTimes([...reminderTimes, newTime]);
      setReminderDatesList([...reminderDatesList, currentDate]);
    }
  };

  const removeReminderTime = (index) => {
    if (reminderTimes.length > 1) {
      const newTimes = reminderTimes.filter((_, i) => i !== index);
      const newDates = reminderDatesList.filter((_, i) => i !== index);
      setReminderTimes(newTimes);
      setReminderDatesList(newDates);
    }
  };

const handlePillQuantityChange = (value) => {
  const numValue = value.replace(/[^0-9]/g, '');
  if (numValue === '' || (parseInt(numValue) >= 0 && parseInt(numValue) <= 7)) {
    setPillQuantity(numValue);
  }
};

const incrementPillQuantity = () => {
  const current = parseInt(pillQuantity) || 0;
  if (current < 7) {
    setPillQuantity((current + 1).toString());
  }
};

const decrementPillQuantity = () => {
  const current = parseInt(pillQuantity) || 0;
  if (current > 0) {
    setPillQuantity((current - 1).toString());
  }
};



  const handleSaveDraft = () => {
    if (!selectedMedicine.trim()) {
      Alert.alert('Oh no..', 'Please enter medication name');
      return;
    }
    Alert.alert('Success', 'Medication saved as draft');
  };

  const handleAddMedication = async () => {
    try {
      if (!selectedMedicine.trim() || !selectedDosage.trim()) {
        Alert.alert('Oh no..', 'Please fill in required fields');
        return;
      }

       if (!pillQuantity || parseInt(pillQuantity) <= 0 || parseInt(pillQuantity) > 7) {
         Alert.alert('Oh no..', 'Please enter the number of pills you will put in the device (1–7)');
         return;
      }

      if (!user) {
        Alert.alert('Error', 'You must be logged in to save medicine.');
        navigation.navigate('Login');
        return;
      }

      if (reminderTimes.length > 0 && reminderDatesList.length > 0) {
        for (let i = 0; i < reminderTimes.length; i++) {
          if (reminderDatesList[i] && reminderTimes[i]) {
            if (!validateDateTime(reminderDatesList[i], reminderTimes[i])) {
              Alert.alert('Oh No..', 'The time and Date must be in the correct format and in the future');
              return;
            }
          }
        }
      }

      const formattedReminderTimes = reminderTimes.map(time => formatTime12Hour(time));

const medicineData = {
    ...(isEditing && { id: editingMedicine.id }),
    userId: user.uid,
    name: selectedMedicine,
    dosage: selectedDosage,
    frequency: frequency,
    days: days,
    reminderTimes: formattedReminderTimes,
    reminderDates: reminderDatesList.map(date => date.toISOString()),
    reminderEnabled: reminderEnabled,
    takeWithFood: takeWithFood,
    specialInstructions: specialInstructions,
    
    startDate: reminderDatesList[0] ? reminderDatesList[0].toISOString() : new Date().toISOString(),
    
    pillQuantity: parseInt(pillQuantity),
    currentQuantity: isEditing ? editingMedicine.currentQuantity : parseInt(pillQuantity),
    refillReminder: refillReminder,
    
    isEditing: isEditing,
    updatedAt: serverTimestamp(),
};

      if (isEditing && !fromAlertSettings) {
        const medicineRef = doc(db, "medications", editingMedicine.id);
        await updateDoc(medicineRef, medicineData);
        Alert.alert('Success', `${selectedMedicine} updated successfully!`, [
          { text: 'OK', onPress: () => navigation.navigate('Home') }
        ]);
        return;
      }

      navigation.navigate('AlertSettings', { medicineData });

    } catch (error) {
      console.error('Error preparing medication data:', error);
      Alert.alert('Error', 'Failed to prepare medication data. Please try again.');
    }
  };

  const handlebackButton = () => {
    navigation.navigate('Home');
  };

  const getHeaderTitle = () => {
    if (isEditing) return 'Edit Medicine';
    if (fromAlertSettings) return 'Add Medicine';
    return 'Add Medicine';
  };

  return (
    <SafeAreaView style={styles.container}>
      <ScrollView style={styles.scrollView} showsVerticalScrollIndicator={false}>
        <View style={styles.header}>
          <TouchableOpacity style={styles.backButton} onPress={handlebackButton}>
            <AntDesign name="arrowleft" size={24} color="#333" />
          </TouchableOpacity>
          <Text style={styles.headerTitle}>
            {getHeaderTitle()}
          </Text>
        </View>

        <View style={styles.section}>
          <Text style={styles.sectionHead}>Medication Details</Text>
          <View style={styles.dropdownContainer}>
            <Text style={styles.label}>Select Medicine:</Text>
            <Dropdown
              style={[styles.dropdown, isMedicineFocus && { borderColor: 'blue' }]}
              placeholderStyle={styles.placeholderStyle}
              selectedTextStyle={styles.selectedTextStyle}
              inputSearchStyle={styles.inputSearchStyle}
              iconStyle={styles.iconStyle}
              data={medicineOptions}
              search
              maxHeight={300}
              labelField="label"
              valueField="value"
              placeholder={!isMedicineFocus ? 'Select Medicine' : '...'}
              searchPlaceholder="Search medicine..."
              value={selectedMedicine}
              onFocus={() => setIsMedicineFocus(true)}
              onBlur={() => setIsMedicineFocus(false)}
              onChange={handleMedicineChange}
            />
            <Text style={styles.label}>Select Dosage:</Text>
            <Dropdown
              style={[
                styles.dropdown,
                isDosageFocus && { borderColor: 'blue' },
                !selectedMedicine && { backgroundColor: '#f5f5f5', borderColor: '#ccc' }
              ]}
              placeholderStyle={[
                styles.placeholderStyle,
                !selectedMedicine && { color: '#ccc' }
              ]}
              selectedTextStyle={styles.selectedTextStyle}
              inputSearchStyle={styles.inputSearchStyle}
              iconStyle={styles.iconStyle}
              data={dosageOptions}
              search={dosageOptions.length > 3}
              maxHeight={300}
              labelField="label"
              valueField="value"
              placeholder={
                !selectedMedicine
                  ? 'Please select medicine first'
                  : (!isDosageFocus ? 'Select Dosage' : '...')
              }
              searchPlaceholder="Search dosage..."
              value={selectedDosage}
              onFocus={() => setIsDosageFocus(true)}
              onBlur={() => setIsDosageFocus(false)}
              onChange={handleDosageChange}
              disable={!selectedMedicine}
            />
            <Text style={styles.label}>Frequency:</Text>
            <Dropdown
              style={[styles.dropdown, isFrequencyFocus && { borderColor: 'blue' }]}
              placeholderStyle={styles.placeholderStyle}
              selectedTextStyle={styles.selectedTextStyle}
              inputSearchStyle={styles.inputSearchStyle}
              iconStyle={styles.iconStyle}
              data={frequencyOptions}
              maxHeight={300}
              labelField="label"
              valueField="value"
              placeholder={!isFrequencyFocus ? 'Select Frequency' : '...'}
              value={frequency}
              onFocus={() => setIsFrequencyFocus(true)}
              onBlur={() => setIsFrequencyFocus(false)}
              onChange={handleFrequencyChange}
            />
          </View>
        </View>

        {/* NEW: Pill Inventory Section */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Pill Container (Watch Device)</Text>
          <Text style={styles.sectionSubtitle}>
            How many pills will you put in the device container?
          </Text>
          
          <View style={styles.quantityContainer}>
            <Text style={styles.quantityLabel}>Quantity:</Text>
            <View style={styles.quantityControls}>
              <TouchableOpacity 
                style={styles.quantityButton} 
                onPress={decrementPillQuantity}
              >
                <Text style={styles.quantityButtonText}>−</Text>
              </TouchableOpacity>
              
              <TextInput
                style={styles.quantityInput}
                value={pillQuantity}
                onChangeText={handlePillQuantityChange}
                keyboardType="numeric"
                placeholder="0"
                maxLength={3}
              />
              
              <TouchableOpacity 
                style={styles.quantityButton} 
                onPress={incrementPillQuantity}
              >
                <Text style={styles.quantityButtonText}>+</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
        
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Time & Date Schedule</Text>
          {frequency !== 'As needed' ? (
            <View style={styles.timeScheduleContainer}>
              {reminderTimes.map((time, index) => (
                <View key={index} style={styles.timeRow}>
                  <Text style={styles.timeLabel}>Reminder {index + 1}:</Text>
                  
                  <TouchableOpacity
                    style={styles.dateTimeButton}
                    onPress={() => showTimePickerForIndex(index)}
                  >
                    <AntDesign name="clockcircleo" size={16} color="#666" />
                    <Text style={styles.dateTimeButtonText}>
                      {formatTime12Hour(time)}
                    </Text>
                  </TouchableOpacity>
                  
                  <TouchableOpacity
                    style={styles.dateTimeButton}
                    onPress={() => showDatePickerForIndex(index)}
                  >
                    <AntDesign name="calendar" size={16} color="#666" />
                    <Text style={styles.dateTimeButtonText}>
                      {reminderDatesList[index] ? formatDate(reminderDatesList[index]) : 'Select Date'}
                    </Text>
                  </TouchableOpacity>
                  
                  {reminderTimes.length > 1 && (
                    <TouchableOpacity
                      style={styles.removeTimeButton}
                      onPress={() => removeReminderTime(index)}
                    >
                      <Text style={styles.removeTimeText}>✕</Text>
                    </TouchableOpacity>
                  )}
                </View>
              ))}
              {reminderTimes.length < 6 && (
                <TouchableOpacity style={styles.addTimeButton} onPress={addReminderTime}>
                  <Text style={styles.addTimeText}>Add Another Reminder</Text>
                </TouchableOpacity>
              )}
            </View>
          ) : (
            <View style={styles.scheduleBox}>
              <Text style={styles.scheduleText}>
                No scheduled times - take as needed
              </Text>
            </View>
          )}
        </View>

        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Days</Text>
          <View style={styles.dropdownContainer}>
            <Dropdown
              style={[styles.dropdown, isDaysFocus && { borderColor: 'blue' }]}
              placeholderStyle={styles.placeholderStyle}
              selectedTextStyle={styles.selectedTextStyle}
              inputSearchStyle={styles.inputSearchStyle}
              iconStyle={styles.iconStyle}
              data={daysOptions}
              maxHeight={300}
              labelField="label"
              valueField="value"
              placeholder={!isDaysFocus ? 'Select Days' : '...'}
              value={days}
              onFocus={() => setIsDaysFocus(true)}
              onBlur={() => setIsDaysFocus(false)}
              onChange={handleDaysChange}
            />
          </View>
        </View>

        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Additional Settings</Text>
          <View style={styles.switchRow}>
            <View style={styles.switchLeft}>
              <Text style={styles.switchTitle}>Reminder</Text>
              <Text style={styles.switchSubtitle}>
                Get notified when it's time
              </Text>
            </View>
            <Switch
              value={reminderEnabled}
              onValueChange={setReminderEnabled}
              thumbColor={reminderEnabled ? '#9D4EDD' : '#f4f3f4'}
              trackColor={{ false: '#767577', true: '#E8D5F2' }}
            />
          </View>
          <View style={styles.switchRow}>
            <View style={styles.switchLeft}>
              <Text style={styles.switchTitle}>Take with meal</Text>
              <Text style={styles.switchSubtitle}>
                Reminder to take with food
              </Text>
            </View>
            <Switch
              value={takeWithFood}
              onValueChange={setTakeWithFood}
              thumbColor={takeWithFood ? '#9D4EDD' : '#f4f3f4'}
              trackColor={{ false: '#767577', true: '#E8D5F2' }}
            />
          </View>
        </View>

        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Special Instructions</Text>
          <TextInput
            style={styles.textArea}
            placeholder="Add any special instructions or notes..."
            value={specialInstructions}
            onChangeText={setSpecialInstructions}
            multiline
            numberOfLines={4}
            textAlignVertical="top"
          />
        </View>
         
        <View style={styles.actionButtons}>
          <TouchableOpacity style={styles.draftButton} onPress={handleSaveDraft}>
            <Text style={styles.draftButtonText}>Save as Draft</Text>
          </TouchableOpacity>
          <TouchableOpacity style={styles.addButton} onPress={handleAddMedication}>
            <Text style={styles.addButtonText}>Next</Text>
          </TouchableOpacity>
        </View>

        <View style={styles.bottomSpacing} />

        {showTimePicker && (
          <DateTimePicker
            value={reminderTimes[currentTimeIndex] || new Date()}
            mode="time"
            is24Hour={false}
            display={Platform.OS === 'ios' ? 'spinner' : 'default'}
            onChange={onTimeChange}
          />
        )}

        {showDatePicker && (
          <DateTimePicker
            value={reminderDatesList[currentDateIndex] || new Date()}
            mode="date"
            display={Platform.OS === 'ios' ? 'spinner' : 'default'}
            onChange={onDateChange}
            minimumDate={new Date()}
          />
        )}
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#f8f9fa',
  },
  scrollView: {
    flex: 1,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 16,
    backgroundColor: '#fff',
    borderBottomWidth: 1,
    borderBottomColor: '#e0e0e0',
  },
  backButton: {
    padding: 8,
    marginRight: 12,
  },
  headerTitle: {
    fontSize: 20,
    fontWeight: 'bold',
    color: '#333',
  },
  section: {
    backgroundColor: '#fff',
    marginTop: 12,
    padding: 16,
    borderRadius: 12,
    marginHorizontal: 16,
  },
  sectionHead: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#333',
    marginBottom: 16,
  },
  sectionTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#333',
    marginBottom: 8,
  },
  sectionSubtitle: {
    fontSize: 14,
    color: '#666',
    marginBottom: 16,
  },
  dropdownContainer: {
    gap: 12,
  },
  label: {
    fontSize: 14,
    fontWeight: '600',
    color: '#333',
    marginBottom: 4,
  },
  dropdown: {
    height: 50,
    borderColor: '#ddd',
    borderWidth: 1,
    borderRadius: 8,
    paddingHorizontal: 12,
    backgroundColor: '#fff',
  },
  placeholderStyle: {
    fontSize: 14,
    color: '#999',
  },
  selectedTextStyle: {
    fontSize: 14,
    color: '#333',
  },
  inputSearchStyle: {
    height: 40,
    fontSize: 14,
  },
  iconStyle: {
    width: 20,
    height: 20,
  },
  // NEW: Inventory styles
  quantityContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 16,
    paddingVertical: 8,
  },
  quantityLabel: {
    fontSize: 16,
    fontWeight: '600',
    color: '#333',
  },
  quantityControls: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  quantityButton: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: '#E8D5F2',
    justifyContent: 'center',
    alignItems: 'center',
  },
  quantityButtonText: {
    fontSize: 24,
    fontWeight: 'bold',
    color: '#9D4EDD',
  },
  quantityInput: {
    width: 80,
    height: 45,
    borderWidth: 2,
    borderColor: '#9D4EDD',
    borderRadius: 8,
    textAlign: 'center',
    fontSize: 18,
    fontWeight: 'bold',
    color: '#333',
  },
  
  infoBox: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    backgroundColor: '#F0F0F0',
    padding: 12,
    borderRadius: 8,
  },
  infoText: {
    flex: 1,
    fontSize: 12,
    color: '#666',
  },
  timeScheduleContainer: {
    gap: 12,
  },
  timeRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    paddingVertical: 8,
  },
  timeLabel: {
    fontSize: 14,
    fontWeight: '600',
    color: '#333',
    width: 90,
  },
  dateTimeButton: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    padding: 10,
    backgroundColor: '#f5f5f5',
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#ddd',
  },
  dateTimeButtonText: {
    fontSize: 12,
    color: '#333',
    flex: 1,
  },
  removeTimeButton: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: '#FFE5E5',
    justifyContent: 'center',
    alignItems: 'center',
  },
  removeTimeText: {
    fontSize: 18,
    color: '#FF4444',
    fontWeight: 'bold',
  },
  addTimeButton: {
    padding: 12,
    backgroundColor: '#E8D5F2',
    borderRadius: 8,
    alignItems: 'center',
    marginTop: 8,
  },
  addTimeText: {
    fontSize: 14,
    fontWeight: '600',
    color: '#9D4EDD',
  },
  scheduleBox: {
    padding: 16,
    backgroundColor: '#f5f5f5',
    borderRadius: 8,
    alignItems: 'center',
  },
  scheduleText: {
    fontSize: 14,
    color: '#666',
  },
  switchRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: '#f0f0f0',
  },
  switchLeft: {
    flex: 1,
  },
  switchTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: '#333',
    marginBottom: 4,
  },
  switchSubtitle: {
    fontSize: 12,
    color: '#666',
  },
  textArea: {
    height: 100,
    borderWidth: 1,
    borderColor: '#ddd',
    borderRadius: 8,
    padding: 12,
    fontSize: 14,
    color: '#333',
  },
  actionButtons: {
    flexDirection: 'row',
    gap: 12,
    paddingHorizontal: 16,
    marginTop: 20,
  },
  draftButton: {
    flex: 1,
    padding: 16,
    backgroundColor: '#fff',
    borderRadius: 12,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: '#9D4EDD',
  },
  draftButtonText: {
    fontSize: 16,
    fontWeight: '600',
    color: '#9D4EDD',
  },
  addButton: {
    flex: 1,
    padding: 16,
    backgroundColor: '#9D4EDD',
    borderRadius: 12,
    alignItems: 'center',
  },
  addButtonText: {
    fontSize: 16,
    fontWeight: '600',
    color: '#fff',
  },
  bottomSpacing: {
    height: 40,
  },
});
