import crypto from 'crypto'
import { logError, logInfo } from './logger'

/**
 * 加密配置接口
 */
interface EncryptionConfig {
  algorithm: string
  keyLength: number
  ivLength: number
  saltLength: number
  iterations: number
  hashAlgorithm: string
}

/**
 * 默认加密配置
 */
const defaultConfig: EncryptionConfig = {
  algorithm: 'aes-256-gcm',
  keyLength: 32,
  ivLength: 16,
  saltLength: 16,
  iterations: 100000,
  hashAlgorithm: 'sha256'
}

/**
 * 加密工具类
 */
export class EncryptionService {
  private config: EncryptionConfig
  private masterKey: string

  constructor(masterKey: string, config: Partial<EncryptionConfig> = {}) {
    this.config = { ...defaultConfig, ...config }
    this.masterKey = masterKey
  }

  /**
   * 加密敏感数据
   */
  encrypt(plaintext: string, associatedData?: string): {
    encrypted: string
    iv: string
    authTag: string
    salt: string
  } {
    try {
      // 生成随机盐和IV
      const salt = crypto.randomBytes(this.config.saltLength)
      const iv = crypto.randomBytes(this.config.ivLength)
      
      // 派生密钥
      const key = crypto.pbkdf2Sync(
        this.masterKey,
        salt,
        this.config.iterations,
        this.config.keyLength,
        this.config.hashAlgorithm
      )

      // 创建加密器
      const cipher = crypto.createCipher(this.config.algorithm, key) as any
      
      // 设置关联数据（用于身份验证）
      if (associatedData) {
        cipher.setAAD(Buffer.from(associatedData, 'utf8'))
      }

      // 加密数据
      let encrypted = cipher.update(plaintext, 'utf8', 'hex')
      encrypted += cipher.final('hex')
      
      // 获取认证标签
      const authTag = cipher.getAuthTag()

      return {
        encrypted,
        iv: iv.toString('hex'),
        authTag: authTag.toString('hex'),
        salt: salt.toString('hex')
      }
    } catch (error) {
      logError('Encryption failed', error as Error, { dataLength: plaintext.length })
      throw new Error('加密失败')
    }
  }

  /**
   * 解密敏感数据
   */
  decrypt(
    encryptedData: string,
    iv: string,
    authTag: string,
    salt: string,
    associatedData?: string
  ): string {
    try {
      // 派生密钥
      const key = crypto.pbkdf2Sync(
        this.masterKey,
        Buffer.from(salt, 'hex'),
        this.config.iterations,
        this.config.keyLength,
        this.config.hashAlgorithm
      )

      // 创建解密器
      const decipher = crypto.createDecipher(this.config.algorithm, key) as any
      decipher.setAuthTag(Buffer.from(authTag, 'hex'))
      
      // 设置关联数据
      if (associatedData) {
        decipher.setAAD(Buffer.from(associatedData, 'utf8'))
      }

      // 解密数据
      let decrypted = decipher.update(encryptedData, 'hex', 'utf8')
      decrypted += decipher.final('utf8')

      return decrypted
    } catch (error) {
      logError('Decryption failed', error as Error)
      throw new Error('解密失败')
    }
  }

  /**
   * 生成安全哈希
   */
  hash(data: string, salt?: string): { hash: string; salt: string } {
    try {
      const saltBuffer = salt ? Buffer.from(salt, 'hex') : crypto.randomBytes(this.config.saltLength)
      
      const hash = crypto.pbkdf2Sync(
        data,
        saltBuffer,
        this.config.iterations,
        this.config.keyLength,
        this.config.hashAlgorithm
      )

      return {
        hash: hash.toString('hex'),
        salt: saltBuffer.toString('hex')
      }
    } catch (error) {
      logError('Hashing failed', error as Error)
      throw new Error('哈希生成失败')
    }
  }

  /**
   * 验证哈希
   */
  verifyHash(data: string, hash: string, salt: string): boolean {
    try {
      const { hash: computedHash } = this.hash(data, salt)
      return this.secureCompare(hash, computedHash)
    } catch (error) {
      logError('Hash verification failed', error as Error)
      return false
    }
  }

  /**
   * 生成随机令牌
   */
  generateToken(length: number = 32): string {
    return crypto.randomBytes(length).toString('hex')
  }

  /**
   * 生成安全随机数
   */
  generateSecureRandom(min: number, max: number): number {
    const range = max - min + 1
    const bytesNeeded = Math.ceil(Math.log2(range) / 8)
    const maxValue = Math.pow(256, bytesNeeded)
    const threshold = maxValue - (maxValue % range)

    let randomValue: number
    do {
      const randomBytes = crypto.randomBytes(bytesNeeded)
      randomValue = randomBytes.readUIntBE(0, bytesNeeded)
    } while (randomValue >= threshold)

    return min + (randomValue % range)
  }

  /**
   * 加密文件名
   */
  encryptFilename(filename: string): string {
    try {
      const { encrypted, iv, authTag, salt } = this.encrypt(filename)
      return `${encrypted}.${iv}.${authTag}.${salt}`
    } catch (error) {
      logError('Filename encryption failed', error as Error, { filename })
      throw new Error('文件名加密失败')
    }
  }

  /**
   * 解密文件名
   */
  decryptFilename(encryptedFilename: string): string {
    try {
      const parts = encryptedFilename.split('.')
      if (parts.length < 4) {
        throw new Error('无效的加密文件名格式')
      }

      const encrypted = parts[0]
      const iv = parts[1]
      const authTag = parts[2]
      const salt = parts[3]

      return this.decrypt(encrypted, iv, authTag, salt)
    } catch (error) {
      logError('Filename decryption failed', error as Error, { encryptedFilename })
      throw new Error('文件名解密失败')
    }
  }

  /**
   * 生成API密钥
   */
  generateApiKey(): { key: string; secret: string } {
    const key = 'ak_' + this.generateToken(16)
    const secret = 'sk_' + this.generateToken(32)
    
    return { key, secret }
  }

  /**
   * 生成JWT密钥
   */
  generateJwtKey(): string {
    return crypto.randomBytes(64).toString('hex')
  }

  /**
   * 安全比较两个字符串
   */
  private secureCompare(a: string, b: string): boolean {
    if (a.length !== b.length) {
      return false
    }

    let result = 0
    for (let i = 0; i < a.length; i++) {
      result |= a.charCodeAt(i) ^ b.charCodeAt(i)
    }

    return result === 0
  }
}

/**
 * 敏感数据脱敏工具
 */
export class DataMasking {
  /**
   * 脱敏手机号
   */
  static maskPhone(phone: string): string {
    if (!phone || phone.length < 7) return phone
    return phone.replace(/(\d{3})\d{4}(\d{4})/, '$1****$2')
  }

  /**
   * 脱敏邮箱
   */
  static maskEmail(email: string): string {
    if (!email || !email.includes('@')) return email
    const [username, domain] = email.split('@')
    if (username.length <= 2) return email
    return `${username.charAt(0)}***${username.charAt(username.length - 1)}@${domain}`
  }

  /**
   * 脱敏身份证号
   */
  static maskIdCard(idCard: string): string {
    if (!idCard || idCard.length < 8) return idCard
    return idCard.replace(/(\d{6})\d{8}(\d{4})/, '$1********$2')
  }

  /**
   * 脱敏银行卡号
   */
  static maskBankCard(cardNumber: string): string {
    if (!cardNumber || cardNumber.length < 8) return cardNumber
    return cardNumber.replace(/(\d{4})\d+(\d{4})/, '$1****$2')
  }

  /**
   * 脱敏用户名
   */
  static maskUsername(username: string): string {
    if (!username || username.length <= 2) return username
    if (username.length <= 4) {
      return username.charAt(0) + '*'.repeat(username.length - 2) + username.charAt(username.length - 1)
    }
    return username.substring(0, 2) + '*'.repeat(username.length - 4) + username.substring(username.length - 2)
  }

  /**
   * 脱敏IP地址
   */
  static maskIP(ip: string): string {
    if (!ip) return ip
    const parts = ip.split('.')
    if (parts.length === 4) {
      return `${parts[0]}.${parts[1]}.***.***.`
    }
    return ip
  }

  /**
   * 通用脱敏
   */
  static maskSensitiveData(data: any): any {
    if (typeof data !== 'object' || data === null) {
      return data
    }

    if (Array.isArray(data)) {
      return data.map(item => this.maskSensitiveData(item))
    }

    const masked: any = {}
    const sensitiveFields = [
      'password', 'token', 'secret', 'key', 'phone', 'email', 
      'idCard', 'bankCard', 'creditCard', 'ssn'
    ]

    for (const [key, value] of Object.entries(data)) {
      const lowerKey = key.toLowerCase()
      
      if (sensitiveFields.some(field => lowerKey.includes(field))) {
        if (typeof value === 'string') {
          if (lowerKey.includes('phone')) {
            masked[key] = this.maskPhone(value)
          } else if (lowerKey.includes('email')) {
            masked[key] = this.maskEmail(value)
          } else if (lowerKey.includes('card')) {
            masked[key] = this.maskBankCard(value)
          } else {
            masked[key] = '***MASKED***'
          }
        } else {
          masked[key] = '***MASKED***'
        }
      } else {
        masked[key] = this.maskSensitiveData(value)
      }
    }

    return masked
  }
}

/**
 * 安全随机数生成器
 */
export class SecureRandom {
  /**
   * 生成安全的随机字符串
   */
  static generateString(length: number, charset: string = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789'): string {
    let result = ''
    const charsetLength = charset.length
    
    for (let i = 0; i < length; i++) {
      const randomIndex = crypto.randomInt(0, charsetLength)
      result += charset[randomIndex]
    }
    
    return result
  }

  /**
   * 生成安全的随机数字字符串
   */
  static generateNumericString(length: number): string {
    return this.generateString(length, '0123456789')
  }

  /**
   * 生成安全的随机字母字符串
   */
  static generateAlphabeticString(length: number): string {
    return this.generateString(length, 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz')
  }

  /**
   * 生成UUID v4
   */
  static generateUUID(): string {
    return crypto.randomUUID()
  }
}

// 导出实例
export const encryptionService = new EncryptionService(
  process.env.ENCRYPTION_KEY || 'default-key-change-in-production'
)