import React, { useState, useEffect } from "react";
import {
  View,
  Text,
  StyleSheet,
  SafeAreaView,
  ScrollView,
  Platform,
} from "react-native";
import AsyncStorage from '@react-native-async-storage/async-storage';
import { useFocusEffect } from '@react-navigation/native';
import { AntDesign } from "@expo/vector-icons";
import { getAuth, onAuthStateChanged } from "firebase/auth";

export default function HistoryLog() {
  const [history, setHistory] = useState([]);
  const [userId, setUserId] = useState(null);
  const [isLoading, setIsLoading] = useState(true);
  
  // USER-SPECIFIC KEY - Include userId
  const getDailyStatusKey = (uid) => `daily_status_${uid}_`;
  const auth = getAuth();

  // Auth listener
  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, (user) => {
      if (user) {
        setUserId(user.uid);
      } else {
        setUserId(null);
        setHistory([]);
      }
      setIsLoading(false);
    });

    return unsubscribe;
  }, []);

  const getFormattedDate = (dateString) => {
    const date = new Date(dateString);
    const options = {
      weekday: 'long',
      year: 'numeric',
      month: 'long',
      day: 'numeric'
    };
    return date.toLocaleDateString('en-US', options);
  };

  const getFormattedTime = (dateString) => {
    const date = new Date(dateString);
    const options = {
      hour: '2-digit',
      minute: '2-digit',
      hour12: true
    };
    return date.toLocaleTimeString('en-US', options);
  };

  const getStatusIcon = (status) => {
    switch (status) {
      case 'taken':
        return <AntDesign name="checkcircle" size={30} color="#5cb85c" />;
      case 'missed':
        return <AntDesign name="closecircle" size={30} color="#d9534f" />;
      default:
        return <AntDesign name="medicinebox" size={30} color="#757575" />;
    }
  };

  const getStatusText = (status) => {
    switch (status) {
      case 'taken':
        return { text: 'Taken', color: '#5cb85c' };
      case 'missed':
        return { text: 'Missed', color: '#d9534f' };
      default:
        return { text: 'Pending', color: '#757575' };
    }
  };

  const loadHistory = async (uid) => {
    if (!uid) {
      setHistory([]);
      return;
    }

    try {
      const DAILY_STATUS_KEY = getDailyStatusKey(uid);
      const allKeys = await AsyncStorage.getAllKeys();
      const dailyKeys = allKeys.filter(key => key.startsWith(DAILY_STATUS_KEY));
      
      const historyData = [];
      for (const key of dailyKeys) {
        const dateKey = key.replace(DAILY_STATUS_KEY, '');
        const data = await AsyncStorage.getItem(key);
        if (data) {
          const parsedData = JSON.parse(data);
          const dailyLog = Object.keys(parsedData).map(medId => {
            const entry = parsedData[medId];
            return {
              date: dateKey,
              ...entry,
              id: medId 
            };
          });
          historyData.push(...dailyLog);
        }
      }

      historyData.sort((a, b) => new Date(b.timestamp) - new Date(a.timestamp));
      setHistory(historyData);
    } catch (error) {
      console.error('Failed to load history:', error);
    }
  };

  useFocusEffect(
    React.useCallback(() => {
      if (userId) {
        loadHistory(userId);
      }
    }, [userId])
  );

  const renderHistoryItem = (item, index) => {
    const statusInfo = getStatusText(item.status);

    return (
      <View key={item.id + item.timestamp} style={styles.historyCard}>
        <View style={styles.cardContent}>
          <View style={styles.iconContainer}>
            {getStatusIcon(item.status)}
          </View>
          <View style={styles.mainInfo}>
            <Text style={styles.historyMedicineName}>{item.medicineName}</Text>
            <Text style={styles.historyDate}>{getFormattedDate(item.timestamp)}</Text>
            <Text style={styles.historyTime}>{getFormattedTime(item.timestamp)}</Text>
            <View style={styles.statusContainer}>
              <Text style={[styles.statusText, { color: statusInfo.color }]}>
                Status: {statusInfo.text}
              </Text>
            </View>
          </View>
        </View>
      </View>
    );
  };

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
        <View style={styles.header}>
          <Text style={styles.headerTitle}>Medication History</Text>
          <Text style={styles.headerSubtitle}>
            Review your past medication log
          </Text>
        </View>
        <View style={styles.emptyState}>
          <View style={styles.emptyIcon}>
            <Text style={styles.emptyIconText}>🔒</Text>
          </View>
          <Text style={styles.emptyTitle}>Please log in</Text>
          <Text style={styles.emptySubtitle}>
            Log in to view your medication history.
          </Text>
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.container}>
      <ScrollView
        style={styles.scrollView}
        showsVerticalScrollIndicator={false}
        contentContainerStyle={styles.scrollContent}
      >
        <View style={styles.header}>
          <Text style={styles.headerTitle}>Medication History</Text>
          <Text style={styles.headerSubtitle}>
            Review your past medication log
          </Text>
        </View>

        {history.length === 0 ? (
          <View style={styles.emptyState}>
            <View style={styles.emptyIcon}>
              <Text style={styles.emptyIconText}>📋</Text>
            </View>
            <Text style={styles.emptyTitle}>No history yet</Text>
            <Text style={styles.emptySubtitle}>
              Log your first dose to see it appear here.
            </Text>
          </View>
        ) : (
          <View style={styles.listContainer}>
            {history.map((item, index) => renderHistoryItem(item, index))}
          </View>
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
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  loadingText: {
    fontSize: 16,
    color: '#666',
  },
  header: {
    backgroundColor: '#f8f9fa',
    paddingVertical: 20,
    paddingHorizontal: 16,  
    paddingTop: Platform.OS === 'ios' ? 50 : 20,
  },
  headerTitle: {
    fontSize: 24,
    fontWeight: 'bold',
    color: '#333',
  },
  headerSubtitle: {
    fontSize: 16,
    color: '#666',
    marginTop: 4,
  },
  scrollView: {
    flex: 1,
  },
  scrollContent: {
    paddingBottom: 100,
  },
  listContainer: {
    padding: 16,
  },
  historyCard: {
    backgroundColor: '#fff',
    borderRadius: 12,
    padding: 16,
    marginBottom: 12,
    elevation: 2,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
  },
  cardContent: {
    flexDirection: 'row',
    alignItems: 'center', 
    justifyContent: 'space-between',
  },
  iconContainer: {
    marginRight: 12,
    alignItems: 'center',
    justifyContent: 'center',
  },
  mainInfo: {
    flex: 1,
  },
  historyMedicineName: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#333',
    marginBottom: 4,
  },
  historyDate: {
    fontSize: 14,
    color: '#666',
    marginBottom: 2,
  },
  historyTime: {
    fontSize: 14,
    color: '#666',
    marginBottom: 4,
  },
  statusContainer: {
    marginTop: 4,
  },
  statusText: {
    fontSize: 14,
    fontWeight: '600',
  },
  deleteButton: {
    padding: 8,
    borderRadius: 50,
    backgroundColor: '#f8d7da',
  },
  emptyState: {
    alignItems: 'center',
    justifyContent: 'center',
    padding: 32,
    marginTop: 100,
  },
  emptyIcon: {
    marginBottom: 16,
  },
  emptyIconText: {
    fontSize: 64,
  },
  emptyTitle: {
    fontSize: 24,
    fontWeight: 'bold',
    color: '#333',
    marginBottom: 8,
  },
  emptySubtitle: {
    fontSize: 16,
    color: '#666',
    textAlign: 'center',
  },
});