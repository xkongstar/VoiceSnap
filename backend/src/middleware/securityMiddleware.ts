import type { Request, Response, NextFunction } from "express"
import { createError } from "../utils/globalErrorHandler"
import { logInfo, logError, logPerformance } from "../utils/logger"
import { ErrorCode } from "../utils/errorTypes"
import { securityConfig } from "../config/security"

// 简化版速率限制
interface RateLimitConfig {
  windowMs: number
  max: number
  message?: any
  standardHeaders?: boolean
  legacyHeaders?: boolean
  handler?: (req: Request, res: Response) => void
  skip?: (req: Request) => boolean
  skipSuccessfulRequests?: boolean
}

function rateLimit(config: RateLimitConfig) {
  const windowCounts = new Map<string, { count: number; resetTime: number }>()
  
  return (req: Request, res: Response, next: NextFunction) => {
    const key = req.ip || 'unknown'
    const now = Date.now()
    const windowStart = now - config.windowMs
    
    // 清理过期记录
    for (const [ip, data] of windowCounts.entries()) {
      if (data.resetTime < windowStart) {
        windowCounts.delete(ip)
      }
    }
    
    // 检查是否跳过
    if (config.skip && config.skip(req)) {
      return next()
    }
    
    const current = windowCounts.get(key) || { count: 0, resetTime: now + config.windowMs }
    
    if (current.count >= config.max) {
      if (config.handler) {
        return config.handler(req, res)
      }
      return res.status(429).json(config.message || { error: 'Too Many Requests' })
    }
    
    current.count++
    windowCounts.set(key, current)
    
    if (config.standardHeaders) {
      res.setHeader('X-RateLimit-Limit', config.max)
      res.setHeader('X-RateLimit-Remaining', Math.max(0, config.max - current.count))
      res.setHeader('X-RateLimit-Reset', current.resetTime.toString())
    }
    
    next()
  }
}

// 简化版请求减速
interface SlowDownConfig {
  windowMs: number
  delayAfter: number
  delayMs: number
  onLimitReached?: (req: Request) => void
}

function slowDown(config: SlowDownConfig) {
  const requestCounts = new Map<string, { count: number; resetTime: number }>()
  
  return (req: Request, res: Response, next: NextFunction) => {
    const key = req.ip || 'unknown'
    const now = Date.now()
    const windowStart = now - config.windowMs
    
    // 清理过期记录
    for (const [ip, data] of requestCounts.entries()) {
      if (data.resetTime < windowStart) {
        requestCounts.delete(ip)
      }
    }
    
    const current = requestCounts.get(key) || { count: 0, resetTime: now + config.windowMs }
    current.count++
    requestCounts.set(key, current)
    
    if (current.count > config.delayAfter) {
      const delay = (current.count - config.delayAfter) * config.delayMs
      
      if (config.onLimitReached) {
        config.onLimitReached(req)
      }
      
      setTimeout(() => next(), delay)
    } else {
      next()
    }
  }
}

/**
 * 安全中间件管理器
 */
export class SecurityMiddleware {
  private suspiciousIPs = new Map<string, { count: number; lastSeen: number }>()
  private blacklistedIPs = new Set<string>()

  constructor() {
    this.startCleanupJob()
  }

  /**
   * 通用速率限制
   */
  generalRateLimit = rateLimit({
    windowMs: securityConfig.rateLimits.general.windowMs,
    max: securityConfig.rateLimits.general.max,
    message: {
      error: {
        code: ErrorCode.RATE_LIMIT_EXCEEDED,
        message: '请求过于频繁，请稍后再试'
      }
    },
    standardHeaders: true,
    legacyHeaders: false,
    handler: (req, res) => {
      this.trackSuspiciousActivity(req.ip || 'unknown')
      logError('Rate limit exceeded', new Error('Rate limit'), {
        ip: req.ip,
        userAgent: req.get('User-Agent'),
        path: req.path
      })
      res.status(429).json({
        error: {
          code: ErrorCode.RATE_LIMIT_EXCEEDED,
          message: '请求过于频繁，请稍后再试'
        }
      })
    },
    skip: (req) => this.isWhitelistedIP(req.ip || 'unknown')
  })

  /**
   * 认证速率限制
   */
  authRateLimit = rateLimit({
    windowMs: securityConfig.rateLimits.authentication.windowMs,
    max: securityConfig.rateLimits.authentication.max,
    message: {
      error: {
        code: ErrorCode.RATE_LIMIT_EXCEEDED,
        message: '登录尝试过于频繁，请稍后再试'
      }
    },
    skipSuccessfulRequests: true,
    handler: (req, res) => {
      this.trackSuspiciousActivity(req.ip || 'unknown', 'auth_abuse')
      logError('Auth rate limit exceeded', new Error('Auth rate limit'), {
        ip: req.ip,
        userAgent: req.get('User-Agent'),
        username: req.body?.username
      })
      res.status(429).json({
        error: {
          code: ErrorCode.RATE_LIMIT_EXCEEDED,
          message: '登录尝试过于频繁，请稍后再试'
        }
      })
    }
  })

  /**
   * 上传速率限制
   */
  uploadRateLimit = rateLimit({
    windowMs: securityConfig.rateLimits.upload.windowMs,
    max: securityConfig.rateLimits.upload.max,
    message: {
      error: {
        code: ErrorCode.UPLOAD_RATE_LIMIT,
        message: '上传过于频繁，请稍后再试'
      }
    },
    handler: (req, res) => {
      logError('Upload rate limit exceeded', new Error('Upload rate limit'), {
        ip: req.ip,
        userAgent: req.get('User-Agent'),
        userId: (req as any).user?.id
      })
      res.status(429).json({
        error: {
          code: ErrorCode.UPLOAD_RATE_LIMIT,
          message: '上传过于频繁，请稍后再试'
        }
      })
    }
  })

  /**
   * API速率限制
   */
  apiRateLimit = rateLimit({
    windowMs: securityConfig.rateLimits.api.windowMs,
    max: securityConfig.rateLimits.api.max,
    message: {
      error: {
        code: ErrorCode.API_QUOTA_EXCEEDED,
        message: 'API调用配额已用完，请稍后再试'
      }
    },
    standardHeaders: true,
    handler: (req, res) => {
      logError('API rate limit exceeded', new Error('API rate limit'), {
        ip: req.ip,
        userAgent: req.get('User-Agent'),
        userId: (req as any).user?.id,
        path: req.path
      })
      res.status(429).json({
        error: {
          code: ErrorCode.API_QUOTA_EXCEEDED,
          message: 'API调用配额已用完，请稍后再试'
        }
      })
    }
  })

  /**
   * 请求减速中间件
   */
  requestSlowDown = slowDown({
    windowMs: securityConfig.slowDown.windowMs,
    delayAfter: securityConfig.slowDown.delayAfter,
    delayMs: securityConfig.slowDown.delayMs,
    onLimitReached: (req) => {
      logInfo('Request slowdown triggered', {
        ip: req.ip,
        userAgent: req.get('User-Agent'),
        path: req.path
      })
    }
  })

  /**
   * 安全头部中间件
   */
  securityHeaders = (req: Request, res: Response, next: NextFunction): void => {
    // 设置安全头部
    res.setHeader('X-Content-Type-Options', 'nosniff')
    res.setHeader('X-Frame-Options', 'DENY')
    res.setHeader('X-XSS-Protection', '1; mode=block')
    res.setHeader('Referrer-Policy', 'strict-origin-when-cross-origin')
    // Permissions Policy
    const permissionsPolicy = Object.entries(securityConfig.headers.permissions)
      .map(([permission, value]) => `${permission}=${value}`)
      .join(', ')
    
    res.setHeader('Permissions-Policy', permissionsPolicy)
    
    // 内容安全策略
    const cspDirectives = Object.entries(securityConfig.headers.contentSecurityPolicy)
      .map(([directive, sources]) => `${directive.replace(/([A-Z])/g, '-$1').toLowerCase()} ${sources.join(' ')}`)
      .join('; ')
    
    res.setHeader('Content-Security-Policy', cspDirectives)

    // HSTS (仅在HTTPS环境下)
    if (req.secure || req.get('X-Forwarded-Proto') === 'https') {
      const hstsValue = `max-age=${securityConfig.headers.hsts.maxAge}${securityConfig.headers.hsts.includeSubDomains ? '; includeSubDomains' : ''}${securityConfig.headers.hsts.preload ? '; preload' : ''}`
      res.setHeader('Strict-Transport-Security', hstsValue)
    }

    next()
  }

  /**
   * 输入清理中间件
   */
  sanitizeInput = (req: Request, res: Response, next: NextFunction): void => {
    try {
      // 清理查询参数
      if (req.query) {
        req.query = this.sanitizeObject(req.query)
      }

      // 清理请求体
      if (req.body) {
        req.body = this.sanitizeObject(req.body)
      }

      // 清理路径参数
      if (req.params) {
        req.params = this.sanitizeObject(req.params)
      }

      next()
    } catch (error) {
      logError('Input sanitization failed', error as Error, {
        ip: req.ip,
        path: req.path
      })
      next(createError(ErrorCode.INVALID_INPUT, 'Invalid input data'))
    }
  }

  /**
   * IP黑名单检查
   */
  checkBlacklist = (req: Request, res: Response, next: NextFunction): void => {
    const clientIP = this.getClientIP(req)
    
    if (this.blacklistedIPs.has(clientIP)) {
      logError('Blacklisted IP access attempt', new Error('Blacklisted IP'), {
        ip: clientIP,
        userAgent: req.get('User-Agent'),
        path: req.path
      })
      
      res.status(403).json({
        error: {
          code: ErrorCode.RESOURCE_FORBIDDEN,
          message: '访问被拒绝'
        }
      })
      return
    }

    next()
  }

  /**
   * 可疑活动检测
   */
  detectSuspiciousActivity = (req: Request, res: Response, next: NextFunction): void => {
    const clientIP = this.getClientIP(req)
    const userAgent = req.get('User-Agent') || ''
    
    // 检查可疑的User-Agent
    if (this.isSuspiciousUserAgent(userAgent)) {
      this.trackSuspiciousActivity(clientIP, 'suspicious_user_agent')
    }

    // 检查可疑的请求模式
    if (this.isSuspiciousRequest(req)) {
      this.trackSuspiciousActivity(clientIP, 'suspicious_request')
    }

    next()
  }

  /**
   * CORS安全配置
   */
  corsConfig = {
    origin: (origin: string | undefined, callback: (error: Error | null, allow?: boolean) => void) => {
      // 允许没有origin的请求（如移动应用）
      if (!origin) return callback(null, true)
      
      // 检查是否在允许列表中
      if (securityConfig.cors.allowedOrigins.includes(origin)) {
        callback(null, true)
      } else {
        logError('CORS violation', new Error('CORS violation'), { origin })
        callback(new Error('Not allowed by CORS'))
      }
    },
    credentials: securityConfig.cors.credentials,
    methods: [...securityConfig.cors.methods] as string[], // 转换为可变数组
    allowedHeaders: [...securityConfig.cors.allowedHeaders] as string[],
    exposedHeaders: [...securityConfig.cors.exposedHeaders] as string[],
    maxAge: securityConfig.cors.maxAge
  }

  /**
   * 请求大小限制
   */
  requestSizeLimit = (req: Request, res: Response, next: NextFunction): void => {
    const contentLength = req.get('Content-Length')
    
    if (contentLength) {
      const size = parseInt(contentLength, 10)
      const maxSize = this.parseSize(securityConfig.request.maxRequestSize)
      
      if (size > maxSize) {
        logError('Request size exceeded', new Error('Request too large'), {
          ip: req.ip,
          size,
          maxSize,
          path: req.path
        })
        
        res.status(413).json({
          error: {
            code: ErrorCode.FILE_TOO_LARGE,
            message: '请求体过大'
          }
        })
        return
      }
    }

    next()
  }

  /**
   * 文件类型验证
   */
  validateFileType = (req: Request, res: Response, next: NextFunction): void => {
    if (req.file) {
      const { mimetype } = req.file
      
      if (!securityConfig.fileUpload.allowedMimeTypes.includes(mimetype as any)) {
        logError('Invalid file type', new Error('Invalid file type'), {
          ip: req.ip,
          mimetype,
          userId: (req as any).user?.id
        })
        
        res.status(400).json({
          error: {
            code: ErrorCode.INVALID_FILE_TYPE,
            message: '不支持的文件类型'
          }
        })
        return
      }
    }

    next()
  }

  /**
   * 私有方法
   */
  private sanitizeObject(obj: any): any {
    if (typeof obj !== 'object' || obj === null) {
      return this.sanitizeString(String(obj))
    }

    if (Array.isArray(obj)) {
      return obj.map(item => this.sanitizeObject(item))
    }

    const sanitized: any = {}
    for (const [key, value] of Object.entries(obj)) {
      const sanitizedKey = this.sanitizeString(key)
      sanitized[sanitizedKey] = this.sanitizeObject(value)
    }

    return sanitized
  }

  private sanitizeString(str: string): string {
    if (typeof str !== 'string') return str

    return str
      .replace(/<script\b[^<]*(?:(?!<\/script>)<[^<]*)*<\/script>/gi, '') // 移除script标签
      .replace(/javascript:/gi, '')                                        // 移除javascript:
      .replace(/on\w+\s*=/gi, '')                                         // 移除事件处理器
      .replace(/[<>\"']/g, '')                                            // 移除危险字符
      .trim()
      .substring(0, 1000) // 限制长度
  }

  private trackSuspiciousActivity(ip: string, type: string = 'general'): void {
    const now = Date.now()
    const current = this.suspiciousIPs.get(ip) || { count: 0, lastSeen: now }
    
    current.count++
    current.lastSeen = now
    
    this.suspiciousIPs.set(ip, current)
    
    logInfo('Suspicious activity tracked', {
      ip,
      type,
      count: current.count
    })
    
    // 如果可疑活动过多，加入黑名单
    if (current.count > securityConfig.ipSecurity.maxSuspiciousActivity) {
      this.blacklistedIPs.add(ip)
      logError('IP added to blacklist', new Error('Excessive suspicious activity'), {
        ip,
        count: current.count
      })
    }
  }

  private isWhitelistedIP(ip: string): boolean {
    return securityConfig.ipSecurity.whitelistedIPs.includes(ip)
  }

  private isSuspiciousUserAgent(userAgent: string): boolean {
    const suspiciousPatterns = [
      /bot|crawler|spider/i,
      /curl|wget|python|php/i,
      /scanner|hack|exploit/i
    ]
    
    return suspiciousPatterns.some(pattern => pattern.test(userAgent))
  }

  private isSuspiciousRequest(req: Request): boolean {
    // 检查可疑的路径
    const suspiciousPaths = [
      /\.php$/,
      /\.asp$/,
      /admin/i,
      /config/i,
      /wp-/i
    ]
    
    if (suspiciousPaths.some(pattern => pattern.test(req.path))) {
      return true
    }

    // 检查可疑的查询参数
    const suspiciousParams = ['eval', 'exec', 'system', 'shell']
    const queryString = JSON.stringify(req.query).toLowerCase()
    
    return suspiciousParams.some(param => queryString.includes(param))
  }

  private getClientIP(req: Request): string {
    return req.ip || 
           req.get('X-Forwarded-For')?.split(',')[0] || 
           req.get('X-Real-IP') || 
           req.connection.remoteAddress || 
           'unknown'
  }

  private parseSize(sizeStr: string): number {
    const units = { b: 1, kb: 1024, mb: 1024 * 1024, gb: 1024 * 1024 * 1024 }
    const match = sizeStr.toLowerCase().match(/^(\d+)(b|kb|mb|gb)?$/)
    
    if (!match) return 0
    
    const size = parseInt(match[1], 10)
    const unit = match[2] || 'b'
    
    return size * (units[unit as keyof typeof units] || 1)
  }

  private startCleanupJob(): void {
    // 每小时清理一次过期的可疑IP记录
    setInterval(() => {
      const now = Date.now()
      const cleanupInterval = securityConfig.ipSecurity.cleanupInterval
      
      for (const [ip, data] of this.suspiciousIPs.entries()) {
        if (now - data.lastSeen > cleanupInterval) {
          this.suspiciousIPs.delete(ip)
        }
      }
    }, securityConfig.ipSecurity.cleanupInterval)
  }

  /**
   * 公共方法
   */
  addToBlacklist(ip: string): void {
    this.blacklistedIPs.add(ip)
    logInfo('IP manually added to blacklist', { ip })
  }

  removeFromBlacklist(ip: string): void {
    this.blacklistedIPs.delete(ip)
    logInfo('IP removed from blacklist', { ip })
  }

  getSuspiciousIPs(): Array<{ ip: string; count: number; lastSeen: number }> {
    return Array.from(this.suspiciousIPs.entries()).map(([ip, data]) => ({
      ip,
      ...data
    }))
  }

  getBlacklistedIPs(): string[] {
    return Array.from(this.blacklistedIPs)
  }
}

// 导出单例实例
export const securityMiddleware = new SecurityMiddleware()