import { Request, Response, NextFunction } from 'express'
import logger, { logHttp, logSecurity } from '../utils/logger'

// 扩展Request接口以包含开始时间
interface RequestWithStartTime extends Request {
  startTime?: number
}

/**
 * HTTP请求日志中间件
 */
export const httpLogger = (req: RequestWithStartTime, res: Response, next: NextFunction) => {
  req.startTime = Date.now()

  // 获取客户端IP
  const clientIp = req.ip || 
    req.connection.remoteAddress || 
    req.socket.remoteAddress ||
    (req.connection as any)?.socket?.remoteAddress ||
    'unknown'

  // 请求信息
  const requestInfo = {
    method: req.method,
    url: req.originalUrl,
    userAgent: req.get('User-Agent'),
    clientIp,
    userId: (req as any).user?.id || 'anonymous'
  }

  // 记录请求开始
  logHttp(`${req.method} ${req.originalUrl} - Request started`, requestInfo)

  // 监听响应完成
  res.on('finish', () => {
    const duration = req.startTime ? Date.now() - req.startTime : 0
    const responseInfo = {
      ...requestInfo,
      statusCode: res.statusCode,
      duration: `${duration}ms`,
      contentLength: res.get('Content-Length') || '0'
    }

    // 根据状态码选择日志级别
    if (res.statusCode >= 400) {
      if (res.statusCode >= 500) {
        logger.error(`${req.method} ${req.originalUrl} - ${res.statusCode} - ${duration}ms`, responseInfo)
      } else {
        logger.warn(`${req.method} ${req.originalUrl} - ${res.statusCode} - ${duration}ms`, responseInfo)
      }
    } else {
      logHttp(`${req.method} ${req.originalUrl} - ${res.statusCode} - ${duration}ms`, responseInfo)
    }

    // 记录安全相关事件
    if (res.statusCode === 401 || res.statusCode === 403) {
      logSecurity(`Unauthorized access attempt`, requestInfo.userId, clientIp, {
        method: req.method,
        url: req.originalUrl,
        statusCode: res.statusCode
      })
    }

    // 记录慢请求
    if (duration > 1000) { // 超过1秒的请求
      logger.warn(`Slow request detected: ${req.method} ${req.originalUrl} - ${duration}ms`, responseInfo)
    }
  })

  next()
}

/**
 * 错误日志中间件
 */
export const errorLogger = (error: any, req: Request, res: Response, next: NextFunction) => {
  const errorInfo = {
    message: error.message,
    stack: error.stack,
    method: req.method,
    url: req.originalUrl,
    userAgent: req.get('User-Agent'),
    clientIp: req.ip,
    userId: (req as any).user?.id || 'anonymous',
    body: req.body,
    params: req.params,
    query: req.query
  }

  logger.error(`Request error: ${error.message}`, errorInfo)

  next(error)
}

/**
 * 上传日志中间件 - 记录文件上传相关信息
 */
export const uploadLogger = (req: Request, res: Response, next: NextFunction) => {
  if (req.file) {
    const uploadInfo = {
      originalName: req.file.originalname,
      mimeType: req.file.mimetype,
      size: req.file.size,
      userId: (req as any).user?.id,
      method: req.method,
      url: req.originalUrl
    }

    logger.info(`File upload: ${req.file.originalname} (${req.file.size} bytes)`, uploadInfo)
  }

  next()
}