import { useEffect, useRef, useState, useCallback } from 'react'

/**
 * 内存使用监控Hook
 */
export function useMemoryMonitor(enabled: boolean = __DEV__) {
  const [memoryInfo, setMemoryInfo] = useState<any>(null)
  const intervalRef = useRef<any>(null)

  useEffect(() => {
    if (!enabled) return

    const checkMemory = () => {
      if (performance && (performance as any).memory) {
        const memory = (performance as any).memory
        setMemoryInfo({
          usedJSHeapSize: Math.round(memory.usedJSHeapSize / 1024 / 1024 * 100) / 100,
          totalJSHeapSize: Math.round(memory.totalJSHeapSize / 1024 / 1024 * 100) / 100,
          jsHeapSizeLimit: Math.round(memory.jsHeapSizeLimit / 1024 / 1024 * 100) / 100,
          timestamp: Date.now()
        })
      }
    }

    checkMemory()
    intervalRef.current = setInterval(checkMemory, 5000) // 每5秒检查一次

    return () => {
      if (intervalRef.current) {
        clearInterval(intervalRef.current)
      }
    }
  }, [enabled])

  return memoryInfo
}

/**
 * 内存泄漏检测Hook
 */
export function useLeakDetection(componentName: string, enabled: boolean = __DEV__) {
  const mountTimeRef = useRef(Date.now())
  const cleanupFunctionsRef = useRef<Array<() => void>>([])

  const addCleanup = useCallback((cleanup: () => void) => {
    cleanupFunctionsRef.current.push(cleanup)
  }, [])

  useEffect(() => {
    if (!enabled) return

    const mountTime = mountTimeRef.current
    console.log(`[MemoryTracker] ${componentName} mounted at ${new Date(mountTime).toISOString()}`)

    return () => {
      const unmountTime = Date.now()
      const lifeTime = unmountTime - mountTime
      console.log(`[MemoryTracker] ${componentName} unmounted after ${lifeTime}ms`)

      // 执行所有清理函数
      cleanupFunctionsRef.current.forEach(cleanup => {
        try {
          cleanup()
        } catch (error) {
          console.warn(`[MemoryTracker] Cleanup error in ${componentName}:`, error)
        }
      })
    }
  }, [componentName, enabled])

  return { addCleanup }
}

/**
 * 大对象缓存管理
 */
class LargeObjectCache {
  private cache = new Map<string, { data: any; timestamp: number; size: number }>()
  private maxSize: number
  private maxAge: number

  constructor(maxSize: number = 50 * 1024 * 1024, maxAge: number = 10 * 60 * 1000) {
    this.maxSize = maxSize // 50MB默认
    this.maxAge = maxAge // 10分钟默认
  }

  set(key: string, data: any): void {
    const size = this.estimateSize(data)
    const now = Date.now()

    // 清理过期项
    this.cleanExpired()

    // 检查是否需要清理空间
    if (this.getCurrentSize() + size > this.maxSize) {
      this.evictLRU(size)
    }

    this.cache.set(key, {
      data,
      timestamp: now,
      size
    })
  }

  get(key: string): any {
    const item = this.cache.get(key)
    if (!item) return null

    // 检查是否过期
    if (Date.now() - item.timestamp > this.maxAge) {
      this.cache.delete(key)
      return null
    }

    return item.data
  }

  delete(key: string): boolean {
    return this.cache.delete(key)
  }

  clear(): void {
    this.cache.clear()
  }

  private estimateSize(obj: any): number {
    const type = typeof obj
    if (type === 'string') return obj.length * 2
    if (type === 'number') return 8
    if (type === 'boolean') return 4
    if (obj === null || obj === undefined) return 0
    
    // 简单的对象大小估算
    return JSON.stringify(obj).length * 2
  }

  private getCurrentSize(): number {
    let totalSize = 0
    for (const item of this.cache.values()) {
      totalSize += item.size
    }
    return totalSize
  }

  private cleanExpired(): void {
    const now = Date.now()
    for (const [key, item] of this.cache.entries()) {
      if (now - item.timestamp > this.maxAge) {
        this.cache.delete(key)
      }
    }
  }

  private evictLRU(neededSize: number): void {
    const entries = Array.from(this.cache.entries())
    entries.sort((a, b) => a[1].timestamp - b[1].timestamp)

    let freedSize = 0
    for (const [key, item] of entries) {
      this.cache.delete(key)
      freedSize += item.size
      if (freedSize >= neededSize) break
    }
  }

  getStats() {
    return {
      count: this.cache.size,
      totalSize: this.getCurrentSize(),
      maxSize: this.maxSize,
      items: Array.from(this.cache.entries()).map(([key, item]) => ({
        key,
        size: item.size,
        age: Date.now() - item.timestamp
      }))
    }
  }
}

export const largeObjectCache = new LargeObjectCache()

/**
 * 智能垃圾回收Hook
 */
export function useGarbageCollection() {
  const forceGC = useCallback(() => {
    try {
      // React Native环境下可能不支持手动GC
      if (typeof window !== 'undefined' && (window as any).gc) {
        (window as any).gc()
        console.log('[GC] Manual garbage collection triggered')
      } else {
        console.log('[GC] Manual garbage collection not available')
      }
    } catch (error) {
      console.warn('[GC] Failed to trigger garbage collection:', error)
    }
  }, [])

  const requestGC = useCallback(() => {
    // 在空闲时请求垃圾回收
    if (typeof requestIdleCallback !== 'undefined') {
      requestIdleCallback(() => {
        forceGC()
      }, { timeout: 1000 })
    } else {
      setTimeout(forceGC, 0)
    }
  }, [forceGC])

  return { forceGC, requestGC }
}

/**
 * 组件渲染性能监控
 */
export function useRenderMonitor(componentName: string, enabled: boolean = __DEV__) {
  const renderCountRef = useRef(0)
  const lastRenderTimeRef = useRef(Date.now())

  useEffect(() => {
    if (!enabled) return

    renderCountRef.current++
    const now = Date.now()
    const timeSinceLastRender = now - lastRenderTimeRef.current
    lastRenderTimeRef.current = now

    if (renderCountRef.current > 1) {
      console.log(`[RenderMonitor] ${componentName} render #${renderCountRef.current} (+${timeSinceLastRender}ms)`)
      
      // 警告频繁渲染
      if (timeSinceLastRender < 16 && renderCountRef.current > 10) {
        console.warn(`[RenderMonitor] ${componentName} rendering too frequently! Consider optimization.`)
      }
    }
  })

  return {
    renderCount: renderCountRef.current
  }
}

/**
 * 图片预加载和缓存管理
 */
class ImageCache {
  private cache = new Map<string, Promise<any>>()
  private maxEntries = 100

  preload(uri: string): Promise<any> {
    if (this.cache.has(uri)) {
      return this.cache.get(uri)!
    }

    const promise = new Promise((resolve, reject) => {
      const image = new Image()
      image.onload = () => resolve(image)
      image.onerror = reject
      image.src = uri
    })

    // LRU清理
    if (this.cache.size >= this.maxEntries) {
      const firstKey = this.cache.keys().next().value
      if (firstKey) {
        this.cache.delete(firstKey)
      }
    }

    this.cache.set(uri, promise)
    return promise
  }

  clear(): void {
    this.cache.clear()
  }

  getStats() {
    return {
      count: this.cache.size,
      maxEntries: this.maxEntries
    }
  }
}

export const imageCache = new ImageCache()