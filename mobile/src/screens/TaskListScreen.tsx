"use client"

import { useEffect, useState } from "react"
import { View, Text, FlatList, TouchableOpacity, StyleSheet, RefreshControl, Alert } from "react-native"
import Icon from "react-native-vector-icons/MaterialIcons"
import { useAppStore } from "../store/appStore"
import { apiService } from "../services/apiService"
import type { Task } from "../store/appStore"

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

  const renderTaskItem = ({ item }: { item: Task }) => (
    <TouchableOpacity style={styles.taskItem} onPress={() => handleTaskPress(item)}>
      <View style={styles.taskContent}>
        <Text style={styles.taskId}>任务 {item.text_id}</Text>
        <Text style={styles.taskText} numberOfLines={3}>
          {item.text_content}
        </Text>
      </View>
      <Icon name="keyboard-arrow-right" size={24} color="#666" />
    </TouchableOpacity>
  )

  const renderEmptyState = () => (
    <View style={styles.emptyState}>
      <Icon name="check-circle" size={64} color="#4CAF50" />
      <Text style={styles.emptyStateTitle}>太棒了！</Text>
      <Text style={styles.emptyStateText}>您已经完成了所有可用的录音任务</Text>
    </View>
  )

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <Text style={styles.headerTitle}>待录制任务</Text>
        <Text style={styles.headerSubtitle}>共 {pendingTasks.length} 个任务待完成</Text>
      </View>

      <FlatList
        data={pendingTasks}
        renderItem={renderTaskItem}
        keyExtractor={(item) => item._id}
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
    flexDirection: "row",
    alignItems: "center",
    shadowColor: "#000",
    shadowOffset: {
      width: 0,
      height: 1,
    },
    shadowOpacity: 0.1,
    shadowRadius: 2,
    elevation: 2,
  },
  taskContent: {
    flex: 1,
  },
  taskId: {
    fontSize: 14,
    fontWeight: "600",
    color: "#2196F3",
    marginBottom: 8,
  },
  taskText: {
    fontSize: 16,
    color: "#333",
    lineHeight: 22,
  },
  emptyState: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
    paddingTop: 100,
  },
  emptyStateTitle: {
    fontSize: 24,
    fontWeight: "bold",
    color: "#4CAF50",
    marginTop: 16,
    marginBottom: 8,
  },
  emptyStateText: {
    fontSize: 16,
    color: "#666",
    textAlign: "center",
    paddingHorizontal: 40,
  },
})
