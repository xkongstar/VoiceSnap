import { Alert } from 'react-native'
import { logError, logInfo } from './logger'

/**
 * 前端错误类型
 */
export enum FrontendErrorType {
  NETWORK_ERROR = 'NETWORK_ERROR',
  API_ERROR = 'API_ERROR',
  VALIDATION_ERROR = 'VALIDATION_ERROR',
  STORAGE_ERROR = 'STORAGE_ERROR',
  AUDIO_ERROR = 'AUDIO_ERROR',
  PERMISSION_ERROR = 'PERMISSION_ERROR',
  COMPONENT_ERROR = 'COMPONENT_ERROR',
  UNKNOWN_ERROR = 'UNKNOWN_ERROR'
}

/**
 * 错误严重级别
 */
export enum ErrorSeverity {
  LOW = 'low',
  MEDIUM = 'medium',
  HIGH = 'high',
  CRITICAL = 'critical'
}

/**
 * 前端标准错误接口
 */
export interface FrontendError {
  type: FrontendErrorType
  severity: ErrorSeverity
  message: string
  userMessage: string
  timestamp: number
  context?: {
    component?: string
    action?: string
    userId?: string
    route?: string
    additionalInfo?: Record<string, any>
  }
  originalError?: Error
  stack?: string
  retryable: boolean
  handled: boolean
}

/**
 * 错误恢复策略
 */
export interface ErrorRecoveryOptions {
  showAlert?: boolean
  alertTitle?: string
  alertMessage?: string
  showRetry?: boolean
  onRetry?: () => void
  fallbackAction?: () => void
  logToServer?: boolean
}

/**
 * 前端错误处理器
 */
export class FrontendErrorHandler {
  private static instance: FrontendErrorHandler
  private errorQueue: FrontendError[] = []
  private isOnline = true

  static getInstance(): FrontendErrorHandler {
    if (!FrontendErrorHandler.instance) {
      FrontendErrorHandler.instance = new FrontendErrorHandler()
    }
    return FrontendErrorHandler.instance
  }

  /**
   * 处理错误
   */
  handleError(
    error: Error | any,
    context?: FrontendError['context'],
    recoveryOptions?: ErrorRecoveryOptions
  ): FrontendError {
    const frontendError = this.standardizeError(error, context)
    
    // 记录错误
    this.logError(frontendError)
    
    // 错误恢复处理
    if (recoveryOptions) {
      this.handleErrorRecovery(frontendError, recoveryOptions)
    }
    
    // 标记为已处理
    frontendError.handled = true
    
    return frontendError
  }

  /**
   * 处理API错误
   */
  handleApiError(
    error: any,
    context?: FrontendError['context'],
    recoveryOptions?: ErrorRecoveryOptions
  ): FrontendError {
    const apiError = this.parseApiError(error)
    return this.handleError(apiError, {
      ...context,
      action: context?.action || 'API_CALL'
    }, recoveryOptions)
  }

  /**
   * 处理网络错误
   */
  handleNetworkError(
    error: Error,
    context?: FrontendError['context']
  ): FrontendError {
    return this.handleError(error, {
      ...context,
      action: 'NETWORK_REQUEST'
    }, {
      showAlert: true,
      alertTitle: '网络错误',
      alertMessage: '网络连接失败，请检查网络设置后重试',
      showRetry: true,
      logToServer: false // 网络错误时不记录到服务器
    })
  }

  /**
   * 处理验证错误
   */
  handleValidationError(
    message: string,
    field?: string,
    context?: FrontendError['context']
  ): FrontendError {
    const error = new Error(message)
    return this.handleError(error, {
      ...context,
      action: 'VALIDATION',
      additionalInfo: { field }
    }, {
      showAlert: true,
      alertTitle: '输入错误',
      alertMessage: message
    })
  }

  /**
   * 处理音频错误
   */
  handleAudioError(
    error: Error,
    audioContext?: {
      operation?: 'record' | 'play' | 'upload' | 'process'
      duration?: number
      fileSize?: number
    },
    context?: FrontendError['context']
  ): FrontendError {
    return this.handleError(error, {
      ...context,
      action: 'AUDIO_OPERATION',
      additionalInfo: audioContext
    }, {
      showAlert: true,
      alertTitle: '音频错误',
      alertMessage: this.getAudioErrorMessage(error, audioContext?.operation)
    })
  }

  /**
   * 处理权限错误
   */
  handlePermissionError(
    permission: string,
    context?: FrontendError['context']
  ): FrontendError {
    const error = new Error(`Permission denied: ${permission}`)
    return this.handleError(error, {
      ...context,
      action: 'PERMISSION_REQUEST',
      additionalInfo: { permission }
    }, {
      showAlert: true,
      alertTitle: '权限不足',
      alertMessage: this.getPermissionErrorMessage(permission),
      fallbackAction: () => {
        // 可以跳转到设置页面
      }
    })
  }

  /**
   * 批量处理错误
   */
  handleBatchErrors(
    errors: Array<{ error: Error; context?: FrontendError['context'] }>,
    globalRecoveryOptions?: ErrorRecoveryOptions
  ): FrontendError[] {
    const processedErrors = errors.map(({ error, context }) => 
      this.handleError(error, context, globalRecoveryOptions)
    )

    // 如果有多个错误，显示汇总信息
    if (processedErrors.length > 1 && globalRecoveryOptions?.showAlert) {
      Alert.alert(
        '操作部分失败',
        `${processedErrors.length} 个操作失败，请查看详细信息`,
        [
          { text: '确定', style: 'default' }
        ]
      )
    }

    return processedErrors
  }

  /**
   * 获取错误统计信息
   */
  getErrorStats(): {
    total: number
    byType: Record<FrontendErrorType, number>
    bySeverity: Record<ErrorSeverity, number>
    recent: FrontendError[]
  } {
    const recentErrors = this.errorQueue.slice(-20) // 最近20个错误
    
    const byType = {} as Record<FrontendErrorType, number>
    const bySeverity = {} as Record<ErrorSeverity, number>

    recentErrors.forEach(error => {
      byType[error.type] = (byType[error.type] || 0) + 1
      bySeverity[error.severity] = (bySeverity[error.severity] || 0) + 1
    })

    return {
      total: this.errorQueue.length,
      byType,
      bySeverity,
      recent: recentErrors
    }
  }

  /**
   * 清理错误队列
   */
  clearErrorQueue(): void {
    this.errorQueue = []
  }

  /**
   * 设置网络状态
   */
  setNetworkStatus(isOnline: boolean): void {
    this.isOnline = isOnline
  }

  /**
   * 标准化错误对象
   */
  private standardizeError(
    error: Error | any,
    context?: FrontendError['context']
  ): FrontendError {
    const errorType = this.determineErrorType(error)
    const severity = this.determineSeverity(errorType, error)
    
    return {
      type: errorType,
      severity,
      message: error.message || 'Unknown error',
      userMessage: this.getUserMessage(errorType, error),
      timestamp: Date.now(),
      context,
      originalError: error instanceof Error ? error : undefined,
      stack: error?.stack,
      retryable: this.isRetryable(errorType, error),
      handled: false
    }
  }

  /**
   * 确定错误类型
   */
  private determineErrorType(error: any): FrontendErrorType {
    if (error.name === 'NetworkError' || error.code === 'NETWORK_ERROR') {
      return FrontendErrorType.NETWORK_ERROR
    }
    
    if (error.response || error.status) {
      return FrontendErrorType.API_ERROR
    }
    
    if (error.name === 'ValidationError') {
      return FrontendErrorType.VALIDATION_ERROR
    }
    
    if (error.name === 'AudioError' || error.message?.includes('audio')) {
      return FrontendErrorType.AUDIO_ERROR
    }
    
    if (error.name === 'PermissionError' || error.message?.includes('permission')) {
      return FrontendErrorType.PERMISSION_ERROR
    }
    
    if (error.name === 'ChunkLoadError' || error.componentStack) {
      return FrontendErrorType.COMPONENT_ERROR
    }
    
    return FrontendErrorType.UNKNOWN_ERROR
  }

  /**
   * 确定错误严重级别
   */
  private determineSeverity(type: FrontendErrorType, error: any): ErrorSeverity {
    switch (type) {
      case FrontendErrorType.VALIDATION_ERROR:
        return ErrorSeverity.LOW
      
      case FrontendErrorType.NETWORK_ERROR:
      case FrontendErrorType.API_ERROR:
        return error.status >= 500 ? ErrorSeverity.HIGH : ErrorSeverity.MEDIUM
      
      case FrontendErrorType.AUDIO_ERROR:
      case FrontendErrorType.PERMISSION_ERROR:
        return ErrorSeverity.MEDIUM
      
      case FrontendErrorType.COMPONENT_ERROR:
        return ErrorSeverity.HIGH
      
      default:
        return ErrorSeverity.MEDIUM
    }
  }

  /**
   * 获取用户友好的错误消息
   */
  private getUserMessage(type: FrontendErrorType, error: any): string {
    switch (type) {
      case FrontendErrorType.NETWORK_ERROR:
        return '网络连接失败，请检查网络设置'
      
      case FrontendErrorType.API_ERROR:
        if (error.status === 401) return '登录已过期，请重新登录'
        if (error.status === 403) return '您没有权限执行此操作'
        if (error.status === 404) return '请求的资源不存在'
        if (error.status === 429) return '操作过于频繁，请稍后再试'
        if (error.status >= 500) return '服务器暂时无法响应，请稍后重试'
        return '操作失败，请重试'
      
      case FrontendErrorType.VALIDATION_ERROR:
        return error.message || '输入数据格式不正确'
      
      case FrontendErrorType.AUDIO_ERROR:
        return '音频处理失败，请检查音频文件格式'
      
      case FrontendErrorType.PERMISSION_ERROR:
        return '缺少必要权限，请检查应用设置'
      
      case FrontendErrorType.STORAGE_ERROR:
        return '本地存储失败，请检查存储空间'
      
      case FrontendErrorType.COMPONENT_ERROR:
        return '页面加载失败，请刷新重试'
      
      default:
        return '操作失败，请稍后重试'
    }
  }

  /**
   * 判断错误是否可重试
   */
  private isRetryable(type: FrontendErrorType, error: any): boolean {
    switch (type) {
      case FrontendErrorType.NETWORK_ERROR:
        return true
      
      case FrontendErrorType.API_ERROR:
        return error.status >= 500 || error.status === 429
      
      case FrontendErrorType.AUDIO_ERROR:
        return error.code !== 'UNSUPPORTED_FORMAT'
      
      default:
        return false
    }
  }

  /**
   * 解析API错误
   */
  private parseApiError(error: any): Error {
    if (error.response?.data?.error) {
      const apiError = error.response.data.error
      const newError = new Error(apiError.message || 'API Error')
      ;(newError as any).status = error.response.status
      ;(newError as any).code = apiError.code
      ;(newError as any).details = apiError.details
      return newError
    }
    
    return error
  }

  /**
   * 获取音频错误消息
   */
  private getAudioErrorMessage(error: Error, operation?: string): string {
    const baseMessage = operation ? `${operation}操作失败` : '音频操作失败'
    
    if (error.message.includes('format')) {
      return '不支持的音频格式'
    }
    
    if (error.message.includes('permission')) {
      return '缺少录音权限，请在设置中允许录音'
    }
    
    if (error.message.includes('device')) {
      return '音频设备不可用，请检查设备连接'
    }
    
    return baseMessage
  }

  /**
   * 获取权限错误消息
   */
  private getPermissionErrorMessage(permission: string): string {
    const messages: Record<string, string> = {
      'camera': '需要相机权限，请在设置中允许使用相机',
      'microphone': '需要录音权限，请在设置中允许录音',
      'storage': '需要存储权限，请在设置中允许访问存储',
      'location': '需要位置权限，请在设置中允许位置访问'
    }
    
    return messages[permission] || `需要${permission}权限，请检查应用设置`
  }

  /**
   * 记录错误
   */
  private logError(error: FrontendError): void {
    // 添加到错误队列
    this.errorQueue.push(error)
    
    // 保持队列大小
    if (this.errorQueue.length > 100) {
      this.errorQueue = this.errorQueue.slice(-50)
    }
    
    // 本地日志
    logError(error.message, error.originalError, {
      type: error.type,
      severity: error.severity,
      context: error.context,
      retryable: error.retryable
    })
    
    // 高严重级别错误发送到服务器（如果在线）
    if (this.isOnline && error.severity === ErrorSeverity.CRITICAL) {
      this.reportToServer(error).catch(reportError => {
        console.warn('Failed to report error to server:', reportError)
      })
    }
  }

  /**
   * 处理错误恢复
   */
  private handleErrorRecovery(error: FrontendError, options: ErrorRecoveryOptions): void {
    if (options.showAlert) {
      const buttons: any[] = [
        { text: '确定', style: 'default' }
      ]
      
      if (options.showRetry && options.onRetry) {
        buttons.unshift({
          text: '重试',
          style: 'default',
          onPress: options.onRetry
        })
      }
      
      Alert.alert(
        options.alertTitle || '错误',
        options.alertMessage || error.userMessage,
        buttons
      )
    }
    
    if (options.fallbackAction) {
      setTimeout(options.fallbackAction, 100)
    }
  }

  /**
   * 上报错误到服务器
   */
  private async reportToServer(error: FrontendError): Promise<void> {
    try {
      // 这里可以调用API发送错误报告
      // await apiService.reportError(error)
      logInfo('Error reported to server', { errorId: error.timestamp })
    } catch (reportError) {
      // 报告失败时静默处理
      console.warn('Failed to report error:', reportError)
    }
  }
}

// 导出单例实例
export const frontendErrorHandler = FrontendErrorHandler.getInstance()

// 导出便捷函数
export const handleError = frontendErrorHandler.handleError.bind(frontendErrorHandler)
export const handleApiError = frontendErrorHandler.handleApiError.bind(frontendErrorHandler)
export const handleNetworkError = frontendErrorHandler.handleNetworkError.bind(frontendErrorHandler)
export const handleValidationError = frontendErrorHandler.handleValidationError.bind(frontendErrorHandler)
export const handleAudioError = frontendErrorHandler.handleAudioError.bind(frontendErrorHandler)
export const handlePermissionError = frontendErrorHandler.handlePermissionError.bind(frontendErrorHandler)