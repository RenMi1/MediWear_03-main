import AsyncStorage from '@react-native-async-storage/async-storage';

const LOGS_STORAGE_KEY = 'dev_logs';
const MAX_LOGS = 500; 

class LoggingService {
  static async addLog(category, message, details = '') {
    try {
      const storedLogs = await AsyncStorage.getItem(LOGS_STORAGE_KEY);
      const logs = storedLogs ? JSON.parse(storedLogs) : [];
      
      const newLog = {
        id: Date.now().toString(),
        category, 
        message,
        details,
        timestamp: new Date().toISOString(),
      };
      
      const updatedLogs = [...logs, newLog].slice(-MAX_LOGS);
      
      await AsyncStorage.setItem(LOGS_STORAGE_KEY, JSON.stringify(updatedLogs));
      
      return newLog;
    } catch (error) {
      console.error('Failed to add log:', error);
    }
  }

  static async getLogs() {
    try {
      const storedLogs = await AsyncStorage.getItem(LOGS_STORAGE_KEY);
      return storedLogs ? JSON.parse(storedLogs) : [];
    } catch (error) {
      console.error('Failed to get logs:', error);
      return [];
    }
  }

  static async clearLogs() {
    try {
      await AsyncStorage.removeItem(LOGS_STORAGE_KEY);
    } catch (error) {
      console.error('Failed to clear logs:', error);
    }
  }
}

export default LoggingService;