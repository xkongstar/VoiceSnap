import React, { useEffect, useState, useMemo, useCallback } from "react"
import { View, Text, TouchableOpacity, RefreshControl, Alert } from "react-native"
import { useAppStore, type CompletedTaskItem } from "../store/appStore"
import { apiService } from "../services/apiService"
import { audioService } from "../services/audioService"
import { styles } from "../styles/CompletedTasksScreenStyles"

// 简化的Icon组件
const Icon = ({ name, size = 24, color = '#000' }: { name: string; size?: number; color?: string }) => (
  <Text style={{ fontSize: size, color, fontFamily: 'System' }}>
    {name === 'check-circle' ? '✓' : 
     name === 'schedule' ? '🕰' : 
     name === 'translate' ? '🌐' : 
     name === 'timer' ? '⏱' : 
     name === 'pause' ? '⏸' : 
     name === 'play-arrow' ? '▶️' : 
     name === 'delete' ? '🗑️' : 
     name === 'emoji-events' ? '🏆' : 
     name === 'mic' ? '🎤' : 
     name === 'assignment-turned-in' ? '📝' : 
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

// 录音项组件 - 使用React.memo优化
const CompletedTaskItem = React.memo<{
  item: CompletedTaskItem
  playingId: string | null
  onPlay: (audioUrl: string, recordingId: string) => void
  onDelete: (taskItem: CompletedTaskItem) => void
}>(({ item, playingId, onPlay, onDelete }) => {
  const isPlaying = playingId === item.recording._id
  const duration = item.recording.duration_seconds ? Math.round(item.recording.duration_seconds) : 0

  const handlePlay = useStableCallback(() => {
    if (item.recording.audio_file_url) {
      onPlay(item.recording.audio_file_url, item.recording._id)
    }
  })

  const handleDelete = useStableCallback(() => onDelete(item))

  return (
    <View style={styles.taskItem}>
      <View style={styles.taskHeader}>
        <View style={styles.taskBadgeCompleted}>
          <Icon name="check-circle" size={16} color="#10b981" />
          <Text style={styles.taskId}>任务 {item.task.text_id}</Text>
        </View>
        <View style={styles.completedDateBadge}>
          <Icon name="schedule" size={14} color="#64748b" />
          <Text style={styles.completedDate}>
            {new Date(item.recording.created_at).toLocaleDateString("zh-CN")}
          </Text>
        </View>
      </View>

      <Text style={styles.taskText} numberOfLines={2}>
        {item.task.text_content}
      </Text>

      <View style={styles.transcriptionContainer}>
        <View style={styles.transcriptionHeader}>
          <Icon name="translate" size={16} color="#8b5cf6" />
          <Text style={styles.transcriptionLabel}>方言转录</Text>
        </View>
        <Text style={styles.transcriptionText}>{item.recording.dialect_transcription}</Text>
      </View>

      <View style={styles.metaInfo}>
        {duration > 0 && (
          <View style={styles.durationBadge}>
            <Icon name="timer" size={14} color="#06b6d4" />
            <Text style={styles.durationText}>{duration}秒</Text>
          </View>
        )}
      </View>

      <View style={styles.actionButtons}>
        {item.recording.audio_file_url && (
          <TouchableOpacity
            style={[styles.actionButton, styles.playButton, isPlaying && styles.playButtonActive]}
            onPress={handlePlay}
            activeOpacity={0.7}
          >
            <Icon name={isPlaying ? "pause" : "play-arrow"} size={20} color={isPlaying ? "#fff" : "#10b981"} />
            <Text style={[styles.actionButtonText, { color: isPlaying ? "#fff" : "#10b981" }]}>
              {isPlaying ? "暂停" : "播放"}
            </Text>
          </TouchableOpacity>
        )}

        <TouchableOpacity
          style={[styles.actionButton, styles.deleteButton]}
          onPress={handleDelete}
          activeOpacity={0.7}
        >
          <Icon name="delete" size={20} color="#ef4444" />
          <Text style={[styles.actionButtonText, { color: "#ef4444" }]}>删除</Text>
        </TouchableOpacity>
      </View>
    </View>
  )
})

// 空状态组件 - 使用React.memo优化
const EmptyState = React.memo(() => (
  <View style={styles.emptyState}>
    <View style={styles.emptyIconContainer}>
      <Icon name="assignment-turned-in" size={80} color="#94a3b8" />
      <View style={styles.emptyBadge}>
        <Icon name="mic" size={20} color="#4f46e5" />
      </View>
    </View>
    <Text style={styles.emptyStateTitle}>暂无已完成任务</Text>
    <Text style={styles.emptyStateText}>完成录音任务后，它们会出现在这里</Text>
    <Text style={styles.emptyStateSubtext}>开始您的第一个录音吧！</Text>
  </View>
))

// 头部统计组件 - 使用React.memo优化
const CompletedTasksHeader = React.memo<{
  taskCount: number
  totalDuration: number
}>(({ taskCount, totalDuration }) => (
  <View style={styles.header}>
    <View style={styles.headerContent}>
      <View style={styles.titleSection}>
        <Text style={styles.headerTitle}>已完成任务</Text>
        <Text style={styles.headerSubtitle}>您的录音成果展示</Text>
      </View>
      <View style={styles.achievementBadge}>
        <Icon name="emoji-events" size={20} color="#fbbf24" />
        <Text style={styles.achievementText}>{taskCount}</Text>
      </View>
    </View>
    {taskCount > 0 && (
      <View style={styles.statsRow}>
        <View style={styles.statItem}>
          <Icon name="mic" size={16} color="rgba(255, 255, 255, 0.8)" />
          <Text style={styles.statText}>{taskCount} 个录音</Text>
        </View>
        <View style={styles.statItem}>
          <Icon name="timer" size={16} color="rgba(255, 255, 255, 0.8)" />
          <Text style={styles.statText}>{Math.round(totalDuration / 60)} 分钟</Text>
        </View>
      </View>
    )}
  </View>
))

function OptimizedCompletedTasksScreenComponent() {
  // 性能监控
  useRenderMonitor('OptimizedCompletedTasksScreen')
  const memoryInfo = useMemoryMonitor()
  const { addCleanup } = useLeakDetection('OptimizedCompletedTasksScreen')

  // 状态管理
  const { 
    completedTasks, 
    setCompletedTasks, 
    isLoading, 
    setIsLoading, 
    setError 
  } = useAppStore()

  const [refreshing, setRefreshing] = useState(false)
  const [playingId, setPlayingId] = useState<string | null>(null)
  const [lastRefreshTime, setLastRefreshTime] = useState(0)

  // 防抖刷新
  const debouncedRefresh = useDebounce(() => {}, 500)

  // 缓存计算结果
  const taskStats = useMemoized(() => {
    const totalDuration = completedTasks.reduce(
      (sum, item) => sum + (item.recording?.duration_seconds || 0), 
      0
    )
    
    return {
      count: completedTasks.length,
      totalDuration
    }
  }, [completedTasks])

  // 稳定的回调函数
  const loadCompletedTasks = useStableCallback(async () => {
    try {
      setIsLoading(true)
      
      // 检查缓存
      const cacheKey = 'completed_tasks'
      const cachedTasks = largeObjectCache.get(cacheKey)
      
      if (cachedTasks && Date.now() - lastRefreshTime < 60000) { // 1分钟缓存
        setCompletedTasks(cachedTasks)
        setIsLoading(false)
        return
      }
      
      const response = await apiService.getCompletedTasks()
      setCompletedTasks(response.tasks)
      
      // 缓存结果
      largeObjectCache.set(cacheKey, response.tasks)
      setLastRefreshTime(Date.now())
      
    } catch (error: any) {
      const errorMessage = error.response?.data?.error?.message || "加载已完成任务失败"
      setError(errorMessage)
      Alert.alert("错误", errorMessage)
    } finally {
      setIsLoading(false)
    }
  })

  const handleRefresh = useStableCallback(async () => {
    if (refreshing) return
    
    setRefreshing(true)
    loadCompletedTasks().finally(() => setRefreshing(false))
  })

  const handlePlayRecording = useStableCallback(async (audioUrl: string, recordingId: string) => {
    try {
      if (playingId === recordingId) {
        // 停止当前播放
        await audioService.stopPlayer()
        setPlayingId(null)
      } else {
        // 停止其他播放，开始新播放
        if (playingId) {
          await audioService.stopPlayer()
        }

        await audioService.startPlayer(audioUrl)
        setPlayingId(recordingId)

        // 自动停止（简化版本，实际应该监听播放结束事件）
        setTimeout(() => {
          setPlayingId(null)
        }, 10000)
      }
    } catch (error: any) {
      console.error("[OptimizedCompletedTasks] Playback error:", error)
      Alert.alert("播放失败", error.message || "无法播放录音")
      setPlayingId(null)
    }
  })

  const handleDeleteRecording = useStableCallback(async (taskItem: CompletedTaskItem) => {
    Alert.alert("删除录音", "确定要删除这个录音吗？此操作无法撤销。", [
      { text: "取消", style: "cancel" },
      {
        text: "删除",
        style: "destructive",
        onPress: async () => {
          try {
            await apiService.deleteRecording(taskItem.recording._id)
            
            // 清除缓存并刷新列表
            largeObjectCache.delete('completed_tasks')
            await loadCompletedTasks()
            
            Alert.alert("成功", "录音已删除")
          } catch (error: any) {
            const errorMessage = error.response?.data?.error?.message || "删除失败"
            Alert.alert("错误", errorMessage)
          }
        },
      },
    ])
  })

  // 优化的渲染函数
  const renderTaskItem = useCallback(({ item }: { item: CompletedTaskItem }) => (
    <CompletedTaskItem 
      item={item} 
      playingId={playingId}
      onPlay={handlePlayRecording}
      onDelete={handleDeleteRecording}
    />
  ), [playingId, handlePlayRecording, handleDeleteRecording])

  const keyExtractor = useCallback((item: CompletedTaskItem) => item.recording._id, [])

  // 内存清理
  useEffect(() => {
    addCleanup(() => {
      largeObjectCache.delete('completed_tasks')
      if (playingId) {
        audioService.stopPlayer().catch(console.error)
      }
    })
  }, [addCleanup, playingId])

  // 初始加载
  useEffect(() => {
    loadCompletedTasks()
  }, [])

  // 开发模式下的内存监控
  useEffect(() => {
    if (__DEV__ && memoryInfo) {
      console.log('[CompletedTasks] Memory usage:', memoryInfo)
    }
  }, [memoryInfo])

  return (
    <View style={styles.container}>
      {/* 头部渐变背景 */}
      <View style={styles.headerBackground} />
      
      <CompletedTasksHeader 
        taskCount={taskStats.count} 
        totalDuration={taskStats.totalDuration} 
      />

      <VirtualizedTaskList
        data={completedTasks}
        renderItem={renderTaskItem}
        keyExtractor={keyExtractor}
        itemHeight={160} // 已完成任务项目较高
        initialNumToRender={6}
        maxToRenderPerBatch={4}
        windowSize={6}
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
  withDebounce(OptimizedCompletedTasksScreenComponent, 200),
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