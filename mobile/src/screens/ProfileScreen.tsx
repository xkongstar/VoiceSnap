import { useEffect, useState } from "react"
import { View, Text, TouchableOpacity, StyleSheet, ScrollView, Alert } from "react-native"
import Icon from "react-native-vector-icons/MaterialIcons"
import { useAppStore } from "../store/appStore"
import { apiService } from "../services/apiService"
import { fileService } from "../services/fileService"
import { networkService } from "../services/networkService"

export default function ProfileScreen() {
  const { user, logout, setIsLoading, isLoading, offlineRecordings, isOnline } = useAppStore()
  const [statistics, setStatistics] = useState<any>(null)
  const [localFiles, setLocalFiles] = useState<any[]>([])
  const [isSyncing, setIsSyncing] = useState(false)

  useEffect(() => {
    loadUserStatistics()
    loadLocalFiles()
  }, [])

  const loadUserStatistics = async () => {
    try {
      setIsLoading(true)
      const response = await apiService.getUserStatistics()
      setStatistics(response.stats)
    } catch (error: any) {
      console.error("[v0] Load statistics error:", error)
      // Don't show alert for 401 errors as they're handled by interceptor
      if (error.response?.status !== 401) {
        Alert.alert("错误", "加载统计信息失败")
      }
    } finally {
      setIsLoading(false)
    }
  }

  const loadLocalFiles = async () => {
    try {
      const files = await fileService.listRecordings()
      setLocalFiles(files)
    } catch (error: any) {
      console.error("[v0] Load local files error:", error)
    }
  }

  const handleManualSync = async () => {
    if (!isOnline) {
      Alert.alert("网络未连接", "请检查网络连接后重试")
      return
    }

    if (offlineRecordings.length === 0) {
      Alert.alert("提示", "没有需要同步的离线录音")
      return
    }

    Alert.alert("同步离线录音", `发现 ${offlineRecordings.length} 个离线录音，是否立即同步？`, [
      { text: "取消", style: "cancel" },
      {
        text: "同步",
        onPress: async () => {
          setIsSyncing(true)
          try {
            const result = await networkService.manualSync()

            if (result.success > 0) {
              Alert.alert("同步成功", `成功上传 ${result.success} 个录音`)
              await loadUserStatistics() // Refresh stats
            }

            if (result.failed > 0) {
              Alert.alert("部分失败", `${result.success} 个成功，${result.failed} 个失败`)
            }
          } catch (error: any) {
            Alert.alert("同步失败", error.message || "同步过程中出现错误")
          } finally {
            setIsSyncing(false)
          }
        },
      },
    ])
  }

  const handleLogout = () => {
    Alert.alert("退出登录", "确定要退出登录吗？", [
      { text: "取消", style: "cancel" },
      {
        text: "退出",
        style: "destructive",
        onPress: () => {
          logout()
          Alert.alert("已退出", "您已成功退出登录")
        },
      },
    ])
  }

  const handleCleanupFiles = async () => {
    Alert.alert("清理缓存", "确定要清理临时文件吗？", [
      { text: "取消", style: "cancel" },
      {
        text: "清理",
        onPress: async () => {
          try {
            await fileService.cleanupTempFiles()
            await loadLocalFiles()
            Alert.alert("成功", "临时文件已清理")
          } catch (error: any) {
            Alert.alert("错误", "清理失败：" + error.message)
          }
        },
      },
    ])
  }

  const StatCard = ({ title, value, icon, color = "#2196F3" }: any) => (
    <View style={styles.statCard}>
      <View style={[styles.statIcon, { backgroundColor: color + "20" }]}>
        <Icon name={icon} size={24} color={color} />
      </View>
      <View style={styles.statContent}>
        <Text style={styles.statValue}>{value}</Text>
        <Text style={styles.statTitle}>{title}</Text>
      </View>
    </View>
  )

  return (
    <ScrollView style={styles.container}>
      <View style={styles.header}>
        <View style={styles.userInfo}>
          <View style={styles.avatar}>
            <Icon name="person" size={32} color="#2196F3" />
          </View>
          <View style={styles.userDetails}>
            <Text style={styles.username}>{user?.username}</Text>
            <Text style={styles.userEmail}>{user?.email || "未设置邮箱"}</Text>
          </View>
        </View>
      </View>

      {offlineRecordings.length > 0 && (
        <View style={styles.syncSection}>
          <View style={styles.syncHeader}>
            <Icon name="sync" size={24} color="#FF9800" />
            <Text style={styles.syncTitle}>离线录音</Text>
          </View>
          <Text style={styles.syncDescription}>有 {offlineRecordings.length} 个录音等待上传</Text>
          <TouchableOpacity
            style={[styles.syncButton, (!isOnline || isSyncing) && styles.syncButtonDisabled]}
            onPress={handleManualSync}
            disabled={!isOnline || isSyncing}
          >
            <Icon name={isSyncing ? "hourglass-empty" : "cloud-upload"} size={20} color="white" />
            <Text style={styles.syncButtonText}>{isSyncing ? "同步中..." : isOnline ? "立即同步" : "网络未连接"}</Text>
          </TouchableOpacity>
        </View>
      )}

      {statistics && (
        <View style={styles.statsSection}>
          <Text style={styles.sectionTitle}>录音统计</Text>
          <View style={styles.statsGrid}>
            <StatCard title="总录音数" value={statistics.total_recordings} icon="mic" color="#4CAF50" />
            <StatCard
              title="总时长"
              value={`${Math.round(statistics.total_duration / 60)}分钟`}
              icon="schedule"
              color="#FF9800"
            />
            <StatCard title="完成率" value={`${statistics.completion_rate}%`} icon="trending-up" color="#9C27B0" />
            <StatCard title="活跃天数" value={`${statistics.days_active}天`} icon="calendar-today" color="#00BCD4" />
          </View>
        </View>
      )}

      <View style={styles.section}>
        <Text style={styles.sectionTitle}>本地文件</Text>
        <View style={styles.fileInfo}>
          <Text style={styles.fileCount}>本地录音文件：{localFiles.length} 个</Text>
          <Text style={styles.fileSize}>
            总大小：{fileService.formatFileSize(localFiles.reduce((sum, file) => sum + file.size, 0))}
          </Text>
        </View>
      </View>

      <View style={styles.section}>
        <Text style={styles.sectionTitle}>设置</Text>

        <TouchableOpacity style={styles.settingItem} onPress={handleCleanupFiles}>
          <Icon name="cleaning-services" size={24} color="#666" />
          <Text style={styles.settingText}>清理临时文件</Text>
          <Icon name="keyboard-arrow-right" size={24} color="#ccc" />
        </TouchableOpacity>

        <TouchableOpacity style={styles.settingItem} onPress={loadUserStatistics}>
          <Icon name="refresh" size={24} color="#666" />
          <Text style={styles.settingText}>刷新统计数据</Text>
          <Icon name="keyboard-arrow-right" size={24} color="#ccc" />
        </TouchableOpacity>
      </View>

      <TouchableOpacity style={styles.logoutButton} onPress={handleLogout}>
        <Icon name="logout" size={24} color="#f44336" />
        <Text style={styles.logoutText}>退出登录</Text>
      </TouchableOpacity>
    </ScrollView>
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
  userInfo: {
    flexDirection: "row",
    alignItems: "center",
  },
  avatar: {
    width: 60,
    height: 60,
    borderRadius: 30,
    backgroundColor: "#e3f2fd",
    justifyContent: "center",
    alignItems: "center",
    marginRight: 16,
  },
  userDetails: {
    flex: 1,
  },
  username: {
    fontSize: 20,
    fontWeight: "bold",
    color: "#333",
    marginBottom: 4,
  },
  userEmail: {
    fontSize: 14,
    color: "#666",
  },
  syncSection: {
    backgroundColor: "#fff3e0",
    margin: 16,
    padding: 20,
    borderRadius: 12,
    borderLeftWidth: 4,
    borderLeftColor: "#FF9800",
  },
  syncHeader: {
    flexDirection: "row",
    alignItems: "center",
    marginBottom: 8,
    gap: 8,
  },
  syncTitle: {
    fontSize: 18,
    fontWeight: "600",
    color: "#FF9800",
  },
  syncDescription: {
    fontSize: 14,
    color: "#666",
    marginBottom: 16,
  },
  syncButton: {
    backgroundColor: "#FF9800",
    paddingVertical: 12,
    paddingHorizontal: 16,
    borderRadius: 8,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 8,
  },
  syncButtonDisabled: {
    backgroundColor: "#ccc",
  },
  syncButtonText: {
    color: "white",
    fontSize: 16,
    fontWeight: "600",
  },
  statsSection: {
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
  sectionTitle: {
    fontSize: 18,
    fontWeight: "600",
    color: "#333",
    marginBottom: 16,
  },
  statsGrid: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 12,
  },
  statCard: {
    flex: 1,
    minWidth: "45%",
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "#f9f9f9",
    padding: 12,
    borderRadius: 8,
  },
  statIcon: {
    width: 40,
    height: 40,
    borderRadius: 20,
    justifyContent: "center",
    alignItems: "center",
    marginRight: 12,
  },
  statContent: {
    flex: 1,
  },
  statValue: {
    fontSize: 18,
    fontWeight: "bold",
    color: "#333",
  },
  statTitle: {
    fontSize: 12,
    color: "#666",
    marginTop: 2,
  },
  section: {
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
  fileInfo: {
    gap: 8,
  },
  fileCount: {
    fontSize: 16,
    color: "#333",
  },
  fileSize: {
    fontSize: 14,
    color: "#666",
  },
  settingItem: {
    flexDirection: "row",
    alignItems: "center",
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: "#f0f0f0",
  },
  settingText: {
    flex: 1,
    fontSize: 16,
    color: "#333",
    marginLeft: 12,
  },
  logoutButton: {
    backgroundColor: "white",
    margin: 16,
    padding: 16,
    borderRadius: 12,
    flexDirection: "row",
    justifyContent: "center",
    alignItems: "center",
    gap: 8,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 3,
  },
  logoutText: {
    fontSize: 16,
    fontWeight: "600",
    color: "#f44336",
  },
})
