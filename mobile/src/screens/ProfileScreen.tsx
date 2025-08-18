import { useEffect, useState } from "react"
import { View, Text, TouchableOpacity, StyleSheet, ScrollView, Alert } from "react-native"
import { MaterialIcons as Icon } from "@expo/vector-icons"
import { useAppStore } from "../store/appStore"
import { apiService } from "../services/apiService"
import { fileService } from "../services/fileService"
import { networkService } from "../services/networkService"
import { styles } from "../styles/ProfileScreenStyles"

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

  const StatCard = ({ title, value, icon, color = "#4f46e5", bgColor = "#f1f5f9" }: any) => (
    <View style={styles.statCard}>
      <View style={[styles.statIcon, { backgroundColor: bgColor }]}>
        <Icon name={icon} size={28} color={color} />
      </View>
      <View style={styles.statContent}>
        <Text style={styles.statValue}>{value}</Text>
        <Text style={styles.statTitle}>{title}</Text>
      </View>
      <View style={styles.statDecoration} />
    </View>
  )

  return (
    <ScrollView style={styles.container}>
      {/* 头部渐变背景 */}
      <View style={styles.headerBackground} />
      
      {/* 用户信息区域 */}
      <View style={styles.header}>
        <View style={styles.userInfo}>
          <View style={styles.avatarContainer}>
            <View style={styles.avatar}>
              <Icon name="person" size={36} color="#4f46e5" />
            </View>
            <View style={styles.onlineIndicator}>
              <Icon name={isOnline ? "wifi" : "wifi-off"} size={12} color={isOnline ? "#10b981" : "#f59e0b"} />
            </View>
          </View>
          <View style={styles.userDetails}>
            <Text style={styles.username}>{user?.username}</Text>
            <Text style={styles.userEmail}>{user?.email || "未设置邮箱"}</Text>
            <View style={styles.userBadge}>
              <Icon name="star" size={14} color="#fbbf24" />
              <Text style={styles.userLevel}>方言记录者</Text>
            </View>
          </View>
        </View>
      </View>

      {/* 离线同步提示 */}
      {offlineRecordings.length > 0 && (
        <View style={styles.syncSection}>
          <View style={styles.syncAlert}>
            <View style={styles.syncIcon}>
              <Icon name="sync" size={24} color="#f59e0b" />
            </View>
            <View style={styles.syncContent}>
              <Text style={styles.syncTitle}>离线录音</Text>
              <Text style={styles.syncDescription}>有 {offlineRecordings.length} 个录音等待上传</Text>
            </View>
          </View>
          <TouchableOpacity
            style={[styles.syncButton, (!isOnline || isSyncing) && styles.syncButtonDisabled]}
            onPress={handleManualSync}
            disabled={!isOnline || isSyncing}
            activeOpacity={0.8}
          >
            <Icon name={isSyncing ? "hourglass-empty" : "cloud-upload"} size={20} color="white" />
            <Text style={styles.syncButtonText}>{isSyncing ? "同步中..." : isOnline ? "立即同步" : "网络未连接"}</Text>
          </TouchableOpacity>
        </View>
      )}

      {/* 统计数据 */}
      {statistics && (
        <View style={styles.statsSection}>
          <View style={styles.sectionHeader}>
            <Icon name="bar-chart" size={20} color="#6366f1" />
            <Text style={styles.sectionTitle}>录音统计</Text>
          </View>
          <View style={styles.statsGrid}>
            <StatCard 
              title="总录音数" 
              value={statistics.total_recordings} 
              icon="mic" 
              color="#10b981" 
              bgColor="#f0fdf4"
            />
            <StatCard
              title="总时长"
              value={`${Math.round(statistics.total_duration / 60)}分钟`}
              icon="schedule"
              color="#f59e0b"
              bgColor="#fffbeb"
            />
            <StatCard 
              title="完成率" 
              value={`${statistics.completion_rate}%`} 
              icon="trending-up" 
              color="#8b5cf6"
              bgColor="#faf5ff"
            />
            <StatCard 
              title="活跃天数" 
              value={`${statistics.days_active}天`} 
              icon="calendar-today" 
              color="#06b6d4"
              bgColor="#ecfeff"
            />
          </View>
        </View>
      )}

      {/* 本地文件信息 */}
      <View style={styles.section}>
        <View style={styles.sectionHeader}>
          <Icon name="folder" size={20} color="#64748b" />
          <Text style={styles.sectionTitle}>本地存储</Text>
        </View>
        <View style={styles.fileInfoCard}>
          <View style={styles.fileInfoItem}>
            <Icon name="audiotrack" size={20} color="#06b6d4" />
            <Text style={styles.fileCount}>录音文件：{localFiles.length} 个</Text>
          </View>
          <View style={styles.fileInfoItem}>
            <Icon name="storage" size={20} color="#8b5cf6" />
            <Text style={styles.fileSize}>
              存储空间：{fileService.formatFileSize(localFiles.reduce((sum, file) => sum + file.size, 0))}
            </Text>
          </View>
        </View>
      </View>

      {/* 设置选项 */}
      <View style={styles.section}>
        <View style={styles.sectionHeader}>
          <Icon name="settings" size={20} color="#64748b" />
          <Text style={styles.sectionTitle}>设置</Text>
        </View>
        <View style={styles.settingsContainer}>
          <TouchableOpacity style={styles.settingItem} onPress={handleCleanupFiles}>
            <View style={styles.settingLeft}>
              <View style={styles.settingIcon}>
                <Icon name="cleaning-services" size={20} color="#ef4444" />
              </View>
              <Text style={styles.settingText}>清理临时文件</Text>
            </View>
            <Icon name="keyboard-arrow-right" size={20} color="#cbd5e1" />
          </TouchableOpacity>

          <TouchableOpacity style={styles.settingItem} onPress={loadUserStatistics}>
            <View style={styles.settingLeft}>
              <View style={styles.settingIcon}>
                <Icon name="refresh" size={20} color="#06b6d4" />
              </View>
              <Text style={styles.settingText}>刷新统计数据</Text>
            </View>
            <Icon name="keyboard-arrow-right" size={20} color="#cbd5e1" />
          </TouchableOpacity>
        </View>
      </View>

      {/* 退出登录 */}
      <TouchableOpacity style={styles.logoutButton} onPress={handleLogout} activeOpacity={0.8}>
        <Icon name="logout" size={24} color="#ef4444" />
        <Text style={styles.logoutText}>退出登录</Text>
      </TouchableOpacity>
    </ScrollView>
  )
}
