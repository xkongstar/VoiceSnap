import React, { useState, useEffect, useRef, useCallback, useMemo } from "react"
import { View, Text, TouchableOpacity, Alert, TextInput, Animated, BackHandler } from "react-native"
import { MaterialIcons as Icon } from "@expo/vector-icons"
import { useFocusEffect } from "@react-navigation/native"
import { 
  useTaskSelector, 
  useRecordingSelector, 
  useOfflineSelector, 
  useRecordingStore,
  useTaskStore,
  useOfflineStore 
} from "../store/optimizedStore"
import { audioService } from "../services/audioService"
import { uploadService } from "../services/uploadService"
import { styles } from "../styles/RecordingScreenStyles"
import { 
  useDebounce, 
  useThrottle, 
  useStableCallback, 
  useOptimizedAnimation,
  withErrorBoundary,
  useMemoryCleanup,
  useFocusedEffect
} from "../utils/performanceUtils"

// 性能优化的子组件
const NetworkStatus = React.memo(({ isOnline }: { isOnline: boolean }) => {
  const animatedValue = useOptimizedAnimation(isOnline ? 1 : 0.7, 200)
  
  return (
    <Animated.View style={[
      styles.networkStatus, 
      isOnline ? styles.networkOnline : styles.networkOffline,
      { opacity: animatedValue }
    ]}>
      <Icon name={isOnline ? "wifi" : "wifi-off"} size={16} color="white" />
      <Text style={styles.networkStatusText}>{isOnline ? "在线" : "离线模式"}</Text>
    </Animated.View>
  )
})

const TaskCard = React.memo(({ task }: { task: any }) => {
  const scaleValue = useRef(new Animated.Value(1)).current
  
  useEffect(() => {
    Animated.sequence([
      Animated.timing(scaleValue, {
        toValue: 1.02,
        duration: 150,
        useNativeDriver: true,
      }),
      Animated.timing(scaleValue, {
        toValue: 1,
        duration: 150,
        useNativeDriver: true,
      }),
    ]).start()
  }, [task])

  return (
    <Animated.View style={[styles.taskCard, { transform: [{ scale: scaleValue }] }]}>
      <View style={styles.taskHeader}>
        <View style={styles.taskBadge}>
          <Icon name="assignment" size={16} color="#4f46e5" />
          <Text style={styles.taskId}>任务 {task.text_id}</Text>
        </View>
      </View>
      <Text style={styles.taskText}>{task.text_content}</Text>
    </Animated.View>
  )
})

const RecordingControls = React.memo(({ 
  isRecording, 
  onStartRecording, 
  onStopRecording, 
  recordingDuration,
  disabled 
}: {
  isRecording: boolean
  onStartRecording: () => void
  onStopRecording: () => void
  recordingDuration: number
  disabled: boolean
}) => {
  // 节流录音按钮点击，防止快速重复点击
  const throttledStart = useThrottle(onStartRecording, 1000)
  const throttledStop = useThrottle(onStopRecording, 500)
  
  const pulseAnimation = useRef(new Animated.Value(1)).current
  
  useEffect(() => {
    if (isRecording) {
      const pulseLoop = Animated.loop(
        Animated.sequence([
          Animated.timing(pulseAnimation, {
            toValue: 1.1,
            duration: 800,
            useNativeDriver: true,
          }),
          Animated.timing(pulseAnimation, {
            toValue: 1,
            duration: 800,
            useNativeDriver: true,
          }),
        ])
      )
      pulseLoop.start()
      
      return () => pulseLoop.stop()
    }
  }, [isRecording, pulseAnimation])
  
  const formatTime = useCallback((milliseconds: number) => {
    const totalSeconds = Math.floor(milliseconds / 1000)
    const mins = Math.floor(totalSeconds / 60)
    const secs = totalSeconds % 60
    return `${mins.toString().padStart(2, "0")}:${secs.toString().padStart(2, "0")}`
  }, [])

  return (
    <View style={styles.recordingControls}>
      <Animated.View style={{ transform: [{ scale: pulseAnimation }] }}>
        <TouchableOpacity
          style={[styles.recordButton, isRecording && styles.recordButtonActive]}
          onPress={isRecording ? throttledStop : throttledStart}
          disabled={disabled}
          activeOpacity={0.8}
          accessible={true}
          accessibilityLabel={isRecording ? "停止录音" : "开始录音"}
          accessibilityHint={isRecording ? "点击停止当前录音" : "点击开始录制音频"}
          accessibilityRole="button"
        >
          <View style={styles.recordButtonInner}>
            <Icon name={isRecording ? "stop" : "mic"} size={36} color="white" />
          </View>
        </TouchableOpacity>
      </Animated.View>

      <Text style={styles.recordingTime}>{formatTime(recordingDuration)}</Text>

      {isRecording && (
        <View style={styles.recordingIndicator}>
          <View style={styles.recordingDot} />
          <Text style={styles.recordingText}>录音中...</Text>
        </View>
      )}
    </View>
  )
})

const PlaybackControls = React.memo(({ 
  recordingUri, 
  onPlay, 
  onStop, 
  onDelete, 
  isPlaying, 
  isRecording, 
  isUploading,
  playbackPosition,
  playbackDuration 
}: {
  recordingUri: string | null
  onPlay: () => void
  onStop: () => void
  onDelete: () => void
  isPlaying: boolean
  isRecording: boolean
  isUploading: boolean
  playbackPosition: number
  playbackDuration: number
}) => {
  const formatTime = useCallback((milliseconds: number) => {
    const totalSeconds = Math.floor(milliseconds / 1000)
    const mins = Math.floor(totalSeconds / 60)
    const secs = totalSeconds % 60
    return `${mins.toString().padStart(2, "0")}:${secs.toString().padStart(2, "0")}`
  }, [])

  if (!recordingUri) return null

  return (
    <View style={styles.playbackSection}>
      <View style={styles.playbackHeader}>
        <Icon name="headset" size={20} color="#10b981" />
        <Text style={styles.playbackTitle}>录音回放</Text>
      </View>
      
      <View style={styles.playbackControls}>
        <TouchableOpacity
          style={[styles.controlButton, styles.playButton, isPlaying && styles.playButtonActive]}
          onPress={onPlay}
          disabled={isRecording || isUploading}
        >
          <Icon name={isPlaying ? "pause" : "play-arrow"} size={28} color={isPlaying ? "#fff" : "#10b981"} />
        </TouchableOpacity>

        {isPlaying && (
          <TouchableOpacity style={[styles.controlButton, styles.stopButton]} onPress={onStop}>
            <Icon name="stop" size={24} color="#f59e0b" />
          </TouchableOpacity>
        )}

        <TouchableOpacity
          style={[styles.controlButton, styles.deleteButton]}
          onPress={onDelete}
          disabled={isRecording || isPlaying || isUploading}
        >
          <Icon name="delete" size={24} color="#ef4444" />
        </TouchableOpacity>
      </View>

      {isPlaying && playbackDuration > 0 && (
        <View style={styles.progressContainer}>
          <Text style={styles.progressText}>
            {formatTime(playbackPosition)} / {formatTime(playbackDuration)}
          </Text>
          <View style={styles.waveformContainer}>
            <View style={styles.progressBar}>
              <View style={[styles.progressFill, { width: `${(playbackPosition / playbackDuration) * 100}%` }]} />
            </View>
          </View>
        </View>
      )}
    </View>
  )
})

const TranscriptionInput = React.memo(({ 
  value, 
  onChangeText, 
  disabled 
}: {
  value: string
  onChangeText: (text: string) => void
  disabled: boolean
}) => {
  // 防抖输入，减少不必要的状态更新
  const debouncedValue = useDebounce(value, 300)
  const [localValue, setLocalValue] = useState(value)

  useEffect(() => {
    if (debouncedValue !== value) {
      onChangeText(debouncedValue)
    }
  }, [debouncedValue, value, onChangeText])

  const handleChangeText = useCallback((text: string) => {
    setLocalValue(text)
  }, [])

  return (
    <View style={styles.transcriptionSection}>
      <Text style={styles.transcriptionHint}>
        请用文字记录您刚才说的方言内容
      </Text>
      <View style={styles.transcriptionInputContainer}>
        <TextInput
          style={styles.transcriptionInput}
          value={localValue}
          onChangeText={handleChangeText}
          placeholder="请输入您的方言转录..."
          placeholderTextColor="#94a3b8"
          multiline
          numberOfLines={4}
          textAlignVertical="top"
          editable={!disabled}
          accessible={true}
          accessibilityLabel="方言转录输入框"
          accessibilityHint="在此输入您刚才录制的方言内容的文字版本"
          accessibilityRole="text"
        />
        <View style={styles.transcriptionCounter}>
          <Text style={styles.counterText}>{localValue.length} 字符</Text>
        </View>
      </View>
    </View>
  )
})

function OptimizedRecordingScreen() {
  // 使用优化的选择器
  const { currentTask } = useTaskSelector()
  const { isRecording, currentRecording, recordingProgress } = useRecordingSelector()
  const { isOnline } = useOfflineSelector()
  
  // Store actions
  const { setIsRecording, setCurrentRecording, updateRecordingProgress } = useRecordingStore()
  const { markTaskCompleted } = useTaskStore()
  const { addOfflineRecording } = useOfflineStore()

  // 本地状态
  const [dialectTranscription, setDialectTranscription] = useState("")
  const [isPlaying, setIsPlaying] = useState(false)
  const [playbackPosition, setPlaybackPosition] = useState(0)
  const [playbackDuration, setPlaybackDuration] = useState(0)
  const [recordingUri, setRecordingUri] = useState<string | null>(null)
  const [isUploading, setIsUploading] = useState(false)
  const [uploadProgress, setUploadProgress] = useState(0)

  // 定时器引用
  const recordingTimer = useRef<NodeJS.Timeout | null>(null)
  const animationFrame = useRef<number | null>(null)

  // 内存清理
  useMemoryCleanup(() => {
    if (recordingTimer.current) {
      clearInterval(recordingTimer.current)
    }
    if (animationFrame.current) {
      cancelAnimationFrame(animationFrame.current)
    }
    audioService.cleanup()
  })

  // 处理Android返回键
  useFocusedEffect(() => {
    const onBackPress = () => {
      if (isRecording) {
        Alert.alert(
          "正在录音",
          "您正在录音中，确定要离开吗？",
          [
            { text: "取消", style: "cancel" },
            { 
              text: "确定", 
              onPress: () => {
                handleStopRecording()
                // 这里可以添加导航逻辑
              }
            }
          ]
        )
        return true
      }
      return false
    }

    BackHandler.addEventListener('hardwareBackPress', onBackPress)
    return () => BackHandler.removeEventListener('hardwareBackPress', onBackPress)
  }, [isRecording])

  // 稳定的回调函数
  const handleStartRecording = useStableCallback(async () => {
    if (!currentTask) {
      Alert.alert("错误", "请先选择一个任务")
      return
    }

    try {
      updateRecordingProgress({ duration: 0, fileSize: 0 })

      const uri = await audioService.startRecording((data) => {
        updateRecordingProgress({
          duration: data.durationMillis || 0,
          quality: {
            volume_level: data.metering ? Math.max(0, Math.min(100, (data.metering + 60) * (100 / 60))) : undefined
          }
        })
      })

      setIsRecording(true)
      setRecordingUri(uri)

      console.log("Recording started successfully")
    } catch (error: any) {
      console.error("Recording start error:", error)
      Alert.alert("录音失败", error.message || "无法开始录音，请检查麦克风权限")
    }
  })

  const handleStopRecording = useStableCallback(async () => {
    try {
      const result = await audioService.stopRecording()
      setIsRecording(false)
      
      if (result) {
        setCurrentRecording(result.uri)
        setRecordingUri(result.uri)
        updateRecordingProgress({ 
          duration: result.duration,
          fileSize: result.size 
        })
      }

      console.log("Recording stopped:", result)
    } catch (error: any) {
      console.error("Recording stop error:", error)
      Alert.alert("停止录音失败", error.message || "无法停止录音")
      setIsRecording(false)
    }
  })

  const handlePlayRecording = useStableCallback(async () => {
    if (!recordingUri) return

    try {
      if (isPlaying) {
        await audioService.pausePlayer()
        setIsPlaying(false)
      } else {
        await audioService.startPlayer(recordingUri, (data) => {
          setPlaybackPosition(data.positionMillis || 0)
          setPlaybackDuration(data.durationMillis || 0)
        })
        setIsPlaying(true)
      }
    } catch (error: any) {
      console.error("Playback error:", error)
      Alert.alert("播放失败", error.message || "无法播放录音")
    }
  })

  const handleStopPlayback = useStableCallback(async () => {
    try {
      await audioService.stopPlayer()
      setIsPlaying(false)
      setPlaybackPosition(0)
    } catch (error: any) {
      console.error("Stop playback error:", error)
    }
  })

  const handleDeleteRecording = useStableCallback(async () => {
    Alert.alert("删除录音", "确定要删除当前录音吗？", [
      { text: "取消", style: "cancel" },
      {
        text: "删除",
        style: "destructive",
        onPress: async () => {
          try {
            if (isPlaying) {
              await audioService.stopPlayer()
            }

            if (recordingUri) {
              await audioService.deleteRecording(recordingUri)
            }

            resetRecordingState()
            console.log("Recording deleted")
          } catch (error: any) {
            console.error("Delete recording error:", error)
            Alert.alert("删除失败", error.message || "无法删除录音")
          }
        },
      },
    ])
  })

  const handleSaveRecording = useStableCallback(async () => {
    if (!currentTask || !recordingUri || !dialectTranscription.trim()) {
      Alert.alert("错误", "请完成录音并填写方言转录")
      return
    }

    const durationSeconds = Math.round(recordingProgress.duration / 1000)

    if (isOnline) {
      // 在线上传
      Alert.alert("保存录音", "确定要保存并上传这个录音吗？", [
        { text: "取消", style: "cancel" },
        {
          text: "保存",
          onPress: async () => {
            setIsUploading(true)
            setUploadProgress(0)

            try {
              const result = await uploadService.uploadRecording(
                currentTask._id,
                currentTask.text_content,
                dialectTranscription,
                recordingUri,
                durationSeconds,
                (progress) => {
                  setUploadProgress(progress.percentage)
                },
              )

              if (result.success) {
                await audioService.deleteRecording(recordingUri)
                markTaskCompleted(currentTask._id, result.recording!)
                resetRecordingState()
                Alert.alert("成功", "录音已保存并上传到服务器！")
              } else {
                throw new Error(result.error || "上传失败")
              }
            } catch (error: any) {
              console.error("Upload error:", error)
              Alert.alert("上传失败", `${error.message}\n\n是否保存到本地，稍后自动上传？`, [
                { text: "取消", style: "cancel" },
                {
                  text: "保存到本地",
                  onPress: () => saveOffline(),
                },
              ])
            } finally {
              setIsUploading(false)
              setUploadProgress(0)
            }
          },
        },
      ])
    } else {
      // 离线保存
      Alert.alert("离线模式", "当前网络未连接，录音将保存到本地，联网后自动上传。", [
        { text: "取消", style: "cancel" },
        {
          text: "保存到本地",
          onPress: () => saveOffline(),
        },
      ])
    }
  })

  const saveOffline = useStableCallback(async () => {
    if (!currentTask || !recordingUri || !dialectTranscription.trim()) return

    try {
      const durationSeconds = Math.round(recordingProgress.duration / 1000)

      await uploadService.saveForOfflineUpload(
        currentTask._id,
        currentTask.text_content,
        dialectTranscription,
        recordingUri,
        durationSeconds,
      )

      resetRecordingState()
      Alert.alert("成功", "录音已保存到本地，联网后将自动上传！")
    } catch (error: any) {
      console.error("Save offline error:", error)
      Alert.alert("保存失败", error.message || "无法保存录音到本地")
    }
  })

  const resetRecordingState = useCallback(() => {
    setCurrentRecording(null)
    setRecordingUri(null)
    setDialectTranscription("")
    updateRecordingProgress({ duration: 0, fileSize: 0 })
    setPlaybackPosition(0)
    setPlaybackDuration(0)
    setIsPlaying(false)
  }, [setCurrentRecording, updateRecordingProgress])

  // Memoized components
  const memoizedNetworkStatus = useMemo(() => 
    <NetworkStatus isOnline={isOnline} />, 
    [isOnline]
  )

  const memoizedTaskCard = useMemo(() => 
    currentTask ? <TaskCard task={currentTask} /> : null, 
    [currentTask]
  )

  if (!currentTask) {
    return (
      <View style={styles.emptyContainer}>
        <Icon name="mic-off" size={64} color="#ccc" />
        <Text style={styles.emptyTitle}>请选择一个任务</Text>
        <Text style={styles.emptyText}>从任务列表中选择一个任务开始录音</Text>
      </View>
    )
  }

  return (
    <View style={styles.container}>
      {memoizedNetworkStatus}
      {memoizedTaskCard}

      <View style={styles.recordingSection}>
        <Text style={styles.sectionTitle}>
          <Icon name="mic" size={20} color="#4f46e5" /> 录音控制
        </Text>
        
        <RecordingControls
          isRecording={isRecording}
          onStartRecording={handleStartRecording}
          onStopRecording={handleStopRecording}
          recordingDuration={recordingProgress.duration}
          disabled={isPlaying || isUploading}
        />

        <PlaybackControls
          recordingUri={recordingUri}
          onPlay={handlePlayRecording}
          onStop={handleStopPlayback}
          onDelete={handleDeleteRecording}
          isPlaying={isPlaying}
          isRecording={isRecording}
          isUploading={isUploading}
          playbackPosition={playbackPosition}
          playbackDuration={playbackDuration}
        />
      </View>

      <TranscriptionInput
        value={dialectTranscription}
        onChangeText={setDialectTranscription}
        disabled={isRecording || isUploading}
      />

      {isUploading && (
        <View style={styles.uploadSection}>
          <View style={styles.uploadHeader}>
            <Icon name="cloud-upload" size={20} color="#06b6d4" />
            <Text style={styles.uploadTitle}>上传中...</Text>
          </View>
          <View style={styles.uploadProgress}>
            <View style={styles.uploadProgressBar}>
              <View style={[styles.uploadProgressFill, { width: `${uploadProgress}%` }]} />
            </View>
            <Text style={styles.uploadProgressText}>{Math.round(uploadProgress)}%</Text>
          </View>
        </View>
      )}

      {recordingUri && dialectTranscription.trim() && (
        <TouchableOpacity
          style={[styles.saveButton, (isRecording || isPlaying || isUploading) && styles.saveButtonDisabled]}
          onPress={handleSaveRecording}
          disabled={isRecording || isPlaying || isUploading}
          activeOpacity={0.8}
        >
          <Icon name={isOnline ? "cloud-upload" : "save"} size={24} color="white" />
          <Text style={styles.saveButtonText}>{isOnline ? "保存并上传" : "保存到本地"}</Text>
        </TouchableOpacity>
      )}
    </View>
  )
}

export default withErrorBoundary(OptimizedRecordingScreen, {
  onError: (error, errorInfo) => {
    console.error('RecordingScreen Error:', error, errorInfo)
    // 这里可以添加错误上报逻辑
  }
})