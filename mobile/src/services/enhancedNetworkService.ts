import NetInfo from "@react-native-community/netinfo"
import { useAppStore } from "../store/appStore"
import { offlineStorageManager, OfflineOperationType } from "./offlineStorageManager"
import { logInfo, logError, logPerformance } from "../utils/logger"

/**
 * 网络状态
 */
export interface NetworkState {
  isConnected: boolean
  isInternetReachable: boolean
  type: string
  isOnline: boolean
  connectionQuality: 'excellent' | 'good' | 'poor' | 'offline'
  lastOnlineAt?: number
  offlineDuration?: number
}

/**
 * 增强的网络服务管理器
 */
export class EnhancedNetworkService {
  private static instance: EnhancedNetworkService
  private unsubscribe: (() => void) | null = null
  private syncInProgress = false
  private autoSyncInterval: NodeJS.Timeout | null = null
  private lastSyncAttempt = 0
  private readonly SYNC_INTERVAL = 30000 // 30秒
  private readonly MIN_SYNC_INTERVAL = 5000 // 最小5秒间隔

  static getInstance(): EnhancedNetworkService {
    if (!EnhancedNetworkService.instance) {
      EnhancedNetworkService.instance = new EnhancedNetworkService()
    }
    return EnhancedNetworkService.instance
  }

  /**
   * 初始化网络监控
   */
  initialize(): void {
    logInfo('初始化增强网络服务')
    
    this.unsubscribe = NetInfo.addEventListener((state) => {
      this.handleNetworkStateChange(state)
    })

    // 获取初始网络状态
    NetInfo.fetch().then((state) => {
      this.handleNetworkStateChange(state, true)
    })

    // 启动定期同步检查
    this.startPeriodicSync()
  }

  /**
   * 处理网络状态变化
   */
  private handleNetworkStateChange(state: any, isInitial = false): void {
    const isOnline = state.isConnected && state.isInternetReachable
    const wasOnline = useAppStore.getState().isOnline
    
    const networkState: NetworkState = {
      isConnected: state.isConnected,
      isInternetReachable: state.isInternetReachable,
      type: state.type,
      isOnline,
      connectionQuality: this.assessConnectionQuality(state),
      lastOnlineAt: isOnline ? Date.now() : useAppStore.getState().lastOnlineAt,
      offlineDuration: isOnline ? 0 : (Date.now() - (useAppStore.getState().lastOnlineAt || Date.now()))
    }

    logInfo('网络状态变化', {
      isOnline,
      type: state.type,
      quality: networkState.connectionQuality,
      isInitial
    })

    // 更新store
    useAppStore.getState().setNetworkState(networkState)

    // 网络恢复时自动同步
    if (isOnline && (!wasOnline || isInitial)) {
      this.handleNetworkRecovery()
    }

    // 网络断开时保存状态
    if (!isOnline && wasOnline) {
      this.handleNetworkDisconnection()
    }
  }

  /**
   * 评估连接质量
   */
  private assessConnectionQuality(state: any): 'excellent' | 'good' | 'poor' | 'offline' {
    if (!state.isConnected || !state.isInternetReachable) {
      return 'offline'
    }

    // 基于连接类型评估质量
    switch (state.type) {
      case 'wifi':
        return 'excellent'
      case 'cellular':
        // 可以根据细分类型进一步判断
        if (state.details?.cellularGeneration === '4g' || state.details?.cellularGeneration === '5g') {
          return 'good'
        }
        return 'poor'
      case 'ethernet':
        return 'excellent'
      default:
        return 'good'
    }
  }

  /**
   * 处理网络恢复
   */
  private async handleNetworkRecovery(): Promise<void> {
    try {
      logInfo('网络已恢复，开始自动同步')
      
      // 防止频繁同步
      const timeSinceLastSync = Date.now() - this.lastSyncAttempt
      if (timeSinceLastSync < this.MIN_SYNC_INTERVAL) {
        logInfo(`距离上次同步时间过短 (${timeSinceLastSync}ms)，跳过此次同步`)
        return
      }

      await this.performAutoSync('network_recovery')
    } catch (error) {
      logError('网络恢复自动同步失败', error as Error)
    }
  }

  /**
   * 处理网络断开
   */
  private handleNetworkDisconnection(): void {
    logInfo('网络已断开，启用离线模式')
    
    // 可以在这里执行一些离线准备工作
    // 比如预加载关键数据、压缩缓存等
  }

  /**
   * 执行自动同步
   */
  async performAutoSync(trigger: string = 'manual'): Promise<{
    success: number
    failed: number
    conflicts: number
    totalOperations: number
  }> {
    if (this.syncInProgress) {
      logInfo('同步正在进行中，跳过此次同步')
      return { success: 0, failed: 0, conflicts: 0, totalOperations: 0 }
    }

    const startTime = Date.now()
    this.syncInProgress = true
    this.lastSyncAttempt = startTime

    try {
      logInfo(`开始自动同步`, { trigger })

      // 检查网络状态
      const networkState = useAppStore.getState().networkState
      if (!networkState?.isOnline) {
        throw new Error('网络未连接，无法同步')
      }

      // 获取待同步操作统计
      const stats = await offlineStorageManager.getOperationStats()
      
      if (stats.pending === 0 && stats.failed === 0) {
        logInfo('没有待同步的操作')
        return { success: 0, failed: 0, conflicts: 0, totalOperations: 0 }
      }

      logInfo(`发现 ${stats.pending + stats.failed} 个待同步操作`)

      // 执行同步
      const result = await offlineStorageManager.processOfflineQueue()

      // 清理已完成的操作
      await offlineStorageManager.cleanupCompletedOperations()

      logPerformance('自动同步', Date.now() - startTime, {
        trigger,
        result,
        stats
      })

      logInfo('自动同步完成', result)

      // 更新store状态
      useAppStore.getState().setSyncStatus({
        lastSyncAt: Date.now(),
        issyncing: false,
        lastSyncResult: result
      })

      return result

    } catch (error) {
      logError('自动同步失败', error as Error, { trigger })
      
      useAppStore.getState().setSyncStatus({
        lastSyncAt: Date.now(),
        issyncing: false,
        lastSyncError: error instanceof Error ? error.message : '同步失败'
      })

      throw error
    } finally {
      this.syncInProgress = false
    }
  }

  /**
   * 手动触发同步
   */
  async manualSync(): Promise<{
    success: number
    failed: number
    conflicts: number
    totalOperations: number
  }> {
    const { networkState } = useAppStore.getState()

    if (!networkState?.isOnline) {
      throw new Error('网络未连接，无法同步')
    }

    return await this.performAutoSync('manual')
  }

  /**
   * 添加离线操作
   */
  async addOfflineOperation(
    type: OfflineOperationType,
    data: any,
    optimisticUpdate = true
  ): Promise<string> {
    try {
      logInfo(`添加离线操作: ${type}`)
      
      const operationId = await offlineStorageManager.addOperation(
        type,
        data,
        optimisticUpdate
      )

      // 如果在线，立即尝试同步
      const { networkState } = useAppStore.getState()
      if (networkState?.isOnline && networkState.connectionQuality !== 'poor') {
        // 延迟同步，避免阻塞用户操作
        setTimeout(() => {
          this.performAutoSync('immediate_after_operation').catch(error => {
            logError('操作后立即同步失败', error as Error)
          })
        }, 1000)
      }

      return operationId
    } catch (error) {
      logError('添加离线操作失败', error as Error, { type, data })
      throw error
    }
  }

  /**
   * 启动定期同步
   */
  private startPeriodicSync(): void {
    if (this.autoSyncInterval) {
      clearInterval(this.autoSyncInterval)
    }

    this.autoSyncInterval = setInterval(async () => {
      try {
        const { networkState } = useAppStore.getState()
        
        // 只在网络良好时进行定期同步
        if (networkState?.isOnline && networkState.connectionQuality !== 'poor') {
          const stats = await offlineStorageManager.getOperationStats()
          
          if (stats.pending > 0 || stats.failed > 0) {
            await this.performAutoSync('periodic')
          }
        }
      } catch (error) {
        logError('定期同步失败', error as Error)
      }
    }, this.SYNC_INTERVAL)
  }

  /**
   * 获取当前网络状态
   */
  async getCurrentNetworkState(): Promise<NetworkState> {
    try {
      const state = await NetInfo.fetch()
      return {
        isConnected: state.isConnected,
        isInternetReachable: state.isInternetReachable,
        type: state.type,
        isOnline: state.isConnected && state.isInternetReachable,
        connectionQuality: this.assessConnectionQuality(state)
      }
    } catch (error) {
      logError('获取网络状态失败', error as Error)
      return {
        isConnected: false,
        isInternetReachable: false,
        type: 'unknown',
        isOnline: false,
        connectionQuality: 'offline'
      }
    }
  }

  /**
   * 检查是否可以进行网络操作
   */
  canPerformNetworkOperation(): boolean {
    const { networkState } = useAppStore.getState()
    return networkState?.isOnline && networkState.connectionQuality !== 'poor'
  }

  /**
   * 获取同步统计信息
   */
  async getSyncStats(): Promise<{
    operations: {
      total: number
      pending: number
      processing: number
      success: number
      failed: number
      conflicts: number
    }
    network: NetworkState | null
    lastSync?: {
      timestamp: number
      result?: any
      error?: string
    }
  }> {
    try {
      const [operationStats, syncStatus] = await Promise.all([
        offlineStorageManager.getOperationStats(),
        useAppStore.getState().syncStatus
      ])

      return {
        operations: operationStats,
        network: useAppStore.getState().networkState,
        lastSync: syncStatus ? {
          timestamp: syncStatus.lastSyncAt || 0,
          result: syncStatus.lastSyncResult,
          error: syncStatus.lastSyncError
        } : undefined
      }
    } catch (error) {
      logError('获取同步统计失败', error as Error)
      throw error
    }
  }

  /**
   * 强制重新连接
   */
  async forceReconnect(): Promise<void> {
    try {
      logInfo('强制重新连接网络')
      
      // 重新获取网络状态
      const state = await NetInfo.fetch()
      this.handleNetworkStateChange(state)
      
      // 如果在线，尝试同步
      if (state.isConnected && state.isInternetReachable) {
        await this.performAutoSync('force_reconnect')
      }
    } catch (error) {
      logError('强制重新连接失败', error as Error)
      throw error
    }
  }

  /**
   * 清理资源
   */
  cleanup(): void {
    logInfo('清理网络服务资源')
    
    if (this.unsubscribe) {
      this.unsubscribe()
      this.unsubscribe = null
    }

    if (this.autoSyncInterval) {
      clearInterval(this.autoSyncInterval)
      this.autoSyncInterval = null
    }

    this.syncInProgress = false
  }
}

// 导出单例实例
export const enhancedNetworkService = EnhancedNetworkService.getInstance()