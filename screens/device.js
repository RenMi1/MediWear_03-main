import React, { useState, useEffect, useCallback, useRef } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  ScrollView,
  Alert,
  ActivityIndicator,
  StyleSheet,
  RefreshControl,
  Platform,
} from 'react-native';
import Ionicons from 'react-native-vector-icons/Ionicons';
import BluetoothService from '../services/BluetoothService';

export default function Device() {
  const [isScanning, setIsScanning] = useState(false);
  const [devices, setDevices] = useState([]);
  const [connectedDevice, setConnectedDevice] = useState(null);
  const [connectingDeviceId, setConnectingDeviceId] = useState(null);
  const [bluetoothEnabled, setBluetoothEnabled] = useState(false);
  const [permissionsGranted, setPermissionsGranted] = useState(false);
  const [refreshing, setRefreshing] = useState(false);
  
  const scanTimeoutRef = useRef(null);
  const connectionMonitorRef = useRef(null);

  useEffect(() => {
    initializeBluetooth();

    return () => {
      cleanup();
    };
  }, []);

  const cleanup = () => {
    if (scanTimeoutRef.current) {
      clearTimeout(scanTimeoutRef.current);
    }
    if (connectionMonitorRef.current) {
      connectionMonitorRef.current.remove();
    }
    BluetoothService.stopScan();
    if (connectedDevice) {
      BluetoothService.disconnectFromDevice(connectedDevice.id).catch(console.error);
    }
  };

  const initializeBluetooth = async () => {
    try {
      const granted = await BluetoothService.requestPermissions();
      setPermissionsGranted(granted);

      if (!granted) {
        Alert.alert(
          'Permissions Required',
          'Bluetooth permissions are required to scan for devices. Please grant permissions in settings.'
        );
        return;
      }

      const enabled = await BluetoothService.isBluetoothEnabled();
      setBluetoothEnabled(enabled);

      if (!enabled) {
        Alert.alert(
          'Bluetooth Disabled',
          'Please enable Bluetooth to scan for devices.',
          [{ text: 'OK' }]
        );
      }
    } catch (error) {
      console.error('Initialization error:', error);
      Alert.alert('Error', 'Failed to initialize Bluetooth');
    }
  };

  const startScan = async () => {
    if (!permissionsGranted) {
      Alert.alert('Permissions Required', 'Please grant Bluetooth permissions first');
      return;
    }

    if (!bluetoothEnabled) {
      Alert.alert('Bluetooth Disabled', 'Please enable Bluetooth to scan for devices');
      return;
    }

    // Clear previous scan timeout
    if (scanTimeoutRef.current) {
      clearTimeout(scanTimeoutRef.current);
    }

    setIsScanning(true);
    setDevices([]);

    try {
      await BluetoothService.startScan(
        (device) => {
          setDevices((prevDevices) => {
            const existingIndex = prevDevices.findIndex(d => d.id === device.id);
            if (existingIndex !== -1) {
              const updated = [...prevDevices];
              updated[existingIndex] = device;
              return updated;
            }
            return [...prevDevices, device];
          });
        },
        (error) => {
          console.error('Scan error:', error);
          setIsScanning(false);
          Alert.alert('Scan Error', error.message || 'Failed to scan for devices');
        }
      );

      // Auto-stop scan after 15 seconds
      scanTimeoutRef.current = setTimeout(() => {
        stopScan();
      }, 15000);
    } catch (error) {
      console.error('Failed to start scan:', error);
      setIsScanning(false);
      Alert.alert('Error', 'Failed to start scanning');
    }
  };

  const stopScan = () => {
    if (scanTimeoutRef.current) {
      clearTimeout(scanTimeoutRef.current);
    }
    BluetoothService.stopScan();
    setIsScanning(false);
  };

  const connectToDevice = async (device) => {
    // Prevent multiple connection attempts
    if (connectingDeviceId || connectedDevice) {
      return;
    }

    Alert.alert(
      'Connect to Device',
      `Connect to ${device.name || 'Unknown Device'}?`,
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Connect',
          onPress: async () => {
            setConnectingDeviceId(device.id);
            
            // Stop scanning before connecting
            stopScan();
            
            // Small delay to ensure scan has stopped
            await new Promise(resolve => setTimeout(resolve, 300));

            try {
              console.log(`Attempting to connect to ${device.name} (${device.id})`);
              
              const connectedDev = await BluetoothService.connectToDevice(device.id);
              
              console.log('Connection successful, setting up monitoring');
              
              // Set connected device state
              setConnectedDevice(connectedDev);
              setConnectingDeviceId(null);

              // Setup disconnect monitoring
              if (connectionMonitorRef.current) {
                connectionMonitorRef.current.remove();
              }
              
              connectionMonitorRef.current = BluetoothService.monitorDeviceConnection(
                device.id,
                (error, disconnectedDevice) => {
                  console.log('Device disconnected:', disconnectedDevice?.name);
                  setConnectedDevice(null);
                  Alert.alert(
                    'Disconnected',
                    `${device.name || 'Device'} has been disconnected`
                  );
                }
              );

              Alert.alert('Success', `Connected to ${device.name || 'Device'}`);
            } catch (error) {
              console.error('Connection error:', error);
              setConnectingDeviceId(null);
              
              let errorMessage = 'Failed to connect to device';
              if (error.message) {
                if (error.message.includes('timeout')) {
                  errorMessage = 'Connection timeout. Device may be out of range.';
                } else if (error.message.includes('disconnected')) {
                  errorMessage = 'Device disconnected during connection.';
                } else {
                  errorMessage = error.message;
                }
              }
              
              Alert.alert('Connection Failed', errorMessage);
            }
          },
        },
      ]
    );
  };

  const disconnectDevice = async () => {
    if (!connectedDevice) return;

    Alert.alert(
      'Disconnect',
      `Disconnect from ${connectedDevice.name || 'device'}?`,
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Disconnect',
          style: 'destructive',
          onPress: async () => {
            try {
              // Remove monitoring first
              if (connectionMonitorRef.current) {
                connectionMonitorRef.current.remove();
                connectionMonitorRef.current = null;
              }
              
              await BluetoothService.disconnectFromDevice(connectedDevice.id);
              setConnectedDevice(null);
              Alert.alert('Disconnected', 'Device disconnected successfully');
            } catch (error) {
              console.error('Disconnect error:', error);
              Alert.alert('Error', 'Failed to disconnect device');
            }
          },
        },
      ]
    );
  };

  const onRefresh = useCallback(async () => {
    setRefreshing(true);
    await initializeBluetooth();
    setRefreshing(false);
  }, []);

  const getSignalStrength = (rssi) => {
    if (!rssi) return { text: 'Unknown', color: '#9ca3af', icon: 'wifi-outline' };
    if (rssi > -50) return { text: 'Excellent', color: '#10b981', icon: 'wifi' };
    if (rssi > -60) return { text: 'Good', color: '#3b82f6', icon: 'wifi' };
    if (rssi > -70) return { text: 'Fair', color: '#f59e0b', icon: 'wifi-outline' };
    return { text: 'Weak', color: '#ef4444', icon: 'wifi-outline' };
  };

  return (
    <View style={styles.container}>
      {/* Status Banner */}
      {!permissionsGranted && (
        <View style={styles.warningBanner}>
          <Ionicons name="warning-outline" size={20} color="#92400e" />
          <Text style={styles.warningText}>Bluetooth permissions not granted</Text>
          <TouchableOpacity onPress={initializeBluetooth} style={styles.warningBtn}>
            <Text style={styles.warningBtnText}>Grant</Text>
          </TouchableOpacity>
        </View>
      )}

      {!bluetoothEnabled && permissionsGranted && (
        <View style={styles.warningBanner}>
          <Ionicons name="bluetooth-outline" size={20} color="#92400e" />
          <Text style={styles.warningText}>Bluetooth is disabled</Text>
          <TouchableOpacity onPress={initializeBluetooth} style={styles.warningBtn}>
            <Text style={styles.warningBtnText}>Check</Text>
          </TouchableOpacity>
        </View>
      )}

      {/* Connected Device Card */}
      {connectedDevice && (
        <View style={styles.connectedCard}>
          <View style={styles.connectedHeader}>
            <Ionicons name="checkmark-circle" size={20} color="#10b981" />
            <Text style={styles.connectedLabel}>CONNECTED DEVICE</Text>
          </View>
          <View style={styles.connectedRow}>
            <View style={styles.flex1}>
              <Text style={styles.deviceName}>{connectedDevice.name || 'Unknown Device'}</Text>
              <Text style={styles.deviceId} numberOfLines={1}>
                {connectedDevice.id}
              </Text>
              <View style={styles.signalRow}>
                <Ionicons 
                  name={getSignalStrength(connectedDevice.rssi).icon} 
                  size={14} 
                  color={getSignalStrength(connectedDevice.rssi).color} 
                />
                <Text style={styles.signalText}>
                  {getSignalStrength(connectedDevice.rssi).text}
                </Text>
              </View>
            </View>
            <TouchableOpacity onPress={disconnectDevice} style={styles.disconnectBtn}>
              <Ionicons name="close-circle-outline" size={18} color="white" />
              <Text style={styles.btnText}>Disconnect</Text>
            </TouchableOpacity>
          </View>
        </View>
      )}

      {/* Scan Button */}
      <View style={styles.scanContainer}>
        <TouchableOpacity
          onPress={isScanning ? stopScan : startScan}
          disabled={!bluetoothEnabled || !permissionsGranted || connectingDeviceId !== null}
          style={[
            styles.scanBtn,
            (!bluetoothEnabled || !permissionsGranted || connectingDeviceId !== null) && styles.scanBtnDisabled,
            isScanning && styles.scanBtnActive,
          ]}
        >
          {isScanning ? (
            <ActivityIndicator color="white" size="small" style={styles.loader} />
          ) : (
            <Ionicons name="scan-outline" size={24} color="white" style={styles.loader} />
          )}
          <Text style={styles.scanBtnText}>
            {isScanning ? 'Stop Scanning' : 'Scan for Devices'}
          </Text>
        </TouchableOpacity>
      </View>

      {/* Device List */}
      <View style={styles.listContainer}>
        <View style={styles.listHeader}>
          <Text style={styles.listTitle}>
            Available Devices ({devices.length})
          </Text>
          {isScanning && (
            <View style={styles.scanningBadge}>
              <ActivityIndicator size="small" color="#2563eb" style={{ marginRight: 4 }} />
              <Text style={styles.scanningText}>Scanning...</Text>
            </View>
          )}
        </View>

        <ScrollView
          style={styles.scrollView}
          refreshControl={
            <RefreshControl refreshing={refreshing} onRefresh={onRefresh} />
          }
        >
          {devices.length === 0 && !isScanning && (
            <View style={styles.emptyState}>
              <Ionicons name="bluetooth-outline" size={80} color="#d1d5db" />
              <Text style={styles.emptyText}>No devices found</Text>
              <Text style={styles.emptySubtext}>
                Tap "Scan for Devices" to start scanning
              </Text>
            </View>
          )}

          {devices.map((device) => {
            const signal = getSignalStrength(device.rssi);
            const isConnected = connectedDevice?.id === device.id;
            const isConnecting = connectingDeviceId === device.id;

            return (
              <TouchableOpacity
                key={device.id}
                onPress={() => !isConnected && !isConnecting && connectToDevice(device)}
                disabled={isConnected || isConnecting || connectingDeviceId !== null}
                style={[
                  styles.deviceCard,
                  isConnected && styles.deviceCardConnected,
                  isConnecting && styles.deviceCardConnecting,
                ]}
              >
                <View style={styles.deviceRow}>
                  <View style={[
                    styles.deviceIcon,
                    isConnected && styles.deviceIconConnected,
                  ]}>
                    <Ionicons 
                      name="bluetooth" 
                      size={24} 
                      color={isConnected ? '#10b981' : '#9D4EDD'} 
                    />
                  </View>
                  <View style={styles.flex1}>
                    <Text style={styles.deviceName}>
                      {device.name || 'Unknown Device'}
                    </Text>
                    <Text style={styles.deviceId} numberOfLines={1}>
                      {device.id}
                    </Text>
                    <View style={styles.signalRow}>
                      <Ionicons name={signal.icon} size={14} color={signal.color} />
                      <Text style={styles.signalText}>
                        {signal.text} • {device.rssi || 'N/A'} dBm
                      </Text>
                    </View>
                  </View>
                  {isConnecting ? (
                    <ActivityIndicator size="small" color="#9D4EDD" />
                  ) : isConnected ? (
                    <View style={styles.connectedBadge}>
                      <Text style={styles.connectedBadgeText}>Connected</Text>
                    </View>
                  ) : (
                    <Ionicons name="chevron-forward" size={20} color="#9ca3af" />
                  )}
                </View>
              </TouchableOpacity>
            );
          })}
        </ScrollView>
      </View>

      {/* Info Footer */}
      <View style={styles.footer}>
        <Ionicons name="information-circle-outline" size={16} color="#1e40af" />
        <Text style={styles.footerText}>
          Pull down to refresh • Stop scanning before connecting
        </Text>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#f9fafb',
  },
  warningBanner: {
    backgroundColor: '#fef3c7',
    padding: 16,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  warningText: {
    color: '#92400e',
    fontSize: 14,
    flex: 1,
    marginLeft: 8,
  },
  warningBtn: {
    backgroundColor: '#f59e0b',
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 6,
  },
  warningBtnText: {
    color: 'white',
    fontSize: 12,
    fontWeight: '600',
  },
  connectedCard: {
    backgroundColor: 'white',
    marginHorizontal: 16,
    marginTop: 16,
    padding: 16,
    borderRadius: 12,
    borderWidth: 2,
    borderColor: '#10b981',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 3,
  },
  connectedHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 12,
    gap: 8,
  },
  connectedLabel: {
    color: '#10b981',
    fontSize: 11,
    fontWeight: '700',
    letterSpacing: 1,
  },
  connectedRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  flex1: {
    flex: 1,
  },
  disconnectBtn: {
    backgroundColor: '#ef4444',
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 8,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  btnText: {
    color: 'white',
    fontWeight: '600',
    fontSize: 13,
  },
  scanContainer: {
    paddingHorizontal: 16,
    marginTop: 16,
  },
  scanBtn: {
    backgroundColor: '#9D4EDD',
    paddingVertical: 16,
    borderRadius: 12,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.2,
    shadowRadius: 3,
    elevation: 4,
  },
  scanBtnDisabled: {
    backgroundColor: '#9ca3af',
  },
  scanBtnActive: {
    backgroundColor: '#ef4444',
  },
  loader: {
    marginRight: 8,
  },
  scanBtnText: {
    color: 'white',
    fontWeight: 'bold',
    fontSize: 16,
  },
  listContainer: {
    flex: 1,
    marginTop: 16,
  },
  listHeader: {
    paddingHorizontal: 16,
    paddingBottom: 12,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  listTitle: {
    color: '#374151',
    fontWeight: '600',
    fontSize: 15,
  },
  scanningBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#eff6ff',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 12,
  },
  scanningText: {
    color: '#2563eb',
    fontSize: 11,
    fontWeight: '600',
  },
  scrollView: {
    flex: 1,
    paddingHorizontal: 16,
  },
  emptyState: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 64,
  },
  emptyText: {
    color: '#6b7280',
    fontSize: 18,
    fontWeight: '600',
    marginTop: 16,
    marginBottom: 8,
  },
  emptySubtext: {
    color: '#9ca3af',
    fontSize: 14,
    textAlign: 'center',
    paddingHorizontal: 32,
  },
  deviceCard: {
    backgroundColor: 'white',
    padding: 16,
    borderRadius: 12,
    marginBottom: 12,
    borderWidth: 1,
    borderColor: '#e5e7eb',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.05,
    shadowRadius: 2,
    elevation: 2,
  },
  deviceCardConnected: {
    borderColor: '#10b981',
    borderWidth: 2,
    backgroundColor: '#f0fdf4',
  },
  deviceCardConnecting: {
    borderColor: '#9D4EDD',
    borderWidth: 2,
    backgroundColor: '#faf5ff',
  },
  deviceRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  deviceIcon: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: '#f3f4f6',
    alignItems: 'center',
    justifyContent: 'center',
  },
  deviceIconConnected: {
    backgroundColor: '#d1fae5',
  },
  deviceName: {
    fontSize: 16,
    fontWeight: '600',
    color: '#1f2937',
    marginBottom: 4,
  },
  deviceId: {
    fontSize: 11,
    color: '#9ca3af',
    fontFamily: Platform.OS === 'ios' ? 'Courier' : 'monospace',
    marginBottom: 6,
  },
  signalRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  signalText: {
    fontSize: 12,
    color: '#6b7280',
  },
  connectedBadge: {
    backgroundColor: '#10b981',
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 12,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  connectedBadgeText: {
    color: 'white',
    fontSize: 11,
    fontWeight: '700',
  },
  footer: {
    backgroundColor: '#eff6ff',
    padding: 12,
    borderTopWidth: 1,
    borderTopColor: '#dbeafe',
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
  },
  footerText: {
    color: '#1e40af',
    fontSize: 11,
  },
});