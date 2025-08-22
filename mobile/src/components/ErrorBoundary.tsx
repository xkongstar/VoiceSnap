import React, { Component, ErrorInfo, ReactNode } from 'react'
import {
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  ScrollView,
  Dimensions
} from 'react-native'
import { frontendErrorHandler, FrontendErrorType, ErrorSeverity } from '../utils/errorHandler'

// 简化的Icon组件
const Icon = ({ name, size = 24, color = '#000' }: { name: string; size?: number; color?: string }) => (
  <Text style={{ fontSize: size, color, fontFamily: 'System' }}>
    {name === 'error' ? '❌' : 
     name === 'refresh' ? '🔄' : 
     name === 'info' ? 'ℹ️' : 
     name === 'warning' ? '⚠️' : '●'}
  </Text>
)

interface ErrorBoundaryState {
  hasError: boolean
  error: Error | null
  errorInfo: ErrorInfo | null
  errorId: string | null
}

interface ErrorBoundaryProps {
  children: ReactNode
  fallback?: React.ComponentType<{
    error: Error
    errorInfo: ErrorInfo
    retry: () => void
    errorId: string
  }>
  onError?: (error: Error, errorInfo: ErrorInfo) => void
  level?: 'page' | 'component' | 'critical'
  componentName?: string
}

/**
 * 全局错误边界组件
 */
export class ErrorBoundary extends Component<ErrorBoundaryProps, ErrorBoundaryState> {
  private retryCount = 0
  private readonly maxRetries = 3

  constructor(props: ErrorBoundaryProps) {
    super(props)
    
    this.state = {
      hasError: false,
      error: null,
      errorInfo: null,
      errorId: null
    }
  }

  static getDerivedStateFromError(error: Error): Partial<ErrorBoundaryState> {
    return {
      hasError: true,
      error,
      errorId: `error_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`
    }
  }

  componentDidCatch(error: Error, errorInfo: ErrorInfo) {
    // 更新状态
    this.setState({
      errorInfo
    })

    // 处理错误
    const processedError = frontendErrorHandler.handleError(
      error,
      {
        component: this.props.componentName || 'ErrorBoundary',
        action: 'COMPONENT_RENDER',
        additionalInfo: {
          componentStack: errorInfo.componentStack,
          level: this.props.level || 'component',
          retryCount: this.retryCount
        }
      },
      {
        logToServer: true
      }
    )

    // 调用外部错误处理函数
    if (this.props.onError) {
      this.props.onError(error, errorInfo)
    }

    console.error('ErrorBoundary caught an error:', {
      error: error.message,
      stack: error.stack,
      componentStack: errorInfo.componentStack,
      errorId: this.state.errorId
    })
  }

  handleRetry = () => {
    this.retryCount++
    
    if (this.retryCount <= this.maxRetries) {
      this.setState({
        hasError: false,
        error: null,
        errorInfo: null,
        errorId: null
      })
    }
  }

  handleReset = () => {
    this.retryCount = 0
    this.setState({
      hasError: false,
      error: null,
      errorInfo: null,
      errorId: null
    })
  }

  renderErrorFallback() {
    const { error, errorInfo, errorId } = this.state
    const { fallback: CustomFallback } = this.props

    if (CustomFallback && error && errorInfo && errorId) {
      return (
        <CustomFallback
          error={error}
          errorInfo={errorInfo}
          retry={this.handleRetry}
          errorId={errorId}
        />
      )
    }

    return this.renderDefaultErrorFallback()
  }

  renderDefaultErrorFallback() {
    const { error, errorId } = this.state
    const { level = 'component', componentName } = this.props
    const canRetry = this.retryCount < this.maxRetries

    const errorTitle = this.getErrorTitle(level)
    const errorMessage = this.getErrorMessage(error, level)

    return (
      <View style={[
        styles.errorContainer,
        level === 'critical' && styles.criticalErrorContainer
      ]}>
        <View style={styles.errorIcon}>
          <Icon 
            name={level === 'critical' ? 'error' : 'warning'} 
            size={level === 'critical' ? 60 : 40} 
            color={level === 'critical' ? '#ef4444' : '#f59e0b'} 
          />
        </View>

        <Text style={[
          styles.errorTitle,
          level === 'critical' && styles.criticalErrorTitle
        ]}>
          {errorTitle}
        </Text>

        <Text style={styles.errorMessage}>
          {errorMessage}
        </Text>

        {componentName && (
          <Text style={styles.componentName}>
            组件: {componentName}
          </Text>
        )}

        <View style={styles.actionButtons}>
          {canRetry && (
            <TouchableOpacity
              style={[styles.actionButton, styles.retryButton]}
              onPress={this.handleRetry}
              activeOpacity={0.8}
            >
              <Icon name="refresh" size={16} color="#fff" />
              <Text style={styles.actionButtonText}>
                重试 ({this.maxRetries - this.retryCount})
              </Text>
            </TouchableOpacity>
          )}

          <TouchableOpacity
            style={[styles.actionButton, styles.resetButton]}
            onPress={this.handleReset}
            activeOpacity={0.8}
          >
            <Text style={[styles.actionButtonText, { color: '#6b7280' }]}>
              重置
            </Text>
          </TouchableOpacity>
        </View>

        {__DEV__ && (
          <View style={styles.debugInfo}>
            <Text style={styles.debugTitle}>调试信息:</Text>
            <ScrollView style={styles.debugScroll}>
              <Text style={styles.debugText}>
                错误ID: {errorId}
              </Text>
              <Text style={styles.debugText}>
                错误: {error?.message}
              </Text>
              <Text style={styles.debugText}>
                重试次数: {this.retryCount}/{this.maxRetries}
              </Text>
              {error?.stack && (
                <Text style={styles.debugText}>
                  堆栈: {error.stack}
                </Text>
              )}
            </ScrollView>
          </View>
        )}
      </View>
    )
  }

  getErrorTitle(level: string): string {
    switch (level) {
      case 'critical':
        return '应用程序错误'
      case 'page':
        return '页面加载失败'
      case 'component':
      default:
        return '组件错误'
    }
  }

  getErrorMessage(error: Error | null, level: string): string {
    if (level === 'critical') {
      return '应用程序遇到了严重错误，请重启应用或联系技术支持'
    }

    if (level === 'page') {
      return '页面无法正常加载，请尝试刷新或返回上一页'
    }

    // 根据错误类型返回用户友好的消息
    if (error?.message) {
      if (error.message.includes('ChunkLoadError')) {
        return '页面资源加载失败，请刷新页面重试'
      }
      
      if (error.message.includes('Network')) {
        return '网络连接失败，请检查网络设置'
      }
      
      if (error.message.includes('Memory')) {
        return '内存不足，请关闭其他应用后重试'
      }
    }

    return '组件渲染失败，请尝试重新加载'
  }

  render() {
    if (this.state.hasError) {
      return this.renderErrorFallback()
    }

    return this.props.children
  }
}

/**
 * 高阶组件：为组件添加错误边界
 */
export function withErrorBoundary<P extends object>(
  Component: React.ComponentType<P>,
  options?: {
    fallback?: ErrorBoundaryProps['fallback']
    onError?: ErrorBoundaryProps['onError']
    level?: ErrorBoundaryProps['level']
    componentName?: string
  }
) {
  const WrappedComponent = (props: P) => (
    <ErrorBoundary
      fallback={options?.fallback}
      onError={options?.onError}
      level={options?.level}
      componentName={options?.componentName || Component.displayName || Component.name}
    >
      <Component {...props} />
    </ErrorBoundary>
  )

  WrappedComponent.displayName = `withErrorBoundary(${Component.displayName || Component.name})`
  
  return WrappedComponent
}

/**
 * 页面级错误边界
 */
export const PageErrorBoundary: React.FC<{
  children: ReactNode
  pageName?: string
}> = ({ children, pageName }) => (
  <ErrorBoundary
    level="page"
    componentName={pageName}
    fallback={({ error, retry, errorId }) => (
      <View style={styles.pageErrorContainer}>
        <Icon name="error" size={80} color="#ef4444" />
        <Text style={styles.pageErrorTitle}>页面加载失败</Text>
        <Text style={styles.pageErrorMessage}>
          {pageName ? `${pageName}页面` : '当前页面'}无法正常加载
        </Text>
        <TouchableOpacity style={styles.pageRetryButton} onPress={retry}>
          <Text style={styles.pageRetryText}>重新加载</Text>
        </TouchableOpacity>
      </View>
    )}
  >
    {children}
  </ErrorBoundary>
)

/**
 * 关键功能错误边界
 */
export const CriticalErrorBoundary: React.FC<{
  children: ReactNode
}> = ({ children }) => (
  <ErrorBoundary
    level="critical"
    componentName="CriticalFeature"
    onError={(error, errorInfo) => {
      // 关键错误需要立即上报
      console.error('Critical error occurred:', error, errorInfo)
    }}
  >
    {children}
  </ErrorBoundary>
)

const { width, height } = Dimensions.get('window')

const styles = StyleSheet.create({
  errorContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 20,
    backgroundColor: '#fff',
  },
  criticalErrorContainer: {
    backgroundColor: '#fef2f2',
  },
  errorIcon: {
    marginBottom: 20,
  },
  errorTitle: {
    fontSize: 20,
    fontWeight: 'bold',
    color: '#1f2937',
    marginBottom: 12,
    textAlign: 'center',
  },
  criticalErrorTitle: {
    color: '#ef4444',
    fontSize: 24,
  },
  errorMessage: {
    fontSize: 16,
    color: '#6b7280',
    textAlign: 'center',
    lineHeight: 24,
    marginBottom: 20,
  },
  componentName: {
    fontSize: 12,
    color: '#9ca3af',
    marginBottom: 20,
  },
  actionButtons: {
    flexDirection: 'row',
    gap: 12,
    marginBottom: 20,
  },
  actionButton: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    paddingHorizontal: 20,
    paddingVertical: 12,
    borderRadius: 8,
    minWidth: 100,
    justifyContent: 'center',
  },
  retryButton: {
    backgroundColor: '#4f46e5',
  },
  resetButton: {
    backgroundColor: '#f3f4f6',
    borderWidth: 1,
    borderColor: '#d1d5db',
  },
  actionButtonText: {
    fontSize: 14,
    fontWeight: '500',
    color: '#fff',
  },
  debugInfo: {
    width: '100%',
    maxHeight: 200,
    backgroundColor: '#f3f4f6',
    borderRadius: 8,
    padding: 12,
  },
  debugTitle: {
    fontSize: 14,
    fontWeight: '600',
    color: '#374151',
    marginBottom: 8,
  },
  debugScroll: {
    maxHeight: 150,
  },
  debugText: {
    fontSize: 12,
    color: '#6b7280',
    fontFamily: 'monospace',
    marginBottom: 4,
  },
  pageErrorContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 40,
    backgroundColor: '#fff',
  },
  pageErrorTitle: {
    fontSize: 24,
    fontWeight: 'bold',
    color: '#ef4444',
    marginTop: 20,
    marginBottom: 12,
    textAlign: 'center',
  },
  pageErrorMessage: {
    fontSize: 16,
    color: '#6b7280',
    textAlign: 'center',
    lineHeight: 24,
    marginBottom: 30,
  },
  pageRetryButton: {
    backgroundColor: '#4f46e5',
    paddingHorizontal: 24,
    paddingVertical: 12,
    borderRadius: 8,
  },
  pageRetryText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '500',
  },
})