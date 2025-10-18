import { BleManager } from 'react-native-ble-plx';
import { PermissionsAndroid, Platform } from 'react-native';
import base64 from 'react-native-base64';

// UUIDs from your Arduino device
const SERVICE_UUID = 'cba77667-81ff-45c8-ab64-ae8599e50373';
const CHARACTERISTIC_UUID = '5d01e477-2544-4eae-ab60-386888dedad6';

class BluetoothService {
  constructor() {
    this.manager = new BleManager();
    this.device = null;
    this.isConnected = false;
    this.listeners = [];
    this.buffer = '';
  }

  async requestPermissions() {
    if (Platform.OS === 'android') {
      if (Platform.Version >= 31) {
        const granted = await PermissionsAndroid.requestMultiple([
          PermissionsAndroid.PERMISSIONS.BLUETOOTH_SCAN,
          PermissionsAndroid.PERMISSIONS.BLUETOOTH_CONNECT,
          PermissionsAndroid.PERMISSIONS.ACCESS_FINE_LOCATION,
        ]);

        return Object.values(granted).every(
          status => status === PermissionsAndroid.RESULTS.GRANTED
        );
      } else {
        const granted = await PermissionsAndroid.request(
          PermissionsAndroid.PERMISSIONS.ACCESS_FINE_LOCATION
        );
        return granted === PermissionsAndroid.RESULTS.GRANTED;
      }
    }
    return true;
  }

  async isBluetoothEnabled() {
    try {
      const state = await this.manager.state();
      return state === 'PoweredOn';
    } catch (error) {
      console.error('Error checking Bluetooth status:', error);
      return false;
    }
  }

  async startScan(onDeviceFound, onError) {
    try {
      const hasPermission = await this.requestPermissions();
      if (!hasPermission) {
        throw new Error('Bluetooth permissions not granted');
      }

      const isEnabled = await this.isBluetoothEnabled();
      if (!isEnabled) {
        throw new Error('Bluetooth is not enabled');
      }

      console.log('🔍 Starting BLE scan...');

      this.manager.startDeviceScan(
        null,
        { allowDuplicates: false },
        (error, device) => {
          if (error) {
            console.error('❌ Scan error:', error);
            onError(error);
            return;
          }

          if (device && device.name) {
            console.log('📡 Found device:', device.name, device.id);
            onDeviceFound({
              id: device.id,
              name: device.name,
              rssi: device.rssi,
            });
          }
        }
      );
    } catch (error) {
      console.error('❌ Error starting scan:', error);
      onError(error);
    }
  }

  stopScan() {
    this.manager.stopDeviceScan();
    console.log('⏹ Stopped scanning');
  }

  async connectToDevice(deviceId) {
    try {
      console.log('🔗 Connecting to device:', deviceId);

      this.device = await this.manager.connectToDevice(deviceId, {
        requestMTU: 512,
      });

      console.log('✓ Connected, discovering services...');

      await this.device.discoverAllServicesAndCharacteristics();

      console.log('✓ Services discovered');

      this.isConnected = true;
      this.buffer = '';

      this.device.onDisconnected((error, device) => {
        console.log('📡 Device disconnected:', device?.name);
        this.isConnected = false;
        this.device = null;
        this.notifyListeners({ type: 'DISCONNECTED' });
      });

      this.startListening();

      return this.device;
    } catch (error) {
      console.error('❌ Connection error:', error);
      this.isConnected = false;
      this.device = null;
      throw error;
    }
  }

  startListening() {
    if (!this.device) return;

    console.log('👂 Setting up characteristic monitoring...');
    console.log('⏸️  App will wait for device to send data...');

    this.device.monitorCharacteristicForService(
      SERVICE_UUID,
      CHARACTERISTIC_UUID,
      (error, characteristic) => {
        if (error) {
          console.error('❌ Monitor error:', error);
          return;
        }

        if (characteristic?.value) {
          try {
            const decoded = base64.decode(characteristic.value);
            this.buffer += decoded;
            const lines = this.buffer.split('\n');
            this.buffer = lines.pop() || '';
            
            lines.forEach(line => {
              const trimmed = line.trim();
              if (trimmed) {
                this.processMessage(trimmed);
              }
            });
          } catch (error) {
            console.error('❌ Error processing data:', error);
          }
        }
      }
    );
  }

  processMessage(message) {
    try {
      const json = JSON.parse(message);
      
      console.log('📨 Received from device:', json.cmd || json.status);
      
      switch (json.cmd) {
        case 'LOGS_DATA':
          this.notifyListeners({
            type: 'LOGS_DATA',
            logs: json.data?.logs || [],
            count: json.count || 0
          });
          break;

        case 'STORAGE_LOGS_DATA':
          this.notifyListeners({
            type: 'STORAGE_LOGS_DATA',
            logs: json.data?.logs || [],
            count: json.count || 0
          });
          break;

        case 'SYNC_LOGS_DATA':
          this.notifyListeners({
            type: 'SYNC_LOGS_DATA',
            logs: json.data?.logs || [],
            count: json.count || 0
          });
          break;

        case 'ADHERENCE_DATA':
          this.notifyListeners({
            type: 'ADHERENCE_DATA',
            data: json.data
          });
          break;

        case 'MEDS_DATA':
          this.notifyListeners({
            type: 'MEDS_DATA',
            medications: json.medications || [],
            count: json.count || 0
          });
          break;

        case 'LOGS_SENT_CONFIRM':
          console.log('✓ Alarm logs confirmed by watch:', json.count);
          this.notifyListeners({
            type: 'LOGS_SENT_CONFIRM',
            count: json.count,
            success: json.success
          });
          break;

        case 'STORAGE_LOGS_SENT_CONFIRM':
          console.log('✓ Storage logs confirmed by watch:', json.count);
          this.notifyListeners({
            type: 'STORAGE_LOGS_SENT_CONFIRM',
            count: json.count,
            success: json.success
          });
          break;

        case 'SYNC_LOGS_SENT_CONFIRM':
          console.log('✓ Sync logs confirmed by watch:', json.count);
          this.notifyListeners({
            type: 'SYNC_LOGS_SENT_CONFIRM',
            count: json.count,
            success: json.success
          });
          break;

        case 'ALL_DATA_SENT_CONFIRM':
          console.log('✓ All data confirmed by watch');
          this.notifyListeners({
            type: 'ALL_DATA_SENT_CONFIRM',
            status: json.status,
            message: json.message,
            breakdown: json.breakdown,
            items_sent: json.items_sent,
            items_total: json.items_total
          });
          break;

        case 'SYNC_RESPONSE':
          console.log('✓ Medication sync response:', json.accepted ? 'ACCEPTED' : 'DECLINED');
          this.notifyListeners({
            type: 'SYNC_RESPONSE',
            accepted: json.accepted,
            medication_id: json.medication_id,
            message: json.message
          });
          break;

        // Only respond to device-initiated ping
        case 'PING':
          console.log('🏓 Ping received from device - responding with pong');
          this.sendCommand({ status: 'pong' });
          break;

        case 'PONG':
          // Only log if app explicitly sent a ping
          console.log('💓 Pong received from device');
          this.notifyListeners({ type: 'PONG' });
          break;

        default:
          if (json.status === 'success') {
            this.notifyListeners({
              type: 'SUCCESS',
              command: json.cmd
            });
          } else if (json.status === 'error') {
            this.notifyListeners({
              type: 'ERROR',
              message: json.message
            });
          } else if (json.status === 'pong') {
            console.log('💓 Device responded to ping');
          } else {
            console.log('📥 Device sent:', json);
          }
      }
    } catch (error) {
      console.error('❌ Error parsing JSON:', error, 'Message:', message);
    }
  }

  async disconnectFromDevice(deviceId) {
    try {
      if (this.device && this.device.id === deviceId) {
        await this.device.cancelConnection();
        this.device = null;
        this.isConnected = false;
        this.buffer = '';
        console.log('✓ Disconnected');
      }
    } catch (error) {
      console.error('❌ Disconnect error:', error);
      throw error;
    }
  }

  async getConnectedDevices() {
    try {
      if (this.device && this.isConnected) {
        const isConnected = await this.device.isConnected();
        if (isConnected) {
          return [this.device];
        }
      }
      return [];
    } catch (error) {
      console.error('❌ Error getting connected devices:', error);
      return [];
    }
  }

  monitorDeviceConnection(deviceId, callback) {
    return {
      remove: () => {
        console.log('Removed connection monitor');
      }
    };
  }

  async sendCommand(command) {
    if (!this.isConnected || !this.device) {
      throw new Error('Not connected to device');
    }

    try {
      const json = JSON.stringify(command);
      const encoded = base64.encode(json + '\n');
      
      await this.device.writeCharacteristicWithResponseForService(
        SERVICE_UUID,
        CHARACTERISTIC_UUID,
        encoded
      );
      
      console.log('📤 Sent to device:', command.cmd || command.status);
    } catch (error) {
      console.error('❌ Error sending command:', error);
      throw error;
    }
  }

  async requestAdherence() {
    console.log('📊 Requesting adherence data...');
    await this.sendCommand({ cmd: 'GET_ADHERENCE' });
  }

  async requestLogs() {
    console.log('📋 Requesting alarm logs...');
    await this.sendCommand({ cmd: 'GET_LOGS' });
  }

  async requestStorageLogs() {
    console.log('📦 Requesting storage logs...');
    await this.sendCommand({ cmd: 'GET_STORAGE_LOGS' });
  }

  async requestSyncLogs() {
    console.log('🔄 Requesting sync logs...');
    await this.sendCommand({ cmd: 'GET_SYNC_LOGS' });
  }

  async requestMedications() {
    console.log('💊 Requesting medications...');
    await this.sendCommand({ cmd: 'GET_MEDS' });
  }

  async requestAllData() {
    console.log('📦 Requesting all data...');
    await this.sendCommand({ cmd: 'GET_ALL_DATA' });
  }

  async addMedication(medication) {
    console.log('➕ Adding medication to device...');
    await this.sendCommand({
      cmd: 'ADD_MED',
      name: medication.name,
      dosage: medication.dosage,
      hour: medication.hour,
      minute: medication.minute,
      frequency: medication.frequency || 'Daily',
      days: medication.days || 'Daily',
      pill_count: medication.pill_count || 0
    });
  }

  async updateMedication(medication) {
    console.log('✏️ Updating medication on device...');
    await this.sendCommand({
      cmd: 'UPDATE_MED',
      id: medication.id,
      name: medication.name,
      dosage: medication.dosage,
      hour: medication.hour,
      minute: medication.minute,
      active: medication.active !== undefined ? medication.active : true
    });
  }

  async deleteMedication(id) {
    console.log('🗑️ Deleting medication from device...');
    await this.sendCommand({
      cmd: 'DELETE_MED',
      id: id
    });
  }

  async updatePillCount(medicationId, pillCount) {
    console.log('💊 Updating pill count on device...');
    await this.sendCommand({
      cmd: 'UPDATE_PILL_COUNT',
      id: medicationId,
      pill_count: pillCount
    });
  }

  async clearLogs() {
    console.log('🧹 Clearing alarm logs on device...');
    await this.sendCommand({ cmd: 'CLEAR_LOGS' });
  }

  async clearStorageLogs() {
    console.log('🧹 Clearing storage logs on device...');
    await this.sendCommand({ cmd: 'CLEAR_STORAGE_LOGS' });
  }

  async clearSyncLogs() {
    console.log('🧹 Clearing sync logs on device...');
    await this.sendCommand({ cmd: 'CLEAR_SYNC_LOGS' });
  }

  // Optional: Manual ping if needed for connection check
  async ping() {
    console.log('🏓 Sending ping to device...');
    await this.sendCommand({ cmd: 'PING' });
  }

  async syncMedicationToDevice(medicineData) {
    if (!this.isConnected || !this.device) {
      throw new Error('Not connected to device');
    }
    
    try {
      const convertTo24Hour = (timeStr) => {
        const [time, meridiem] = timeStr.split(' ');
        const [hours, minutes] = time.split(':');
        let hour24 = parseInt(hours, 10);
        
        if (meridiem === 'PM' && hour24 !== 12) {
          hour24 += 12;
        } else if (meridiem === 'AM' && hour24 === 12) {
          hour24 = 0;
        }
        
        return { hour: hour24, minute: parseInt(minutes, 10) };
      };

      const firstTime = convertTo24Hour(medicineData.reminderTimes[0]);
      
      await this.sendCommand({
        cmd: 'SYNC_MED',
        name: medicineData.name,
        dosage: medicineData.dosage,
        hour: firstTime.hour,
        minute: firstTime.minute,
        frequency: medicineData.frequency || 'Daily',
        days: medicineData.days || 'Daily',
        pill_quantity: medicineData.pill_quantity || 0
      });
      
      console.log('📤 Sync request sent - waiting for device confirmation...');
      
      return new Promise((resolve, reject) => {
        const timeout = setTimeout(() => {
          this.listeners = this.listeners.filter(cb => cb !== listener);
          reject(new Error('Device confirmation timeout (60s)'));
        }, 60000);
        
        const listener = (data) => {
          if (data.type === 'SYNC_RESPONSE') {
            clearTimeout(timeout);
            this.listeners = this.listeners.filter(cb => cb !== listener);
            
            if (data.accepted) {
              console.log('✓ Device accepted medication sync');
              resolve(data);
            } else {
              console.log('✗ Device declined medication sync');
              reject(new Error('Device user declined the medication sync'));
            }
          }
        };
        
        this.subscribe(listener);
      });
      
    } catch (error) {
      console.error('❌ Error syncing medication:', error);
      throw error;
    }
  }

  subscribe(callback) {
    this.listeners.push(callback);
    return () => {
      this.listeners = this.listeners.filter(cb => cb !== callback);
    };
  }

  notifyListeners(data) {
    this.listeners.forEach(callback => {
      try {
        callback(data);
      } catch (error) {
        console.error('❌ Error in listener callback:', error);
      }
    });
  }

  getConnectionStatus() {
    return {
      isConnected: this.isConnected,
      device: this.device ? {
        name: this.device.name,
        id: this.device.id
      } : null
    };
  }

  destroy() {
    if (this.device) {
      this.device.cancelConnection();
    }
    this.manager.destroy();
    this.listeners = [];
    this.buffer = '';
    console.log('✓ BluetoothService destroyed');
  }
}

export default new BluetoothService();