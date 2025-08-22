import React, { useState, useEffect, useCallback } from 'react'
import {
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  ScrollView,
  Modal,
  Dimensions,
  Switch
} from 'react-native'
import { 
  useMemoryMonitor, 
  largeObjectCache, 
  useGarbageCollection 
} from '../utils/memoryUtils'

// 简化的Icon组件
const Icon = ({ name, size = 24, color = '#000' }: { name: string; size?: number; color?: string }) => (
  <Text style={{ fontSize: size, color }}>
    {name === 'close' ? '✕' : 
     name === 'refresh' ? '↻' : 
     name === 'flash-on' ? '⚡' : 
     name === 'clear-all' ? '🗑️' : 
     name === 'warning' ? '⚠️' : 
     name === 'memory' ? '💾' : 
     name === 'storage' ? '📜' : 
     name === 'analytics' ? '📊' : '●'}
  </Text>
)

interface PerformanceMonitorProps {
  visible: boolean
  onClose: () => void
}

interface PerformanceMetrics {
  fps: number
  renderTime: number
  componentCount: number
  memoryUsage: any
  cacheStats: any
}

export const PerformanceMonitor: React.FC<PerformanceMonitorProps> = ({
  visible,
  onClose
}) => {
  const [metrics, setMetrics] = useState<PerformanceMetrics>({
    fps: 0,
    renderTime: 0,
    componentCount: 0,
    memoryUsage: null,
    cacheStats: null
  })
  
  const [autoRefresh, setAutoRefresh] = useState(true)
  const [selectedTab, setSelectedTab] = useState<'memory' | 'cache' | 'performance'>('memory')
  
  const memoryInfo = useMemoryMonitor(true)
  const { forceGC, requestGC } = useGarbageCollection()

  // FPS 监控
  const [fpsCounter, setFpsCounter] = useState(0)
  const [lastFrameTime, setLastFrameTime] = useState(performance.now())

  const updateMetrics = useCallback(() => {
    const cacheStats = largeObjectCache.getStats()
    
    setMetrics(prev => ({
      ...prev,
      memoryUsage: memoryInfo,
      cacheStats,
      fps: fpsCounter
    }))
  }, [memoryInfo, fpsCounter])

  // FPS 计算
  useEffect(() => {
    if (!visible) return

    let frameId: number
    const measureFPS = () => {
      const now = performance.now()
      const deltaTime = now - lastFrameTime
      
      if (deltaTime >= 1000) { // 每秒更新一次
        const fps = Math.round(1000 / deltaTime * fpsCounter)
        setFpsCounter(0)
        setLastFrameTime(now)
        
        setMetrics(prev => ({ ...prev, fps }))
      } else {
        setFpsCounter(prev => prev + 1)
      }
      
      frameId = requestAnimationFrame(measureFPS)
    }
    
    frameId = requestAnimationFrame(measureFPS)
    
    return () => {
      if (frameId) {
        cancelAnimationFrame(frameId)
      }
    }
  }, [visible, lastFrameTime, fpsCounter])

  // 自动刷新
  useEffect(() => {
    if (!visible || !autoRefresh) return

    const interval = setInterval(updateMetrics, 1000)
    return () => clearInterval(interval)
  }, [visible, autoRefresh, updateMetrics])

  const clearCache = useCallback(() => {
    largeObjectCache.clear()
    updateMetrics()
  }, [updateMetrics])

  const formatBytes = (bytes: number) => {
    if (bytes === 0) return '0 B'
    const k = 1024
    const sizes = ['B', 'KB', 'MB', 'GB']
    const i = Math.floor(Math.log(bytes) / Math.log(k))
    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i]
  }

  const renderMemoryTab = () => (
    <ScrollView style={styles.tabContent}>
      <View style={styles.section}>
        <Text style={styles.sectionTitle}>内存使用情况</Text>
        {metrics.memoryUsage ? (
          <View style={styles.metricsGrid}>
            <View style={styles.metricItem}>
              <Text style={styles.metricLabel}>已用堆内存</Text>
              <Text style={styles.metricValue}>
                {metrics.memoryUsage.usedJSHeapSize} MB
              </Text>
            </View>
            <View style={styles.metricItem}>
              <Text style={styles.metricLabel}>总堆内存</Text>
              <Text style={styles.metricValue}>
                {metrics.memoryUsage.totalJSHeapSize} MB
              </Text>
            </View>
            <View style={styles.metricItem}>
              <Text style={styles.metricLabel}>堆内存限制</Text>
              <Text style={styles.metricValue}>
                {metrics.memoryUsage.jsHeapSizeLimit} MB
              </Text>
            </View>
            <View style={styles.metricItem}>
              <Text style={styles.metricLabel}>内存使用率</Text>
              <Text style={[
                styles.metricValue,
                { color: (metrics.memoryUsage.usedJSHeapSize / metrics.memoryUsage.jsHeapSizeLimit) > 0.8 ? '#ef4444' : '#10b981' }
              ]}>
                {Math.round((metrics.memoryUsage.usedJSHeapSize / metrics.memoryUsage.jsHeapSizeLimit) * 100)}%
              </Text>
            </View>
          </View>
        ) : (
          <Text style={styles.noDataText}>内存数据不可用</Text>
        )}
      </View>

      <View style={styles.section}>
        <Text style={styles.sectionTitle}>垃圾回收</Text>
        <View style={styles.actionButtons}>
          <TouchableOpacity style={styles.actionButton} onPress={requestGC}>
            <Icon name="refresh" size={20} color="#4f46e5" />
            <Text style={styles.actionButtonText}>请求GC</Text>
          </TouchableOpacity>
          <TouchableOpacity style={styles.actionButton} onPress={forceGC}>
            <Icon name="flash-on" size={20} color="#f59e0b" />
            <Text style={styles.actionButtonText}>强制GC</Text>
          </TouchableOpacity>
        </View>
      </View>
    </ScrollView>
  )

  const renderCacheTab = () => (
    <ScrollView style={styles.tabContent}>
      <View style={styles.section}>
        <Text style={styles.sectionTitle}>缓存统计</Text>
        {metrics.cacheStats ? (
          <View style={styles.metricsGrid}>
            <View style={styles.metricItem}>
              <Text style={styles.metricLabel}>缓存项数量</Text>
              <Text style={styles.metricValue}>{metrics.cacheStats.count}</Text>
            </View>
            <View style={styles.metricItem}>
              <Text style={styles.metricLabel}>总大小</Text>
              <Text style={styles.metricValue}>
                {formatBytes(metrics.cacheStats.totalSize)}
              </Text>
            </View>
            <View style={styles.metricItem}>
              <Text style={styles.metricLabel}>最大大小</Text>
              <Text style={styles.metricValue}>
                {formatBytes(metrics.cacheStats.maxSize)}
              </Text>
            </View>
            <View style={styles.metricItem}>
              <Text style={styles.metricLabel}>使用率</Text>
              <Text style={[
                styles.metricValue,
                { color: (metrics.cacheStats.totalSize / metrics.cacheStats.maxSize) > 0.8 ? '#ef4444' : '#10b981' }
              ]}>
                {Math.round((metrics.cacheStats.totalSize / metrics.cacheStats.maxSize) * 100)}%
              </Text>
            </View>
          </View>
        ) : (
          <Text style={styles.noDataText}>缓存数据不可用</Text>
        )}
      </View>

      <View style={styles.section}>
        <Text style={styles.sectionTitle}>缓存项详情</Text>
        {metrics.cacheStats?.items?.map((item: any, index: number) => (
          <View key={index} style={styles.cacheItem}>
            <Text style={styles.cacheKey}>{item.key}</Text>
            <Text style={styles.cacheSize}>{formatBytes(item.size)}</Text>
            <Text style={styles.cacheAge}>{Math.round(item.age / 1000)}s</Text>
          </View>
        ))}
      </View>

      <View style={styles.section}>
        <Text style={styles.sectionTitle}>缓存操作</Text>
        <TouchableOpacity style={[styles.actionButton, styles.clearButton]} onPress={clearCache}>
          <Icon name="clear-all" size={20} color="#ef4444" />
          <Text style={[styles.actionButtonText, { color: '#ef4444' }]}>清空缓存</Text>
        </TouchableOpacity>
      </View>
    </ScrollView>
  )

  const renderPerformanceTab = () => (
    <ScrollView style={styles.tabContent}>
      <View style={styles.section}>
        <Text style={styles.sectionTitle}>性能指标</Text>
        <View style={styles.metricsGrid}>
          <View style={styles.metricItem}>
            <Text style={styles.metricLabel}>FPS</Text>
            <Text style={[
              styles.metricValue,
              { color: metrics.fps < 30 ? '#ef4444' : metrics.fps < 50 ? '#f59e0b' : '#10b981' }
            ]}>
              {metrics.fps}
            </Text>
          </View>
          <View style={styles.metricItem}>
            <Text style={styles.metricLabel}>渲染时间</Text>
            <Text style={styles.metricValue}>{metrics.renderTime}ms</Text>
          </View>
          <View style={styles.metricItem}>
            <Text style={styles.metricLabel}>组件数量</Text>
            <Text style={styles.metricValue}>{metrics.componentCount}</Text>
          </View>
        </View>
      </View>

      <View style={styles.section}>
        <Text style={styles.sectionTitle}>性能建议</Text>
        <View style={styles.suggestionList}>
          {metrics.fps < 30 && (
            <View style={styles.suggestion}>
              <Icon name="warning" size={16} color="#f59e0b" />
              <Text style={styles.suggestionText}>FPS过低，考虑优化渲染逻辑</Text>
            </View>
          )}
          {metrics.memoryUsage && (metrics.memoryUsage.usedJSHeapSize / metrics.memoryUsage.jsHeapSizeLimit) > 0.8 && (
            <View style={styles.suggestion}>
              <Icon name="memory" size={16} color="#ef4444" />
              <Text style={styles.suggestionText}>内存使用率过高，建议进行垃圾回收</Text>
            </View>
          )}
          {metrics.cacheStats && (metrics.cacheStats.totalSize / metrics.cacheStats.maxSize) > 0.9 && (
            <View style={styles.suggestion}>
              <Icon name="storage" size={16} color="#f59e0b" />
              <Text style={styles.suggestionText}>缓存空间不足，考虑清理</Text>
            </View>
          )}
        </View>
      </View>
    </ScrollView>
  )

  const renderTabContent = () => {
    switch (selectedTab) {
      case 'memory':
        return renderMemoryTab()
      case 'cache':
        return renderCacheTab()
      case 'performance':
        return renderPerformanceTab()
      default:
        return renderMemoryTab()
    }
  }

  return (
    <Modal visible={visible} animationType="slide" presentationStyle="pageSheet">
      <View style={styles.container}>
        <View style={styles.header}>
          <Text style={styles.title}>性能监控</Text>
          <View style={styles.headerControls}>
            <View style={styles.autoRefreshContainer}>
              <Text style={styles.switchLabel}>自动刷新</Text>
              <Switch
                value={autoRefresh}
                onValueChange={setAutoRefresh}
                thumbColor="#4f46e5"
                trackColor={{ false: '#d1d5db', true: '#c7d2fe' }}
              />
            </View>
            <TouchableOpacity style={styles.closeButton} onPress={onClose}>
              <Icon name="close" size={24} color="#6b7280" />
            </TouchableOpacity>
          </View>
        </View>

        <View style={styles.tabBar}>
          {['memory', 'cache', 'performance'].map((tab) => (
            <TouchableOpacity
              key={tab}
              style={[styles.tab, selectedTab === tab && styles.activeTab]}
              onPress={() => setSelectedTab(tab as any)}
            >
              <Text style={[styles.tabText, selectedTab === tab && styles.activeTabText]}>
                {tab === 'memory' ? '内存' : tab === 'cache' ? '缓存' : '性能'}
              </Text>
            </TouchableOpacity>
          ))}
        </View>

        {renderTabContent()}
      </View>
    </Modal>
  )
}

// 性能监控浮动按钮
export const PerformanceMonitorFAB: React.FC = () => {
  const [visible, setVisible] = useState(false)

  // 只在开发模式下显示
  if (!__DEV__) return null

  return (
    <>
      <TouchableOpacity
        style={styles.fab}
        onPress={() => setVisible(true)}
        activeOpacity={0.8}
      >
        <Icon name="analytics" size={24} color="#fff" />
      </TouchableOpacity>
      
      <PerformanceMonitor
        visible={visible}
        onClose={() => setVisible(false)}
      />
    </>
  )
}

const { width, height } = Dimensions.get('window')

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#fff',
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 20,
    paddingTop: 60,
    paddingBottom: 20,
    borderBottomWidth: 1,
    borderBottomColor: '#e5e7eb',
  },
  title: {
    fontSize: 24,
    fontWeight: 'bold',
    color: '#1f2937',
  },
  headerControls: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 15,
  },
  autoRefreshContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  switchLabel: {
    fontSize: 14,
    color: '#6b7280',
  },
  closeButton: {
    padding: 8,
  },
  tabBar: {
    flexDirection: 'row',
    backgroundColor: '#f9fafb',
    margin: 20,
    marginBottom: 0,
    borderRadius: 8,
    padding: 4,
  },
  tab: {
    flex: 1,
    paddingVertical: 12,
    alignItems: 'center',
    borderRadius: 6,
  },
  activeTab: {
    backgroundColor: '#4f46e5',
  },
  tabText: {
    fontSize: 14,
    fontWeight: '500',
    color: '#6b7280',
  },
  activeTabText: {
    color: '#fff',
  },
  tabContent: {
    flex: 1,
    padding: 20,
  },
  section: {
    marginBottom: 24,
  },
  sectionTitle: {
    fontSize: 18,
    fontWeight: '600',
    color: '#1f2937',
    marginBottom: 12,
  },
  metricsGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 12,
  },
  metricItem: {
    flex: 1,
    minWidth: (width - 60) / 2 - 6,
    backgroundColor: '#f9fafb',
    padding: 16,
    borderRadius: 8,
    alignItems: 'center',
  },
  metricLabel: {
    fontSize: 12,
    color: '#6b7280',
    marginBottom: 4,
  },
  metricValue: {
    fontSize: 20,
    fontWeight: 'bold',
    color: '#1f2937',
  },
  noDataText: {
    fontSize: 14,
    color: '#9ca3af',
    textAlign: 'center',
    paddingVertical: 20,
  },
  actionButtons: {
    flexDirection: 'row',
    gap: 12,
  },
  actionButton: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    backgroundColor: '#f3f4f6',
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderRadius: 8,
    flex: 1,
    justifyContent: 'center',
  },
  clearButton: {
    backgroundColor: '#fef2f2',
  },
  actionButtonText: {
    fontSize: 14,
    fontWeight: '500',
    color: '#4f46e5',
  },
  cacheItem: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 8,
    borderBottomWidth: 1,
    borderBottomColor: '#f3f4f6',
  },
  cacheKey: {
    flex: 1,
    fontSize: 12,
    color: '#1f2937',
  },
  cacheSize: {
    fontSize: 12,
    color: '#6b7280',
    marginHorizontal: 8,
  },
  cacheAge: {
    fontSize: 12,
    color: '#9ca3af',
  },
  suggestionList: {
    gap: 8,
  },
  suggestion: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    backgroundColor: '#fef3c7',
    padding: 12,
    borderRadius: 8,
  },
  suggestionText: {
    flex: 1,
    fontSize: 14,
    color: '#92400e',
  },
  fab: {
    position: 'absolute',
    bottom: 100,
    right: 20,
    width: 56,
    height: 56,
    borderRadius: 28,
    backgroundColor: '#4f46e5',
    justifyContent: 'center',
    alignItems: 'center',
    elevation: 8,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 8,
  },
})