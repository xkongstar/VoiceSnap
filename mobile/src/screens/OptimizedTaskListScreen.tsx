import React, { useEffect, useState, useMemo, useCallback } from "react"
import { View, Text, TouchableOpacity, RefreshControl, Alert } from "react-native"
import { useAppStore } from "../store/appStore"
import { apiService } from "../services/apiService"
import type { Task } from "../store/appStore"
import { styles } from "../styles/TaskListScreenStyles"

// 简化的Icon组件
const Icon = ({ name, size = 24, color = '#000' }: { name: string; size?: number; color?: string }) => (
  <Text style={{ fontSize: size, color, fontFamily: 'System' }}>
    {name === 'assignment' ? '📝' : 
     name === 'play-circle-filled' ? '▶️' : 
     name === 'check-circle' ? '✓' :
     name === 'error-outline' ? '⚠️' : '●'}
  </Text>
)

// 性能优化工具
import { 
  withDebounce, 
  withErrorBoundary, 
  useStableCallback, 
  useDebounce 
} from "../utils/performanceUtils"

// 简化的useMemoized实现
function useMemoized<T>(factory: () => T, deps: React.DependencyList): T {
  return React.useMemo(factory, deps)
}
import { 
  useMemoryMonitor, 
  useLeakDetection, 
  useRenderMonitor,
  largeObjectCache 
} from "../utils/memoryUtils"
import { VirtualizedTaskList } from "../components/VirtualizedList"

interface OptimizedTaskListScreenProps {
  navigation: any
}

// 任务项组件 - 使用React.memo优化
const TaskItem = React.memo<{
  item: Task
  index: number
  onPress: (task: Task) => void
}>(({ item, index, onPress }) => {
  const handlePress = useStableCallback(() => onPress(item))
  
  return (
    <TouchableOpacity 
      style={[styles.taskItem, { transform: [{ translateY: index * 2 }] }]} 
      onPress={handlePress}
      activeOpacity={0.7}
    >
      <View style={styles.taskLeftSection}>
        <View style={styles.taskIdBadge}>
          <Text style={styles.taskIdText}>{item.text_id}</Text>
        </View>
        <View style={styles.taskContent}>
          <Text style={styles.taskLabel}>录制文本</Text>
          <Text style={styles.taskText} numberOfLines={3}>
            {item.text_content}
          </Text>
        </View>
      </View>
      <View style={styles.taskRightSection}>
        <View style={styles.playIconContainer}>
          <Icon name="play-circle-filled" size={32} color="#4f46e5" />
        </View>
      </View>
    </TouchableOpacity>
  )
})

// 空状态组件 - 使用React.memo优化
const EmptyState = React.memo(() => (
  <View style={styles.emptyState}>
    <View style={styles.emptyIconContainer}>
      <Icon name="check-circle" size={80} color="#10b981" />
      <View style={styles.sparkle1} />
      <View style={styles.sparkle2} />
      <View style={styles.sparkle3} />
    </View>
    <Text style={styles.emptyStateTitle}>太棒了！</Text>
    <Text style={styles.emptyStateText}>您已经完成了所有可用的录音任务</Text>
    <Text style={styles.emptyStateSubtext}>干得漂亮！期待更多任务的到来 🎉</Text>
  </View>
))

// 头部组件 - 使用React.memo优化
const TaskHeader = React.memo<{
  taskCount: number
  progressPercentage: number
}>(({ taskCount, progressPercentage }) => (
  <View style={styles.header}>
    <View style={styles.headerContent}>
      <View style={styles.titleSection}>
        <Text style={styles.headerTitle}>待录制任务</Text>
        <Text style={styles.headerSubtitle}>发现您的声音，记录方言之美</Text>
      </View>
      <View style={styles.taskCounter}>
        <Icon name="assignment" size={20} color="#4f46e5" />
        <Text style={styles.taskCountText}>{taskCount}</Text>
      </View>
    </View>
    {taskCount > 0 && (
      <View style={styles.progressSection}>
        <Text style={styles.progressText}>今日进度</Text>
        <View style={styles.progressBar}>
          <View style={[styles.progressFill, { width: `${progressPercentage}%` }]} />
        </View>
        <Text style={styles.progressLabel}>继续加油！</Text>
      </View>
    )}
  </View>
))

function OptimizedTaskListScreenComponent({ navigation }: OptimizedTaskListScreenProps) {
  // 性能监控
  useRenderMonitor('OptimizedTaskListScreen')
  const memoryInfo = useMemoryMonitor()
  const { addCleanup } = useLeakDetection('OptimizedTaskListScreen')

  // 状态管理
  const { 
    pendingTasks, 
    setPendingTasks, 
    setCurrentTask, 
    isLoading, 
    setIsLoading, 
    setError 
  } = useAppStore()

  const [refreshing, setRefreshing] = useState(false)
  const [lastRefreshTime, setLastRefreshTime] = useState(0)

  // 防抖刷新
  const debouncedRefresh = useDebounce(() => {}, 500)

  // 缓存计算结果
  const taskStats = useMemoized(() => {
    const total = pendingTasks.length
    const completed = 0 // 可以从其他状态获取
    const progressPercentage = total > 0 ? Math.min(75, (completed / total) * 100) : 0
    
    return { total, completed, progressPercentage }
  }, [pendingTasks.length])

  // 稳定的回调函数
  const loadPendingTasks = useStableCallback(async () => {
    try {
      setIsLoading(true)
      
      // 检查缓存
      const cacheKey = 'pending_tasks'
      const cachedTasks = largeObjectCache.get(cacheKey)
      
      if (cachedTasks && Date.now() - lastRefreshTime < 30000) {
        setPendingTasks(cachedTasks)
        setIsLoading(false)
        return
      }
      
      const response = await apiService.getPendingTasks()
      setPendingTasks(response.tasks)
      
      // 缓存结果
      largeObjectCache.set(cacheKey, response.tasks)
      setLastRefreshTime(Date.now())
      
    } catch (error: any) {
      const errorMessage = error.response?.data?.error?.message || "加载任务失败"
      setError(errorMessage)
      Alert.alert("错误", errorMessage)
    } finally {
      setIsLoading(false)
    }
  })

  const handleRefresh = useStableCallback(async () => {
    if (refreshing) return
    
    setRefreshing(true)
    loadPendingTasks().finally(() => setRefreshing(false))
  })

  const handleTaskPress = useStableCallback((task: Task) => {
    setCurrentTask(task)
    navigation.navigate("Recording")
  })

  // 优化的渲染函数
  const renderTaskItem = useCallback(({ item, index }: { item: Task; index: number }) => (
    <TaskItem item={item} index={index} onPress={handleTaskPress} />
  ), [handleTaskPress])

  const keyExtractor = useCallback((item: Task) => item._id, [])

  // 内存清理
  useEffect(() => {
    addCleanup(() => {
      largeObjectCache.delete('pending_tasks')
    })
  }, [addCleanup])

  // 初始加载
  useEffect(() => {
    loadPendingTasks()
  }, [])

  // 开发模式下的内存监控
  useEffect(() => {
    if (__DEV__ && memoryInfo) {
      console.log('[TaskList] Memory usage:', memoryInfo)
    }
  }, [memoryInfo])

  return (
    <View style={styles.container}>
      {/* 头部渐变背景 */}
      <View style={styles.headerBackground} />
      
      <TaskHeader 
        taskCount={taskStats.total} 
        progressPercentage={taskStats.progressPercentage} 
      />

      <VirtualizedTaskList
        data={pendingTasks}
        renderItem={renderTaskItem}
        keyExtractor={keyExtractor}
        itemHeight={120} // 估算的项目高度
        initialNumToRender={8}
        maxToRenderPerBatch={5}
        windowSize={8}
        removeClippedSubviews={true}
        onEndReachedThreshold={0.5}
        style={styles.listContainer}
        ListEmptyComponent={!isLoading ? EmptyState : undefined}
        ListHeaderComponent={
          <RefreshControl 
            refreshing={refreshing} 
            onRefresh={handleRefresh}
            colors={['#4f46e5']}
            tintColor="#4f46e5"
          />
        }
      />
    </View>
  )
}

// 使用错误边界和防抖包装组件
export default withErrorBoundary(
  withDebounce(OptimizedTaskListScreenComponent, 200),
  {
    fallback: ({ error }: { error: Error }) => (
      <View style={styles.container}>
        <View style={[styles.emptyState, { justifyContent: 'center' }]}>
          <Icon name="error-outline" size={60} color="#ef4444" />
          <Text style={[styles.emptyStateTitle, { color: '#ef4444' }]}>页面加载失败</Text>
          <Text style={[styles.emptyStateText, { color: '#6b7280' }]}>{error.message}</Text>
          <TouchableOpacity 
            style={[styles.taskItem, { 
              marginTop: 20, 
              backgroundColor: '#4f46e5',
              alignItems: 'center',
              justifyContent: 'center',
              paddingVertical: 12
            }]} 
            onPress={() => window.location.reload()}
            activeOpacity={0.8}
          >
            <Text style={[styles.emptyStateTitle, { color: '#fff' }]}>重试</Text>
          </TouchableOpacity>
        </View>
      </View>
    )
  }
)