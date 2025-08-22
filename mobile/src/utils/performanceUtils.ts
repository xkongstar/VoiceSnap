import React, { memo, useCallback, useMemo, useRef, useEffect } from 'react'
import { View, Text, Animated, Easing } from 'react-native'
import { useFocusEffect } from '@react-navigation/native'

// === 性能优化的HOC ===

/**
 * 防抖HOC - 防止组件快速重复渲染
 */
export const withDebounce = <P extends object>(
  Component: React.ComponentType<P>,
  delay: number = 300
) => {
  return memo((props: P) => {
    const timeoutRef = useRef<NodeJS.Timeout>()
    const [shouldRender, setShouldRender] = React.useState(true)

    useEffect(() => {
      setShouldRender(false)
      
      if (timeoutRef.current) {
        clearTimeout(timeoutRef.current)
      }
      
      timeoutRef.current = setTimeout(() => {
        setShouldRender(true)
      }, delay)

      return () => {
        if (timeoutRef.current) {
          clearTimeout(timeoutRef.current)
        }
      }
    }, [props, delay])

    if (!shouldRender) {
      return null
    }

    return <Component {...props} />
  })
}

/**
 * 懒加载HOC - 延迟渲染重型组件
 */
export const withLazyRender = <P extends object>(
  Component: React.ComponentType<P>,
  delay: number = 100
) => {
  return memo((props: P) => {
    const [shouldRender, setShouldRender] = React.useState(false)

    useEffect(() => {
      const timer = setTimeout(() => {
        setShouldRender(true)
      }, delay)

      return () => clearTimeout(timer)
    }, [delay])

    if (!shouldRender) {
      return (
        <View style={{ minHeight: 100, justifyContent: 'center', alignItems: 'center' }}>
          <Text style={{ color: '#666' }}>加载中...</Text>
        </View>
      )
    }

    return <Component {...props} />
  })
}

/**
 * 错误边界HOC
 */
interface ErrorBoundaryState {
  hasError: boolean
  error: Error | null
}

class ErrorBoundaryComponent extends React.Component<
  React.PropsWithChildren<{
    fallback?: React.ComponentType<{ error: Error }>
    onError?: (error: Error, errorInfo: any) => void
  }>,
  ErrorBoundaryState
> {
  constructor(props: any) {
    super(props)
    this.state = { hasError: false, error: null }
  }

  static getDerivedStateFromError(error: Error): ErrorBoundaryState {
    return { hasError: true, error }
  }

  componentDidCatch(error: Error, errorInfo: any) {
    console.error('ErrorBoundary caught an error:', error, errorInfo)
    this.props.onError?.(error, errorInfo)
  }

  render() {
    if (this.state.hasError) {
      const Fallback = this.props.fallback
      if (Fallback && this.state.error) {
        return <Fallback error={this.state.error} />
      }
      
      return (
        <View style={{ flex: 1, justifyContent: 'center', alignItems: 'center', padding: 20 }}>
          <Text style={{ fontSize: 18, fontWeight: 'bold', marginBottom: 10, color: '#ef4444' }}>
            出现错误
          </Text>
          <Text style={{ textAlign: 'center', color: '#666' }}>
            {this.state.error?.message || '组件渲染时发生未知错误'}
          </Text>
        </View>
      )
    }

    return this.props.children
  }
}

export const withErrorBoundary = <P extends object>(
  Component: React.ComponentType<P>,
  options?: {
    fallback?: React.ComponentType<{ error: Error }>
    onError?: (error: Error, errorInfo: any) => void
  }
) => {
  return memo((props: P) => (
    <ErrorBoundaryComponent {...options}>
      <Component {...props} />
    </ErrorBoundaryComponent>
  ))
}

// === 性能优化的自定义Hooks ===

/**
 * 防抖Hook
 */
export const useDebounce = <T>(value: T, delay: number): T => {
  const [debouncedValue, setDebouncedValue] = React.useState<T>(value)

  useEffect(() => {
    const handler = setTimeout(() => {
      setDebouncedValue(value)
    }, delay)

    return () => {
      clearTimeout(handler)
    }
  }, [value, delay])

  return debouncedValue
}

/**
 * 节流Hook
 */
export const useThrottle = <T extends (...args: any[]) => any>(
  callback: T,
  delay: number
): T => {
  const callbackRef = useRef(callback)
  const lastCalledRef = useRef(0)

  useEffect(() => {
    callbackRef.current = callback
  }, [callback])

  return useCallback(
    ((...args: any[]) => {
      const now = Date.now()
      if (now - lastCalledRef.current >= delay) {
        lastCalledRef.current = now
        return callbackRef.current(...args)
      }
    }) as T,
    [delay]
  )
}

/**
 * 稳定的回调Hook - 防止不必要的重渲染
 */
export const useStableCallback = <T extends (...args: any[]) => any>(
  callback: T
): T => {
  const callbackRef = useRef(callback)

  useEffect(() => {
    callbackRef.current = callback
  }, [callback])

  return useCallback(
    ((...args: any[]) => callbackRef.current(...args)) as T,
    []
  )
}

/**
 * 异步状态Hook
 */
interface AsyncState<T> {
  data: T | null
  loading: boolean
  error: string | null
}

export const useAsyncState = <T>(
  asyncFunction: () => Promise<T>,
  deps: React.DependencyList = []
): AsyncState<T> & { retry: () => void } => {
  const [state, setState] = React.useState<AsyncState<T>>({
    data: null,
    loading: false,
    error: null,
  })

  const stableAsyncFunction = useStableCallback(asyncFunction)

  const execute = useCallback(async () => {
    setState(prev => ({ ...prev, loading: true, error: null }))
    
    try {
      const result = await stableAsyncFunction()
      setState({ data: result, loading: false, error: null })
    } catch (error: any) {
      setState(prev => ({ 
        ...prev, 
        loading: false, 
        error: error.message || '发生未知错误' 
      }))
    }
  }, [stableAsyncFunction])

  useEffect(() => {
    execute()
  }, deps) // eslint-disable-line react-hooks/exhaustive-deps

  const retry = useCallback(() => {
    execute()
  }, [execute])

  return { ...state, retry }
}

/**
 * 间隔执行Hook
 */
export const useInterval = (
  callback: () => void,
  delay: number | null,
  immediate: boolean = false
) => {
  const savedCallback = useRef(callback)

  useEffect(() => {
    savedCallback.current = callback
  }, [callback])

  useEffect(() => {
    if (immediate) {
      savedCallback.current()
    }
  }, [immediate])

  useEffect(() => {
    if (delay === null) return

    const interval = setInterval(() => {
      savedCallback.current()
    }, delay)

    return () => clearInterval(interval)
  }, [delay])
}

/**
 * 页面焦点Hook - 优化导航性能
 */
export const useFocusedEffect = (
  effect: () => void | (() => void),
  deps: React.DependencyList = []
) => {
  useFocusEffect(
    useCallback(() => {
      return effect()
    }, deps) // eslint-disable-line react-hooks/exhaustive-deps
  )
}

/**
 * 动画优化Hook
 */
export const useOptimizedAnimation = (
  toValue: number,
  duration: number = 250,
  useNativeDriver: boolean = true
) => {
  const animatedValue = useRef(new Animated.Value(0)).current

  const animate = useCallback(() => {
    Animated.timing(animatedValue, {
      toValue,
      duration,
      easing: Easing.bezier(0.25, 0.46, 0.45, 0.94), // easeOutQuart
      useNativeDriver,
    }).start()
  }, [animatedValue, toValue, duration, useNativeDriver])

  useEffect(() => {
    animate()
  }, [animate])

  return animatedValue
}

/**
 * 列表虚拟化Hook
 */
export const useVirtualizedList = <T>(
  items: T[],
  itemHeight: number,
  containerHeight: number,
  overscan: number = 3
) => {
  const [scrollOffset, setScrollOffset] = React.useState(0)

  const visibleRange = useMemo(() => {
    const startIndex = Math.max(0, Math.floor(scrollOffset / itemHeight) - overscan)
    const endIndex = Math.min(
      items.length - 1,
      Math.ceil((scrollOffset + containerHeight) / itemHeight) + overscan
    )
    
    return { startIndex, endIndex }
  }, [scrollOffset, itemHeight, containerHeight, items.length, overscan])

  const visibleItems = useMemo(() => {
    return items.slice(visibleRange.startIndex, visibleRange.endIndex + 1)
      .map((item, index) => ({
        item,
        index: visibleRange.startIndex + index,
        offsetY: (visibleRange.startIndex + index) * itemHeight,
      }))
  }, [items, visibleRange, itemHeight])

  const totalHeight = items.length * itemHeight

  const onScroll = useCallback((event: any) => {
    setScrollOffset(event.nativeEvent.contentOffset.y)
  }, [])

  return {
    visibleItems,
    totalHeight,
    onScroll,
    containerHeight,
  }
}

/**
 * 内存优化Hook - 清理大型对象
 */
export const useMemoryCleanup = (cleanupFn: () => void, deps: React.DependencyList = []) => {
  const cleanupRef = useRef(cleanupFn)

  useEffect(() => {
    cleanupRef.current = cleanupFn
  }, [cleanupFn])

  useEffect(() => {
    return () => {
      cleanupRef.current()
    }
  }, deps) // eslint-disable-line react-hooks/exhaustive-deps
}

/**
 * 网络状态优化Hook
 */
export const useNetworkOptimizedFetch = <T>(
  fetchFn: () => Promise<T>,
  options: {
    cacheKey: string
    cacheTime?: number // 缓存时间（毫秒）
    retryCount?: number
    retryDelay?: number
  }
) => {
  const cache = useRef<Map<string, { data: T; timestamp: number }>>(new Map())
  const { cacheKey, cacheTime = 5 * 60 * 1000, retryCount = 3, retryDelay = 1000 } = options

  const [state, setState] = React.useState<AsyncState<T>>({
    data: null,
    loading: false,
    error: null,
  })

  const fetchWithRetry = useCallback(async (attempt: number = 1): Promise<T> => {
    try {
      return await fetchFn()
    } catch (error) {
      if (attempt < retryCount) {
        await new Promise(resolve => setTimeout(resolve, retryDelay * attempt))
        return fetchWithRetry(attempt + 1)
      }
      throw error
    }
  }, [fetchFn, retryCount, retryDelay])

  const execute = useCallback(async (forceRefresh: boolean = false) => {
    // 检查缓存
    if (!forceRefresh) {
      const cached = cache.current.get(cacheKey)
      if (cached && Date.now() - cached.timestamp < cacheTime) {
        setState({ data: cached.data, loading: false, error: null })
        return
      }
    }

    setState(prev => ({ ...prev, loading: true, error: null }))
    
    try {
      const result = await fetchWithRetry()
      
      // 更新缓存
      cache.current.set(cacheKey, { data: result, timestamp: Date.now() })
      
      setState({ data: result, loading: false, error: null })
    } catch (error: any) {
      setState(prev => ({ 
        ...prev, 
        loading: false, 
        error: error.message || '网络请求失败' 
      }))
    }
  }, [cacheKey, cacheTime, fetchWithRetry])

  useEffect(() => {
    execute()
  }, [execute])

  const refresh = useCallback(() => execute(true), [execute])

  return { ...state, refresh }
}