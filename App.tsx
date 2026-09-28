import React from 'react';
import { StatusBar } from 'expo-status-bar';
import { StyleSheet, Text } from 'react-native';
import { NavigationContainer } from '@react-navigation/native';
import { createBottomTabNavigator } from '@react-navigation/bottom-tabs';
import { ExpensesProvider } from './src/ExpensesContext';
import HomeScreen from './src/screens/HomeScreen';
import AddExpenseScreen from './src/screens/AddExpenseScreen';
import GoalsScreen from './src/screens/GoalsScreen';
import ProfileScreen from './src/screens/ProfileScreen';

const Tab = createBottomTabNavigator();

const TAB_ICONS: Record<string, string> = {
  Home: '⌂',
  Add: '+',
  Goals: '◈',
  Profile: '◎',
};

export default function App() {
  return (
    <ExpensesProvider>
      <NavigationContainer>
        <Tab.Navigator
          screenOptions={({ route }) => ({
            headerShown: false,
            tabBarActiveTintColor: '#D6009A',
            tabBarInactiveTintColor: '#6B6680',
            tabBarStyle: styles.tabBar,
            tabBarLabelStyle: styles.tabLabel,
            tabBarItemStyle: styles.tabItem,
            tabBarIcon: () => (
              <Text style={styles.tabIcon}>{TAB_ICONS[route.name]}</Text>
            ),
          })}
        >
          <Tab.Screen name="Home" component={HomeScreen} />
          <Tab.Screen name="Add" component={AddExpenseScreen} />
          <Tab.Screen name="Goals" component={GoalsScreen} />
          <Tab.Screen name="Profile" component={ProfileScreen} />
        </Tab.Navigator>
      </NavigationContainer>
      <StatusBar style="dark" />
    </ExpensesProvider>
  );
}

const styles = StyleSheet.create({
  tabBar: {
    height: 68,
    paddingTop: 6,
    paddingBottom: 8,
    backgroundColor: '#F4F0FF',
    borderTopColor: '#00F5D4',
    borderTopWidth: 2,
    width: '100%',
    alignSelf: 'center',
  },
  tabItem: { flex: 1, minWidth: 0, paddingHorizontal: 2 },
  tabIcon: { fontFamily: 'monospace', fontSize: 20, fontWeight: '700' },
  tabLabel: { fontFamily: 'monospace', fontSize: 10, fontWeight: '700' },
});
