import { useCallback, useEffect, useMemo } from 'react';
import { StatusBar } from 'expo-status-bar';
import { StyleSheet, View } from 'react-native';
import * as SplashScreen from 'expo-splash-screen';
import { Ionicons } from '@expo/vector-icons';
import {
  useFonts,
  Poppins_400Regular,
  Poppins_500Medium,
  Poppins_600SemiBold,
  Poppins_700Bold,
} from '@expo-google-fonts/poppins';
import { NavigationContainer } from '@react-navigation/native';
import { createBottomTabNavigator } from '@react-navigation/bottom-tabs';
import { SafeAreaProvider, useSafeAreaInsets } from 'react-native-safe-area-context';
import { ExpensesProvider } from './src/ExpensesContext';
import { ThemeProvider, useTheme } from './src/ThemeContext';
import HomeScreen from './src/screens/HomeScreen';
import AddExpenseScreen from './src/screens/AddExpenseScreen';
import GoalsScreen from './src/screens/GoalsScreen';
import ProfileScreen from './src/screens/ProfileScreen';

SplashScreen.preventAutoHideAsync().catch(() => {});

const Tab = createBottomTabNavigator();

const TAB_ICONS: Record<string, keyof typeof Ionicons.glyphMap> = {
  Home: 'home',
  Add: 'add-circle',
  Goals: 'flag',
  Profile: 'person-circle',
};

const TAB_ICONS_OUTLINE: Record<string, keyof typeof Ionicons.glyphMap> = {
  Home: 'home-outline',
  Add: 'add-circle-outline',
  Goals: 'flag-outline',
  Profile: 'person-circle-outline',
};

function createStyles(colors: ReturnType<typeof useTheme>['colors']) {
  return StyleSheet.create({
    root: { flex: 1, backgroundColor: colors.background },
    tabBar: {
      paddingTop: 8,
      backgroundColor: colors.surface,
      borderTopColor: colors.border,
      borderTopWidth: 1,
      width: '100%',
      alignSelf: 'center',
    },
    tabItem: { flex: 1, minWidth: 0, paddingHorizontal: 2 },
    tabLabel: { fontSize: 11, fontWeight: '500', fontFamily: 'Poppins_500Medium' },
  });
}

function Navigation() {
  const insets = useSafeAreaInsets();
  const { colors, mode } = useTheme();
  const styles = useMemo(() => createStyles(colors), [colors]);

  return (
    <View style={styles.root}>
      <NavigationContainer>
        <Tab.Navigator
          screenOptions={({ route }) => ({
            headerShown: false,
            tabBarActiveTintColor: colors.accent,
            tabBarInactiveTintColor: colors.textFaint,
            tabBarStyle: [
              styles.tabBar,
              { height: 78 + insets.bottom, paddingBottom: insets.bottom + 12 },
            ],
            tabBarLabelStyle: styles.tabLabel,
            tabBarItemStyle: styles.tabItem,
            tabBarIcon: ({ focused, color }) => (
              <Ionicons
                name={focused ? TAB_ICONS[route.name] : TAB_ICONS_OUTLINE[route.name]}
                size={22}
                color={color}
              />
            ),
          })}
        >
          <Tab.Screen name="Home" component={HomeScreen} />
          <Tab.Screen name="Add" component={AddExpenseScreen} />
          <Tab.Screen name="Goals" component={GoalsScreen} />
          <Tab.Screen name="Profile" component={ProfileScreen} />
        </Tab.Navigator>
      </NavigationContainer>
      <StatusBar style={mode === 'dark' ? 'light' : 'dark'} />
    </View>
  );
}

export default function App() {
  const [fontsLoaded] = useFonts({
    Poppins_400Regular,
    Poppins_500Medium,
    Poppins_600SemiBold,
    Poppins_700Bold,
  });

  const onLayoutRootView = useCallback(() => {
    if (fontsLoaded) SplashScreen.hideAsync().catch(() => {});
  }, [fontsLoaded]);

  useEffect(() => {
    if (fontsLoaded) SplashScreen.hideAsync().catch(() => {});
  }, [fontsLoaded]);

  if (!fontsLoaded) return null;

  return (
    <SafeAreaProvider>
      <View style={{ flex: 1 }} onLayout={onLayoutRootView}>
        <ThemeProvider>
          <ExpensesProvider>
            <Navigation />
          </ExpensesProvider>
        </ThemeProvider>
      </View>
    </SafeAreaProvider>
  );
}
