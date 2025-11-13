import { db } from './firebaseConfig';
import { 
  collection, 
  doc, 
  setDoc, 
  getDoc, 
  getDocs,
  query, 
  where,
  limit,
  deleteDoc,
  writeBatch,
  serverTimestamp 
} from 'firebase/firestore';

class FirestoreDataService {
  
  // ==================== DAILY PROGRESS ====================
  
  async saveDailyProgress(userId, medicineId, status, medicineName, date = null) {
    try {
      const dateKey = date || this.getCurrentDateKey();
      const progressRef = doc(
        db, 
        'dailyProgress', 
        `${userId}_${medicineId}_${dateKey}`
      );
      
      await setDoc(progressRef, {
        userId,
        medicineId,
        medicineName,
        status,
        date: dateKey,
        timestamp: serverTimestamp(),
        updatedAt: serverTimestamp()
      });
      
      console.log(`Daily progress saved: ${medicineName} - ${status}`);
      return true;
    } catch (error) {
      console.error('Failed to save daily progress:', error);
      throw error;
    }
  }
  
  async getDailyProgress(userId, date = null) {
    try {
      const dateKey = date || this.getCurrentDateKey();
      const progressQuery = query(
        collection(db, 'dailyProgress'),
        where('userId', '==', userId),
        where('date', '==', dateKey)
      );
      
      const snapshot = await getDocs(progressQuery);
      const progress = {};
      
      snapshot.forEach(doc => {
        const data = doc.data();
        progress[data.medicineId] = {
          status: data.status,
          timestamp: data.timestamp,
          medicineName: data.medicineName
        };
      });
      
      return progress;
    } catch (error) {
      console.error('Failed to get daily progress:', error);
      return {};
    }
  }
  
  async getProgressForDateRange(userId, days = 7) {
    try {
      const dates = [];
      for (let i = 0; i < days; i++) {
        const date = new Date();
        date.setDate(date.getDate() - i);
        dates.push(date.toISOString().split('T')[0]);
      }
      
      const progressData = {};
      
      for (const date of dates) {
        const dailyProgress = await this.getDailyProgress(userId, date);
        progressData[date] = dailyProgress;
      }
      
      return progressData;
    } catch (error) {
      console.error('Failed to get progress for date range:', error);
      return {};
    }
  }
  
  // ==================== WEEKLY ARCHIVES ====================
  
  async archiveWeekData(userId, weekNumber, weekData) {
    try {
      const archiveRef = doc(db, 'weeklyArchives', `${userId}_${weekNumber}`);
      
      await setDoc(archiveRef, {
        userId,
        weekNumber,
        data: weekData,
        archivedAt: serverTimestamp()
      });
      
      console.log(`Week ${weekNumber} archived successfully`);
      return true;
    } catch (error) {
      console.error('Failed to archive week data:', error);
      throw error;
    }
  }
  
  async getArchivedWeek(userId, weekNumber) {
    try {
      const archiveRef = doc(db, 'weeklyArchives', `${userId}_${weekNumber}`);
      const docSnap = await getDoc(archiveRef);
      
      if (docSnap.exists()) {
        return docSnap.data().data;
      }
      return null;
    } catch (error) {
      console.error('Failed to get archived week:', error);
      return null;
    }
  }
  
  // ✅ FIXED: Removed orderBy to avoid composite index requirement
  async getAllArchivedWeeks(userId) {
    try {
      const archiveQuery = query(
        collection(db, 'weeklyArchives'),
        where('userId', '==', userId)
      );
      
      const snapshot = await getDocs(archiveQuery);
      
      // Sort manually in JavaScript
      const sortedDocs = snapshot.docs.sort((a, b) => {
        const aTime = a.data().archivedAt?.toMillis() || 0;
        const bTime = b.data().archivedAt?.toMillis() || 0;
        return bTime - aTime; // descending order
      });
      
      const archives = {};
      sortedDocs.forEach(doc => {
        const data = doc.data();
        archives[data.weekNumber] = data.data;
      });
      
      return archives;
    } catch (error) {
      console.error('Failed to get all archived weeks:', error);
      return {};
    }
  }
  
  // ==================== NOTIFICATION HISTORY ====================
  
  async logNotification(userId, medicineId, medicineName, dosage, action, scheduledTime = null) {
    try {
      const notificationRef = doc(collection(db, 'notificationHistory'));
      
      await setDoc(notificationRef, {
        userId,
        medicineId,
        medicineName,
        dosage,
        action,
        scheduledTime,
        timestamp: serverTimestamp(),
        notificationId: `${medicineId}_${this.getCurrentDateKey()}_${scheduledTime || 'manual'}`
      });
      
      console.log(`Notification logged: ${medicineName} - ${action}`);
      return true;
    } catch (error) {
      console.error('Failed to log notification:', error);
      throw error;
    }
  }
  
  // ✅ FIXED: Using limit and manual sorting instead of orderBy
  async getNotificationHistory(userId, limitCount = 100) {
    try {
      const notificationQuery = query(
        collection(db, 'notificationHistory'),
        where('userId', '==', userId),
        limit(limitCount)
      );
      
      const snapshot = await getDocs(notificationQuery);
      const notifications = [];
      
      snapshot.forEach(doc => {
        notifications.push({
          id: doc.id,
          ...doc.data()
        });
      });
      
      // Sort manually by timestamp (newest first)
      notifications.sort((a, b) => {
        const aTime = a.timestamp?.toMillis() || 0;
        const bTime = b.timestamp?.toMillis() || 0;
        return bTime - aTime;
      });
      
      return notifications.slice(0, limitCount);
    } catch (error) {
      console.error('Failed to get notification history:', error);
      return [];
    }
  }
  
  async clearOldNotifications(userId, daysToKeep = 30) {
    try {
      const cutoffDate = new Date();
      cutoffDate.setDate(cutoffDate.getDate() - daysToKeep);
      
      const notificationQuery = query(
        collection(db, 'notificationHistory'),
        where('userId', '==', userId)
      );
      
      const snapshot = await getDocs(notificationQuery);
      const batch = writeBatch(db);
      let deleteCount = 0;
      
      snapshot.forEach(doc => {
        const data = doc.data();
        const timestamp = data.timestamp?.toDate();
        if (timestamp && timestamp < cutoffDate) {
          batch.delete(doc.ref);
          deleteCount++;
        }
      });
      
      await batch.commit();
      console.log(`Cleared ${deleteCount} old notifications`);
      return deleteCount;
    } catch (error) {
      console.error('Failed to clear old notifications:', error);
      return 0;
    }
  }
  
  // ==================== STATISTICS ====================
  
  async calculateOverallAdherence(userId) {
    try {
      const progressQuery = query(
        collection(db, 'dailyProgress'),
        where('userId', '==', userId)
      );
      
      const snapshot = await getDocs(progressQuery);
      let totalExpected = 0;
      let totalTaken = 0;
      
      snapshot.forEach(doc => {
        const data = doc.data();
        totalExpected++;
        if (data.status === 'taken') {
          totalTaken++;
        }
      });
      
      // Also include archived weeks
      const archives = await this.getAllArchivedWeeks(userId);
      Object.values(archives).forEach(weekData => {
        Object.values(weekData).forEach(dayData => {
          Object.values(dayData).forEach(medData => {
            totalExpected++;
            if (medData.status === 'taken') {
              totalTaken++;
            }
          });
        });
      });
      
      return totalExpected > 0 ? Math.round((totalTaken / totalExpected) * 100) : 0;
    } catch (error) {
      console.error('Failed to calculate overall adherence:', error);
      return 0;
    }
  }
  
  // ✅ FIXED: Removed orderBy and sort manually
  async calculateStreak(userId) {
    try {
      const progressQuery = query(
        collection(db, 'dailyProgress'),
        where('userId', '==', userId)
      );
      
      const snapshot = await getDocs(progressQuery);
      
      // Group by date
      const dateProgress = {};
      snapshot.forEach(doc => {
        const data = doc.data();
        if (!dateProgress[data.date]) {
          dateProgress[data.date] = { taken: 0, total: 0 };
        }
        dateProgress[data.date].total++;
        if (data.status === 'taken') {
          dateProgress[data.date].taken++;
        }
      });
      
      // Sort dates manually (descending)
      const sortedDates = Object.keys(dateProgress).sort().reverse();
      
      // Calculate streak
      let streak = 0;
      for (const date of sortedDates) {
        const dayData = dateProgress[date];
        const completionRate = dayData.total > 0 ? (dayData.taken / dayData.total) : 0;
        
        if (completionRate >= 0.8) {
          streak++;
        } else {
          break;
        }
      }
      
      return streak;
    } catch (error) {
      console.error('Failed to calculate streak:', error);
      return 0;
    }
  }
  
  // ==================== UTILITY FUNCTIONS ====================
  
  getCurrentDateKey() {
    const today = new Date();
    return today.toISOString().split('T')[0];
  }
  
  getWeekNumber(date) {
    const d = new Date(Date.UTC(date.getFullYear(), date.getMonth(), date.getDate()));
    const dayNum = d.getUTCDay() || 7;
    d.setUTCDate(d.getUTCDate() + 4 - dayNum);
    const yearStart = new Date(Date.UTC(d.getUTCFullYear(), 0, 1));
    const weekNo = Math.ceil((((d - yearStart) / 86400000) + 1) / 7);
    return `${d.getUTCFullYear()}-W${weekNo}`;
  }
  
  async cleanupOldDailyProgress(userId) {
    try {
      const cutoffDate = new Date();
      cutoffDate.setDate(cutoffDate.getDate() - 30);
      const cutoffDateKey = cutoffDate.toISOString().split('T')[0];
      
      const progressQuery = query(
        collection(db, 'dailyProgress'),
        where('userId', '==', userId)
      );
      
      const snapshot = await getDocs(progressQuery);
      const batch = writeBatch(db);
      let deleteCount = 0;
      
      snapshot.forEach(doc => {
        const data = doc.data();
        if (data.date < cutoffDateKey) {
          batch.delete(doc.ref);
          deleteCount++;
        }
      });
      
      await batch.commit();
      console.log(`Cleaned up ${deleteCount} old progress entries`);
      return deleteCount;
    } catch (error) {
      console.error('Failed to cleanup old progress:', error);
      return 0;
    }
  }
}

export default new FirestoreDataService();