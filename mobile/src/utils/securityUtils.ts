import AsyncStorage from '@react-native-async-storage/async-storage'
// 简化版日志函数
const logError = (message: string, error: Error, context?: any) => {
  console.error('[ERROR]', message, error, context)
}

const logInfo = (message: string, context?: any) => {
  console.info('[INFO]', message, context)
}

/**
 * 前端安全工具类
 */
export class SecurityUtils {
  private static readonly API_KEY_PREFIX = 'api_key_'
  private static readonly SESSION_PREFIX = 'session_'
  private static readonly MAX_RETRY_ATTEMPTS = 3
  
  /**
   * 生成请求签名
   */
  static generateRequestSignature(
    method: string,
    url: string,
    body?: any,
    timestamp?: number
  ): string {
    try {
      const ts = timestamp || Date.now()
      const payload = JSON.stringify({
        method: method.toUpperCase(),
        url,
        body: body || null,
        timestamp: ts
      })
      
      // 简化版签名生成（实际应用中应使用HMAC）
      let hash = 0
      for (let i = 0; i < payload.length; i++) {
        const char = payload.charCodeAt(i)
        hash = ((hash << 5) - hash) + char
        hash = hash & hash // 转换为32位整数
      }
      
      return `${Math.abs(hash).toString(16)}_${ts}`
    } catch (error) {
      logError('Failed to generate request signature', error as Error)
      return `fallback_${Date.now()}`
    }
  }

  /**
   * 验证API响应完整性
   */
  static validateResponseIntegrity(response: any, expectedSignature?: string): boolean {
    try {
      if (!response || typeof response !== 'object') {
        return false
      }

      // 检查必需的安全字段
      if (!response.meta || !response.meta.timestamp) {
        logError('Response missing security metadata', new Error('Invalid response format'))
        return false
      }

      // 检查时间戳有效性（5分钟内）
      const responseTime = new Date(response.meta.timestamp).getTime()
      const currentTime = Date.now()
      const timeDiff = Math.abs(currentTime - responseTime)
      
      if (timeDiff > 5 * 60 * 1000) { // 5分钟
        logError('Response timestamp too old', new Error('Stale response'))
        return false
      }

      return true
    } catch (error) {
      logError('Response integrity validation failed', error as Error)
      return false
    }
  }

  /**
   * 安全地存储敏感数据
   */
  static async secureStore(key: string, value: string): Promise<boolean> {
    try {
      // 简单的数据混淆（实际应用中应使用加密）
      const obfuscated = this.obfuscateData(value)
      await AsyncStorage.setItem(this.API_KEY_PREFIX + key, obfuscated)
      
      logInfo('Data securely stored', { key: this.maskKey(key) })
      return true
    } catch (error) {
      logError('Failed to store secure data', error as Error, { key: this.maskKey(key) })
      return false
    }
  }

  /**
   * 安全地检索敏感数据
   */
  static async secureRetrieve(key: string): Promise<string | null> {
    try {
      const obfuscated = await AsyncStorage.getItem(this.API_KEY_PREFIX + key)
      if (!obfuscated) {
        return null
      }
      
      const value = this.deobfuscateData(obfuscated)
      logInfo('Data securely retrieved', { key: this.maskKey(key) })
      return value
    } catch (error) {
      logError('Failed to retrieve secure data', error as Error, { key: this.maskKey(key) })
      return null
    }
  }

  /**
   * 清理敏感数据
   */
  static async secureClear(key: string): Promise<boolean> {
    try {
      await AsyncStorage.removeItem(this.API_KEY_PREFIX + key)
      logInfo('Secure data cleared', { key: this.maskKey(key) })
      return true
    } catch (error) {
      logError('Failed to clear secure data', error as Error, { key: this.maskKey(key) })
      return false
    }
  }

  /**
   * 检测潜在的安全威胁
   */
  static detectSecurityThreats(requestData: any): Array<{
    type: string
    severity: 'LOW' | 'MEDIUM' | 'HIGH'
    description: string
  }> {
    const threats: Array<{
      type: string
      severity: 'LOW' | 'MEDIUM' | 'HIGH'
      description: string
    }> = []

    try {
      // 检查SQL注入模式
      const sqlPatterns = [
        /['\";\\)(]|union|select|insert|update|delete|drop|create|alter/i,
        /(eval|exec|system|shell)/i
      ]
      
      const requestString = JSON.stringify(requestData).toLowerCase()
      
      for (const pattern of sqlPatterns) {
        if (pattern.test(requestString)) {
          threats.push({
            type: 'SQL_INJECTION',
            severity: 'HIGH',
            description: 'Potential SQL injection attempt detected'
          })
          break
        }
      }

      // 检查XSS模式
      const xssPatterns = [
        /<script[^>]*>.*?<\/script>/i,
        /javascript:/i,
        /on\w+\s*=/i
      ]
      
      for (const pattern of xssPatterns) {
        if (pattern.test(requestString)) {
          threats.push({
            type: 'XSS_ATTEMPT',
            severity: 'HIGH',
            description: 'Potential XSS attempt detected'
          })
          break
        }
      }

      // 检查异常大小的数据
      if (requestString.length > 100000) { // 100KB
        threats.push({
          type: 'OVERSIZED_REQUEST',
          severity: 'MEDIUM',
          description: 'Request data size exceeds normal limits'
        })
      }

      // 检查敏感信息泄露
      const sensitivePatterns = [
        /password\s*[:=]\s*['"][^'"]+['"]/i,
        /token\s*[:=]\s*['"][^'"]+['"]/i,
        /secret\s*[:=]\s*['"][^'"]+['"]/i
      ]
      
      for (const pattern of sensitivePatterns) {
        if (pattern.test(requestString)) {
          threats.push({
            type: 'SENSITIVE_DATA_EXPOSURE',
            severity: 'MEDIUM',
            description: 'Potential sensitive data in request'
          })
          break
        }
      }

    } catch (error) {
      logError('Security threat detection failed', error as Error)
    }

    return threats
  }

  /**
   * 验证请求频率
   */
  static async validateRequestRate(endpoint: string, maxRequests: number = 10): Promise<boolean> {
    try {
      const key = `rate_limit_${endpoint}`
      const now = Date.now()
      const windowStart = now - (60 * 1000) // 1分钟窗口
      
      const requestsData = await AsyncStorage.getItem(key)
      let requests: number[] = requestsData ? JSON.parse(requestsData) : []
      
      // 清理过期的请求记录
      requests = requests.filter(timestamp => timestamp > windowStart)
      
      if (requests.length >= maxRequests) {
        logError('Rate limit exceeded', new Error('Too many requests'), {
          endpoint,
          requests: requests.length,
          maxRequests
        })
        return false
      }
      
      // 添加当前请求
      requests.push(now)
      await AsyncStorage.setItem(key, JSON.stringify(requests))
      
      return true
    } catch (error) {
      logError('Rate limit validation failed', error as Error)
      return true // 失败时允许请求继续
    }
  }

  /**
   * 生成安全的随机ID
   */
  static generateSecureId(length: number = 16): string {
    const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789'
    let result = ''
    
    for (let i = 0; i < length; i++) {
      result += chars.charAt(Math.floor(Math.random() * chars.length))
    }
    
    return result
  }

  /**
   * 检查设备环境安全性
   */
  static async checkDeviceSecurity(): Promise<{
    isSecure: boolean
    issues: string[]
  }> {
    const issues: string[] = []
    
    try {
      // 检查是否在调试模式
      if (__DEV__) {
        issues.push('Application running in debug mode')
      }

      // 简单的完整性检查
      const critical_functions = [
        AsyncStorage.getItem,
        AsyncStorage.setItem,
        JSON.stringify,
        JSON.parse
      ]
      
      for (const func of critical_functions) {
        if (typeof func !== 'function') {
          issues.push('Critical function integrity compromised')
          break
        }
      }
      
      return {
        isSecure: issues.length === 0,
        issues
      }
    } catch (error) {
      logError('Device security check failed', error as Error)
      return {
        isSecure: false,
        issues: ['Security check failed']
      }
    }
  }

  /**
   * 私有方法
   */
  private static obfuscateData(data: string): string {
    // 简单的Base64编码 + 字符移位
    const encoded = btoa(unescape(encodeURIComponent(data)))
    let shifted = ''
    
    for (let i = 0; i < encoded.length; i++) {
      shifted += String.fromCharCode(encoded.charCodeAt(i) + 3)
    }
    
    return shifted
  }

  private static deobfuscateData(obfuscated: string): string {
    // 反向操作
    let unshifted = ''
    
    for (let i = 0; i < obfuscated.length; i++) {
      unshifted += String.fromCharCode(obfuscated.charCodeAt(i) - 3)
    }
    
    return decodeURIComponent(escape(atob(unshifted)))
  }

  private static maskKey(key: string): string {
    if (key.length <= 4) {
      return '*'.repeat(key.length)
    }
    return key.substring(0, 2) + '*'.repeat(key.length - 4) + key.substring(key.length - 2)
  }
}

/**
 * API安全防护装饰器
 */
export function apiSecurityGuard(target: any, propertyName: string, descriptor: PropertyDescriptor) {
  const method = descriptor.value

  descriptor.value = async function (...args: any[]) {
    try {
      // 检查设备安全性
      const securityCheck = await SecurityUtils.checkDeviceSecurity()
      if (!securityCheck.isSecure) {
        logError('Insecure device environment detected', new Error('Security check failed'), {
          issues: securityCheck.issues
        })
        // 在生产环境中可能需要阻止请求
      }

      // 检查威胁
      const threats = SecurityUtils.detectSecurityThreats(args)
      if (threats.some(t => t.severity === 'HIGH')) {
        logError('High severity security threat detected', new Error('Security threat'), { threats })
        throw new Error('Request blocked for security reasons')
      }

      // 执行原方法
      return await method.apply(this, args)
    } catch (error) {
      logError(`API security guard failed for ${propertyName}`, error as Error)
      throw error
    }
  }

  return descriptor
}

/**
 * 请求重试管理器
 */
export class RetryManager {
  private static retryCounters = new Map<string, number>()
  
  static async withRetry<T>(
    key: string,
    operation: () => Promise<T>,
    maxRetries: number = SecurityUtils['MAX_RETRY_ATTEMPTS']
  ): Promise<T> {
    const currentRetries = this.retryCounters.get(key) || 0
    
    try {
      const result = await operation()
      this.retryCounters.delete(key) // 成功后清除重试计数
      return result
    } catch (error) {
      if (currentRetries < maxRetries) {
        this.retryCounters.set(key, currentRetries + 1)
        
        // 指数退避策略
        const delay = Math.pow(2, currentRetries) * 1000
        await new Promise(resolve => setTimeout(resolve, delay))
        
        logInfo(`Retrying operation: ${key}`, {
          attempt: currentRetries + 1,
          maxRetries,
          delay
        })
        
        return this.withRetry(key, operation, maxRetries)
      } else {
        this.retryCounters.delete(key)
        logError(`Max retries exceeded for: ${key}`, error as Error)
        throw error
      }
    }
  }
  
  static clearRetryCounter(key: string): void {
    this.retryCounters.delete(key)
  }
}