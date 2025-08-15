"use client"

import { useEffect } from "react"
import { StatusBar } from "react-native"
import AppNavigator from "./src/navigation/AppNavigator"
import { networkService } from "./src/services/networkService"

export default function App() {
  useEffect(() => {
    networkService.initialize()

    // Cleanup on unmount
    return () => {
      networkService.cleanup()
    }
  }, [])

  return (
    <>
      <StatusBar barStyle="light-content" backgroundColor="#2196F3" />
      <AppNavigator />
    </>
  )
}
