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
import {CustomDrawerContent} from './components/CustomDrawerContent';
import { auth } from './services/firebaseConfig';
import { onAuthStateChanged } from 'firebase/auth';
import { useState, useEffect } from 'react';
import NotificationService from './services/NotificationService';
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
        options={{ tabBarLabel: 'Device' }}
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

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, async (currentUser) => {
      console.log('Auth state changed:', currentUser?.email, 'Verified:', currentUser?.emailVerified);
      
      // Only set user if they exist AND email is verified
      if (currentUser && currentUser.emailVerified) {
        setUser(currentUser);
        
        // Setup notification permissions and listener for verified users
        await NotificationService.registerForPushNotificationsAsync();
        NotificationService.setupAlarmListener();
        NotificationService.startListeningToFirebase(currentUser.uid);
      } else {
        // User is not logged in OR email is not verified
        setUser(null);
        
        // If user exists but email is not verified, sign them out
        if (currentUser && !currentUser.emailVerified) {
          console.log('User email not verified, signing out...');
          await auth.signOut();
        }
      }
      
      if (initializing) setInitializing(false);
    });

    return unsubscribe;
  }, [initializing]);

  const handleSplashComplete = () => {
    setShowSplash(false);
  };

  if (showSplash) {
    return <SplashScreen onAnimationComplete={handleSplashComplete} />;
  }

  // Show loading indicator while checking auth
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