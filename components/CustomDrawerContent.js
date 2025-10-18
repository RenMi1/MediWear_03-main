import React, { useState, useEffect } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, SafeAreaView, Image, Alert } from 'react-native';
import { DrawerContentScrollView } from '@react-navigation/drawer';
import { useNavigation } from '@react-navigation/native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import Icon from 'react-native-vector-icons/Ionicons';
import { auth } from '../services/firebaseConfig';
import { signOut } from 'firebase/auth';

export function CustomDrawerContent(props) {
  const navigation = useNavigation();
  const [userData, setUserData] = useState({
    name: 'User',
    email: 'user@example.com',
  });

  useEffect(() => {
    loadUserData();
    
    // Reload when drawer opens or when returning to any screen
    const unsubscribe = navigation.addListener('state', () => {
      loadUserData();
    });

    return unsubscribe;
  }, [navigation]);

  const loadUserData = async () => {
    try {
      const storedData = await AsyncStorage.getItem('userData');
      if (storedData) {
        const parsedData = JSON.parse(storedData);
        setUserData({
          name: parsedData.name || 'User',
          email: parsedData.email || 'user@example.com',
        });
      }
    } catch (error) {
      console.error('Error loading user data:', error);
    }
  };

  const handleLogout = async () => {
    try {
      await signOut(auth);
      await AsyncStorage.removeItem('userData');
    } catch (error) {
      console.error('Error during logout:', error);
      Alert.alert('Logout Error', 'Failed to logout. Please try again.');
    }
  };

  const getInitials = (name) => {
    if (!name) return '?';
    const names = name.trim().split(' ');
    if (names.length === 1) {
      return names[0].charAt(0).toUpperCase();
    }
    return (names[0].charAt(0) + names[names.length - 1].charAt(0)).toUpperCase();
  };

  const menuItems = [
    { label: 'Home', screen: 'HomeDrawer', icon: require('../assets/home.png') },
    { label: 'Watch Logs', screen: 'LogScreen', icon: require('../assets/smart-watch.png') },
    { label: 'History', screen: 'HistoryLog', icon: require('../assets/history.png') },
    { label: 'Profile', screen: 'Profile', icon: require('../assets/user.png') },
    { label: 'Inventory', screen: 'Inventory', icon: require('../assets/pill_bottle.png') },
  ];

  const getCurrentRouteIndex = () => {
    const currentRoute = props.state.routes[props.state.index];
    return menuItems.findIndex(item => item.screen === currentRoute.name);
  };

  const currentIndex = getCurrentRouteIndex();

  return (
    <SafeAreaView style={styles.container}>
      <TouchableOpacity 
        style={styles.header}
        onPress={() => navigation.navigate('Profile')}
        activeOpacity={0.7}
      >
        <View style={styles.profileIconContainer}>
          <Text style={styles.profileIconText}>{getInitials(userData.name)}</Text>
        </View>
        <Text style={styles.userName}>{userData.name}</Text>
        <Text style={styles.userEmail}>{userData.email}</Text>
      </TouchableOpacity>

      <DrawerContentScrollView 
        {...props} 
        contentContainerStyle={styles.drawerContent}
        showsVerticalScrollIndicator={false}
      >
        <View style={styles.menuSection}>
          {menuItems.map((item, index) => (
            <TouchableOpacity
              key={`drawer-item-${index}`}
              style={[
                styles.drawerItem,
                currentIndex === index && styles.activeDrawerItem,
              ]}
              onPress={() => navigation.navigate(item.screen)}
              activeOpacity={0.7}
            >
              <View style={[
                styles.iconContainer,
                currentIndex === index && styles.activeIconContainer
              ]}>
                <Image 
                  source={item.icon} 
                  style={[
                    styles.menuIcon,
                    currentIndex === index && styles.activeMenuIcon
                  ]} 
                  resizeMode="contain"
                />
              </View>
              <Text
                style={[
                  styles.drawerLabel,
                  currentIndex === index && styles.activeDrawerLabel,
                ]}
              >
                {item.label}
              </Text>
            </TouchableOpacity>
          ))}
        </View>
      </DrawerContentScrollView>

      <View style={styles.footer}>
        <TouchableOpacity 
          style={styles.logoutButton} 
          onPress={handleLogout}
          activeOpacity={0.7}
        >
          <View style={styles.logoutIconContainer}>
            <Image
              source={require('../assets/logout.png')}
              style={styles.logoutIcon}
              resizeMode="contain"
            />
          </View>
          <Text style={styles.logoutText}>Logout</Text>
        </TouchableOpacity>
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#FAFAFA',
  },
  header: {
    padding: 24,
    paddingTop: 20,
    paddingBottom: 28,
    borderBottomWidth: 1,
    borderBottomColor: '#E8E8E8',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#FFFFFF',
  },
  profileIconContainer: {
    width: 70,
    height: 70,
    borderRadius: 35,
    backgroundColor: '#9D4EDD',
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 12,
    shadowColor: '#9D4EDD',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.2,
    shadowRadius: 8,
    elevation: 4,
  },
  profileIconText: {
    color: '#FFFFFF',
    fontSize: 28,
    fontWeight: 'bold',
  },
  userName: {
    fontSize: 17,
    fontWeight: '600',
    color: '#1A1A1A',
    marginTop: 4,
  },
  userEmail: {
    fontSize: 13,
    color: '#757575',
    marginTop: 4,
  },
  drawerContent: {
    flexGrow: 1,
    paddingTop: 8,
  },
  menuSection: {
    paddingHorizontal: 12,
    paddingVertical: 8,
  },
  drawerItem: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 14,
    paddingHorizontal: 16,
    borderRadius: 12,
    marginBottom: 4,
    backgroundColor: 'transparent',
  },
  activeDrawerItem: {
    backgroundColor: '#F3E8FF',
  },
  iconContainer: {
    width: 36,
    height: 36,
    borderRadius: 10,
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 14,
    backgroundColor: '#F5F5F5',
  },
  activeIconContainer: {
    backgroundColor: '#9D4EDD',
  },
  menuIcon: {
    width: 20,
    height: 20,
    tintColor: '#616161',
  },
  activeMenuIcon: {
    tintColor: '#FFFFFF',
  },
  drawerLabel: {
    fontSize: 15,
    fontWeight: '500',
    color: '#424242',
    letterSpacing: 0.2,
  },
  activeDrawerLabel: {
    color: '#9D4EDD',
    fontWeight: '600',
  },
  footer: {
    padding: 16,
    paddingBottom: 24,
    borderTopWidth: 1,
    borderTopColor: '#E8E8E8',
    backgroundColor: '#FFFFFF',
  },
  logoutButton: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 12,
    paddingHorizontal: 16,
    borderRadius: 12,
    backgroundColor: '#FFEBEE',
  },
  logoutIconContainer: {
    width: 36,
    height: 36,
    borderRadius: 10,
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 14,
    backgroundColor: '#FFCDD2',
  },
  logoutIcon: {
    width: 22,
    height: 22,
    tintColor: '#E53935',
  },
  logoutText: {
    fontSize: 15,
    color: '#E53935',
    fontWeight: '600',
  },
});

export default CustomDrawerContent;