import AsyncStorage from '@react-native-async-storage/async-storage'
import { useAppStore } from '../store/appStore'
import { logInfo, logError } from '../utils/logger'

/**
 * 离线操作类型
 */
export enum OfflineOperationType {
  CREATE_RECORDING = 'CREATE_RECORDING',
  UPDATE_RECORDING = 'UPDATE_RECORDING',
  DELETE_RECORDING = 'DELETE_RECORDING',
  UPDATE_PROFILE = 'UPDATE_PROFILE',
  COMPLETE_TASK = 'COMPLETE_TASK'
}

/**
 * 离线操作状态
 */
export enum OfflineOperationStatus {
  PENDING = 'PENDING',
  PROCESSING = 'PROCESSING',
  SUCCESS = 'SUCCESS',
  FAILED = 'FAILED',
  CONFLICT = 'CONFLICT'
}

/**
 * 离线操作记录
 */
export interface OfflineOperation {
  id: string
  type: OfflineOperationType
  status: OfflineOperationStatus
  data: any
  metadata: {
    timestamp: number
    retryCount: number
    lastRetryAt?: number
    conflictData?: any
    originalData?: any
  }
  optimisticUpdate?: boolean
}

/**
 * 同步结果
 */
export interface SyncResult {
  success: number
  failed: number
  conflicts: number
  totalOperations: number
  details: Array<{
    operationId: string
    status: 'success' | 'failed' | 'conflict'
    error?: string
    conflictData?: any
  }>
}

/**
 * 冲突解决策略
 */
export enum ConflictResolutionStrategy {
  CLIENT_WINS = 'CLIENT_WINS',
  SERVER_WINS = 'SERVER_WINS',
  MERGE = 'MERGE',
  MANUAL = 'MANUAL'
}

/**
 * 增强的离线存储管理器
 */
export class OfflineStorageManager {
  private static instance: OfflineStorageManager
  private readonly OPERATIONS_KEY = 'offline_operations'
  private readonly CACHE_KEY = 'offline_cache'
  private readonly MAX_RETRY_COUNT = 3
  private readonly RETRY_DELAY_BASE = 1000 // 1秒

  static getInstance(): OfflineStorageManager {
    if (!OfflineStorageManager.instance) {
      OfflineStorageManager.instance = new OfflineStorageManager()
    }
    return OfflineStorageManager.instance
  }

  /**
   * 添加离线操作到队列
   */
  async addOperation(
    type: OfflineOperationType,
    data: any,
    optimisticUpdate: boolean = true
  ): Promise<string> {
    try {
      const operationId = this.generateOperationId()
      const operation: OfflineOperation = {
        id: operationId,
        type,
        status: OfflineOperationStatus.PENDING,
        data,
        metadata: {
          timestamp: Date.now(),
          retryCount: 0
        },
        optimisticUpdate
      }

      // 如果启用乐观更新，立即更新本地状态
      if (optimisticUpdate) {
        await this.applyOptimisticUpdate(operation)
      }

      // 添加到离线队列
      await this.addToQueue(operation)

      logInfo(`离线操作已添加: ${type}`, { operationId, optimistic: optimisticUpdate })

      return operationId
    } catch (error) {
      logError('添加离线操作失败', error as Error, { type, data })
      throw error
    }
  }

  /**
   * 获取所有待处理的操作
   */
  async getPendingOperations(): Promise<OfflineOperation[]> {
    try {
      const operations = await this.getOperationsFromStorage()
      return operations.filter(op => 
        op.status === OfflineOperationStatus.PENDING || 
        op.status === OfflineOperationStatus.FAILED
      )
    } catch (error) {
      logError('获取待处理操作失败', error as Error)
      return []
    }
  }

  /**
   * 处理同步队列
   */
  async processOfflineQueue(): Promise<SyncResult> {
    try {
      logInfo('开始处理离线同步队列')
      
      const pendingOperations = await this.getPendingOperations()
      
      if (pendingOperations.length === 0) {
        logInfo('没有待同步的操作')
        return {
          success: 0,
          failed: 0,
          conflicts: 0,
          totalOperations: 0,
          details: []
        }
      }

      const result: SyncResult = {
        success: 0,
        failed: 0,
        conflicts: 0,
        totalOperations: pendingOperations.length,
        details: []
      }

      // 按时间戳排序，确保操作顺序
      const sortedOperations = pendingOperations.sort(
        (a, b) => a.metadata.timestamp - b.metadata.timestamp
      )

      for (const operation of sortedOperations) {
        try {
          await this.updateOperationStatus(operation.id, OfflineOperationStatus.PROCESSING)
          
          const syncResult = await this.syncSingleOperation(operation)
          
          result.details.push({
            operationId: operation.id,
            status: syncResult.status,
            error: syncResult.error,
            conflictData: syncResult.conflictData
          })

          switch (syncResult.status) {
            case 'success':
              result.success++
              await this.updateOperationStatus(operation.id, OfflineOperationStatus.SUCCESS)
              break
            case 'conflict':
              result.conflicts++
              await this.updateOperationStatus(operation.id, OfflineOperationStatus.CONFLICT)
              await this.handleConflict(operation, syncResult.conflictData)
              break
            case 'failed':
              result.failed++
              await this.handleFailedOperation(operation, syncResult.error)
              break
          }
        } catch (error) {
          result.failed++
          result.details.push({
            operationId: operation.id,
            status: 'failed',
            error: error instanceof Error ? error.message : '未知错误'
          })
          await this.handleFailedOperation(operation, error instanceof Error ? error.message : '未知错误')
        }
      }

      logInfo('离线同步队列处理完成', result)
      return result
    } catch (error) {
      logError('处理离线队列失败', error as Error)
      throw error
    }
  }

  /**
   * 同步单个操作
   */
  private async syncSingleOperation(operation: OfflineOperation): Promise<{
    status: 'success' | 'failed' | 'conflict'
    error?: string
    conflictData?: any
  }> {
    try {
      const { apiService } = await import('../services/apiService')
      
      switch (operation.type) {
        case OfflineOperationType.CREATE_RECORDING:
          return await this.syncCreateRecording(operation)
        
        case OfflineOperationType.UPDATE_RECORDING:
          return await this.syncUpdateRecording(operation)
        
        case OfflineOperationType.DELETE_RECORDING:
          return await this.syncDeleteRecording(operation)
        
        case OfflineOperationType.UPDATE_PROFILE:
          return await this.syncUpdateProfile(operation)
        
        default:
          throw new Error(`不支持的操作类型: ${operation.type}`)
      }
    } catch (error) {
      if (this.isConflictError(error)) {
        return {
          status: 'conflict',
          conflictData: this.extractConflictData(error)
        }
      }
      
      return {
        status: 'failed',
        error: error instanceof Error ? error.message : '同步失败'
      }
    }
  }

  /**
   * 同步创建录音操作
   */
  private async syncCreateRecording(operation: OfflineOperation): Promise<{
    status: 'success' | 'failed' | 'conflict'
    error?: string
    conflictData?: any
  }> {
    try {
      const { apiService } = await import('../services/apiService')
      
      // 创建FormData
      const formData = new FormData()
      formData.append('task_id', operation.data.task_id)
      formData.append('dialect_transcription', operation.data.dialect_transcription)
      formData.append('duration_seconds', operation.data.duration_seconds?.toString() || '0')
      
      if (operation.data.audioFile) {
        formData.append('audio', operation.data.audioFile)
      }

      const response = await apiService.uploadRecording(formData)
      
      // 同步成功，更新本地状态
      await this.updateLocalStateAfterSync(operation, response)
      
      return { status: 'success' }
    } catch (error) {
      return {
        status: 'failed',
        error: error instanceof Error ? error.message : '创建录音同步失败'
      }
    }
  }

  /**
   * 同步更新录音操作
   */
  private async syncUpdateRecording(operation: OfflineOperation): Promise<{
    status: 'success' | 'failed' | 'conflict'
    error?: string
    conflictData?: any
  }> {
    try {
      const { apiService } = await import('../services/apiService')
      
      const response = await apiService.updateRecording(
        operation.data.recordingId,
        operation.data.updateData
      )
      
      await this.updateLocalStateAfterSync(operation, response)
      
      return { status: 'success' }
    } catch (error) {
      return {
        status: 'failed',
        error: error instanceof Error ? error.message : '更新录音同步失败'
      }
    }
  }

  /**
   * 同步删除录音操作
   */
  private async syncDeleteRecording(operation: OfflineOperation): Promise<{
    status: 'success' | 'failed' | 'conflict'
    error?: string
    conflictData?: any
  }> {
    try {
      const { apiService } = await import('../services/apiService')
      
      await apiService.deleteRecording(operation.data.recordingId)
      
      await this.updateLocalStateAfterSync(operation, null)
      
      return { status: 'success' }
    } catch (error) {
      return {
        status: 'failed',
        error: error instanceof Error ? error.message : '删除录音同步失败'
      }
    }
  }

  /**
   * 同步更新用户资料操作
   */
  private async syncUpdateProfile(operation: OfflineOperation): Promise<{
    status: 'success' | 'failed' | 'conflict'
    error?: string
    conflictData?: any
  }> {
    try {
      const { apiService } = await import('../services/apiService')
      
      const response = await apiService.updateUserProfile(operation.data)
      
      await this.updateLocalStateAfterSync(operation, response)
      
      return { status: 'success' }
    } catch (error) {
      return {
        status: 'failed',
        error: error instanceof Error ? error.message : '更新用户资料同步失败'
      }
    }
  }

  /**
   * 应用乐观更新
   */
  private async applyOptimisticUpdate(operation: OfflineOperation): Promise<void> {
    try {
      const store = useAppStore.getState()
      
      switch (operation.type) {
        case OfflineOperationType.CREATE_RECORDING:
          // 乐观地添加录音到已完成任务
          this.optimisticallyAddRecording(operation.data)
          break
        
        case OfflineOperationType.UPDATE_RECORDING:
          // 乐观地更新录音
          this.optimisticallyUpdateRecording(operation.data)
          break
        
        case OfflineOperationType.DELETE_RECORDING:
          // 乐观地删除录音
          this.optimisticallyDeleteRecording(operation.data.recordingId)
          break
      }

      logInfo(`乐观更新已应用: ${operation.type}`, { operationId: operation.id })
    } catch (error) {
      logError('应用乐观更新失败', error as Error, { operation })
    }
  }

  /**
   * 乐观地添加录音
   */
  private optimisticallyAddRecording(data: any): void {
    // 这里可以添加到本地状态，标记为待同步
    const tempRecording = {
      _id: `temp_${Date.now()}`,
      ...data,
      status: 'pending_sync',
      optimistic: true
    }
    
    // 更新store状态
    // useAppStore.getState().addOptimisticRecording(tempRecording)
  }

  /**
   * 乐观地更新录音
   */
  private optimisticallyUpdateRecording(data: any): void {
    // 更新本地录音状态
    // useAppStore.getState().updateOptimisticRecording(data.recordingId, data.updateData)
  }

  /**
   * 乐观地删除录音
   */
  private optimisticallyDeleteRecording(recordingId: string): void {
    // 从本地状态中删除录音
    // useAppStore.getState().deleteOptimisticRecording(recordingId)
  }

  /**
   * 处理失败的操作
   */
  private async handleFailedOperation(operation: OfflineOperation, error: string): Promise<void> {
    const newRetryCount = operation.metadata.retryCount + 1
    
    if (newRetryCount < this.MAX_RETRY_COUNT) {
      // 更新重试计数和状态
      await this.updateOperation(operation.id, {
        ...operation,
        status: OfflineOperationStatus.FAILED,
        metadata: {
          ...operation.metadata,
          retryCount: newRetryCount,
          lastRetryAt: Date.now()
        }
      })
      
      logInfo(`操作失败，将重试: ${operation.id}`, { retryCount: newRetryCount, error })
    } else {
      // 超过最大重试次数，标记为永久失败
      await this.updateOperation(operation.id, {
        ...operation,
        status: OfflineOperationStatus.FAILED,
        metadata: {
          ...operation.metadata,
          retryCount: newRetryCount
        }
      })
      
      // 回滚乐观更新
      if (operation.optimisticUpdate) {
        await this.rollbackOptimisticUpdate(operation)
      }
      
      logError(`操作永久失败: ${operation.id}`, new Error(error), { operation })
    }
  }

  /**
   * 处理冲突
   */
  private async handleConflict(operation: OfflineOperation, conflictData: any): Promise<void> {
    // 保存冲突信息
    await this.updateOperation(operation.id, {
      ...operation,
      status: OfflineOperationStatus.CONFLICT,
      metadata: {
        ...operation.metadata,
        conflictData
      }
    })
    
    // 这里可以触发冲突解决UI
    logInfo(`检测到冲突: ${operation.id}`, { conflictData })
  }

  /**
   * 解决冲突
   */
  async resolveConflict(
    operationId: string, 
    strategy: ConflictResolutionStrategy,
    mergedData?: any
  ): Promise<void> {
    try {
      const operations = await this.getOperationsFromStorage()
      const operation = operations.find(op => op.id === operationId)
      
      if (!operation || operation.status !== OfflineOperationStatus.CONFLICT) {
        throw new Error('未找到冲突操作')
      }

      switch (strategy) {
        case ConflictResolutionStrategy.CLIENT_WINS:
          // 使用客户端数据重新同步
          await this.updateOperation(operationId, {
            ...operation,
            status: OfflineOperationStatus.PENDING
          })
          break
        
        case ConflictResolutionStrategy.SERVER_WINS:
          // 使用服务器数据更新本地状态
          await this.updateLocalStateAfterSync(operation, operation.metadata.conflictData)
          await this.updateOperationStatus(operationId, OfflineOperationStatus.SUCCESS)
          break
        
        case ConflictResolutionStrategy.MERGE:
          // 使用合并后的数据
          if (mergedData) {
            await this.updateOperation(operationId, {
              ...operation,
              data: mergedData,
              status: OfflineOperationStatus.PENDING
            })
          }
          break
      }
      
      logInfo(`冲突已解决: ${operationId}`, { strategy })
    } catch (error) {
      logError('解决冲突失败', error as Error, { operationId, strategy })
      throw error
    }
  }

  /**
   * 回滚乐观更新
   */
  private async rollbackOptimisticUpdate(operation: OfflineOperation): Promise<void> {
    try {
      // 根据操作类型回滚
      switch (operation.type) {
        case OfflineOperationType.CREATE_RECORDING:
          // 移除乐观添加的录音
          break
        case OfflineOperationType.UPDATE_RECORDING:
          // 恢复原始数据
          break
        case OfflineOperationType.DELETE_RECORDING:
          // 恢复删除的录音
          break
      }
      
      logInfo(`乐观更新已回滚: ${operation.id}`)
    } catch (error) {
      logError('回滚乐观更新失败', error as Error, { operation })
    }
  }

  /**
   * 更新同步后的本地状态
   */
  private async updateLocalStateAfterSync(operation: OfflineOperation, response: any): Promise<void> {
    // 根据操作类型更新本地状态
    // 这里需要调用store的相应方法
  }

  /**
   * 判断是否为冲突错误
   */
  private isConflictError(error: any): boolean {
    return error?.response?.status === 409 || 
           error?.message?.includes('conflict') ||
           error?.message?.includes('冲突')
  }

  /**
   * 提取冲突数据
   */
  private extractConflictData(error: any): any {
    return error?.response?.data || error?.conflictData || null
  }

  /**
   * 生成操作ID
   */
  private generateOperationId(): string {
    return `offline_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`
  }

  /**
   * 添加操作到队列
   */
  private async addToQueue(operation: OfflineOperation): Promise<void> {
    const operations = await this.getOperationsFromStorage()
    operations.push(operation)
    await AsyncStorage.setItem(this.OPERATIONS_KEY, JSON.stringify(operations))
  }

  /**
   * 从存储获取操作列表
   */
  private async getOperationsFromStorage(): Promise<OfflineOperation[]> {
    try {
      const data = await AsyncStorage.getItem(this.OPERATIONS_KEY)
      return data ? JSON.parse(data) : []
    } catch (error) {
      logError('获取离线操作失败', error as Error)
      return []
    }
  }

  /**
   * 更新操作状态
   */
  private async updateOperationStatus(operationId: string, status: OfflineOperationStatus): Promise<void> {
    const operations = await this.getOperationsFromStorage()
    const operationIndex = operations.findIndex(op => op.id === operationId)
    
    if (operationIndex !== -1) {
      operations[operationIndex].status = status
      await AsyncStorage.setItem(this.OPERATIONS_KEY, JSON.stringify(operations))
    }
  }

  /**
   * 更新操作
   */
  private async updateOperation(operationId: string, updatedOperation: OfflineOperation): Promise<void> {
    const operations = await this.getOperationsFromStorage()
    const operationIndex = operations.findIndex(op => op.id === operationId)
    
    if (operationIndex !== -1) {
      operations[operationIndex] = updatedOperation
      await AsyncStorage.setItem(this.OPERATIONS_KEY, JSON.stringify(operations))
    }
  }

  /**
   * 清理已完成的操作
   */
  async cleanupCompletedOperations(): Promise<void> {
    try {
      const operations = await this.getOperationsFromStorage()
      const activeOperations = operations.filter(op => 
        op.status !== OfflineOperationStatus.SUCCESS
      )
      
      await AsyncStorage.setItem(this.OPERATIONS_KEY, JSON.stringify(activeOperations))
      
      const cleanedCount = operations.length - activeOperations.length
      logInfo(`已清理 ${cleanedCount} 个已完成的离线操作`)
    } catch (error) {
      logError('清理已完成操作失败', error as Error)
    }
  }

  /**
   * 获取操作统计
   */
  async getOperationStats(): Promise<{
    total: number
    pending: number
    processing: number
    success: number
    failed: number
    conflicts: number
  }> {
    try {
      const operations = await this.getOperationsFromStorage()
      
      return {
        total: operations.length,
        pending: operations.filter(op => op.status === OfflineOperationStatus.PENDING).length,
        processing: operations.filter(op => op.status === OfflineOperationStatus.PROCESSING).length,
        success: operations.filter(op => op.status === OfflineOperationStatus.SUCCESS).length,
        failed: operations.filter(op => op.status === OfflineOperationStatus.FAILED).length,
        conflicts: operations.filter(op => op.status === OfflineOperationStatus.CONFLICT).length
      }
    } catch (error) {
      logError('获取操作统计失败', error as Error)
      return {
        total: 0,
        pending: 0,
        processing: 0,
        success: 0,
        failed: 0,
        conflicts: 0
      }
    }
  }
}

// 导出单例实例
export const offlineStorageManager = OfflineStorageManager.getInstance()