import { NavigationContainer } from "@react-navigation/native"
import { createStackNavigator } from "@react-navigation/stack"
import { createBottomTabNavigator } from "@react-navigation/bottom-tabs"
import { View } from "react-native"
import { MaterialIcons as Icon } from "@expo/vector-icons"

import { useAppStore } from "../store/appStore"
import LoginScreen from "../screens/LoginScreen"
import TaskListScreen from "../screens/TaskListScreen"
import RecordingScreen from "../screens/RecordingScreen"
import ProfileScreen from "../screens/ProfileScreen"
import CompletedTasksScreen from "../screens/CompletedTasksScreen"

const Stack = createStackNavigator()
const Tab = createBottomTabNavigator()

function MainTabs() {
  return (
    <Tab.Navigator
      screenOptions={({ route }) => ({
        tabBarIcon: ({ focused, color, size }) => {
          let iconName: string
          let iconSize = focused ? size + 2 : size

          switch (route.name) {
            case "Tasks":
              iconName = "assignment"
              break
            case "Recording":
              iconName = "mic"
              break
            case "Completed":
              iconName = "check-circle"
              break
            case "Profile":
              iconName = "person"
              break
            default:
              iconName = "help"
          }

          return (
            <View style={{
              backgroundColor: focused ? '#4f46e520' : 'transparent',
              borderRadius: 12,
              padding: focused ? 8 : 4,
              alignItems: 'center',
              justifyContent: 'center',
              minWidth: 48,
            }}>
              <Icon name={iconName} size={iconSize} color={color} />
            </View>
          )
        },
        tabBarActiveTintColor: "#4f46e5",
        tabBarInactiveTintColor: "#94a3b8",
        tabBarStyle: {
          backgroundColor: "#ffffff",
          borderTopWidth: 0,
          elevation: 8,
          shadowColor: "#1e293b",
          shadowOffset: { width: 0, height: -4 },
          shadowOpacity: 0.1,
          shadowRadius: 12,
          height: 80,
          paddingBottom: 12,
          paddingTop: 10,
          borderTopLeftRadius: 24,
          borderTopRightRadius: 24,
        },
        tabBarLabelStyle: {
          fontSize: 12,
          fontWeight: "600",
          marginTop: 4,
        },
        headerStyle: {
          backgroundColor: "#4f46e5",
          elevation: 0,
          shadowOpacity: 0,
          borderBottomWidth: 0,
        },
        headerTintColor: "#fff",
        headerTitleStyle: {
          fontWeight: "800",
          fontSize: 18,
        },
      })}
    >
      <Tab.Screen 
        name="Tasks" 
        component={TaskListScreen} 
        options={{ 
          title: "任务列表",
          headerShown: false,
        }} 
      />
      <Tab.Screen 
        name="Recording" 
        component={RecordingScreen} 
        options={{ 
          title: "录音",
          headerShown: false,
        }} 
      />
      <Tab.Screen 
        name="Completed" 
        component={CompletedTasksScreen} 
        options={{ 
          title: "已完成",
          headerShown: false,
        }} 
      />
      <Tab.Screen 
        name="Profile" 
        component={ProfileScreen} 
        options={{ 
          title: "我的",
          headerShown: false,
        }} 
      />
    </Tab.Navigator>
  )
}

export default function AppNavigator() {
  const isAuthenticated = useAppStore((state) => state.isAuthenticated)

  return (
    <NavigationContainer>
      <Stack.Navigator screenOptions={{ headerShown: false }}>
        {isAuthenticated ? (
          <Stack.Screen name="Main" component={MainTabs} />
        ) : (
          <Stack.Screen name="Login" component={LoginScreen} />
        )}
      </Stack.Navigator>
    </NavigationContainer>
  )
}
