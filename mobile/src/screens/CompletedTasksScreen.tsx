"use client"

import { useEffect, useState } from "react"
import { View, Text, FlatList, TouchableOpacity, StyleSheet, RefreshControl, Alert } from "react-native"
import Icon from "react-native-vector-icons/MaterialIcons"
import { useAppStore } from "../store/appStore"
import { apiService } from "../services/apiService"
import { audioService } from "../services/audioService"

export default function CompletedTasksScreen() {
  const { completedTasks, setCompletedTasks, isLoading, setIsLoading, setError } = useAppStore()
  const [refreshing, setRefreshing] = useState(false)
  const [playingId, setPlayingId] = useState<string | null>(null)

  useEffect(() => {
    loadCompletedTasks()
  }, [])

  const loadCompletedTasks = async () => {
    try {
      setIsLoading(true)
      const response = await apiService.getCompletedTasks()
      setCompletedTasks(response.tasks)
    } catch (error: any) {
      const errorMessage = error.response?.data?.error?.message || "加载已完成任务失败"
      setError(errorMessage)
      Alert.alert("错误", errorMessage)
    } finally {
      setIsLoading(false)
    }
  }

  const onRefresh = async () => {
    setRefreshing(true)
    await loadCompletedTasks()
    setRefreshing(false)
  }

  const handlePlayRecording = async (audioUrl: string, recordingId: string) => {
    try {
      if (playingId === recordingId) {
        // Stop current playback
        await audioService.stopPlayer()
        setPlayingId(null)
      } else {
        // Stop any current playback first
        if (playingId) {
          await audioService.stopPlayer()
        }

        // Start new playback
        await audioService.startPlayer(audioUrl)
        setPlayingId(recordingId)

        // Auto-stop when finished (simplified)
        setTimeout(() => {
          setPlayingId(null)
        }, 10000) // Assume max 10 seconds, in real app you'd track actual duration
      }
    } catch (error: any) {
      console.error("[v0] Playback error:", error)
      Alert.alert("播放失败", error.message || "无法播放录音")
      setPlayingId(null)
    }
  }

  const handleDeleteRecording = async (taskItem: any) => {
    Alert.alert("删除录音", "确定要删除这个录音吗？此操作无法撤销。", [
      { text: "取消", style: "cancel" },
      {
        text: "删除",
        style: "destructive",
        onPress: async () => {
          try {
            await apiService.deleteRecording(taskItem.recording._id)
            await loadCompletedTasks() // Refresh list
            Alert.alert("成功", "录音已删除")
          } catch (error: any) {
            const errorMessage = error.response?.data?.error?.message || "删除失败"
            Alert.alert("错误", errorMessage)
          }
        },
      },
    ])
  }

  const renderTaskItem = ({ item }: { item: any }) => {
    const isPlaying = playingId === item.recording._id

    return (
      <View style={styles.taskItem}>
        <View style={styles.taskHeader}>
          <Text style={styles.taskId}>任务 {item.task.text_id}</Text>
          <Text style={styles.completedDate}>{new Date(item.recording.created_at).toLocaleDateString("zh-CN")}</Text>
        </View>

        <Text style={styles.taskText} numberOfLines={2}>
          {item.task.text_content}
        </Text>

        <View style={styles.transcriptionContainer}>
          <Text style={styles.transcriptionLabel}>方言转录：</Text>
          <Text style={styles.transcriptionText}>{item.recording.dialect_transcription}</Text>
        </View>

        <View style={styles.actionButtons}>
          {item.recording.audio_file_url && (
            <TouchableOpacity
              style={[styles.actionButton, styles.playButton]}
              onPress={() => handlePlayRecording(item.recording.audio_file_url, item.recording._id)}
            >
              <Icon name={isPlaying ? "stop" : "play-arrow"} size={20} color="#2196F3" />
              <Text style={[styles.actionButtonText, { color: "#2196F3" }]}>{isPlaying ? "停止" : "播放"}</Text>
            </TouchableOpacity>
          )}

          <TouchableOpacity
            style={[styles.actionButton, styles.deleteButton]}
            onPress={() => handleDeleteRecording(item)}
          >
            <Icon name="delete" size={20} color="#f44336" />
            <Text style={[styles.actionButtonText, { color: "#f44336" }]}>删除</Text>
          </TouchableOpacity>
        </View>

        {item.recording.duration_seconds && (
          <Text style={styles.durationText}>时长：{Math.round(item.recording.duration_seconds)}秒</Text>
        )}
      </View>
    )
  }

  const renderEmptyState = () => (
    <View style={styles.emptyState}>
      <Icon name="assignment-turned-in" size={64} color="#ccc" />
      <Text style={styles.emptyStateTitle}>暂无已完成任务</Text>
      <Text style={styles.emptyStateText}>完成录音任务后，它们会出现在这里</Text>
    </View>
  )

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <Text style={styles.headerTitle}>已完成任务</Text>
        <Text style={styles.headerSubtitle}>共 {completedTasks.length} 个任务已完成</Text>
      </View>

      <FlatList
        data={completedTasks}
        renderItem={renderTaskItem}
        keyExtractor={(item) => item.recording._id}
        contentContainerStyle={styles.listContainer}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} />}
        ListEmptyComponent={!isLoading ? renderEmptyState : null}
        showsVerticalScrollIndicator={false}
      />
    </View>
  )
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: "#f5f5f5",
  },
  header: {
    backgroundColor: "white",
    padding: 20,
    borderBottomWidth: 1,
    borderBottomColor: "#eee",
  },
  headerTitle: {
    fontSize: 24,
    fontWeight: "bold",
    color: "#333",
  },
  headerSubtitle: {
    fontSize: 14,
    color: "#666",
    marginTop: 4,
  },
  listContainer: {
    padding: 16,
    flexGrow: 1,
  },
  taskItem: {
    backgroundColor: "white",
    borderRadius: 12,
    padding: 16,
    marginBottom: 12,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.1,
    shadowRadius: 2,
    elevation: 2,
  },
  taskHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: 8,
  },
  taskId: {
    fontSize: 14,
    fontWeight: "600",
    color: "#4CAF50",
  },
  completedDate: {
    fontSize: 12,
    color: "#999",
  },
  taskText: {
    fontSize: 16,
    color: "#333",
    lineHeight: 22,
    marginBottom: 12,
  },
  transcriptionContainer: {
    backgroundColor: "#f9f9f9",
    padding: 12,
    borderRadius: 8,
    marginBottom: 12,
  },
  transcriptionLabel: {
    fontSize: 12,
    color: "#666",
    marginBottom: 4,
  },
  transcriptionText: {
    fontSize: 14,
    color: "#333",
    fontStyle: "italic",
  },
  actionButtons: {
    flexDirection: "row",
    gap: 12,
    marginBottom: 8,
  },
  actionButton: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 6,
    gap: 4,
  },
  playButton: {
    backgroundColor: "#e3f2fd",
  },
  deleteButton: {
    backgroundColor: "#ffebee",
  },
  actionButtonText: {
    fontSize: 14,
    fontWeight: "500",
  },
  durationText: {
    fontSize: 12,
    color: "#999",
    textAlign: "right",
  },
  emptyState: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
    paddingTop: 100,
  },
  emptyStateTitle: {
    fontSize: 20,
    fontWeight: "bold",
    color: "#666",
    marginTop: 16,
    marginBottom: 8,
  },
  emptyStateText: {
    fontSize: 16,
    color: "#999",
    textAlign: "center",
    paddingHorizontal: 40,
  },
})
