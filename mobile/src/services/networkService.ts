import NetInfo from "@react-native-community/netinfo"
import { useAppStore } from "../store/appStore"
import { uploadService } from "./uploadService"

class NetworkService {
  private unsubscribe: (() => void) | null = null

  // Initialize network monitoring
  initialize(): void {
    this.unsubscribe = NetInfo.addEventListener((state) => {
      const isOnline = state.isConnected && state.isInternetReachable
      const wasOnline = useAppStore.getState().isOnline

      console.log("[v0] Network state changed:", {
        isConnected: state.isConnected,
        isInternetReachable: state.isInternetReachable,
        type: state.type,
        isOnline,
      })

      // Update store
      useAppStore.getState().setIsOnline(isOnline)

      // Auto-sync when coming back online
      if (isOnline && !wasOnline) {
        console.log("[v0] Back online, starting auto-sync")
        this.autoSync()
      }
    })

    // Get initial network state
    NetInfo.fetch().then((state) => {
      const isOnline = state.isConnected && state.isInternetReachable
      useAppStore.getState().setIsOnline(isOnline)
      console.log("[v0] Initial network state:", isOnline)
    })
  }

  // Auto-sync offline recordings when online
  private async autoSync(): Promise<void> {
    try {
      const result = await uploadService.syncOfflineRecordings()

      if (result.success > 0) {
        console.log("[v0] Auto-sync completed:", result.success, "recordings uploaded")
      }

      if (result.failed > 0) {
        console.warn("[v0] Auto-sync had failures:", result.failed, "recordings failed")
      }
    } catch (error) {
      console.error("[v0] Auto-sync error:", error)
    }
  }

  // Manual sync trigger
  async manualSync(): Promise<{ success: number; failed: number }> {
    const { isOnline } = useAppStore.getState()

    if (!isOnline) {
      throw new Error("网络未连接，无法同步")
    }

    return await uploadService.syncOfflineRecordings()
  }

  // Check current network status
  async checkNetworkStatus(): Promise<boolean> {
    const state = await NetInfo.fetch()
    return state.isConnected && state.isInternetReachable
  }

  // Cleanup
  cleanup(): void {
    if (this.unsubscribe) {
      this.unsubscribe()
      this.unsubscribe = null
    }
  }
}

export const networkService = new NetworkService()
