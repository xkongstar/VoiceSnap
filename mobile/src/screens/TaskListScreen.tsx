"use client"

import { useEffect, useState } from "react"
import { View, Text, FlatList, TouchableOpacity, RefreshControl, Alert } from "react-native"
import { MaterialIcons as Icon } from "@expo/vector-icons"
import { useAppStore } from "../store/appStore"
import { apiService } from "../services/apiService"
import type { Task } from "../store/appStore"
import { styles } from "../styles/TaskListScreenStyles"

export default function TaskListScreen({ navigation }: any) {
  const { pendingTasks, setPendingTasks, setCurrentTask, isLoading, setIsLoading, setError } = useAppStore()

  const [refreshing, setRefreshing] = useState(false)

  useEffect(() => {
    loadPendingTasks()
  }, [])

  const loadPendingTasks = async () => {
    try {
      setIsLoading(true)
      const response = await apiService.getPendingTasks()
      setPendingTasks(response.tasks)
    } catch (error: any) {
      const errorMessage = error.response?.data?.error?.message || "加载任务失败"
      setError(errorMessage)
      Alert.alert("错误", errorMessage)
    } finally {
      setIsLoading(false)
    }
  }

  const onRefresh = async () => {
    setRefreshing(true)
    await loadPendingTasks()
    setRefreshing(false)
  }

  const handleTaskPress = (task: Task) => {
    setCurrentTask(task)
    navigation.navigate("Recording")
  }

  const renderTaskItem = ({ item, index }: { item: Task; index: number }) => (
    <TouchableOpacity 
      style={[styles.taskItem, { transform: [{ translateY: index * 2 }] }]} 
      onPress={() => handleTaskPress(item)}
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
        {/* <Icon name="keyboard-arrow-right" size={20} color="#94a3b8" /> */}
      </View>
    </TouchableOpacity>
  )

  const renderEmptyState = () => (
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
  )

  return (
    <View style={styles.container}>
      {/* 头部渐变背景 */}
      <View style={styles.headerBackground} />
      
      <View style={styles.header}>
        <View style={styles.headerContent}>
          <View style={styles.titleSection}>
            <Text style={styles.headerTitle}>待录制任务</Text>
            <Text style={styles.headerSubtitle}>发现您的声音，记录方言之美</Text>
          </View>
          <View style={styles.taskCounter}>
            <Icon name="assignment" size={20} color="#4f46e5" />
            <Text style={styles.taskCountText}>{pendingTasks.length}</Text>
          </View>
        </View>
        {pendingTasks.length > 0 && (
          <View style={styles.progressSection}>
            <Text style={styles.progressText}>今日进度</Text>
            <View style={styles.progressBar}>
              <View style={[styles.progressFill, { width: '75%' }]} />
            </View>
            <Text style={styles.progressLabel}>继续加油！</Text>
          </View>
        )}
      </View>

      <FlatList
        data={pendingTasks}
        renderItem={renderTaskItem}
        keyExtractor={(item) => item._id}
        contentContainerStyle={styles.listContainer}
        refreshControl={
          <RefreshControl 
            refreshing={refreshing} 
            onRefresh={onRefresh}
            colors={['#4f46e5']}
            tintColor="#4f46e5"
          />
        }
        ListEmptyComponent={!isLoading ? renderEmptyState : null}
        showsVerticalScrollIndicator={false}
        ItemSeparatorComponent={() => <View style={styles.separator} />}
      />
    </View>
  )
}
