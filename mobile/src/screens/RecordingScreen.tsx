"use client"

import { useState, useEffect, useRef } from "react"
import { View, Text, TouchableOpacity, Alert, TextInput } from "react-native"
import Icon from 'react-native-vector-icons/MaterialIcons'
import { useAppStore } from "../store/appStore"
import { audioService } from "../services/audioService"
import { uploadService } from "../services/uploadService"
import { styles } from "../styles/RecordingScreenStyles"

export default function RecordingScreen() {
  const { currentTask, isRecording, setIsRecording, currentRecording, setCurrentRecording, isOnline } = useAppStore()

  const [dialectTranscription, setDialectTranscription] = useState("")
  const [recordingDuration, setRecordingDuration] = useState(0)
  const [isPlaying, setIsPlaying] = useState(false)
  const [playbackPosition, setPlaybackPosition] = useState(0)
  const [playbackDuration, setPlaybackDuration] = useState(0)
  const [recordingUri, setRecordingUri] = useState<string | null>(null)
  const [isUploading, setIsUploading] = useState(false)
  const [uploadProgress, setUploadProgress] = useState(0)

  const recordingTimer = useRef<ReturnType<typeof setTimeout> | null>(null)

  useEffect(() => {
    // Cleanup on unmount
    return () => {
      if (recordingTimer.current) {
        clearInterval(recordingTimer.current)
      }
      audioService.cleanup()
    }
  }, [])

  const formatTime = (milliseconds: number) => {
    const totalSeconds = Math.floor(milliseconds / 1000)
    const mins = Math.floor(totalSeconds / 60)
    const secs = totalSeconds % 60
    return `${mins.toString().padStart(2, "0")}:${secs.toString().padStart(2, "0")}`
  }

  const handleStartRecording = async () => {
    if (!currentTask) {
      Alert.alert("错误", "请先选择一个任务")
      return
    }

    try {
      setRecordingDuration(0)

      // Start recording with progress callback
      const uri = await audioService.startRecording((data) => {
        setRecordingDuration(data.durationMillis || 0)
      })

      setIsRecording(true)
      setRecordingUri(uri)

      console.log("[v0] Recording started successfully")
    } catch (error: any) {
      console.error("[v0] Recording start error:", error)
      Alert.alert("录音失败", error.message || "无法开始录音，请检查麦克风权限")
    }
  }

  const handleStopRecording = async () => {
    try {
      const result = await audioService.stopRecording()
      setIsRecording(false)
      
      if (result) {
        setCurrentRecording(result.uri)
        setRecordingUri(result.uri)

        // Get actual duration if not tracked by progress
        if (result.duration > 0) {
          setRecordingDuration(result.duration) // Duration is already in milliseconds
        }
      }

      console.log("[v0] Recording stopped:", result)
    } catch (error: any) {
      console.error("[v0] Recording stop error:", error)
      Alert.alert("停止录音失败", error.message || "无法停止录音")
      setIsRecording(false)
    }
  }

  const handlePlayRecording = async () => {
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
      console.error("[v0] Playback error:", error)
      Alert.alert("播放失败", error.message || "无法播放录音")
    }
  }

  const handleStopPlayback = async () => {
    try {
      await audioService.stopPlayer()
      setIsPlaying(false)
      setPlaybackPosition(0)
    } catch (error: any) {
      console.error("[v0] Stop playback error:", error)
    }
  }

  const handleSaveRecording = async () => {
    if (!currentTask || !recordingUri || !dialectTranscription.trim()) {
      Alert.alert("错误", "请完成录音并填写方言转录")
      return
    }

    const durationSeconds = Math.round(recordingDuration / 1000)

    if (isOnline) {
      // Online: Upload directly
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
                // Clean up local file
                await audioService.deleteRecording(recordingUri)

                // Reset state
                resetRecordingState()

                Alert.alert("成功", "录音已保存并上传到服务器！")
              } else {
                throw new Error(result.error || "上传失败")
              }
            } catch (error: any) {
              console.error("[v0] Upload error:", error)

              // Ask if user wants to save offline
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
      // Offline: Save for later upload
      Alert.alert("离线模式", "当前网络未连接，录音将保存到本地，联网后自动上传。", [
        { text: "取消", style: "cancel" },
        {
          text: "保存到本地",
          onPress: () => saveOffline(),
        },
      ])
    }
  }

  const saveOffline = async () => {
    if (!currentTask || !recordingUri || !dialectTranscription.trim()) return

    try {
      const durationSeconds = Math.round(recordingDuration / 1000)

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
      console.error("[v0] Save offline error:", error)
      Alert.alert("保存失败", error.message || "无法保存录音到本地")
    }
  }

  const resetRecordingState = () => {
    setCurrentRecording(null)
    setRecordingUri(null)
    setDialectTranscription("")
    setRecordingDuration(0)
    setPlaybackPosition(0)
    setPlaybackDuration(0)
    setIsPlaying(false)
  }

  const handleDeleteRecording = async () => {
    Alert.alert("删除录音", "确定要删除当前录音吗？", [
      { text: "取消", style: "cancel" },
      {
        text: "删除",
        style: "destructive",
        onPress: async () => {
          try {
            // Stop playback if playing
            if (isPlaying) {
              await audioService.stopPlayer()
            }

            // Delete file
            if (recordingUri) {
              await audioService.deleteRecording(recordingUri)
            }

            // Reset state
            resetRecordingState()

            console.log("[v0] Recording deleted")
          } catch (error: any) {
            console.error("[v0] Delete recording error:", error)
            Alert.alert("删除失败", error.message || "无法删除录音")
          }
        },
      },
    ])
  }

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
      {/* 网络状态指示器 */}
      <View style={[styles.networkStatus, isOnline ? styles.networkOnline : styles.networkOffline]}>
        <Icon name={isOnline ? "wifi" : "wifi-off"} size={16} color="white" />
        <Text style={styles.networkStatusText}>{isOnline ? "在线" : "离线模式"}</Text>
      </View>

      {/* 任务卡片 */}
      <View style={styles.taskCard}>
        <View style={styles.taskHeader}>
          <View style={styles.taskBadge}>
            <Icon name="assignment" size={16} color="#4f46e5" />
            <Text style={styles.taskId}>任务 {currentTask.text_id}</Text>
          </View>
        </View>
        <Text style={styles.taskText}>{currentTask.text_content}</Text>
      </View>

      {/* 录音控制区域 */}
      <View style={styles.recordingSection}>
        <Text style={styles.sectionTitle}>
          <Icon name="mic" size={20} color="#4f46e5" /> 录音控制
        </Text>
        
        <View style={styles.recordingControls}>
          {/* 录音按钮 */}
          <TouchableOpacity
            style={[styles.recordButton, isRecording && styles.recordButtonActive]}
            onPress={isRecording ? handleStopRecording : handleStartRecording}
            disabled={isPlaying || isUploading}
            activeOpacity={0.8}
          >
            <View style={styles.recordButtonInner}>
              <Icon name={isRecording ? "stop" : "mic"} size={36} color="white" />
            </View>
            {isRecording && (
              <>
                <View style={styles.pulseRing1} />
                <View style={styles.pulseRing2} />
              </>
            )}
          </TouchableOpacity>

          <Text style={styles.recordingTime}>{formatTime(recordingDuration)}</Text>

          {isRecording && (
            <View style={styles.recordingIndicator}>
              <View style={styles.recordingDot} />
              <Text style={styles.recordingText}>录音中...</Text>
            </View>
          )}
        </View>

        {/* 回放控制 */}
        {recordingUri && (
          <View style={styles.playbackSection}>
            <View style={styles.playbackHeader}>
              <Icon name="headset" size={20} color="#10b981" />
              <Text style={styles.playbackTitle}>录音回放</Text>
            </View>
            
            <View style={styles.playbackControls}>
              <TouchableOpacity
                style={[styles.controlButton, styles.playButton, isPlaying && styles.playButtonActive]}
                onPress={handlePlayRecording}
                disabled={isRecording || isUploading}
              >
                <Icon name={isPlaying ? "pause" : "play-arrow"} size={28} color={isPlaying ? "#fff" : "#10b981"} />
              </TouchableOpacity>

              {isPlaying && (
                <TouchableOpacity style={[styles.controlButton, styles.stopButton]} onPress={handleStopPlayback}>
                  <Icon name="stop" size={24} color="#f59e0b" />
                </TouchableOpacity>
              )}

              <TouchableOpacity
                style={[styles.controlButton, styles.deleteButton]}
                onPress={handleDeleteRecording}
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
        )}
      </View>

      {/* 方言转录区域 */}
      <View style={styles.transcriptionSection}>
        {/* <View style={styles.transcriptionHeader}>
          <Icon name="translate" size={20} color="#8b5cf6" />
          <Text style={styles.sectionTitle}>方言转录</Text>
        </View> */}
        <Text style={styles.transcriptionHint}>
          请用文字记录您刚才说的方言内容
        </Text>
        <View style={styles.transcriptionInputContainer}>
          <TextInput
            style={styles.transcriptionInput}
            value={dialectTranscription}
            onChangeText={setDialectTranscription}
            placeholder="请输入您的方言转录..."
            placeholderTextColor="#94a3b8"
            multiline
            numberOfLines={4}
            textAlignVertical="top"
            editable={!isRecording && !isUploading}
          />
          <View style={styles.transcriptionCounter}>
            <Text style={styles.counterText}>{dialectTranscription.length} 字符</Text>
          </View>
        </View>
      </View>

      {/* 上传进度 */}
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

      {/* 保存按钮 */}
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