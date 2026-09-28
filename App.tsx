import React from 'react';
import { StatusBar } from 'expo-status-bar';
import { StyleSheet, Text } from 'react-native';
import { NavigationContainer } from '@react-navigation/native';
import { createBottomTabNavigator } from '@react-navigation/bottom-tabs';
import { ExpensesProvider } from './src/ExpensesContext';
import HomeScreen from './src/screens/HomeScreen';
import AddExpenseScreen from './src/screens/AddExpenseScreen';
import StatsScreen from './src/screens/StatsScreen';

const Tab = createBottomTabNavigator();

const TAB_ICONS: Record<string, string> = {
  Home: '⌂',
  Add: '+',
  Stats: '▦',
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
          <Tab.Screen name="Stats" component={StatsScreen} />
        </Tab.Navigator>
      </NavigationContainer>
      <StatusBar style="dark" />
    </ExpensesProvider>
  );
}

const styles = StyleSheet.create({
  tabBar: {
    height: 72,
    paddingTop: 8,
    paddingBottom: 10,
    backgroundColor: '#F4F0FF',
    borderTopColor: '#00F5D4',
    borderTopWidth: 2,
  },
  tabItem: { paddingHorizontal: 8 },
  tabIcon: { fontFamily: 'monospace', fontSize: 22, fontWeight: '700' },
  tabLabel: { fontFamily: 'monospace', fontSize: 11, fontWeight: '700' },
});
