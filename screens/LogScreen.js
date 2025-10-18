import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  FlatList,
  TouchableOpacity,
  StyleSheet,
  Alert,
  ActivityIndicator,
  RefreshControl,
  Image,
} from 'react-native';
import Ionicons from 'react-native-vector-icons/Ionicons';
import AsyncStorage from '@react-native-async-storage/async-storage';
import BluetoothService from '../services/BluetoothService';
import SyncImage from '../assets/sync.png'; 

const STORAGE_KEY = '@medication_logs';
const STORAGE_LOGS_KEY = '@storage_logs';
const SYNC_LOGS_KEY = '@sync_logs';

export default function LogScreen({ navigation }) {
  const [savedLogs, setSavedLogs] = useState([]);
  const [savedStorageLogs, setSavedStorageLogs] = useState([]);
  const [savedSyncLogs, setSavedSyncLogs] = useState([]);
  const [newLogs, setNewLogs] = useState([]);
  const [newStorageLogs, setNewStorageLogs] = useState([]);
  const [newSyncLogs, setNewSyncLogs] = useState([]);
  const [activeTab, setActiveTab] = useState('saved');
  const [isLoading, setIsLoading] = useState(false);
  const [refreshing, setRefreshing] = useState(false);
  const [connectedDevice, setConnectedDevice] = useState(null);
  const [syncStatus, setSyncStatus] = useState('');
  const [autoSaving, setAutoSaving] = useState(false);

  useEffect(() => {
    const unsubscribe = BluetoothService.subscribe(handleBluetoothData);
    checkConnection();
    loadSavedLogs();
    loadSavedStorageLogs();
    loadSavedSyncLogs();

    return () => {
      unsubscribe();
    };
  }, []);

  const loadSavedLogs = async () => {
    try {
      const logsJson = await AsyncStorage.getItem(STORAGE_KEY);
      if (logsJson) {
        const logs = JSON.parse(logsJson);
        setSavedLogs(logs);
      }
    } catch (error) {
      console.error('Error loading saved logs:', error);
    }
  };

  const loadSavedStorageLogs = async () => {
    try {
      const logsJson = await AsyncStorage.getItem(STORAGE_LOGS_KEY);
      if (logsJson) {
        const logs = JSON.parse(logsJson);
        setSavedStorageLogs(logs);
      }
    } catch (error) {
      console.error('Error loading saved storage logs:', error);
    }
  };

  const loadSavedSyncLogs = async () => {
    try {
      const logsJson = await AsyncStorage.getItem(SYNC_LOGS_KEY);
      if (logsJson) {
        const logs = JSON.parse(logsJson);
        setSavedSyncLogs(logs);
      }
    } catch (error) {
      console.error('Error loading saved sync logs:', error);
    }
  };

  const saveLogsToStorage = async (logsToSave) => {
    try {
      const existingLogsJson = await AsyncStorage.getItem(STORAGE_KEY);
      let existingLogs = existingLogsJson ? JSON.parse(existingLogsJson) : [];
      
      const newLogsWithMeta = logsToSave.map(log => ({
        ...log,
        id: `${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
        savedAt: Date.now()
      }));
      
      const updatedLogs = [...newLogsWithMeta, ...existingLogs];
      
      await AsyncStorage.setItem(STORAGE_KEY, JSON.stringify(updatedLogs));
      setSavedLogs(updatedLogs);
      
      return newLogsWithMeta.length;
    } catch (error) {
      console.error('Error saving logs:', error);
      throw error;
    }
  };

  const saveStorageLogsToStorage = async (logsToSave) => {
    try {
      const existingLogsJson = await AsyncStorage.getItem(STORAGE_LOGS_KEY);
      let existingLogs = existingLogsJson ? JSON.parse(existingLogsJson) : [];
      
      const newLogsWithMeta = logsToSave.map(log => ({
        ...log,
        id: `${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
        savedAt: Date.now()
      }));
      
      const updatedLogs = [...newLogsWithMeta, ...existingLogs];
      
      await AsyncStorage.setItem(STORAGE_LOGS_KEY, JSON.stringify(updatedLogs));
      setSavedStorageLogs(updatedLogs);
      
      return newLogsWithMeta.length;
    } catch (error) {
      console.error('Error saving storage logs:', error);
      throw error;
    }
  };

  const saveSyncLogsToStorage = async (logsToSave) => {
    try {
      const existingLogsJson = await AsyncStorage.getItem(SYNC_LOGS_KEY);
      let existingLogs = existingLogsJson ? JSON.parse(existingLogsJson) : [];
      
      const newLogsWithMeta = logsToSave.map(log => ({
        ...log,
        id: `${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
        savedAt: Date.now()
      }));
      
      const updatedLogs = [...newLogsWithMeta, ...existingLogs];
      
      await AsyncStorage.setItem(SYNC_LOGS_KEY, JSON.stringify(updatedLogs));
      setSavedSyncLogs(updatedLogs);
      
      return newLogsWithMeta.length;
    } catch (error) {
      console.error('Error saving sync logs:', error);
      throw error;
    }
  };

  const checkConnection = async () => {
    try {
      const status = BluetoothService.getConnectionStatus();
      
      if (status.isConnected && status.device) {
        setConnectedDevice(status.device);
      } else {
        setConnectedDevice(null);
      }
    } catch (error) {
      console.error('Error checking connection:', error);
    }
  };

  const handleBluetoothData = async (data) => {
    console.log('📥 Received BLE data:', data.type);
    
    switch (data.type) {
      case 'LOGS_DATA':
        const receivedLogs = data.logs.map((log, index) => ({
          ...log,
          id: `temp_${Date.now()}_${index}`,
          logType: 'alarm'
        }));
        
        setNewLogs(receivedLogs);
        setSyncStatus(`${receivedLogs.length} alarm logs received`);
        setActiveTab('new');
        
        console.log(`✓ Received ${receivedLogs.length} alarm logs`);
        break;
      
      case 'STORAGE_LOGS_DATA':
        const receivedStorageLogs = data.logs.map((log, index) => ({
          ...log,
          id: `temp_storage_${Date.now()}_${index}`,
          logType: 'storage'
        }));
        
        setNewStorageLogs(receivedStorageLogs);
        setSyncStatus(`${receivedStorageLogs.length} storage logs received`);
        
        console.log(`✓ Received ${receivedStorageLogs.length} storage logs`);
        break;
      
      case 'SYNC_LOGS_DATA':
        const receivedSyncLogs = data.logs.map((log, index) => ({
          ...log,
          id: `temp_sync_${Date.now()}_${index}`,
          logType: 'sync'
        }));
        
        setNewSyncLogs(receivedSyncLogs);
        setSyncStatus(`${receivedSyncLogs.length} action logs received`);
        
        console.log(`✓ Received ${receivedSyncLogs.length} sync logs`);
        break;
      
      case 'ADHERENCE_DATA':
        console.log('📊 Watch Adherence data received:', data.data);
        setSyncStatus('Adherence data synced');
        break;
      
      case 'LOGS_SENT_CONFIRM':
        console.log('✓ Watch confirmed alarm log transmission:', data);
        setSyncStatus(`✓ ${data.count} alarm logs confirmed`);
        break;
      
      case 'STORAGE_LOGS_SENT_CONFIRM':
        console.log('✓ Watch confirmed storage log transmission:', data);
        setSyncStatus(`✓ ${data.count} storage logs confirmed`);
        break;
      
      case 'SYNC_LOGS_SENT_CONFIRM':
        console.log('✓ Watch confirmed sync log transmission:', data);
        setSyncStatus(`✓ ${data.count} action logs confirmed`);
        break;
      
      case 'ALL_DATA_SENT_CONFIRM':
        console.log('✓ All data transmission confirmed:', data);
        setSyncStatus('✓ All data synced');
        
        if (data.status === 'success') {
          console.log('✓ Complete sync successful:', data.breakdown);
        } else {
          console.warn('⚠ Partial sync:', data.message);
        }
        break;
      
      case 'SYNC_RESPONSE':
        console.log('✓ Medication sync response:', data);
        
        if (data.accepted) {
          console.log('✓ Watch accepted medication sync');
        } else {
          console.log('✗ Watch declined medication sync');
        }
        break;
      
      case 'PONG':
        console.log('💓 Watch is alive');
        break;
        
      case 'ERROR':
        console.error('❌ BLE Error:', data.message);
        setSyncStatus('Error occurred');
        break;

      case 'DISCONNECTED':
        setConnectedDevice(null);
        setSyncStatus('Disconnected');
        console.log('📡 Watch disconnected');
        break;
    }
  };

  const saveNewLogs = async () => {
    if (newLogs.length === 0 && newStorageLogs.length === 0 && newSyncLogs.length === 0) {
      Alert.alert('No Logs', 'There are no new logs to save');
      return;
    }

    setIsLoading(true);
    try {
      let totalSaved = 0;
      
      if (newLogs.length > 0) {
        const count = await saveLogsToStorage(newLogs);
        totalSaved += count;
        setNewLogs([]);
      }
      
      if (newStorageLogs.length > 0) {
        const count = await saveStorageLogsToStorage(newStorageLogs);
        totalSaved += count;
        setNewStorageLogs([]);
      }
      
      if (newSyncLogs.length > 0) {
        const count = await saveSyncLogsToStorage(newSyncLogs);
        totalSaved += count;
        setNewSyncLogs([]);
      }
      
      setActiveTab('saved');
      setSyncStatus('');
      Alert.alert('Success', `Saved ${totalSaved} logs`);
      console.log(`✓ Manually saved ${totalSaved} total logs`);
    } catch (error) {
      Alert.alert('Error', 'Failed to save logs: ' + error.message);
    } finally {
      setIsLoading(false);
    }
  };

  const discardNewLogs = () => {
    if (newLogs.length === 0 && newStorageLogs.length === 0 && newSyncLogs.length === 0) return;

    Alert.alert(
      'Discard Logs',
      'Remove all new logs without saving?',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Discard',
          style: 'destructive',
          onPress: () => {
            setNewLogs([]);
            setNewStorageLogs([]);
            setNewSyncLogs([]);
            setSyncStatus('');
          }
        }
      ]
    );
  };

  const deleteAllSavedLogs = () => {
    Alert.alert(
      'Delete All Logs',
      'Permanently delete all saved logs? This cannot be undone.',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Delete All',
          style: 'destructive',
          onPress: async () => {
            setIsLoading(true);
            try {
              await AsyncStorage.removeItem(STORAGE_KEY);
              await AsyncStorage.removeItem(STORAGE_LOGS_KEY);
              await AsyncStorage.removeItem(SYNC_LOGS_KEY);
              setSavedLogs([]);
              setSavedStorageLogs([]);
              setSavedSyncLogs([]);
            } catch (error) {
              Alert.alert('Error', 'Failed to delete logs: ' + error.message);
            } finally {
              setIsLoading(false);
            }
          }
        }
      ]
    );
  };

  const deleteSingleLog = (logId, logType) => {
    Alert.alert(
      'Delete Log',
      'Remove this log entry?',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Delete',
          style: 'destructive',
          onPress: async () => {
            try {
              if (logType === 'alarm') {
                const updatedLogs = savedLogs.filter(log => log.id !== logId);
                await AsyncStorage.setItem(STORAGE_KEY, JSON.stringify(updatedLogs));
                setSavedLogs(updatedLogs);
              } else if (logType === 'storage') {
                const updatedLogs = savedStorageLogs.filter(log => log.id !== logId);
                await AsyncStorage.setItem(STORAGE_LOGS_KEY, JSON.stringify(updatedLogs));
                setSavedStorageLogs(updatedLogs);
              } else if (logType === 'sync') {
                const updatedLogs = savedSyncLogs.filter(log => log.id !== logId);
                await AsyncStorage.setItem(SYNC_LOGS_KEY, JSON.stringify(updatedLogs));
                setSavedSyncLogs(updatedLogs);
              }
            } catch (error) {
              Alert.alert('Error', 'Failed to delete log');
            }
          }
        }
      ]
    );
  };

  const onRefresh = async () => {
    setRefreshing(true);
    await checkConnection();
    await loadSavedLogs();
    await loadSavedStorageLogs();
    await loadSavedSyncLogs();
    setTimeout(() => setRefreshing(false), 500);
  };

  const formatDateTime = (timestamp) => {
    const date = new Date(timestamp * 1000);
    return date.toLocaleString('en-US', {
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
      hour12: true
    });
  };

  const formatSavedDate = (timestamp) => {
    const date = new Date(timestamp);
    return date.toLocaleString('en-US', {
      month: 'short',
      day: 'numeric',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
      hour12: true
    });
  };

  const getActionColor = (action) => {
    switch (action?.toLowerCase()) {
      case 'taken':
        return '#10b981';
      case 'snoozed':
      case 'auto-snoozed':
        return '#f59e0b';
      case 'dismissed':
      case 'missed':
        return '#ef4444';
      case 'opened':
        return '#3b82f6';
      case 'closed':
        return '#6b7280';
      default:
        return '#6b7280';
    }
  };

  const getActionIcon = (action) => {
    switch (action?.toLowerCase()) {
      case 'taken':
        return 'checkmark-circle';
      case 'snoozed':
      case 'auto-snoozed':
        return 'time';
      case 'dismissed':
      case 'missed':
        return 'close-circle';
      case 'opened':
        return 'lock-open';
      case 'closed':
        return 'lock-closed';
      default:
        return 'help-circle';
    }
  };

  const getSyncLogStyle = (item) => {
    const isAppSync = item.source === 'APP_SYNC';
    const action = item.action?.toUpperCase();
    
    if (isAppSync) {
      const isAccepted = action === 'ACCEPTED';
      return {
        bgColor: isAccepted ? '#E8D5F2' : '#FFF3CD',
        borderColor: isAccepted ? '#9D4EDD' : '#f59e0b',
        icon: 'bluetooth',
        label: 'APP SYNC',
        textColor: isAccepted ? '#6b21a8' : '#92400e'
      };
    } else {
      // Manual actions
      if (action === 'ADDED') {
        return {
          bgColor: '#D5F4E6',
          borderColor: '#10b981',
          icon: 'add-circle',
          label: 'MANUAL ADD',
          textColor: '#065f46'
        };
      } else if (action === 'EDITED') {
        return {
          bgColor: '#FFF3CD',
          borderColor: '#f59e0b',
          icon: 'create',
          label: 'MANUAL EDIT',
          textColor: '#92400e'
        };
      } else if (action === 'DELETED') {
        return {
          bgColor: '#F8D7DA',
          borderColor: '#ef4444',
          icon: 'trash',
          label: 'MANUAL DELETE',
          textColor: '#991b1b'
        };
      } else {
        return {
          bgColor: '#E3F2FD',
          borderColor: '#3b82f6',
          icon: 'settings',
          label: 'MANUAL ACTION',
          textColor: '#1e40af'
        };
      }
    }
  };

  const renderLog = ({ item, index, isSaved }) => {
    let logTypeLabel = '';
    let logTypeBgColor = '#EBF5FB';
    let logTypeBorderColor = '#3b82f6';
    let logTypeIcon = 'alarm';
    
    if (item.logType === 'alarm') {
      logTypeLabel = 'ALARM LOG';
      logTypeBgColor = '#EBF5FB';
      logTypeBorderColor = '#3b82f6';
      logTypeIcon = 'notifications';
    } else if (item.logType === 'storage') {
      logTypeLabel = 'STORAGE LOG';
      logTypeBgColor = '#E8F5E9';
      logTypeBorderColor = '#10b981';
      logTypeIcon = 'cube';
    } else if (item.logType === 'sync') {
      const syncStyle = getSyncLogStyle(item);
      logTypeLabel = syncStyle.label;
      logTypeBgColor = syncStyle.bgColor;
      logTypeBorderColor = syncStyle.borderColor;
      logTypeIcon = syncStyle.icon;
    }
    
    return (
      <View style={[styles.logCard, { backgroundColor: logTypeBgColor, borderWidth: 2, borderColor: logTypeBorderColor }]}>
        {/* Log Type Badge */}
        <View style={[styles.logTypeBadge, { backgroundColor: logTypeBorderColor }]}>
          <Ionicons name={logTypeIcon} size={12} color="white" style={{ marginRight: 4 }} />
          <Text style={styles.logTypeText}>
            {logTypeLabel}
          </Text>
        </View>
        
        <View style={styles.cardHeader}>
          <View style={styles.indexBadge}>
            <Text style={styles.indexText}>{index + 1}</Text>
          </View>
          
          <View style={styles.medicationInfo}>
            {item.logType === 'sync' ? (
              <>
                <Text style={styles.medicationName}>{item.medication_name || item.medication}</Text>
                <Text style={styles.dosageText}>{item.dosage}</Text>
                <View style={[styles.syncActionBadge, { backgroundColor: logTypeBorderColor }]}>
                  <Text style={styles.syncActionText}>{item.action}</Text>
                </View>
              </>
            ) : (
              <>
                <Text style={styles.medicationName}>{item.medication_name || item.medication}</Text>
                <Text style={styles.dosageText}>{item.dosage}</Text>
              </>
            )}
          </View>
          
          {isSaved && (
            <TouchableOpacity
              style={styles.deleteButton}
              onPress={() => deleteSingleLog(item.id, item.logType)}
            >
              <Ionicons name="trash-outline" size={20} color="#ef4444" />
            </TouchableOpacity>
          )}
        </View>

        {item.logType !== 'sync' && (
          <View style={styles.actionBadgeContainer}>
            <View style={[styles.actionBadge, { backgroundColor: getActionColor(item.action) }]}>
              <Ionicons name={getActionIcon(item.action)} size={14} color="white" />
              <Text style={styles.actionText}>{item.action}</Text>
            </View>
          </View>
        )}

        <View style={styles.cardFooter}>
          <View style={styles.infoChip}>
            <Ionicons name="time-outline" size={14} color="#6b7280" />
            <Text style={styles.infoChipText}>
              {isSaved ? formatSavedDate(item.savedAt) : formatDateTime(item.timestamp)}
            </Text>
          </View>
          
          {item.snooze_count > 0 && (
            <View style={styles.infoChip}>
              <Ionicons name="alarm-outline" size={14} color="#f59e0b" />
              <Text style={styles.infoChipText}>Snoozed {item.snooze_count}x</Text>
            </View>
          )}
          
          {item.pill_count !== undefined && item.pill_count > 0 && (
            <View style={styles.infoChip}>
              <Ionicons name="medical-outline" size={14} color="#6b7280" />
              <Text style={styles.infoChipText}>{item.pill_count} pills</Text>
            </View>
          )}
          
          {item.pill_quantity !== undefined && item.pill_quantity > 0 && (
            <View style={styles.infoChip}>
              <Ionicons name="medical-outline" size={14} color="#6b7280" />
              <Text style={styles.infoChipText}>{item.pill_quantity} qty</Text>
            </View>
          )}

          {isSaved && (
            <View style={[styles.infoChip, styles.savedChip]}>
              <Ionicons name="checkmark-circle" size={14} color="#10b981" />
              <Text style={[styles.infoChipText, { color: '#065f46' }]}>Saved</Text>
            </View>
          )}
        </View>
      </View>
    );
  };

  const currentLogs = activeTab === 'saved'
    ? [...savedLogs, ...savedStorageLogs, ...savedSyncLogs].sort((a, b) => b.savedAt - a.savedAt)
    : [...newLogs, ...newStorageLogs, ...newSyncLogs].sort((a, b) => b.timestamp - a.timestamp);

  const totalNewLogs = newLogs.length + newStorageLogs.length + newSyncLogs.length;
  const totalSavedLogs = savedLogs.length + savedStorageLogs.length + savedSyncLogs.length;

  return (
    <View style={styles.container}>
      {/* Status Banner */}
      {autoSaving && (
        <View style={styles.statusBanner}>
          <View style={styles.statusContent}>
            <ActivityIndicator size="small" color="#92400e" />
            <Text style={styles.statusText}>Auto-saving logs...</Text>
          </View>
        </View>
      )}

      {connectedDevice && !autoSaving && (
        <View style={[styles.statusBanner, styles.connectedBanner]}>
          <View style={styles.statusContent}>
            <Ionicons name="bluetooth" size={16} color="#065f46" />
            <Text style={[styles.statusText, styles.connectedText]}>
              Connected to {connectedDevice.name}
            </Text>
          </View>
        </View>
      )}

      {/* Header */}
      <View style={styles.header}>
        <View style={styles.headerLeft}>
          <Ionicons name="document-text" size={28} color="#9D4EDD" />
          <Text style={styles.title}>Logs</Text>
        </View>
        <TouchableOpacity style={styles.refreshBtn} onPress={onRefresh}>
  <Image source={SyncImage} style={styles.syncImage} resizeMode="contain" />
</TouchableOpacity>

      </View>

      {/* Tab Navigation */}
      <View style={styles.tabContainer}>
        <TouchableOpacity
          style={[styles.tab, activeTab === 'saved' && styles.activeTab]}
          onPress={() => setActiveTab('saved')}
        >
          <Ionicons
            name="save"
            size={18}
            color={activeTab === 'saved' ? '#9D4EDD' : '#6b7280'}
          />
          <Text style={[styles.tabText, activeTab === 'saved' && styles.activeTabText]}>
            Saved Logs
          </Text>
          <View style={[styles.badge, activeTab === 'saved' && styles.activeBadge]}>
            <Text style={[styles.badgeText, activeTab === 'saved' && styles.activeBadgeText]}>
              {totalSavedLogs}
            </Text>
          </View>
        </TouchableOpacity>

        <TouchableOpacity
          style={[styles.tab, activeTab === 'new' && styles.activeTab]}
          onPress={() => setActiveTab('new')}
        >
          <Ionicons
            name="download"
            size={18}
            color={activeTab === 'new' ? '#9D4EDD' : '#6b7280'}
          />
          <Text style={[styles.tabText, activeTab === 'new' && styles.activeTabText]}>
            New Logs
          </Text>
          <View style={[styles.badge, activeTab === 'new' && styles.activeBadge]}>
            <Text style={[styles.badgeText, activeTab === 'new' && styles.activeBadgeText]}>
              {totalNewLogs}
            </Text>
          </View>
        </TouchableOpacity>
      </View>

      {/* Log Type Summary */}
      {currentLogs.length > 0 && (
        <View style={styles.summaryContainer}>
          <View style={styles.summaryChip}>
            <Ionicons name="notifications" size={14} color="#3b82f6" />
            <Text style={styles.summaryText}>
              {activeTab === 'saved' ? savedLogs.length : newLogs.length} Alarms
            </Text>
          </View>
          <View style={styles.summaryChip}>
            <Ionicons name="cube" size={14} color="#10b981" />
            <Text style={styles.summaryText}>
              {activeTab === 'saved' ? savedStorageLogs.length : newStorageLogs.length} Storage
            </Text>
          </View>
          <View style={styles.summaryChip}>
            <Ionicons name="sync" size={14} color="#9D4EDD" />
            <Text style={styles.summaryText}>
              {activeTab === 'saved' ? savedSyncLogs.length : newSyncLogs.length} Actions
            </Text>
          </View>
        </View>
      )}

      {/* Action Buttons */}
      {activeTab === 'new' && totalNewLogs > 0 && (
        <View style={styles.actionBar}>
          <TouchableOpacity
            style={[styles.actionButton, styles.saveButton]}
            onPress={saveNewLogs}
            disabled={isLoading}
          >
            <Ionicons name="save-outline" size={18} color="white" />
            <Text style={styles.buttonText}>Save All Logs</Text>
          </TouchableOpacity>
          <TouchableOpacity
            style={[styles.actionButton, styles.discardButton]}
            onPress={discardNewLogs}
            disabled={isLoading}
          >
            <Ionicons name="close-outline" size={18} color="white" />
            <Text style={styles.buttonText}>Discard</Text>
          </TouchableOpacity>
        </View>
      )}

      {activeTab === 'saved' && totalSavedLogs > 0 && (
        <View style={styles.actionBar}>
          <TouchableOpacity
            style={[styles.actionButton, styles.deleteAllButton]}
            onPress={deleteAllSavedLogs}
            disabled={isLoading}
          >
            <Ionicons name="trash-outline" size={18} color="white" />
            <Text style={styles.buttonText}>Delete All Logs</Text>
          </TouchableOpacity>
        </View>
      )}

      {/* Info Card */}
      {activeTab === 'new' && (
        <View style={styles.infoCard}>
          <Ionicons name="information-circle" size={20} color="#9D4EDD" />
          <Text style={styles.infoCardText}>
            Press "PUSH LOGS" on your watch to receive medication logs. They will be auto-saved.
          </Text>
        </View>
      )}

      {activeTab === 'saved' && (
        <View style={styles.infoCard}>
          <Ionicons name="information-circle" size={20} color="#10b981" />
          <Text style={[styles.infoCardText, { color: '#065f46' }]}>
            All logs are saved permanently. Tap the trash icon to delete individual entries.
          </Text>
        </View>
      )}

      {/* Logs List */}
      <FlatList
        data={currentLogs}
        renderItem={({ item, index }) => renderLog({ item, index, isSaved: activeTab === 'saved' })}
        keyExtractor={(item) => item.id}
        contentContainerStyle={styles.listContent}
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={onRefresh}
            colors={['#9D4EDD']}
            tintColor="#9D4EDD"
          />
        }
        ListEmptyComponent={
          <View style={styles.emptyState}>
            <View style={styles.emptyIconContainer}>
              <Ionicons
                name={activeTab === 'saved' ? 'folder-open-outline' : 'download-outline'}
                size={64}
                color="#d1d5db"
              />
            </View>
            <Text style={styles.emptyTitle}>
              {activeTab === 'saved' ? 'No saved logs yet' : 'No new logs'}
            </Text>
            <Text style={styles.emptySubtext}>
              {activeTab === 'saved'
                ? 'Logs from your watch will be saved here permanently after syncing'
                : !connectedDevice
                ? 'Connect your watch and press "PUSH LOGS" to receive medication logs'
                : 'Press "PUSH LOGS" on your watch to sync new logs'
              }
            </Text>
          </View>
        }
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#f5f5f7',
  },

  syncImage: {
  width: 22,
  height: 22,
  tintColor: '#9D4EDD', // optional: removes if you want original colors
},

  statusBanner: {
    backgroundColor: '#fef3c7',
    paddingVertical: 12,
    paddingHorizontal: 16,
    borderBottomWidth: 1,
    borderBottomColor: '#fde68a',
  },
  connectedBanner: {
    backgroundColor: '#d1fae5',
    borderBottomColor: '#a7f3d0',
  },
  statusContent: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
  },
  statusText: {
    fontSize: 14,
    fontWeight: '600',
    color: '#92400e',
  },
  connectedText: {
    color: '#065f46',
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 20,
    paddingVertical: 20,
    backgroundColor: 'white',
  },
  headerLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  title: {
    fontSize: 28,
    fontWeight: 'bold',
    color: '#1a1a1a',
  },
  refreshBtn: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: '#f3e8ff',
    alignItems: 'center',
    justifyContent: 'center',
  },
  tabContainer: {
    flexDirection: 'row',
    backgroundColor: 'white',
    paddingHorizontal: 16,
    paddingBottom: 12,
    gap: 8,
  },
  tab: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 12,
    paddingHorizontal: 16,
    borderRadius: 12,
    backgroundColor: '#f9fafb',
    gap: 8,
  },
  activeTab: {
    backgroundColor: '#f3e8ff',
  },
  tabText: {
    fontSize: 14,
    fontWeight: '600',
    color: '#6b7280',
  },
  activeTabText: {
    color: '#9D4EDD',
  },
  badge: {
    backgroundColor: '#e5e7eb',
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: 10,
    minWidth: 24,
    alignItems: 'center',
  },
  activeBadge: {
    backgroundColor: '#9D4EDD',
  },
  badgeText: {
    fontSize: 12,
    fontWeight: '700',
    color: '#6b7280',
  },
  activeBadgeText: {
    color: 'white',
  },
  summaryContainer: {
    flexDirection: 'row',
    justifyContent: 'space-around',
    backgroundColor: 'white',
    paddingVertical: 12,
    paddingHorizontal: 16,
    borderTopWidth: 1,
    borderTopColor: '#f3f4f6',
  },
  summaryChip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: 12,
    paddingVertical: 6,
    backgroundColor: '#f9fafb',
    borderRadius: 8,
  },
  summaryText: {
    fontSize: 12,
    fontWeight: '600',
    color: '#6b7280',
  },
  actionBar: {
    flexDirection: 'row',
    paddingHorizontal: 16,
    paddingTop: 12,
    paddingBottom: 8,
    backgroundColor: 'white',
    gap: 8,
  },
  actionButton: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 14,
    paddingHorizontal: 20,
    borderRadius: 12,
    gap: 8,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.08,
    shadowRadius: 4,
    elevation: 2,
  },
  saveButton: {
    backgroundColor: '#10b981',
  },
  discardButton: {
    backgroundColor: '#6b7280',
  },
  deleteAllButton: {
    backgroundColor: '#ef4444',
  },
  buttonText: {
    color: 'white',
    fontWeight: '600',
    fontSize: 15,
  },
  infoCard: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    backgroundColor: '#f3e8ff',
    marginHorizontal: 16,
    marginTop: 16,
    padding: 16,
    borderRadius: 12,
  },
  infoCardText: {
    flex: 1,
    fontSize: 13,
    color: '#6b21a8',
    lineHeight: 18,
  },
  listContent: {
    padding: 16,
    paddingTop: 20,
  },
  logCard: {
    backgroundColor: 'white',
    borderRadius: 16,
    padding: 16,
    marginBottom: 12,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.06,
    shadowRadius: 8,
    elevation: 2,
  },
  logTypeBadge: {
    position: 'absolute',
    top: 12,
    right: 12,
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 8,
    zIndex: 1,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.1,
    shadowRadius: 2,
    elevation: 2,
  },
  logTypeText: {
    fontSize: 10,
    fontWeight: '800',
    color: 'white',
    letterSpacing: 0.5,
  },
  cardHeader: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 12,
    marginBottom: 12,
    marginTop: 8,
  },
  indexBadge: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: '#f3f4f6',
    alignItems: 'center',
    justifyContent: 'center',
  },
  indexText: {
    fontSize: 15,
    fontWeight: '700',
    color: '#6b7280',
  },
  medicationInfo: {
    flex: 1,
    paddingRight: 8,
  },
  medicationName: {
    fontSize: 18,
    fontWeight: '700',
    color: '#1a1a1a',
    marginBottom: 4,
  },
  dosageText: {
    fontSize: 14,
    color: '#6b7280',
    marginBottom: 4,
  },
  syncActionBadge: {
    alignSelf: 'flex-start',
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 6,
    marginTop: 6,
  },
  syncActionText: {
    color: 'white',
    fontSize: 11,
    fontWeight: '700',
    letterSpacing: 0.5,
  },
  actionBadgeContainer: {
    marginBottom: 12,
    alignItems: 'flex-start',
  },
  actionBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 20,
    gap: 6,
  },
  actionText: {
    color: 'white',
    fontSize: 13,
    fontWeight: '700',
    textTransform: 'capitalize',
  },
  cardFooter: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
    paddingTop: 12,
    borderTopWidth: 1,
    borderTopColor: '#f3f4f6',
  },
  infoChip: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#f9fafb',
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 8,
    gap: 6,
  },
  savedChip: {
    backgroundColor: '#d1fae5',
  },
  infoChipText: {
    fontSize: 12,
    color: '#6b7280',
    fontWeight: '500',
  },
  deleteButton: {
    width: 36,
    height: 36,
    borderRadius: 18,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#fee2e2',
  },
  emptyState: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 80,
    paddingHorizontal: 32,
  },
  emptyIconContainer: {
    width: 120,
    height: 120,
    borderRadius: 60,
    backgroundColor: '#f3f4f6',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 20,
  },
  emptyTitle: {
    fontSize: 22,
    fontWeight: '700',
    color: '#374151',
    marginBottom: 8,
  },
  emptySubtext: {
    fontSize: 15,
    color: '#9ca3af',
    textAlign: 'center',
    lineHeight: 22,
  },
});

