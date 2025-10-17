// StorageUtils.js - Utility functions for managing medicine progress with dates

{/*import AsyncStorage from '@react-native-async-storage/async-storage';

export class MedicineProgressManager {
  static STATUS_STORAGE_KEY = 'medicine_status_';
  static DAILY_STATUS_KEY = 'daily_status_';

  // current date here
  static getCurrentDateKey() {
    const today = new Date();
    return today.toISOString().split('T')[0];
  }

  // Get date key for a specific date
  static getDateKey(date) {
    return date.toISOString().split('T')[0];
  }

  // Update medicine status for a specific date
  static async updateMedicineStatus(medicineId, status, date = null) {
    const dateKey = date ? this.getDateKey(date) : this.getCurrentDateKey();
    const statusKey = `${this.STATUS_STORAGE_KEY}${medicineId}_${dateKey}`;
    
    try {
      await AsyncStorage.setItem(statusKey, status);
      
      // Also update the daily progress summary
      await this.updateDailyProgress(medicineId, status, dateKey);
      
      return true;
    } catch (error) {
      console.error('Failed to update medicine status:', error);
      return false;
    }
  }

  // Get medicine status for a specific date
  static async getMedicineStatus(medicineId, date = null) {
    const dateKey = date ? this.getDateKey(date) : this.getCurrentDateKey();
    const statusKey = `${this.STATUS_STORAGE_KEY}${medicineId}_${dateKey}`;
    
    try {
      const status = await AsyncStorage.getItem(statusKey);
      return status || 'pending';
    } catch (error) {
      console.error('Failed to get medicine status:', error);
      return 'pending';
    }
  }

  // Update daily progress summary
  static async updateDailyProgress(medicineId, status, dateKey) {
    const progressKey = `${this.DAILY_STATUS_KEY}${dateKey}`;
    
    try {
      const existingProgress = await AsyncStorage.getItem(progressKey);
      const progress = existingProgress ? JSON.parse(existingProgress) : {};
      
      progress[medicineId] = {
        status: status,
        timestamp: new Date().toISOString()
      };
      
      await AsyncStorage.setItem(progressKey, JSON.stringify(progress));
      return true;
    } catch (error) {
      console.error('Failed to update daily progress:', error);
      return false;
    }
  }

  // Get daily progress summary
  static async getDailyProgress(date = null) {
    const dateKey = date ? this.getDateKey(date) : this.getCurrentDateKey();
    const progressKey = `${this.DAILY_STATUS_KEY}${dateKey}`;
    
    try {
      const progressData = await AsyncStorage.getItem(progressKey);
      return progressData ? JSON.parse(progressData) : {};
    } catch (error) {
      console.error('Failed to get daily progress:', error);
      return {};
    }
  }

  // Calculate streak
  static async calculateStreak() {
    try {
      const allKeys = await AsyncStorage.getAllKeys();
      const dailyStatusKeys = allKeys.filter(key => key.startsWith(this.DAILY_STATUS_KEY));
      
      if (dailyStatusKeys.length === 0) {
        return 0;
      }

      // Sort dates in descending order (most recent first)
      const sortedDates = dailyStatusKeys
        .map(key => key.replace(this.DAILY_STATUS_KEY, ''))
        .sort((a, b) => new Date(b) - new Date(a));

      let currentStreak = 0;
      const today = this.getCurrentDateKey();

      for (const date of sortedDates) {
        const progressKey = `${this.DAILY_STATUS_KEY}${date}`;
        const progressData = await AsyncStorage.getItem(progressKey);
        
        if (progressData) {
          const progress = JSON.parse(progressData);
          const statuses = Object.values(progress);
          const takenCount = statuses.filter(item => item.status === 'taken').length;
          const totalCount = statuses.length;
          
          // Consider it a successful day if at least 80% of medicines were taken
          const completionRate = totalCount > 0 ? (takenCount / totalCount) : 0;
          
          if (completionRate >= 0.8) {
            currentStreak++;
          } else if (date !== today) {
            // Don't break streak for today if it's not completed yet
            break;
          }
        } else if (date === today) {
          // Today hasn't been completed yet, don't break streak
          continue;
        } else {
          // No data for this day, streak is broken
          break;
        }
      }

      return currentStreak;
    } catch (error) {
      console.error('Failed to calculate streak:', error);
      return 0;
    }
  }

  // Calculate weekly progress
  static async calculateWeeklyProgress() {
    try {
      const today = new Date();
      let totalExpectedDoses = 0;
      let totalTakenDoses = 0;

      for (let i = 0; i < 7; i++) {
        const checkDate = new Date(today.getTime() - i * 24 * 60 * 60 * 1000);
        const dateKey = this.getDateKey(checkDate);
        const progressKey = `${this.DAILY_STATUS_KEY}${dateKey}`;
        
        const progressData = await AsyncStorage.getItem(progressKey);
        if (progressData) {
          const progress = JSON.parse(progressData);
          const statuses = Object.values(progress);
          
          totalExpectedDoses += statuses.length;
          totalTakenDoses += statuses.filter(item => item.status === 'taken').length;
        }
      }

      return totalExpectedDoses > 0 ? Math.round((totalTakenDoses / totalExpectedDoses) * 100) : 0;
    } catch (error) {
      console.error('Failed to calculate weekly progress:', error);
      return 0;
    }
  }

  // Get progress for a date range
  static async getProgressForDateRange(startDate, endDate) {
    try {
      const progress = [];
      const current = new Date(startDate);
      
      while (current <= endDate) {
        const dateKey = this.getDateKey(current);
        const dailyProgress = await this.getDailyProgress(current);
        
        const statuses = Object.values(dailyProgress);
        const totalDoses = statuses.length;
        const takenDoses = statuses.filter(item => item.status === 'taken').length;
        const missedDoses = statuses.filter(item => item.status === 'missed').length;
        const completionPercentage = totalDoses > 0 ? Math.round((takenDoses / totalDoses) * 100) : 0;
        
        progress.push({
          date: dateKey,
          totalDoses,
          takenDoses,
          missedDoses,
          completionPercentage
        });
        
        current.setDate(current.getDate() + 1);
      }
      
      return progress;
    } catch (error) {
      console.error('Failed to get progress for date range:', error);
      return [];
    }
  }

  // Clean up old data (keep only last 30 days)
  static async cleanupOldData() {
    try {
      const allKeys = await AsyncStorage.getAllKeys();
      const thirtyDaysAgo = new Date();
      thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);
      const cutoffDate = this.getDateKey(thirtyDaysAgo);
      
      const keysToRemove = allKeys.filter(key => {
        if (key.startsWith(this.STATUS_STORAGE_KEY) || key.startsWith(this.DAILY_STATUS_KEY)) {
          const datePart = key.split('_').pop();
          return datePart < cutoffDate;
        }
        return false;
      });
      
      if (keysToRemove.length > 0) {
        await AsyncStorage.multiRemove(keysToRemove);
        console.log(`Cleaned up ${keysToRemove.length} old medicine records`);
      }
    } catch (error) {
      console.error('Failed to cleanup old data:', error);
    }
  }

  // Reset all medicine statuses for today (useful for testing)
  static async resetTodayStatuses() {
    try {
      const allKeys = await AsyncStorage.getAllKeys();
      const today = this.getCurrentDateKey();
      
      const keysToRemove = allKeys.filter(key => 
        key.includes(`_${today}`) && 
        (key.startsWith(this.STATUS_STORAGE_KEY) || key.startsWith(this.DAILY_STATUS_KEY))
      );
      
      if (keysToRemove.length > 0) {
        await AsyncStorage.multiRemove(keysToRemove);
        console.log(`Reset ${keysToRemove.length} today's statuses`);
      }
    } catch (error) {
      console.error('Failed to reset today statuses:', error);
    }
  }

  // Check if medicine time has passed (for missed dose detection)
  static checkMissedDose(reminderTime) {
    if (!reminderTime) return false;
    
    const [time, meridiem] = reminderTime.split(' ');
    if (!time || !meridiem) return false;
    
    let [hours, minutes] = time.split(':').map(Number);
    
    // Convert to 24-hour format
    if (meridiem.toLowerCase() === 'pm' && hours < 12) {
      hours += 12;
    }
    if (meridiem.toLowerCase() === 'am' && hours === 12) {
      hours = 0;
    }
    
    const doseTime = new Date();
    doseTime.setHours(hours, minutes, 0, 0);
    
    // Add 10 minutes grace period
    const tenMinutesAfterDose = new Date(doseTime.getTime() + 10 * 60000);
    const now = new Date();
    
    return now > tenMinutesAfterDose;
  }

  static getFormattedDate(date = null) {
    const targetDate = date || new Date();
    const options = { 
      weekday: 'long', 
      year: 'numeric', 
      month: 'long', 
      day: 'numeric' 
    };
    return targetDate.toLocaleDateString('en-US', options);
  }
}
  */}