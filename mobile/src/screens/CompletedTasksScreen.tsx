"use client"

import { useEffect, useState } from "react"
import { View, Text, FlatList, TouchableOpacity, RefreshControl, Alert } from "react-native"
import { MaterialIcons as Icon } from "@expo/vector-icons"
import { useAppStore, type CompletedTaskItem } from "../store/appStore"
import { apiService } from "../services/apiService"
import { audioService } from "../services/audioService"
import { styles } from "../styles/CompletedTasksScreenStyles"

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

  const handleDeleteRecording = async (taskItem: CompletedTaskItem) => {
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

  const renderTaskItem = ({ item }: { item: CompletedTaskItem }) => {
    const isPlaying = playingId === item.recording._id
    const duration = item.recording.duration_seconds ? Math.round(item.recording.duration_seconds) : 0

    return (
      <View style={styles.taskItem}>
        <View style={styles.taskHeader}>
          <View style={styles.taskBadgeCompleted}>
            <Icon name="check-circle" size={16} color="#10b981" />
            <Text style={styles.taskId}>任务 {item.task.text_id}</Text>
          </View>
          <View style={styles.completedDateBadge}>
            <Icon name="schedule" size={14} color="#64748b" />
            <Text style={styles.completedDate}>{new Date(item.recording.created_at).toLocaleDateString("zh-CN")}</Text>
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
              onPress={() => handlePlayRecording(item.recording.audio_file_url!, item.recording._id)}
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
            onPress={() => handleDeleteRecording(item)}
            activeOpacity={0.7}
          >
            <Icon name="delete" size={20} color="#ef4444" />
            <Text style={[styles.actionButtonText, { color: "#ef4444" }]}>删除</Text>
          </TouchableOpacity>
        </View>
      </View>
    )
  }

  const renderEmptyState = () => (
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
  )

  return (
    <View style={styles.container}>
      {/* 头部渐变背景 */}
      <View style={styles.headerBackground} />
      
      <View style={styles.header}>
        <View style={styles.headerContent}>
          <View style={styles.titleSection}>
            <Text style={styles.headerTitle}>已完成任务</Text>
            <Text style={styles.headerSubtitle}>您的录音成果展示</Text>
          </View>
          <View style={styles.achievementBadge}>
            <Icon name="emoji-events" size={20} color="#fbbf24" />
            <Text style={styles.achievementText}>{completedTasks.length}</Text>
          </View>
        </View>
        {completedTasks.length > 0 && (
          <View style={styles.statsRow}>
            <View style={styles.statItem}>
              <Icon name="mic" size={16} color="rgba(255, 255, 255, 0.8)" />
              <Text style={styles.statText}>{completedTasks.length} 个录音</Text>
            </View>
            <View style={styles.statItem}>
              <Icon name="timer" size={16} color="rgba(255, 255, 255, 0.8)" />
              <Text style={styles.statText}>
                {Math.round(completedTasks.reduce((sum, item) => sum + (item.recording?.duration_seconds || 0), 0) / 60)} 分钟
              </Text>
            </View>
          </View>
        )}
      </View>

      <FlatList
        data={completedTasks}
        renderItem={renderTaskItem}
        keyExtractor={(item) => item.recording._id}
        contentContainerStyle={styles.listContainer}
        refreshControl={
          <RefreshControl 
            refreshing={refreshing} 
            onRefresh={onRefresh}
            colors={['#10b981']}
            tintColor="#10b981"
          />
        }
        ListEmptyComponent={!isLoading ? renderEmptyState : null}
        showsVerticalScrollIndicator={false}
        ItemSeparatorComponent={() => <View style={styles.separator} />}
      />
    </View>
  )
}
  