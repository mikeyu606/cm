import React from 'react';
import { View, StyleSheet, TouchableOpacity, Text, Platform } from 'react-native';
import { NavigationContainer, useNavigation } from '@react-navigation/native';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import { createBottomTabNavigator } from '@react-navigation/bottom-tabs';
import { Ionicons, Feather } from '@expo/vector-icons';
import { useAuth } from '../context/AuthContext';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

// Screens
import LoginScreen from '../screens/LoginScreen';
import SignupScreen from '../screens/SignupScreen';
import HomeScreen from '../screens/HomeScreen';
import AddFoodScreen from '../screens/AddFoodScreen';
import HistoryScreen from '../screens/HistoryScreen';
import SettingsScreen from '../screens/SettingsScreen';
import ScannerScreen from '../screens/ScannerScreen';

const Stack = createNativeStackNavigator();
const Tab = createBottomTabNavigator();

const TAB_BAR_HEIGHT = 50;

// Custom Add Button
function AddButton() {
  const navigation = useNavigation<any>();
  
  return (
    <TouchableOpacity 
      style={styles.addButton} 
      onPress={() => navigation.navigate('Scanner')}
      activeOpacity={0.7}
    >
      <View style={styles.addButtonInner}>
        <Feather name="plus" size={22} color="#1A1A2E" />
      </View>
    </TouchableOpacity>
  );
}

function PlaceholderScreen() {
  return <View style={{ flex: 1, backgroundColor: '#FAFAFA' }} />;
}

function MainTabs() {
  const insets = useSafeAreaInsets();
  const bottomPadding = Math.max(insets.bottom, 10);
  
  return (
    <Tab.Navigator
      screenOptions={{
        headerShown: false,
        tabBarStyle: {
          backgroundColor: '#fff',
          borderTopWidth: 0.5,
          borderTopColor: '#DBDBDB',
          height: TAB_BAR_HEIGHT + bottomPadding,
          paddingTop: 8,
          paddingBottom: bottomPadding,
          elevation: 0,
          shadowOpacity: 0,
        },
        tabBarShowLabel: false,
        tabBarActiveTintColor: '#000',
        tabBarInactiveTintColor: '#000',
      }}
    >
      <Tab.Screen
        name="Home"
        component={HomeScreen}
        options={{
          tabBarIcon: ({ focused }) => (
            <Ionicons 
              name={focused ? "home" : "home-outline"} 
              size={26} 
              color="#000" 
            />
          ),
        }}
      />
      <Tab.Screen
        name="History"
        component={HistoryScreen}
        options={{
          tabBarIcon: ({ focused }) => (
            <Ionicons 
              name={focused ? "stats-chart" : "stats-chart-outline"} 
              size={26} 
              color="#000" 
            />
          ),
        }}
      />
      <Tab.Screen
        name="Add"
        component={PlaceholderScreen}
        options={{
          tabBarButton: () => <AddButton />,
        }}
      />
      <Tab.Screen
        name="Activity"
        component={PlaceholderScreen}
        options={{
          tabBarIcon: ({ focused }) => (
            <Ionicons 
              name={focused ? "heart" : "heart-outline"} 
              size={26} 
              color="#000" 
            />
          ),
        }}
      />
      <Tab.Screen
        name="Profile"
        component={SettingsScreen}
        options={{
          tabBarIcon: ({ focused }) => (
            <Ionicons 
              name={focused ? "person" : "person-outline"} 
              size={26} 
              color="#000" 
            />
          ),
        }}
      />
    </Tab.Navigator>
  );
}

function MainStack() {
  return (
    <Stack.Navigator screenOptions={{ headerShown: false }}>
      <Stack.Screen name="MainTabs" component={MainTabs} />
      <Stack.Screen 
        name="Scanner" 
        component={ScannerScreen}
        options={{
          presentation: 'fullScreenModal',
          animation: 'slide_from_bottom',
        }}
      />
      <Stack.Screen 
        name="AddFoodModal" 
        component={AddFoodScreen}
        options={{
          presentation: 'modal',
          animation: 'slide_from_bottom',
        }}
      />
    </Stack.Navigator>
  );
}

function AuthStack() {
  return (
    <Stack.Navigator screenOptions={{ headerShown: false }}>
      <Stack.Screen name="Login" component={LoginScreen} />
      <Stack.Screen name="Signup" component={SignupScreen} />
    </Stack.Navigator>
  );
}

export default function AppNavigator() {
  const { user, loading } = useAuth();

  if (loading) {
    return (
      <View style={styles.loadingContainer}>
        <Text style={styles.loadingText}>🔥</Text>
        <Text style={styles.loadingSubtext}>CalorieMonster</Text>
      </View>
    );
  }

  return (
    <NavigationContainer>
      {user ? <MainStack /> : <AuthStack />}
    </NavigationContainer>
  );
}

const styles = StyleSheet.create({
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: '#FAFAFA',
  },
  loadingText: {
    fontSize: 64,
    marginBottom: 16,
  },
  loadingSubtext: {
    fontSize: 24,
    fontWeight: '700',
    color: '#1A1A2E',
  },
  addButton: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  addButtonInner: {
    width: 28,
    height: 28,
    borderRadius: 8,
    borderWidth: 1.5,
    borderColor: '#1A1A2E',
    justifyContent: 'center',
    alignItems: 'center',
  },
});
