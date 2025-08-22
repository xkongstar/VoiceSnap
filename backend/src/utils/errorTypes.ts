/**
 * 统一错误处理系统 - 错误类型定义
 */

/**
 * 错误严重级别
 */
export enum ErrorSeverity {
  LOW = 'low',           // 低级错误，不影响核心功能
  MEDIUM = 'medium',     // 中级错误，影响部分功能
  HIGH = 'high',         // 高级错误，影响核心功能
  CRITICAL = 'critical'  // 严重错误，影响系统运行
}

/**
 * 错误类别
 */
export enum ErrorCategory {
  AUTHENTICATION = 'authentication',     // 认证相关错误
  AUTHORIZATION = 'authorization',       // 授权相关错误
  VALIDATION = 'validation',             // 数据验证错误
  DATABASE = 'database',                 // 数据库相关错误
  NETWORK = 'network',                   // 网络相关错误
  FILE_SYSTEM = 'file_system',          // 文件系统错误
  AUDIO_PROCESSING = 'audio_processing', // 音频处理错误
  BUSINESS_LOGIC = 'business_logic',     // 业务逻辑错误
  SYSTEM = 'system',                     // 系统级错误
  EXTERNAL_SERVICE = 'external_service', // 外部服务错误
  RATE_LIMIT = 'rate_limit',            // 频率限制错误
  QUOTA_EXCEEDED = 'quota_exceeded'      // 配额超限错误
}

/**
 * 错误代码枚举
 */
export enum ErrorCode {
  // 认证相关 (1000-1099)
  INVALID_CREDENTIALS = 'AUTH_1001',
  TOKEN_EXPIRED = 'AUTH_1002',
  TOKEN_INVALID = 'AUTH_1003',
  REFRESH_TOKEN_EXPIRED = 'AUTH_1004',
  ACCOUNT_LOCKED = 'AUTH_1005',
  PASSWORD_TOO_WEAK = 'AUTH_1006',
  
  // 授权相关 (1100-1199)
  INSUFFICIENT_PERMISSIONS = 'AUTHZ_1101',
  RESOURCE_FORBIDDEN = 'AUTHZ_1102',
  ADMIN_REQUIRED = 'AUTHZ_1103',
  
  // 验证相关 (1200-1299)
  INVALID_INPUT = 'VALID_1201',
  MISSING_REQUIRED_FIELD = 'VALID_1202',
  FIELD_TOO_LONG = 'VALID_1203',
  FIELD_TOO_SHORT = 'VALID_1204',
  INVALID_FORMAT = 'VALID_1205',
  INVALID_FILE_TYPE = 'VALID_1206',
  FILE_TOO_LARGE = 'VALID_1207',
  
  // 数据库相关 (1300-1399)
  DATABASE_CONNECTION_FAILED = 'DB_1301',
  DUPLICATE_KEY_ERROR = 'DB_1302',
  RECORD_NOT_FOUND = 'DB_1303',
  FOREIGN_KEY_CONSTRAINT = 'DB_1304',
  DATABASE_TIMEOUT = 'DB_1305',
  TRANSACTION_FAILED = 'DB_1306',
  
  // 网络相关 (1400-1499)
  NETWORK_TIMEOUT = 'NET_1401',
  CONNECTION_REFUSED = 'NET_1402',
  DNS_LOOKUP_FAILED = 'NET_1403',
  SLOW_NETWORK = 'NET_1404',
  
  // 文件系统相关 (1500-1599)
  FILE_NOT_FOUND = 'FS_1501',
  FILE_ACCESS_DENIED = 'FS_1502',
  DISK_SPACE_FULL = 'FS_1503',
  FILE_CORRUPTION = 'FS_1504',
  UPLOAD_FAILED = 'FS_1505',
  
  // 音频处理相关 (1600-1699)
  AUDIO_FORMAT_UNSUPPORTED = 'AUDIO_1601',
  AUDIO_CORRUPTION = 'AUDIO_1602',
  AUDIO_TOO_SHORT = 'AUDIO_1603',
  AUDIO_TOO_LONG = 'AUDIO_1604',
  AUDIO_QUALITY_TOO_LOW = 'AUDIO_1605',
  FFMPEG_ERROR = 'AUDIO_1606',
  AUDIO_ANALYSIS_FAILED = 'AUDIO_1607',
  
  // 业务逻辑相关 (1700-1799)
  TASK_ALREADY_COMPLETED = 'BIZ_1701',
  RECORDING_ALREADY_EXISTS = 'BIZ_1702',
  INVALID_OPERATION_STATE = 'BIZ_1703',
  OPERATION_NOT_ALLOWED = 'BIZ_1704',
  RESOURCE_CONFLICT = 'BIZ_1705',
  
  // 系统相关 (1800-1899)
  INTERNAL_SERVER_ERROR = 'SYS_1801',
  SERVICE_UNAVAILABLE = 'SYS_1802',
  MEMORY_EXHAUSTED = 'SYS_1803',
  CPU_OVERLOAD = 'SYS_1804',
  CONFIGURATION_ERROR = 'SYS_1805',
  
  // 外部服务相关 (1900-1999)
  CLOUD_STORAGE_ERROR = 'EXT_1901',
  PAYMENT_SERVICE_ERROR = 'EXT_1902',
  EMAIL_SERVICE_ERROR = 'EXT_1903',
  SMS_SERVICE_ERROR = 'EXT_1904',
  
  // 频率限制相关 (2000-2099)
  RATE_LIMIT_EXCEEDED = 'RATE_2001',
  TOO_MANY_REQUESTS = 'RATE_2002',
  UPLOAD_RATE_LIMIT = 'RATE_2003',
  API_QUOTA_EXCEEDED = 'RATE_2004'
}

/**
 * 错误恢复策略
 */
export enum ErrorRecoveryStrategy {
  RETRY = 'retry',               // 重试操作
  FALLBACK = 'fallback',         // 使用备选方案
  USER_ACTION = 'user_action',   // 需要用户操作
  IGNORE = 'ignore',             // 忽略错误
  TERMINATE = 'terminate'        // 终止操作
}

/**
 * 标准化错误接口
 */
export interface StandardError {
  // 基本信息
  code: ErrorCode
  message: string
  category: ErrorCategory
  severity: ErrorSeverity
  
  // 上下文信息
  timestamp: number
  requestId?: string
  userId?: string
  operation?: string
  resource?: string
  
  // 技术细节
  originalError?: Error
  stack?: string
  details?: Record<string, any>
  
  // 错误处理
  recoveryStrategy: ErrorRecoveryStrategy
  retryable: boolean
  maxRetries?: number
  currentRetry?: number
  
  // 用户友好信息
  userMessage: string
  userAction?: string
  helpUrl?: string
  
  // 开发信息
  developmentMessage?: string
  debugInfo?: Record<string, any>
}

/**
 * 错误构建器
 */
export class ErrorBuilder {
  private error: Partial<StandardError> = {}

  static create(code: ErrorCode): ErrorBuilder {
    return new ErrorBuilder().withCode(code)
  }

  withCode(code: ErrorCode): ErrorBuilder {
    this.error.code = code
    this.error.category = this.getCategoryFromCode(code)
    this.error.severity = this.getDefaultSeverity(code)
    return this
  }

  withMessage(message: string): ErrorBuilder {
    this.error.message = message
    return this
  }

  withUserMessage(userMessage: string): ErrorBuilder {
    this.error.userMessage = userMessage
    return this
  }

  withSeverity(severity: ErrorSeverity): ErrorBuilder {
    this.error.severity = severity
    return this
  }

  withCategory(category: ErrorCategory): ErrorBuilder {
    this.error.category = category
    return this
  }

  withOriginalError(originalError: Error): ErrorBuilder {
    this.error.originalError = originalError
    this.error.stack = originalError.stack
    return this
  }

  withDetails(details: Record<string, any>): ErrorBuilder {
    this.error.details = { ...this.error.details, ...details }
    return this
  }

  withContext(context: {
    requestId?: string
    userId?: string
    operation?: string
    resource?: string
  }): ErrorBuilder {
    Object.assign(this.error, context)
    return this
  }

  withRecoveryStrategy(strategy: ErrorRecoveryStrategy): ErrorBuilder {
    this.error.recoveryStrategy = strategy
    return this
  }

  withRetryConfig(retryable: boolean, maxRetries?: number): ErrorBuilder {
    this.error.retryable = retryable
    this.error.maxRetries = maxRetries
    return this
  }

  withUserAction(action: string): ErrorBuilder {
    this.error.userAction = action
    return this
  }

  withHelpUrl(url: string): ErrorBuilder {
    this.error.helpUrl = url
    return this
  }

  withDevelopmentInfo(message: string, debugInfo?: Record<string, any>): ErrorBuilder {
    this.error.developmentMessage = message
    this.error.debugInfo = debugInfo
    return this
  }

  build(): StandardError {
    // 设置默认值
    const now = Date.now()
    const defaultUserMessage = this.getDefaultUserMessage(this.error.code!)
    const defaultRecoveryStrategy = this.getDefaultRecoveryStrategy(this.error.code!)

    return {
      timestamp: now,
      userMessage: defaultUserMessage,
      recoveryStrategy: defaultRecoveryStrategy,
      retryable: false,
      ...this.error
    } as StandardError
  }

  private getCategoryFromCode(code: ErrorCode): ErrorCategory {
    const prefix = code.split('_')[0]
    
    switch (prefix) {
      case 'AUTH': return ErrorCategory.AUTHENTICATION
      case 'AUTHZ': return ErrorCategory.AUTHORIZATION
      case 'VALID': return ErrorCategory.VALIDATION
      case 'DB': return ErrorCategory.DATABASE
      case 'NET': return ErrorCategory.NETWORK
      case 'FS': return ErrorCategory.FILE_SYSTEM
      case 'AUDIO': return ErrorCategory.AUDIO_PROCESSING
      case 'BIZ': return ErrorCategory.BUSINESS_LOGIC
      case 'SYS': return ErrorCategory.SYSTEM
      case 'EXT': return ErrorCategory.EXTERNAL_SERVICE
      case 'RATE': return ErrorCategory.RATE_LIMIT
      default: return ErrorCategory.SYSTEM
    }
  }

  private getDefaultSeverity(code: ErrorCode): ErrorSeverity {
    // 根据错误代码确定默认严重级别
    const criticalErrors = [
      ErrorCode.DATABASE_CONNECTION_FAILED,
      ErrorCode.MEMORY_EXHAUSTED,
      ErrorCode.CPU_OVERLOAD,
      ErrorCode.SERVICE_UNAVAILABLE
    ]
    
    const highErrors = [
      ErrorCode.INTERNAL_SERVER_ERROR,
      ErrorCode.CONFIGURATION_ERROR,
      ErrorCode.DISK_SPACE_FULL
    ]
    
    const lowErrors = [
      ErrorCode.INVALID_INPUT,
      ErrorCode.MISSING_REQUIRED_FIELD,
      ErrorCode.FIELD_TOO_LONG,
      ErrorCode.FIELD_TOO_SHORT
    ]

    if (criticalErrors.includes(code)) return ErrorSeverity.CRITICAL
    if (highErrors.includes(code)) return ErrorSeverity.HIGH
    if (lowErrors.includes(code)) return ErrorSeverity.LOW
    
    return ErrorSeverity.MEDIUM
  }

  private getDefaultUserMessage(code: ErrorCode): string {
    const messages: Record<ErrorCode, string> = {
      [ErrorCode.INVALID_CREDENTIALS]: '用户名或密码错误',
      [ErrorCode.TOKEN_EXPIRED]: '登录已过期，请重新登录',
      [ErrorCode.INSUFFICIENT_PERMISSIONS]: '您没有权限执行此操作',
      [ErrorCode.INVALID_INPUT]: '输入的数据格式不正确',
      [ErrorCode.MISSING_REQUIRED_FIELD]: '请填写所有必填字段',
      [ErrorCode.FILE_TOO_LARGE]: '文件大小超出限制',
      [ErrorCode.AUDIO_FORMAT_UNSUPPORTED]: '不支持的音频格式',
      [ErrorCode.TASK_ALREADY_COMPLETED]: '该任务已经完成',
      [ErrorCode.NETWORK_TIMEOUT]: '网络连接超时，请检查网络连接',
      [ErrorCode.RATE_LIMIT_EXCEEDED]: '操作过于频繁，请稍后再试',
      [ErrorCode.INTERNAL_SERVER_ERROR]: '服务器内部错误，请稍后重试'
    }

    return messages[code] || '操作失败，请稍后重试'
  }

  private getDefaultRecoveryStrategy(code: ErrorCode): ErrorRecoveryStrategy {
    const retryableErrors = [
      ErrorCode.NETWORK_TIMEOUT,
      ErrorCode.DATABASE_TIMEOUT,
      ErrorCode.CLOUD_STORAGE_ERROR
    ]

    const userActionErrors = [
      ErrorCode.INVALID_CREDENTIALS,
      ErrorCode.INVALID_INPUT,
      ErrorCode.MISSING_REQUIRED_FIELD,
      ErrorCode.FILE_TOO_LARGE
    ]

    if (retryableErrors.includes(code)) return ErrorRecoveryStrategy.RETRY
    if (userActionErrors.includes(code)) return ErrorRecoveryStrategy.USER_ACTION
    
    return ErrorRecoveryStrategy.FALLBACK
  }
}

/**
 * 预定义的常用错误
 */
export const CommonErrors = {
  // 认证错误
  InvalidCredentials: () => ErrorBuilder
    .create(ErrorCode.INVALID_CREDENTIALS)
    .withMessage('Invalid username or password')
    .withRecoveryStrategy(ErrorRecoveryStrategy.USER_ACTION)
    .build(),

  TokenExpired: () => ErrorBuilder
    .create(ErrorCode.TOKEN_EXPIRED)
    .withMessage('Access token has expired')
    .withRecoveryStrategy(ErrorRecoveryStrategy.USER_ACTION)
    .withUserAction('请重新登录')
    .build(),

  // 验证错误
  InvalidInput: (field?: string) => ErrorBuilder
    .create(ErrorCode.INVALID_INPUT)
    .withMessage(`Invalid input${field ? ` for field: ${field}` : ''}`)
    .withDetails({ field })
    .withRecoveryStrategy(ErrorRecoveryStrategy.USER_ACTION)
    .build(),

  MissingRequiredField: (field: string) => ErrorBuilder
    .create(ErrorCode.MISSING_REQUIRED_FIELD)
    .withMessage(`Missing required field: ${field}`)
    .withDetails({ field })
    .withRecoveryStrategy(ErrorRecoveryStrategy.USER_ACTION)
    .withUserAction(`请填写${field}字段`)
    .build(),

  // 业务逻辑错误
  TaskAlreadyCompleted: (taskId: string) => ErrorBuilder
    .create(ErrorCode.TASK_ALREADY_COMPLETED)
    .withMessage('Task has already been completed')
    .withDetails({ taskId })
    .withRecoveryStrategy(ErrorRecoveryStrategy.USER_ACTION)
    .build(),

  RecordingAlreadyExists: (taskId: string) => ErrorBuilder
    .create(ErrorCode.RECORDING_ALREADY_EXISTS)
    .withMessage('Recording already exists for this task')
    .withDetails({ taskId })
    .withRecoveryStrategy(ErrorRecoveryStrategy.USER_ACTION)
    .withUserAction('该任务已有录音，您可以选择更新现有录音')
    .build(),

  // 网络错误
  NetworkTimeout: () => ErrorBuilder
    .create(ErrorCode.NETWORK_TIMEOUT)
    .withMessage('Network request timed out')
    .withRecoveryStrategy(ErrorRecoveryStrategy.RETRY)
    .withRetryConfig(true, 3)
    .build(),

  // 系统错误
  InternalServerError: (originalError?: Error) => ErrorBuilder
    .create(ErrorCode.INTERNAL_SERVER_ERROR)
    .withMessage('Internal server error')
    .withOriginalError(originalError)
    .withSeverity(ErrorSeverity.HIGH)
    .withRecoveryStrategy(ErrorRecoveryStrategy.RETRY)
    .withRetryConfig(true, 2)
    .build()
}