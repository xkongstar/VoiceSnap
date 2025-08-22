import axios, { type AxiosInstance, type AxiosError, type AxiosRequestConfig } from "axios"
import { useAuthStore } from "../store/optimizedStore"
import AsyncStorage from "@react-native-async-storage/async-storage"

// API缓存接口
interface CacheItem<T> {
  data: T
  timestamp: number
  ttl: number // 生存时间（毫秒）
}

// API响应包装器
interface ApiResponse<T> {
  success: boolean
  data: T
  message?: string
  cached?: boolean
}

// 请求配置扩展
interface ExtendedAxiosConfig extends AxiosRequestConfig {
  useCache?: boolean
  cacheKey?: string
  cacheTTL?: number
  retryCount?: number
  retryDelay?: number
  skipAuth?: boolean
}

const API_BASE_URL = __DEV__ 
  ? "https://gsfjlp-uzgwep-3000.app.cloudstudio.work/api" 
  : "https://gsfjlp-uzgwep-3000.app.cloudstudio.work/api"

class ApiService {
  private api: AxiosInstance
  private cache: Map<string, CacheItem<any>> = new Map()
  private requestQueue: Map<string, Promise<any>> = new Map()
  private isRefreshingToken = false
  private refreshPromise: Promise<void> | null = null

  constructor() {
    this.api = axios.create({
      baseURL: API_BASE_URL,
      timeout: 30000,
      headers: {
        "Content-Type": "application/json",
      },
    })

    this.setupInterceptors()
    this.loadCacheFromStorage()
  }

  private setupInterceptors() {
    // 请求拦截器
    this.api.interceptors.request.use(
      (config) => {
        const extConfig = config as ExtendedAxiosConfig
        
        // 添加认证令牌
        if (!extConfig.skipAuth) {
          const token = useAuthStore.getState().token
          if (token) {
            config.headers.Authorization = `Bearer ${token}`
          }
        }

        return config
      },
      (error) => Promise.reject(error)
    )

    // 响应拦截器
    this.api.interceptors.response.use(
      (response) => response,
      async (error: AxiosError) => {
        const originalRequest = error.config as ExtendedAxiosConfig

        // 处理401错误 - 令牌过期
        if (error.response?.status === 401 && !originalRequest._retry) {
          originalRequest._retry = true

          // 避免多个请求同时刷新令牌
          if (!this.isRefreshingToken) {
            this.isRefreshingToken = true
            this.refreshPromise = this.refreshTokens()
          }

          try {
            await this.refreshPromise
            
            // 重新发送原始请求
            const token = useAuthStore.getState().token
            if (token && originalRequest.headers) {
              originalRequest.headers.Authorization = `Bearer ${token}`
            }
            
            return this.api(originalRequest)
          } catch (refreshError) {
            // 刷新失败，重定向到登录
            useAuthStore.getState().logout()
            return Promise.reject(refreshError)
          } finally {
            this.isRefreshingToken = false
            this.refreshPromise = null
          }
        }

        return Promise.reject(error)
      }
    )
  }

  private async refreshTokens(): Promise<void> {
    const { refreshToken } = useAuthStore.getState()
    
    if (!refreshToken) {
      throw new Error('No refresh token available')
    }

    try {
      const response = await this.api.post('/auth/refresh', {
        refreshToken
      }, { skipAuth: true } as ExtendedAxiosConfig)

      const { accessToken } = response.data
      useAuthStore.getState().setTokens(accessToken)
    } catch (error) {
      throw new Error('Failed to refresh token')
    }
  }

  private async loadCacheFromStorage() {
    try {
      const cacheData = await AsyncStorage.getItem('api-cache')
      if (cacheData) {
        const parsedCache = JSON.parse(cacheData)
        const now = Date.now()
        
        // 过滤过期的缓存项
        Object.entries(parsedCache).forEach(([key, item]: [string, any]) => {
          if (now - item.timestamp < item.ttl) {
            this.cache.set(key, item)
          }
        })
      }
    } catch (error) {
      console.warn('Failed to load API cache from storage:', error)
    }
  }

  private async saveCacheToStorage() {
    try {
      const cacheObject = Object.fromEntries(this.cache)
      await AsyncStorage.setItem('api-cache', JSON.stringify(cacheObject))
    } catch (error) {
      console.warn('Failed to save API cache to storage:', error)
    }
  }

  private getCacheKey(url: string, config?: AxiosRequestConfig): string {
    const method = config?.method || 'GET'
    const params = config?.params ? JSON.stringify(config.params) : ''
    return `${method}:${url}:${params}`
  }

  private isValidCache<T>(item: CacheItem<T>): boolean {
    return Date.now() - item.timestamp < item.ttl
  }

  private async request<T>(config: ExtendedAxiosConfig): Promise<ApiResponse<T>> {
    const {
      useCache = false,
      cacheKey,
      cacheTTL = 5 * 60 * 1000, // 默认5分钟
      retryCount = 3,
      retryDelay = 1000,
      ...axiosConfig
    } = config

    const finalCacheKey = cacheKey || this.getCacheKey(axiosConfig.url || '', axiosConfig)

    // 检查缓存
    if (useCache && this.cache.has(finalCacheKey)) {
      const cached = this.cache.get(finalCacheKey)!
      if (this.isValidCache(cached)) {
        return {
          success: true,
          data: cached.data,
          cached: true
        }
      }
    }

    // 防止重复请求
    if (this.requestQueue.has(finalCacheKey)) {
      return this.requestQueue.get(finalCacheKey)!
    }

    // 发起请求
    const requestPromise = this.executeRequest<T>(axiosConfig, retryCount, retryDelay)
    this.requestQueue.set(finalCacheKey, requestPromise)

    try {
      const response = await requestPromise
      
      // 缓存响应
      if (useCache && response.success) {
        this.cache.set(finalCacheKey, {
          data: response.data,
          timestamp: Date.now(),
          ttl: cacheTTL
        })
        this.saveCacheToStorage()
      }

      return response
    } finally {
      this.requestQueue.delete(finalCacheKey)
    }
  }

  private async executeRequest<T>(
    config: AxiosRequestConfig,
    retryCount: number,
    retryDelay: number,
    attempt: number = 1
  ): Promise<ApiResponse<T>> {
    try {
      const response = await this.api(config)
      return {
        success: true,
        data: response.data
      }
    } catch (error: any) {
      if (attempt < retryCount && this.shouldRetry(error)) {
        await new Promise(resolve => setTimeout(resolve, retryDelay * attempt))
        return this.executeRequest(config, retryCount, retryDelay, attempt + 1)
      }
      
      throw {
        success: false,
        data: null,
        message: error.response?.data?.error?.message || error.message || '请求失败'
      }
    }
  }

  private shouldRetry(error: AxiosError): boolean {
    // 仅对网络错误或5xx错误重试
    return (
      !error.response ||
      error.response.status >= 500 ||
      error.code === 'NETWORK_ERROR' ||
      error.code === 'TIMEOUT'
    )
  }

  // 认证相关API
  async login(username: string, password: string) {
    const response = await this.request<any>({
      method: 'POST',
      url: '/auth/login',
      data: { username, password },
      skipAuth: true,
      retryCount: 2
    })
    return response.data
  }

  async register(username: string, password: string, email?: string) {
    const response = await this.request<any>({
      method: 'POST',
      url: '/auth/register',
      data: { username, password, email },
      skipAuth: true,
      retryCount: 2
    })
    return response.data
  }

  async refreshToken(token: string) {
    const response = await this.request<any>({
      method: 'POST',
      url: '/auth/refresh',
      data: { refreshToken: token },
      skipAuth: true
    })
    return response.data
  }

  // 任务相关API
  async getTasks() {
    const response = await this.request<any>({
      method: 'GET',
      url: '/tasks',
      useCache: true,
      cacheTTL: 3 * 60 * 1000 // 3分钟缓存
    })
    return response.data
  }

  async getPendingTasks() {
    const response = await this.request<any>({
      method: 'GET',
      url: '/tasks/pending',
      useCache: true,
      cacheTTL: 2 * 60 * 1000 // 2分钟缓存
    })
    return response.data
  }

  async getCompletedTasks() {
    const response = await this.request<any>({
      method: 'GET',
      url: '/tasks/completed',
      useCache: true,
      cacheTTL: 5 * 60 * 1000 // 5分钟缓存
    })
    return response.data
  }

  async getTask(id: string) {
    const response = await this.request<any>({
      method: 'GET',
      url: `/tasks/${id}`,
      useCache: true,
      cacheTTL: 10 * 60 * 1000 // 10分钟缓存
    })
    return response.data
  }

  // 录音相关API
  async getRecordings() {
    const response = await this.request<any>({
      method: 'GET',
      url: '/recordings',
      useCache: true,
      cacheTTL: 5 * 60 * 1000
    })
    return response.data
  }

  async getRecording(id: string) {
    const response = await this.request<any>({
      method: 'GET',
      url: `/recordings/${id}`,
      useCache: true,
      cacheTTL: 10 * 60 * 1000
    })
    return response.data
  }

  async uploadRecording(formData: FormData) {
    const response = await this.request<any>({
      method: 'POST',
      url: '/recordings',
      data: formData,
      headers: {
        "Content-Type": "multipart/form-data",
      },
      timeout: 60000,
      retryCount: 2,
      retryDelay: 2000
    })
    return response.data
  }

  async updateRecording(id: string, formData: FormData) {
    const response = await this.request<any>({
      method: 'PUT',
      url: `/recordings/${id}`,
      data: formData,
      headers: {
        "Content-Type": "multipart/form-data",
      },
      timeout: 60000,
      retryCount: 2
    })
    return response.data
  }

  async deleteRecording(id: string) {
    const response = await this.request<any>({
      method: 'DELETE',
      url: `/recordings/${id}`,
      retryCount: 2
    })
    return response.data
  }

  // 用户相关API
  async getUserProfile() {
    const response = await this.request<any>({
      method: 'GET',
      url: '/user/profile',
      useCache: true,
      cacheTTL: 10 * 60 * 1000
    })
    return response.data
  }

  async getUserDashboard() {
    const response = await this.request<any>({
      method: 'GET',
      url: '/user/dashboard',
      useCache: true,
      cacheTTL: 5 * 60 * 1000
    })
    return response.data
  }

  async getUserStatistics() {
    const response = await this.request<any>({
      method: 'GET',
      url: '/user/statistics',
      useCache: true,
      cacheTTL: 15 * 60 * 1000
    })
    return response.data
  }

  // 文件上传API
  async uploadAudio(formData: FormData) {
    const response = await this.request<any>({
      method: 'POST',
      url: '/upload/audio',
      data: formData,
      headers: {
        "Content-Type": "multipart/form-data",
      },
      timeout: 60000,
      retryCount: 3,
      retryDelay: 2000
    })
    return response.data
  }

  // 音频质量相关API
  async getRecordingQualityReport(id: string) {
    const response = await this.request<any>({
      method: 'GET',
      url: `/recordings/${id}/quality-report`,
      useCache: true,
      cacheTTL: 30 * 60 * 1000
    })
    return response.data
  }

  async getBatchQualityAnalysis(recordingIds: string[]) {
    const response = await this.request<any>({
      method: 'POST',
      url: '/recordings/batch-analyze',
      data: { recording_ids: recordingIds },
      retryCount: 2
    })
    return response.data
  }

  // 缓存管理
  clearCache(pattern?: string) {
    if (pattern) {
      // 清除匹配模式的缓存
      const keysToDelete = Array.from(this.cache.keys()).filter(key => 
        key.includes(pattern)
      )
      keysToDelete.forEach(key => this.cache.delete(key))
    } else {
      // 清除所有缓存
      this.cache.clear()
    }
    this.saveCacheToStorage()
  }

  getCacheSize(): number {
    return this.cache.size
  }

  getCacheInfo(): Array<{ key: string; size: number; age: number }> {
    const now = Date.now()
    return Array.from(this.cache.entries()).map(([key, item]) => ({
      key,
      size: JSON.stringify(item.data).length,
      age: now - item.timestamp
    }))
  }
}


export const apiService = new ApiService()
