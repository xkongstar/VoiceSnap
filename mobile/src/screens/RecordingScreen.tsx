"use client"

import { useState, useEffect, useRef } from "react"
import { View, Text, TouchableOpacity, StyleSheet, Alert, ScrollView, TextInput } from "react-native"
import Icon from "react-native-vector-icons/MaterialIcons"
import { useAppStore } from "../store/appStore"
import { audioService } from "../services/audioService"
import { uploadService } from "../services/uploadService"

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

  const recordingTimer = useRef<NodeJS.Timeout | null>(null)

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
        setRecordingDuration(data.currentPosition)
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
      setCurrentRecording(result.uri)
      setRecordingUri(result.uri)

      // Get actual duration if not tracked by progress
      if (result.duration > 0) {
        setRecordingDuration(result.duration * 1000) // Convert to milliseconds
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
          setPlaybackPosition(data.currentPosition)
          setPlaybackDuration(data.duration)
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
    <ScrollView style={styles.container}>
      <View style={[styles.networkStatus, isOnline ? styles.networkOnline : styles.networkOffline]}>
        <Icon name={isOnline ? "wifi" : "wifi-off"} size={16} color="white" />
        <Text style={styles.networkStatusText}>{isOnline ? "在线" : "离线模式"}</Text>
      </View>

      <View style={styles.taskCard}>
        <Text style={styles.taskId}>任务 {currentTask.text_id}</Text>
        <Text style={styles.taskText}>{currentTask.text_content}</Text>
      </View>

      <View style={styles.recordingSection}>
        <View style={styles.recordingControls}>
          <TouchableOpacity
            style={[styles.recordButton, isRecording && styles.recordButtonActive]}
            onPress={isRecording ? handleStopRecording : handleStartRecording}
            disabled={isPlaying || isUploading}
          >
            <Icon name={isRecording ? "stop" : "mic"} size={32} color="white" />
          </TouchableOpacity>

          <Text style={styles.recordingTime}>{formatTime(recordingDuration)}</Text>

          {isRecording && (
            <View style={styles.recordingIndicator}>
              <View style={styles.recordingDot} />
              <Text style={styles.recordingText}>录音中...</Text>
            </View>
          )}
        </View>

        {recordingUri && (
          <View style={styles.playbackSection}>
            <Text style={styles.sectionTitle}>录音回放</Text>
            <View style={styles.playbackControls}>
              <TouchableOpacity
                style={styles.playButton}
                onPress={handlePlayRecording}
                disabled={isRecording || isUploading}
              >
                <Icon name={isPlaying ? "pause" : "play-arrow"} size={24} color="#2196F3" />
              </TouchableOpacity>

              {isPlaying && (
                <TouchableOpacity style={styles.stopButton} onPress={handleStopPlayback}>
                  <Icon name="stop" size={24} color="#FF9800" />
                </TouchableOpacity>
              )}

              <TouchableOpacity
                style={styles.deleteButton}
                onPress={handleDeleteRecording}
                disabled={isRecording || isPlaying || isUploading}
              >
                <Icon name="delete" size={24} color="#f44336" />
              </TouchableOpacity>
            </View>

            {isPlaying && playbackDuration > 0 && (
              <View style={styles.progressContainer}>
                <Text style={styles.progressText}>
                  {formatTime(playbackPosition)} / {formatTime(playbackDuration)}
                </Text>
                <View style={styles.progressBar}>
                  <View style={[styles.progressFill, { width: `${(playbackPosition / playbackDuration) * 100}%` }]} />
                </View>
              </View>
            )}
          </View>
        )}
      </View>

      <View style={styles.transcriptionSection}>
        <Text style={styles.sectionTitle}>方言转录</Text>
        <Text style={styles.transcriptionHint}>请用文字记录您刚才说的方言内容：</Text>
        <TextInput
          style={styles.transcriptionInput}
          value={dialectTranscription}
          onChangeText={setDialectTranscription}
          placeholder="请输入您的方言转录..."
          multiline
          numberOfLines={4}
          textAlignVertical="top"
          editable={!isRecording && !isUploading}
        />
      </View>

      {isUploading && (
        <View style={styles.uploadSection}>
          <Text style={styles.sectionTitle}>上传中...</Text>
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
        >
          <Icon name={isOnline ? "cloud-upload" : "save"} size={24} color="white" />
          <Text style={styles.saveButtonText}>{isOnline ? "保存并上传" : "保存到本地"}</Text>
        </TouchableOpacity>
      )}
    </ScrollView>
  )
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: "#f5f5f5",
  },
  networkStatus: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    paddingVertical: 8,
    paddingHorizontal: 16,
    gap: 8,
  },
  networkOnline: {
    backgroundColor: "#4CAF50",
  },
  networkOffline: {
    backgroundColor: "#FF9800",
  },
  networkStatusText: {
    color: "white",
    fontSize: 14,
    fontWeight: "500",
  },
  emptyContainer: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
    backgroundColor: "#f5f5f5",
  },
  emptyTitle: {
    fontSize: 20,
    fontWeight: "bold",
    color: "#666",
    marginTop: 16,
    marginBottom: 8,
  },
  emptyText: {
    fontSize: 16,
    color: "#999",
    textAlign: "center",
    paddingHorizontal: 40,
  },
  taskCard: {
    backgroundColor: "white",
    margin: 16,
    padding: 20,
    borderRadius: 12,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 3,
  },
  taskId: {
    fontSize: 16,
    fontWeight: "600",
    color: "#2196F3",
    marginBottom: 8,
  },
  taskText: {
    fontSize: 18,
    color: "#333",
    lineHeight: 26,
  },
  recordingSection: {
    backgroundColor: "white",
    margin: 16,
    padding: 20,
    borderRadius: 12,
    alignItems: "center",
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 3,
  },
  recordingControls: {
    alignItems: "center",
  },
  recordButton: {
    width: 80,
    height: 80,
    borderRadius: 40,
    backgroundColor: "#2196F3",
    justifyContent: "center",
    alignItems: "center",
    marginBottom: 16,
  },
  recordButtonActive: {
    backgroundColor: "#f44336",
  },
  recordingTime: {
    fontSize: 24,
    fontWeight: "bold",
    color: "#333",
  },
  recordingIndicator: {
    flexDirection: "row",
    alignItems: "center",
    marginTop: 12,
  },
  recordingDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: "#f44336",
    marginRight: 8,
  },
  recordingText: {
    fontSize: 14,
    color: "#f44336",
    fontWeight: "500",
  },
  playbackSection: {
    marginTop: 20,
    width: "100%",
  },
  sectionTitle: {
    fontSize: 18,
    fontWeight: "600",
    color: "#333",
    marginBottom: 12,
  },
  playbackControls: {
    flexDirection: "row",
    justifyContent: "center",
    gap: 20,
  },
  playButton: {
    width: 50,
    height: 50,
    borderRadius: 25,
    backgroundColor: "#e3f2fd",
    justifyContent: "center",
    alignItems: "center",
  },
  stopButton: {
    width: 50,
    height: 50,
    borderRadius: 25,
    backgroundColor: "#fff3e0",
    justifyContent: "center",
    alignItems: "center",
  },
  deleteButton: {
    width: 50,
    height: 50,
    borderRadius: 25,
    backgroundColor: "#ffebee",
    justifyContent: "center",
    alignItems: "center",
  },
  progressContainer: {
    marginTop: 16,
    alignItems: "center",
  },
  progressText: {
    fontSize: 14,
    color: "#666",
    marginBottom: 8,
  },
  progressBar: {
    width: "100%",
    height: 4,
    backgroundColor: "#e0e0e0",
    borderRadius: 2,
    overflow: "hidden",
  },
  progressFill: {
    height: "100%",
    backgroundColor: "#2196F3",
  },
  transcriptionSection: {
    backgroundColor: "white",
    margin: 16,
    padding: 20,
    borderRadius: 12,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 3,
  },
  transcriptionHint: {
    fontSize: 14,
    color: "#666",
    marginBottom: 12,
  },
  transcriptionInput: {
    borderWidth: 1,
    borderColor: "#ddd",
    borderRadius: 8,
    padding: 12,
    fontSize: 16,
    minHeight: 100,
    backgroundColor: "#f9f9f9",
  },
  uploadSection: {
    backgroundColor: "white",
    margin: 16,
    padding: 20,
    borderRadius: 12,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 3,
  },
  uploadProgress: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
  },
  uploadProgressBar: {
    flex: 1,
    height: 8,
    backgroundColor: "#e0e0e0",
    borderRadius: 4,
    overflow: "hidden",
  },
  uploadProgressFill: {
    height: "100%",
    backgroundColor: "#4CAF50",
  },
  uploadProgressText: {
    fontSize: 14,
    fontWeight: "600",
    color: "#4CAF50",
    minWidth: 40,
  },
  saveButton: {
    backgroundColor: "#4CAF50",
    margin: 16,
    padding: 16,
    borderRadius: 12,
    flexDirection: "row",
    justifyContent: "center",
    alignItems: "center",
    gap: 8,
  },
  saveButtonDisabled: {
    backgroundColor: "#ccc",
  },
  saveButtonText: {
    color: "white",
    fontSize: 18,
    fontWeight: "bold",
  },
})
