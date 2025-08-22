// import winston from 'winston'
import path from 'path'

// 临时的简化日志实现，等待winston安装
const logger = {
  error: (message: string, metadata?: any) => {
    console.error(`[ERROR] ${new Date().toISOString()} - ${message}`, metadata || '')
  },
  warn: (message: string, metadata?: any) => {
    console.warn(`[WARN] ${new Date().toISOString()} - ${message}`, metadata || '')
  },
  info: (message: string, metadata?: any) => {
    console.info(`[INFO] ${new Date().toISOString()} - ${message}`, metadata || '')
  },
  debug: (message: string, metadata?: any) => {
    if (process.env.NODE_ENV === 'development') {
      console.debug(`[DEBUG] ${new Date().toISOString()} - ${message}`, metadata || '')
    }
  },
  http: (message: string, metadata?: any) => {
    if (process.env.NODE_ENV === 'development') {
      console.log(`[HTTP] ${new Date().toISOString()} - ${message}`, metadata || '')
    }
  }
}

export default logger

// 导出专用的日志方法
export const logError = (message: string, error?: Error, metadata?: any) => {
  logger.error(message, { error: error?.stack || error, metadata })
}

export const logWarning = (message: string, metadata?: any) => {
  logger.warn(message, { metadata })
}

export const logInfo = (message: string, metadata?: any) => {
  logger.info(message, { metadata })
}

export const logDebug = (message: string, metadata?: any) => {
  logger.debug(message, { metadata })
}

export const logHttp = (message: string, metadata?: any) => {
  logger.http(message, { metadata })
}

// 性能监控日志
export const logPerformance = (operation: string, duration: number, metadata?: any) => {
  logger.info(`Performance: ${operation} completed in ${duration}ms`, { 
    operation, 
    duration, 
    metadata 
  })
}

// 安全事件日志
export const logSecurity = (event: string, userId?: string, ip?: string, metadata?: any) => {
  logger.warn(`Security: ${event}`, {
    event,
    userId,
    ip,
    metadata,
    timestamp: new Date().toISOString()
  })
}

// 业务日志
export const logBusiness = (action: string, userId?: string, metadata?: any) => {
  logger.info(`Business: ${action}`, {
    action,
    userId,
    metadata,
    timestamp: new Date().toISOString()
  })
}