import { NavigationContainer } from "@react-navigation/native"
import { createStackNavigator } from "@react-navigation/stack"
import { createBottomTabNavigator } from "@react-navigation/bottom-tabs"
import Icon from "react-native-vector-icons/MaterialIcons"

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

          switch (route.name) {
            case "Tasks":
              iconName = "list"
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

          return <Icon name={iconName} size={size} color={color} />
        },
        tabBarActiveTintColor: "#2196F3",
        tabBarInactiveTintColor: "gray",
        headerStyle: {
          backgroundColor: "#2196F3",
        },
        headerTintColor: "#fff",
        headerTitleStyle: {
          fontWeight: "bold",
        },
      })}
    >
      <Tab.Screen name="Tasks" component={TaskListScreen} options={{ title: "待录制任务" }} />
      <Tab.Screen name="Recording" component={RecordingScreen} options={{ title: "录音" }} />
      <Tab.Screen name="Completed" component={CompletedTasksScreen} options={{ title: "已完成" }} />
      <Tab.Screen name="Profile" component={ProfileScreen} options={{ title: "个人中心" }} />
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
