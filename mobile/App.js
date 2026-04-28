import React, { useEffect, useState, useCallback } from 'react';
import { View, ActivityIndicator, StyleSheet } from 'react-native';
import { StatusBar } from 'expo-status-bar';
import { NavigationContainer, DefaultTheme } from '@react-navigation/native';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import { createBottomTabNavigator } from '@react-navigation/bottom-tabs';
import { SafeAreaProvider } from 'react-native-safe-area-context';

import { Auth } from './src/lib/auth';
import { Storage } from './src/lib/storage';
import { colors } from './src/lib/theme';

import LoginScreen from './src/screens/LoginScreen';
import RegisterScreen from './src/screens/RegisterScreen';
import ChatScreen from './src/screens/ChatScreen';
import DailyScreen from './src/screens/DailyScreen';
import HistoryScreen from './src/screens/HistoryScreen';
import SettingsScreen from './src/screens/SettingsScreen';

const Stack = createNativeStackNavigator();
const Tab = createBottomTabNavigator();

const navTheme = {
  ...DefaultTheme,
  dark: true,
  colors: {
    ...DefaultTheme.colors,
    background: colors.bg,
    card: colors.surface,
    text: colors.text,
    border: colors.border,
    primary: colors.primary,
    notification: colors.primary,
  },
};

function AuthStack({ onAuthed }) {
  return (
    <Stack.Navigator screenOptions={{ headerShown: false }}>
      <Stack.Screen name="Login">
        {(props) => <LoginScreen {...props} onAuthed={onAuthed} />}
      </Stack.Screen>
      <Stack.Screen name="Register" component={RegisterScreen} />
    </Stack.Navigator>
  );
}

function TabIcon({ label, focused }) {
  return (
    <View style={{ alignItems: 'center' }}>
      <View
        style={{
          width: 6, height: 6, borderRadius: 3,
          backgroundColor: focused ? colors.primary : 'transparent',
          marginBottom: 4,
        }}
      />
    </View>
  );
}

function MainTabs({ onLogout }) {
  return (
    <Tab.Navigator
      screenOptions={({ route }) => ({
        headerStyle: { backgroundColor: colors.surface },
        headerTintColor: colors.primary,
        headerTitleStyle: { fontWeight: '700', letterSpacing: 1 },
        tabBarStyle: {
          backgroundColor: colors.surface,
          borderTopColor: colors.border,
        },
        tabBarActiveTintColor: colors.primary,
        tabBarInactiveTintColor: colors.textMuted,
        tabBarIcon: ({ focused }) => <TabIcon focused={focused} label={route.name} />,
      })}
    >
      <Tab.Screen name="Sohbet" component={ChatScreen} />
      <Tab.Screen name="Gunluk" component={DailyScreen} options={{ title: 'Gunluk' }} />
      <Tab.Screen name="Gecmis" component={HistoryScreen} options={{ title: 'Gecmis' }} />
      <Tab.Screen name="Ayarlar" options={{ title: 'Ayarlar' }}>
        {(props) => <SettingsScreen {...props} onLogout={onLogout} />}
      </Tab.Screen>
    </Tab.Navigator>
  );
}

export default function App() {
  const [booting, setBooting] = useState(true);
  const [authed, setAuthed] = useState(false);

  const check = useCallback(async () => {
    const logged = await Auth.isLoggedIn();
    setAuthed(logged);
    if (logged) {
      const uid = await Auth.getUserId();
      if (uid) Storage.pullFromSupabase(uid);
    }
    setBooting(false);
  }, []);

  useEffect(() => { check(); }, [check]);

  if (booting) {
    return (
      <View style={styles.boot}>
        <StatusBar style="light" />
        <ActivityIndicator color={colors.primary} />
      </View>
    );
  }

  return (
    <SafeAreaProvider>
      <StatusBar style="light" />
      <NavigationContainer theme={navTheme}>
        {authed ? (
          <MainTabs onLogout={() => setAuthed(false)} />
        ) : (
          <AuthStack onAuthed={() => check()} />
        )}
      </NavigationContainer>
    </SafeAreaProvider>
  );
}

const styles = StyleSheet.create({
  boot: {
    flex: 1, backgroundColor: colors.bg,
    alignItems: 'center', justifyContent: 'center',
  },
});
