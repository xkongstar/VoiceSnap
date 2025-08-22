import { Request, Response, NextFunction } from 'express'
import { createError } from './errorHandler'
import { logWarning } from '../utils/logger'

// 简化版本的验证类型定义
export interface ValidationError {
  field: string
  message: string
  value?: any
}

// 基础验证函数
const isValidEmail = (email: string): boolean => {
  const emailRegex = /^\w+([.-]?\w+)*@\w+([.-]?\w+)*(\.\w{2,3})+$/
  return emailRegex.test(email)
}

const isValidObjectId = (id: string): boolean => {
  const objectIdRegex = /^[0-9a-fA-F]{24}$/
  return objectIdRegex.test(id)
}

const isValidPassword = (password: string): boolean => {
  return password.length >= 6 && /^(?=.*[a-zA-Z])(?=.*\d)/.test(password)
}

const isValidUsername = (username: string): boolean => {
  return username.length >= 3 && username.length <= 50 && /^[a-zA-Z0-9_\u4e00-\u9fa5]+$/.test(username)
}

/**
 * 通用验证错误处理
 */
const handleValidationError = (errors: ValidationError[], req: Request, next: NextFunction) => {
  if (errors.length > 0) {
    logWarning('请求验证失败', {
      url: req.originalUrl,
      method: req.method,
      errors,
      ip: req.ip,
      userAgent: req.get('User-Agent')
    })

    const error = createError('输入验证失败', 400)
    ;(error as any).details = errors
    return next(error)
  }
}

/**
 * 认证相关验证
 */
export const validateRegister = (req: Request, res: Response, next: NextFunction) => {
  const errors: ValidationError[] = []
  const { username, password, email } = req.body

  if (!username || typeof username !== 'string') {
    errors.push({ field: 'username', message: '用户名不能为空' })
  } else if (!isValidUsername(username.trim())) {
    errors.push({ field: 'username', message: '用户名格式无效，长度3-50字符，只能包含字母数字下划线和中文' })
  }

  if (!password || typeof password !== 'string') {
    errors.push({ field: 'password', message: '密码不能为空' })
  } else if (!isValidPassword(password)) {
    errors.push({ field: 'password', message: '密码必须至少6个字符，包含字母和数字' })
  }

  if (email && typeof email === 'string' && !isValidEmail(email)) {
    errors.push({ field: 'email', message: '邮箱格式无效' })
  }

  if (errors.length > 0) {
    return handleValidationError(errors, req, next)
  }

  next()
}

export const validateLogin = (req: Request, res: Response, next: NextFunction) => {
  const errors: ValidationError[] = []
  const { username, password } = req.body

  if (!username || typeof username !== 'string' || username.trim().length === 0) {
    errors.push({ field: 'username', message: '用户名不能为空' })
  }

  if (!password || typeof password !== 'string' || password.length === 0) {
    errors.push({ field: 'password', message: '密码不能为空' })
  }

  if (errors.length > 0) {
    return handleValidationError(errors, req, next)
  }

  next()
}

export const validateRefreshToken = (req: Request, res: Response, next: NextFunction) => {
  const errors: ValidationError[] = []
  const { refreshToken } = req.body

  if (!refreshToken || typeof refreshToken !== 'string' || refreshToken.trim().length === 0) {
    errors.push({ field: 'refreshToken', message: '刷新令牌不能为空' })
  }

  if (errors.length > 0) {
    return handleValidationError(errors, req, next)
  }

  next()
}

/**
 * 录音相关验证
 */
export const validateRecordingUpload = (req: Request, res: Response, next: NextFunction) => {
  const errors: ValidationError[] = []
  const { task_id, original_text, dialect_transcription, duration_seconds } = req.body

  if (!task_id || !isValidObjectId(task_id)) {
    errors.push({ field: 'task_id', message: '无效的任务ID格式' })
  }

  if (!original_text || typeof original_text !== 'string' || original_text.trim().length === 0) {
    errors.push({ field: 'original_text', message: '原文本不能为空' })
  } else if (original_text.length > 1000) {
    errors.push({ field: 'original_text', message: '原文本长度不能超过1000个字符' })
  }

  if (!dialect_transcription || typeof dialect_transcription !== 'string' || dialect_transcription.trim().length === 0) {
    errors.push({ field: 'dialect_transcription', message: '方言转录不能为空' })
  } else if (dialect_transcription.length > 1000) {
    errors.push({ field: 'dialect_transcription', message: '方言转录长度不能超过1000个字符' })
  }

  if (duration_seconds !== undefined) {
    const duration = parseFloat(duration_seconds)
    if (isNaN(duration) || duration <= 0 || duration > 600) {
      errors.push({ field: 'duration_seconds', message: '录音时长必须在0.1-600秒之间' })
    }
  }

  if (errors.length > 0) {
    return handleValidationError(errors, req, next)
  }

  next()
}

/**
 * 文件上传验证
 */
export const validateFileUpload = (req: Request, res: Response, next: NextFunction) => {
  if (!req.file) {
    return next(createError('音频文件必填', 400))
  }

  const file = req.file
  
  // 验证文件类型
  const allowedMimeTypes = [
    'audio/wav',
    'audio/mpeg',
    'audio/mp4',
    'audio/aac',
    'audio/x-m4a',
    'audio/ogg',
    'audio/webm'
  ]
  
  if (!allowedMimeTypes.includes(file.mimetype)) {
    return next(createError(`不支持的文件类型: ${file.mimetype}`, 400))
  }
  
  // 验证文件大小 (100MB)
  const maxSize = 100 * 1024 * 1024
  if (file.size > maxSize) {
    return next(createError(`文件过大: ${file.size} bytes (最大: ${maxSize} bytes)`, 400))
  }
  
  next()
}

/**
 * 简化版速率限制
 */
interface RateLimitStore {
  [key: string]: {
    count: number
    resetTime: number
  }
}

const rateLimitStore: RateLimitStore = {}

export const createRateLimit = (windowMs: number, max: number, message: string) => {
  return (req: Request, res: Response, next: NextFunction) => {
    const key = req.ip || 'unknown'
    const now = Date.now()
    
    if (!rateLimitStore[key] || now > rateLimitStore[key].resetTime) {
      rateLimitStore[key] = {
        count: 1,
        resetTime: now + windowMs
      }
    } else {
      rateLimitStore[key].count++
    }
    
    if (rateLimitStore[key].count > max) {
      logWarning('速率限制触发', {
        ip: req.ip,
        url: req.originalUrl,
        method: req.method,
        userAgent: req.get('User-Agent')
      })
      
      return res.status(429).json({
        error: { message }
      })
    }
    
    next()
  }
}

// 预定义的速率限制
export const authRateLimit = createRateLimit(
  15 * 60 * 1000, // 15分钟
  10, // 最多10次尝试
  '登录尝试过于频繁，请稍后再试'
)

export const uploadRateLimit = createRateLimit(
  60 * 1000, // 1分钟
  5, // 最多5次上传
  '上传过于频繁，请稍后再试'
)

export const apiRateLimit = createRateLimit(
  15 * 60 * 1000, // 15分钟
  100, // 最多100次请求
  'API请求过于频繁，请稍后再试'
)

/**
 * 处理验证错误（保持兼容性）
 */
export const handleValidationErrors = (req: Request, res: Response, next: NextFunction) => {
  // 这个函数在简化版本中主要用于兼容性，实际验证在各个具体函数中处理
  next()
}

/**
 * 安全头部中间件
 */
export const securityHeaders = (req: Request, res: Response, next: NextFunction) => {
  // 防止点击劫持
  res.setHeader('X-Frame-Options', 'DENY')
  
  // 防止MIME类型嗅探
  res.setHeader('X-Content-Type-Options', 'nosniff')
  
  // XSS保护
  res.setHeader('X-XSS-Protection', '1; mode=block')
  
  // 强制HTTPS
  if (process.env.NODE_ENV === 'production') {
    res.setHeader('Strict-Transport-Security', 'max-age=31536000; includeSubDomains')
  }
  
  next()
}

// 占位符函数，保持兼容性
export const validateRecordingUpdate = (req: Request, res: Response, next: NextFunction) => next()
export const validateRecordingId = (req: Request, res: Response, next: NextFunction) => next()
export const validateBatchOperation = (req: Request, res: Response, next: NextFunction) => next()