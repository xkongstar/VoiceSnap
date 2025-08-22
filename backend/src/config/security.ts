import dotenv from 'dotenv'

// 加载环境变量
dotenv.config()

/**
 * 安全配置常量
 */
export const SecurityConfig = {
  // 加密配置
  encryption: {
    algorithm: 'aes-256-gcm',
    keyLength: 32,
    ivLength: 16,
    saltLength: 16,
    iterations: 100000,
    masterKey: process.env.ENCRYPTION_MASTER_KEY || 'change-this-in-production-environment'
  },

  // JWT配置
  jwt: {
    accessTokenExpiry: '15m',
    refreshTokenExpiry: '7d',
    accessTokenSecret: process.env.JWT_ACCESS_SECRET || 'jwt-access-secret-change-in-production',
    refreshTokenSecret: process.env.JWT_REFRESH_SECRET || 'jwt-refresh-secret-change-in-production',
    issuer: 'VoiceSnap-API',
    audience: 'VoiceSnap-Client'
  },

  // 速率限制配置
  rateLimits: {
    general: {
      windowMs: 15 * 60 * 1000, // 15分钟
      max: 100 // 每个IP 15分钟内最多100次请求
    },
    authentication: {
      windowMs: 15 * 60 * 1000, // 15分钟
      max: 5 // 每个IP 15分钟内最多5次登录尝试
    },
    upload: {
      windowMs: 60 * 1000, // 1分钟
      max: 10 // 每个IP 1分钟内最多10次上传
    },
    api: {
      windowMs: 15 * 60 * 1000, // 15分钟
      max: 1000 // 每个IP 15分钟内最多1000次API调用
    }
  },

  // 请求减速配置
  slowDown: {
    windowMs: 15 * 60 * 1000, // 15分钟
    delayAfter: 50, // 50次请求后开始延迟
    delayMs: 500, // 每次增加500ms延迟
    maxDelayMs: 10000 // 最大延迟10秒
  },

  // CORS配置
  cors: {
    allowedOrigins: [
      'http://localhost:3000',
      'https://voicesnap.com',
      'https://www.voicesnap.com',
      ...(process.env.ADDITIONAL_CORS_ORIGINS?.split(',') || [])
    ],
    credentials: true,
    methods: ['GET', 'POST', 'PUT', 'DELETE', 'PATCH', 'OPTIONS'],
    allowedHeaders: [
      'Origin',
      'X-Requested-With',
      'Content-Type',
      'Accept',
      'Authorization',
      'X-Request-ID',
      'X-API-Key'
    ],
    exposedHeaders: ['X-Request-ID', 'X-RateLimit-Limit', 'X-RateLimit-Remaining'],
    maxAge: 86400 // 24小时
  },

  // 文件上传安全配置
  fileUpload: {
    maxFileSize: 50 * 1024 * 1024, // 50MB
    allowedMimeTypes: [
      'audio/wav',
      'audio/mpeg',
      'audio/mp4',
      'audio/aac',
      'audio/ogg',
      'audio/webm'
    ],
    allowedExtensions: ['.wav', '.mp3', '.mp4', '.aac', '.ogg', '.webm'],
    maxFiles: 1,
    preservePath: false,
    safeFileNames: true
  },

  // 请求安全配置
  request: {
    maxRequestSize: '10mb',
    maxParameterLength: 1000,
    maxHeaderSize: 8192,
    maxUrlLength: 2048
  },

  // 会话安全配置
  session: {
    maxAge: 24 * 60 * 60 * 1000, // 24小时
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'strict' as const,
    name: 'voicesnap_session'
  },

  // 密码策略
  password: {
    minLength: 8,
    maxLength: 128,
    requireUppercase: true,
    requireLowercase: true,
    requireNumbers: true,
    requireSpecialChars: true,
    maxRetries: 5,
    lockoutDuration: 15 * 60 * 1000 // 15分钟
  },

  // IP安全配置
  ipSecurity: {
    whitelistedIPs: [
      '127.0.0.1',
      '::1',
      'localhost',
      ...(process.env.WHITELISTED_IPS?.split(',') || [])
    ],
    maxSuspiciousActivity: 50,
    blacklistDuration: 24 * 60 * 60 * 1000, // 24小时
    cleanupInterval: 60 * 60 * 1000 // 1小时清理一次
  },

  // 安全头部配置
  headers: {
    contentSecurityPolicy: {
      defaultSrc: ["'self'"],
      scriptSrc: ["'self'", "'unsafe-inline'"],
      styleSrc: ["'self'", "'unsafe-inline'"],
      imgSrc: ["'self'", 'data:', 'https:'],
      connectSrc: ["'self'", 'https:'],
      fontSrc: ["'self'"],
      objectSrc: ["'none'"],
      mediaSrc: ["'self'"],
      frameSrc: ["'none'"]
    },
    hsts: {
      maxAge: 31536000, // 1年
      includeSubDomains: true,
      preload: true
    },
    permissions: {
      camera: '()',
      microphone: '()',
      geolocation: '()',
      notifications: '()',
      payment: '()'
    }
  },

  // 审计配置
  audit: {
    enableRequestLogging: true,
    enableErrorLogging: true,
    enableSecurityEventLogging: true,
    logSensitiveData: process.env.NODE_ENV === 'development',
    maxLogSize: '100mb',
    logRetentionDays: 30
  },

  // 监控配置
  monitoring: {
    enablePerformanceMetrics: true,
    enableHealthChecks: true,
    healthCheckInterval: 30 * 1000, // 30秒
    alertThresholds: {
      responseTime: 5000, // 5秒
      errorRate: 0.05, // 5%
      memoryUsage: 0.85 // 85%
    }
  },

  // API安全配置
  api: {
    enableApiKeyAuth: false,
    apiKeyHeader: 'X-API-Key',
    enableRequestSigning: false,
    signatureHeader: 'X-Signature',
    timestampTolerance: 5 * 60 * 1000, // 5分钟
    enableVersioning: true,
    defaultVersion: 'v2',
    deprecationWarnings: true
  },

  // 开发环境配置
  development: {
    enableDebugMode: process.env.NODE_ENV === 'development',
    enableSwagger: process.env.NODE_ENV === 'development',
    disableRateLimit: process.env.DISABLE_RATE_LIMIT === 'true',
    allowInsecureConnections: process.env.NODE_ENV === 'development'
  }
} as const

/**
 * 环境特定的安全配置
 */
export const getEnvironmentConfig = () => {
  const env = process.env.NODE_ENV || 'development'
  
  const baseConfig = { ...SecurityConfig }
  
  switch (env) {
    case 'production':
      return {
        ...baseConfig,
        session: {
          ...baseConfig.session,
          secure: true
        },
        headers: {
          ...baseConfig.headers,
          hsts: {
            ...baseConfig.headers.hsts,
            maxAge: 63072000 // 2年
          }
        },
        audit: {
          ...baseConfig.audit,
          logSensitiveData: false
        },
        development: {
          ...baseConfig.development,
          enableDebugMode: false,
          enableSwagger: false,
          disableRateLimit: false,
          allowInsecureConnections: false
        }
      }
    
    case 'staging':
      return {
        ...baseConfig,
        rateLimits: {
          ...baseConfig.rateLimits,
          general: { ...baseConfig.rateLimits.general, max: 200 },
          api: { ...baseConfig.rateLimits.api, max: 2000 }
        }
      }
    
    case 'test':
      return {
        ...baseConfig,
        rateLimits: {
          general: { windowMs: 1000, max: 1000 },
          authentication: { windowMs: 1000, max: 100 },
          upload: { windowMs: 1000, max: 100 },
          api: { windowMs: 1000, max: 1000 }
        },
        development: {
          ...baseConfig.development,
          disableRateLimit: true
        }
      }
    
    default: // development
      return baseConfig
  }
}

/**
 * 验证配置的完整性
 */
export const validateSecurityConfig = () => {
  const config = getEnvironmentConfig()
  const issues: string[] = []
  
  // 检查关键配置
  if (config.encryption.masterKey === 'change-this-in-production-environment' && process.env.NODE_ENV === 'production') {
    issues.push('Encryption master key must be changed in production')
  }
  
  if (config.jwt.accessTokenSecret.includes('change-in-production') && process.env.NODE_ENV === 'production') {
    issues.push('JWT secrets must be changed in production')
  }
  
  if (config.cors.allowedOrigins.includes('*') && process.env.NODE_ENV === 'production') {
    issues.push('CORS wildcard origins should not be used in production')
  }
  
  // 检查文件大小限制
  if (config.fileUpload.maxFileSize > 100 * 1024 * 1024) { // 100MB
    issues.push('File upload size limit seems too high')
  }
  
  return {
    isValid: issues.length === 0,
    issues
  }
}

// 导出配置实例
export const securityConfig = getEnvironmentConfig()

// 在启动时验证配置
const validation = validateSecurityConfig()
if (!validation.isValid) {
  console.warn('Security configuration issues detected:')
  validation.issues.forEach(issue => console.warn(`- ${issue}`))
}