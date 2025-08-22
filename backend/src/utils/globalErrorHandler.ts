import type { Request, Response, NextFunction } from "express"
import { logError, logInfo, logPerformance } from "./logger"
import { 
  StandardError, 
  ErrorBuilder, 
  ErrorCode, 
  ErrorSeverity,
  ErrorCategory,
  ErrorRecoveryStrategy
} from "./errorTypes"
import type { ErrorResponseDTO } from "../types/DTOs"

/**
 * 错误上下文接口
 */
interface ErrorContext {
  requestId?: string
  userId?: string
  operation?: string
  resource?: string
  userAgent?: string
  ip?: string
  url?: string
  method?: string
  body?: any
  query?: any
  params?: any
}

/**
 * 全局错误处理器
 */
export class GlobalErrorHandler {
  private static instance: GlobalErrorHandler
  private readonly isDevelopment = process.env.NODE_ENV === 'development'

  static getInstance(): GlobalErrorHandler {
    if (!GlobalErrorHandler.instance) {
      GlobalErrorHandler.instance = new GlobalErrorHandler()
    }
    return GlobalErrorHandler.instance
  }

  /**
   * Express错误处理中间件
   */
  handleError = (error: any, req: Request, res: Response, next: NextFunction): void => {
    const startTime = Date.now()
    
    try {
      // 提取错误上下文
      const context = this.extractContext(req)
      
      // 标准化错误
      const standardError = this.standardizeError(error, context)
      
      // 记录错误日志
      this.logError(standardError, context)
      
      // 发送错误响应
      this.sendErrorResponse(res, standardError, context)
      
      // 记录处理性能
      logPerformance('错误处理', Date.now() - startTime, {
        errorCode: standardError.code,
        severity: standardError.severity
      })
      
    } catch (handlingError) {
      // 错误处理器本身出错时的兜底处理
      console.error('Error handler failed:', handlingError)
      this.sendFallbackErrorResponse(res)
    }
  }

  /**
   * 异步错误处理包装器
   */
  wrapAsync = (fn: Function) => {
    return (req: Request, res: Response, next: NextFunction) => {
      Promise.resolve(fn(req, res, next)).catch(next)
    }
  }

  /**
   * 创建标准错误
   */
  createError(
    code: ErrorCode,
    message?: string,
    originalError?: Error,
    context?: Partial<ErrorContext>
  ): StandardError {
    return ErrorBuilder
      .create(code)
      .withMessage(message || 'An error occurred')
      .withOriginalError(originalError)
      .withContext(context || {})
      .build()
  }

  /**
   * 提取请求上下文
   */
  private extractContext(req: Request): ErrorContext {
    return {
      requestId: (req as any).requestId || this.generateRequestId(),
      userId: (req as any).user?.id,
      operation: `${req.method} ${req.path}`,
      resource: req.params?.id || req.query?.id as string,
      userAgent: req.get('User-Agent'),
      ip: req.ip || req.connection.remoteAddress,
      url: req.originalUrl,
      method: req.method,
      // 只在开发环境记录敏感数据
      ...(this.isDevelopment && {
        body: this.sanitizeBody(req.body),
        query: req.query,
        params: req.params
      })
    }
  }

  /**
   * 标准化错误对象
   */
  private standardizeError(error: any, context: ErrorContext): StandardError {
    // 如果已经是标准错误，直接返回
    if (this.isStandardError(error)) {
      return { ...error, ...context }
    }

    // 根据错误类型进行标准化
    if (error.name === 'ValidationError') {
      return this.handleValidationError(error, context)
    }

    if (error.name === 'MongoError' || error.name === 'MongooseError') {
      return this.handleDatabaseError(error, context)
    }

    if (error.name === 'MulterError') {
      return this.handleFileUploadError(error, context)
    }

    if (error.code === 'ENOENT') {
      return this.handleFileSystemError(error, context)
    }

    if (error.response && error.response.status) {
      return this.handleHttpError(error, context)
    }

    if (error.statusCode) {
      return this.handleExpressError(error, context)
    }

    // 默认处理
    return this.handleGenericError(error, context)
  }

  /**
   * 处理验证错误
   */
  private handleValidationError(error: any, context: ErrorContext): StandardError {
    const details: Record<string, any> = {}
    
    if (error.errors) {
      Object.keys(error.errors).forEach(field => {
        details[field] = error.errors[field].message
      })
    }

    return ErrorBuilder
      .create(ErrorCode.INVALID_INPUT)
      .withMessage('Validation failed')
      .withDetails(details)
      .withContext(context)
      .withOriginalError(error)
      .withRecoveryStrategy(ErrorRecoveryStrategy.USER_ACTION)
      .build()
  }

  /**
   * 处理数据库错误
   */
  private handleDatabaseError(error: any, context: ErrorContext): StandardError {
    // MongoDB重复键错误
    if (error.code === 11000) {
      return ErrorBuilder
        .create(ErrorCode.DUPLICATE_KEY_ERROR)
        .withMessage('Duplicate key error')
        .withDetails({ duplicateField: this.extractDuplicateField(error) })
        .withContext(context)
        .withOriginalError(error)
        .withRecoveryStrategy(ErrorRecoveryStrategy.USER_ACTION)
        .build()
    }

    // 连接超时
    if (error.code === 'ETIMEOUT') {
      return ErrorBuilder
        .create(ErrorCode.DATABASE_TIMEOUT)
        .withMessage('Database operation timed out')
        .withContext(context)
        .withOriginalError(error)
        .withRecoveryStrategy(ErrorRecoveryStrategy.RETRY)
        .withRetryConfig(true, 3)
        .build()
    }

    // 通用数据库错误
    return ErrorBuilder
      .create(ErrorCode.DATABASE_CONNECTION_FAILED)
      .withMessage('Database operation failed')
      .withContext(context)
      .withOriginalError(error)
      .withSeverity(ErrorSeverity.HIGH)
      .withRecoveryStrategy(ErrorRecoveryStrategy.RETRY)
      .withRetryConfig(true, 2)
      .build()
  }

  /**
   * 处理文件上传错误
   */
  private handleFileUploadError(error: any, context: ErrorContext): StandardError {
    switch (error.code) {
      case 'LIMIT_FILE_SIZE':
        return ErrorBuilder
          .create(ErrorCode.FILE_TOO_LARGE)
          .withMessage('File size exceeds limit')
          .withDetails({ limit: error.limit, field: error.field })
          .withContext(context)
          .withOriginalError(error)
          .withRecoveryStrategy(ErrorRecoveryStrategy.USER_ACTION)
          .withUserAction('请选择更小的文件')
          .build()

      case 'LIMIT_UNEXPECTED_FILE':
        return ErrorBuilder
          .create(ErrorCode.INVALID_FILE_TYPE)
          .withMessage('Unexpected file field')
          .withDetails({ field: error.field })
          .withContext(context)
          .withOriginalError(error)
          .withRecoveryStrategy(ErrorRecoveryStrategy.USER_ACTION)
          .build()

      default:
        return ErrorBuilder
          .create(ErrorCode.UPLOAD_FAILED)
          .withMessage('File upload failed')
          .withContext(context)
          .withOriginalError(error)
          .withRecoveryStrategy(ErrorRecoveryStrategy.RETRY)
          .build()
    }
  }

  /**
   * 处理文件系统错误
   */
  private handleFileSystemError(error: any, context: ErrorContext): StandardError {
    return ErrorBuilder
      .create(ErrorCode.FILE_NOT_FOUND)
      .withMessage('File not found')
      .withDetails({ path: error.path })
      .withContext(context)
      .withOriginalError(error)
      .withRecoveryStrategy(ErrorRecoveryStrategy.USER_ACTION)
      .build()
  }

  /**
   * 处理HTTP错误
   */
  private handleHttpError(error: any, context: ErrorContext): StandardError {
    const status = error.response.status
    
    switch (status) {
      case 401:
        return ErrorBuilder
          .create(ErrorCode.INVALID_CREDENTIALS)
          .withMessage('Unauthorized request')
          .withContext(context)
          .withOriginalError(error)
          .withRecoveryStrategy(ErrorRecoveryStrategy.USER_ACTION)
          .build()

      case 403:
        return ErrorBuilder
          .create(ErrorCode.INSUFFICIENT_PERMISSIONS)
          .withMessage('Forbidden request')
          .withContext(context)
          .withOriginalError(error)
          .withRecoveryStrategy(ErrorRecoveryStrategy.USER_ACTION)
          .build()

      case 404:
        return ErrorBuilder
          .create(ErrorCode.RECORD_NOT_FOUND)
          .withMessage('Resource not found')
          .withContext(context)
          .withOriginalError(error)
          .withRecoveryStrategy(ErrorRecoveryStrategy.USER_ACTION)
          .build()

      case 429:
        return ErrorBuilder
          .create(ErrorCode.RATE_LIMIT_EXCEEDED)
          .withMessage('Rate limit exceeded')
          .withContext(context)
          .withOriginalError(error)
          .withRecoveryStrategy(ErrorRecoveryStrategy.RETRY)
          .withRetryConfig(true, 1)
          .build()

      default:
        return ErrorBuilder
          .create(ErrorCode.EXTERNAL_SERVICE_ERROR)
          .withMessage('External service error')
          .withDetails({ status })
          .withContext(context)
          .withOriginalError(error)
          .withRecoveryStrategy(ErrorRecoveryStrategy.RETRY)
          .build()
    }
  }

  /**
   * 处理Express错误
   */
  private handleExpressError(error: any, context: ErrorContext): StandardError {
    const statusCode = error.statusCode || 500
    
    // 根据状态码确定错误类型
    if (statusCode >= 400 && statusCode < 500) {
      return ErrorBuilder
        .create(ErrorCode.INVALID_INPUT)
        .withMessage(error.message || 'Client error')
        .withContext(context)
        .withOriginalError(error)
        .withRecoveryStrategy(ErrorRecoveryStrategy.USER_ACTION)
        .build()
    }

    return ErrorBuilder
      .create(ErrorCode.INTERNAL_SERVER_ERROR)
      .withMessage(error.message || 'Server error')
      .withContext(context)
      .withOriginalError(error)
      .withSeverity(ErrorSeverity.HIGH)
      .withRecoveryStrategy(ErrorRecoveryStrategy.RETRY)
      .build()
  }

  /**
   * 处理通用错误
   */
  private handleGenericError(error: any, context: ErrorContext): StandardError {
    return ErrorBuilder
      .create(ErrorCode.INTERNAL_SERVER_ERROR)
      .withMessage(error.message || 'Unknown error occurred')
      .withContext(context)
      .withOriginalError(error)
      .withSeverity(ErrorSeverity.HIGH)
      .withRecoveryStrategy(ErrorRecoveryStrategy.RETRY)
      .build()
  }

  /**
   * 记录错误日志
   */
  private logError(error: StandardError, context: ErrorContext): void {
    const logLevel = this.getLogLevel(error.severity)
    const logData = {
      code: error.code,
      category: error.category,
      severity: error.severity,
      message: error.message,
      userMessage: error.userMessage,
      context,
      retryable: error.retryable,
      ...(this.isDevelopment && {
        stack: error.stack,
        details: error.details,
        debugInfo: error.debugInfo
      })
    }

    switch (logLevel) {
      case 'error':
        logError(error.message, error.originalError || new Error(error.message), logData)
        break
      case 'warn':
        console.warn('[ERROR]', logData)
        break
      case 'info':
        logInfo(error.message, logData)
        break
    }
  }

  /**
   * 发送错误响应
   */
  private sendErrorResponse(res: Response, error: StandardError, context: ErrorContext): void {
    const statusCode = this.getHttpStatusCode(error.code)
    
    const errorResponse: ErrorResponseDTO = {
      error: {
        code: error.code,
        message: error.userMessage,
        ...(this.isDevelopment && {
          details: error.details,
          stack: error.stack
        })
      },
      meta: {
        timestamp: new Date(error.timestamp).toISOString(),
        request_id: context.requestId,
        path: context.url || '',
        method: context.method || ''
      }
    }

    // 添加恢复建议
    if (error.userAction) {
      errorResponse.error.details = {
        ...errorResponse.error.details,
        userAction: error.userAction
      }
    }

    if (error.helpUrl) {
      errorResponse.error.details = {
        ...errorResponse.error.details,
        helpUrl: error.helpUrl
      }
    }

    res.status(statusCode).json(errorResponse)
  }

  /**
   * 兜底错误响应
   */
  private sendFallbackErrorResponse(res: Response): void {
    res.status(500).json({
      error: {
        code: 'HANDLER_ERROR',
        message: '服务器内部错误'
      },
      meta: {
        timestamp: new Date().toISOString()
      }
    })
  }

  /**
   * 工具方法
   */
  private isStandardError(error: any): error is StandardError {
    return error && typeof error.code === 'string' && error.code.includes('_')
  }

  private getLogLevel(severity: ErrorSeverity): 'error' | 'warn' | 'info' {
    switch (severity) {
      case ErrorSeverity.CRITICAL:
      case ErrorSeverity.HIGH:
        return 'error'
      case ErrorSeverity.MEDIUM:
        return 'warn'
      case ErrorSeverity.LOW:
        return 'info'
      default:
        return 'error'
    }
  }

  private getHttpStatusCode(errorCode: ErrorCode): number {
    const statusMap: Record<string, number> = {
      // 认证相关
      [ErrorCode.INVALID_CREDENTIALS]: 401,
      [ErrorCode.TOKEN_EXPIRED]: 401,
      [ErrorCode.TOKEN_INVALID]: 401,
      
      // 授权相关
      [ErrorCode.INSUFFICIENT_PERMISSIONS]: 403,
      [ErrorCode.RESOURCE_FORBIDDEN]: 403,
      
      // 验证相关
      [ErrorCode.INVALID_INPUT]: 400,
      [ErrorCode.MISSING_REQUIRED_FIELD]: 400,
      [ErrorCode.INVALID_FORMAT]: 400,
      [ErrorCode.FILE_TOO_LARGE]: 400,
      
      // 业务逻辑
      [ErrorCode.RECORD_NOT_FOUND]: 404,
      [ErrorCode.DUPLICATE_KEY_ERROR]: 409,
      [ErrorCode.TASK_ALREADY_COMPLETED]: 409,
      
      // 频率限制
      [ErrorCode.RATE_LIMIT_EXCEEDED]: 429,
      [ErrorCode.TOO_MANY_REQUESTS]: 429,
      
      // 系统错误
      [ErrorCode.INTERNAL_SERVER_ERROR]: 500,
      [ErrorCode.SERVICE_UNAVAILABLE]: 503
    }

    return statusMap[errorCode] || 500
  }

  private generateRequestId(): string {
    return `req_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`
  }

  private sanitizeBody(body: any): any {
    if (!body) return body
    
    const sensitiveFields = ['password', 'token', 'secret', 'key']
    const sanitized = { ...body }
    
    sensitiveFields.forEach(field => {
      if (sanitized[field]) {
        sanitized[field] = '[REDACTED]'
      }
    })
    
    return sanitized
  }

  private extractDuplicateField(error: any): string {
    if (error.errmsg) {
      const match = error.errmsg.match(/index: (.+?)_/)
      return match ? match[1] : 'unknown'
    }
    return 'unknown'
  }
}

// 导出单例实例
export const globalErrorHandler = GlobalErrorHandler.getInstance()

// 导出便捷函数
export const handleAsyncError = globalErrorHandler.wrapAsync
export const createError = globalErrorHandler.createError