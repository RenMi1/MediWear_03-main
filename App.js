import 'react-native-gesture-handler';
import { StyleSheet, ActivityIndicator, View, Image } from 'react-native';
import './services/firebaseConfig';
import { NavigationContainer } from '@react-navigation/native';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import { createDrawerNavigator } from '@react-navigation/drawer';
import { createBottomTabNavigator } from '@react-navigation/bottom-tabs';
import Login from './sign-login/login';
import SignUp from './sign-login/signup';
import Home from './screens/home';
import Device from './screens/device';
import AddMedicine from './screens/meds_sched';
import MedicineList from './screens/meds_list';
import AlertSettings from './screens/AlertSettings';
import MedicineDetails from './screens/meds_details';
import Stats from './screens/Stats';
import Profile from './screens/profile';
import HistoryLog from './screens/HistoryLog';
import LogScreen from './screens/LogScreen';
import Inventory from './screens/Pill_Inventory';
import NotificationLog from './screens/notificationLog'
import MedicineWatchHub from './screens/WifiDevice';
import {CustomDrawerContent} from './components/CustomDrawerContent';
import { auth } from './services/firebaseConfig';
import { onAuthStateChanged } from 'firebase/auth';
import { useState, useEffect, useRef } from 'react';
import NotificationService from './services/NotificationService';
import FirestoreDataService from './services/FirestoreDataService';
import SplashScreen from './screens/SplashScreen'; 

const Stack = createNativeStackNavigator();
const Drawer = createDrawerNavigator();
const Tab = createBottomTabNavigator();

function MyTabs() {
  return (
    <Tab.Navigator
      screenOptions={({ route }) => ({
        headerShown: false,
        tabBarIcon: ({ focused, color, size }) => {
          let iconSource;
         
          if (route.name === 'Home') {
            iconSource = require('./assets/home.png');
          } else if (route.name === 'MedList') {
            iconSource = require('./assets/capsule.png');
          } else if (route.name === 'Device') {
            iconSource = require('./assets/device.png');
          } else if (route.name === 'MedicineWatchHub') {
            iconSource = require('./assets/wifi.png');
          } else if (route.name === 'Stats') {
            iconSource = require('./assets/stats.png');
          }
          
          return (
            <Image
              source={iconSource}
              style={{
                width: size,
                height: size,
                tintColor: color,
              }}
              resizeMode="contain"
            />
          );
        },
        tabBarActiveTintColor: '#9D4EDD',
        tabBarInactiveTintColor: 'gray',
        tabBarStyle: {
          paddingBottom: 5,
          paddingTop: 5,
          height: 60,
        },
        tabBarLabelStyle: {
          fontSize: 12,
        },
      })}
    >
      <Tab.Screen
        name="Home"
        component={Home}
        options={{ tabBarLabel: 'Home' }}
      />
      <Tab.Screen
        name="MedList"
        component={MedicineList}
        options={{ tabBarLabel: 'Medications' }}
      />
      <Tab.Screen
        name="Device"
        component={Device}
        options={{ tabBarLabel: 'Bluetooth' }}
      />
        <Tab.Screen
        name="MedicineWatchHub"
        component={MedicineWatchHub}
        options={{ tabBarLabel: 'Wifi' }}
      />
      <Tab.Screen
        name="Stats"
        component={Stats}
        options={{ tabBarLabel: 'Stats' }}
      />
    </Tab.Navigator>
  );
}

function MyDrawer() {
  return (
    <Drawer.Navigator
      drawerContent={(props) => <CustomDrawerContent {...props} />}
      screenOptions={{headerShown: false}}
    >
      <Drawer.Screen name="HomeDrawer" component={MyTabs} />
      <Drawer.Screen name="LogScreen" component={LogScreen} />
      <Drawer.Screen name="History" component={HistoryLog} />
      <Drawer.Screen name="Inventory" component={Inventory} />
      <Drawer.Screen name="Profile" component={Profile} />
    </Drawer.Navigator>
  );
}

export default function App() {
  const [initializing, setInitializing] = useState(true);
  const [user, setUser] = useState(null);
  const [showSplash, setShowSplash] = useState(true);
  const notificationSetup = useRef(false);

  // Setup notifications ONCE when user is verified
  const setupNotifications = async (userId) => {
    if (notificationSetup.current) {
      console.log('Notifications already setup, skipping...');
      return;
    }

    // Wait a bit to ensure Firebase is fully initialized
    await new Promise(resolve => setTimeout(resolve, 1000));

    try {
      console.log('🔔 Starting notification setup...');
      
      await NotificationService.registerForPushNotificationsAsync();
      console.log('✅ Push notifications registered');
      
      NotificationService.setupAlarmListener();
      console.log('✅ Alarm listener setup');
      
      // Extra delay before Firebase listener
      await new Promise(resolve => setTimeout(resolve, 500));
      
      NotificationService.startListeningToFirebase(userId);
      console.log('✅ Firebase listener started');
      
      notificationSetup.current = true;
      console.log('✅ All notifications setup complete');
    } catch (error) {
      console.error('❌ Notification setup error:', error);
      // Don't block app from loading
    }
  };

  useEffect(() => {
    let mounted = true;

    const unsubscribe = onAuthStateChanged(auth, async (currentUser) => {
      if (!mounted) return;

      try {
        console.log('Auth state changed:', currentUser?.email, 'Verified:', currentUser?.emailVerified);
        
        if (currentUser?.emailVerified) {
          setUser(currentUser);
          
          // Setup notifications in background (non-blocking)
          setupNotifications(currentUser.uid);
        } else {
          setUser(null);
          notificationSetup.current = false;
          
          // Sign out unverified users
          if (currentUser && !currentUser.emailVerified) {
            console.log('User email not verified, signing out...');
            auth.signOut().catch(err => console.error('Sign out error:', err));
          }
        }
      } catch (error) {
        console.error('Auth state change error:', error);
        setUser(null);
      } finally {
        if (initializing && mounted) {
          // Small delay to ensure everything is ready
          setTimeout(() => {
            if (mounted) {
              setInitializing(false);
            }
          }, 500);
        }
      }
    });

    // Safety timeout
    const timeout = setTimeout(() => {
      if (initializing && mounted) {
        console.log('⏱️ Auth initialization timeout, forcing completion');
        setInitializing(false);
      }
    }, 5000);

    return () => {
      mounted = false;
      clearTimeout(timeout);
      unsubscribe();
    };
  }, [initializing]);

  const handleSplashComplete = () => {
    setShowSplash(false);
  };

  if (showSplash) {
    return <SplashScreen onAnimationComplete={handleSplashComplete} />;
  }

  if (initializing) {
    return (
      <View style={styles.loadingContainer}>
        <ActivityIndicator size="large" color="#9D4EDD" />
      </View>
    );
  }
 
  return (
    <NavigationContainer>
      <Stack.Navigator
        screenOptions={styles.headerOptions}
      >
        {user ? (
          // User is logged in AND email is verified
          <>
            <Stack.Screen
              name="Home"
              component={MyDrawer}
              options={{ headerShown: false }}
            />
            <Stack.Screen
              name="MedList"
              component={MedicineList}
              options={{
                headerShown: true,
                title: 'My Medications',
              }}
            />
            <Stack.Screen
              name="Device"
              component={Device}
              options={{
                headerShown: true,
                title: 'Device Settings',
              }}
            />
            <Stack.Screen
              name="AddMedicine"
              component={AddMedicine}
              options={{
                headerShown: true,
                title: 'Add Medicine',
              }}
            />
            <Stack.Screen
              name="AlertSettings"
              component={AlertSettings}
              options={{
                headerShown: false,
                title: 'Alert Settings',
              }}
            />
            <Stack.Screen
              name="MedicineDetails"
              component={MedicineDetails}
              options={{
                headerShown: false,
                title: 'Details',
              }}
            />
            <Stack.Screen
              name="Stats"
              component={Stats}
              options={{
                headerShown: true,
                title: 'Status',
              }}
            />
            <Stack.Screen
              name="Profile"
              component={Profile}
              options={{
                headerShown: false,
              }}
            />
            <Stack.Screen
              name="HistoryLog"
              component={HistoryLog}
              options={{
                headerShown: true,
              }}
            />
            <Stack.Screen
              name="LogScreen"
              component={LogScreen}
              options={{
                headerShown: false,
              }}
            />
            <Stack.Screen
              name="Inventory"
              component={Inventory}
              options={{
                headerShown: false,
              }}
            />
            <Stack.Screen
              name="NotificationLog"
              component={NotificationLog}
              options={{
                headerShown: false,
              }}
            />
              <Stack.Screen
              name="MedicineWatchHub"
              component={MedicineWatchHub}
              options={{
                headerShown: false,
              }}
            />
          </>
        ) : (
          // User is not logged in OR email is not verified
          <>
            <Stack.Screen
              name="Login"
              component={Login}
              options={{ headerShown: false }}
            />
            <Stack.Screen
              name="SignUp"
              component={SignUp}
              options={{ headerShown: false }}
            />
          </>
        )}
      </Stack.Navigator>
    </NavigationContainer>
  );
}

const styles = StyleSheet.create({
  headerOptions: {
    headerStyle: {
      backgroundColor: '#fff',
    },
    headerTintColor: 'black',
    headerTitleStyle: {
      fontWeight: 'bold',
      fontSize: 18,
    },
    headerTitleAlign: 'center',
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: '#fff',
  },
});
