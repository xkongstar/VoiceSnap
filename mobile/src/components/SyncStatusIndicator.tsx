import React, { useState, useEffect, useCallback } from 'react'
import {
  View,
  Text,
  TouchableOpacity,
  Animated,
  StyleSheet,
  Modal,
  ScrollView,
  RefreshControl,
  Dimensions
} from 'react-native'
import { useAppStore } from '../store/appStore'
import { enhancedNetworkService } from '../services/enhancedNetworkService'
import { offlineStorageManager } from '../services/offlineStorageManager'
import { ConflictResolutionModal } from './ConflictResolutionModal'

// 简化的Icon组件
const Icon = ({ name, size = 24, color = '#000' }: { name: string; size?: number; color?: string }) => (
  <Text style={{ fontSize: size, color, fontFamily: 'System' }}>
    {name === 'wifi' ? '📶' : 
     name === 'wifi-off' ? '📵' : 
     name === 'sync' ? '🔄' : 
     name === 'check' ? '✅' : 
     name === 'warning' ? '⚠️' : 
     name === 'error' ? '❌' : 
     name === 'clock' ? '🕐' : 
     name === 'info' ? 'ℹ️' : 
     name === 'close' ? '✕' : '●'}
  </Text>
)

interface SyncStatusIndicatorProps {
  position?: 'top' | 'bottom'
  showDetailed?: boolean
}

export const SyncStatusIndicator: React.FC<SyncStatusIndicatorProps> = ({
  position = 'top',
  showDetailed = true
}) => {
  const [isDetailModalVisible, setIsDetailModalVisible] = useState(false)
  const [isConflictModalVisible, setIsConflictModalVisible] = useState(false)
  const [currentConflict, setCurrentConflict] = useState<any>(null)
  const [syncStats, setSyncStats] = useState<any>(null)
  const [isRefreshing, setIsRefreshing] = useState(false)
  const [animatedValue] = useState(new Animated.Value(0))

  const { networkState, syncStatus } = useAppStore()

  // 获取同步统计信息
  const loadSyncStats = useCallback(async () => {
    try {
      const stats = await enhancedNetworkService.getSyncStats()
      setSyncStats(stats)
    } catch (error) {
      console.error('获取同步统计失败:', error)
    }
  }, [])

  // 初始加载和定期更新
  useEffect(() => {
    loadSyncStats()
    const interval = setInterval(loadSyncStats, 10000) // 每10秒更新一次
    return () => clearInterval(interval)
  }, [loadSyncStats])

  // 同步动画
  useEffect(() => {
    if (syncStatus?.issyncing) {
      Animated.loop(
        Animated.sequence([
          Animated.timing(animatedValue, {
            toValue: 1,
            duration: 1000,
            useNativeDriver: true,
          }),
          Animated.timing(animatedValue, {
            toValue: 0,
            duration: 1000,
            useNativeDriver: true,
          }),
        ])
      ).start()
    } else {
      animatedValue.setValue(0)
    }
  }, [syncStatus?.issyncing, animatedValue])

  const handleManualSync = useCallback(async () => {
    try {
      await enhancedNetworkService.manualSync()
      await loadSyncStats()
    } catch (error) {
      console.error('手动同步失败:', error)
    }
  }, [loadSyncStats])

  const handleDetailModalRefresh = useCallback(async () => {
    setIsRefreshing(true)
    await loadSyncStats()
    setIsRefreshing(false)
  }, [loadSyncStats])

  const renderBasicIndicator = () => {
    const isOnline = networkState?.isOnline
    const isSyncing = syncStatus?.issyncing
    const hasConflicts = syncStats?.operations?.conflicts > 0
    const hasPendingOperations = (syncStats?.operations?.pending || 0) > 0
    const hasFailedOperations = (syncStats?.operations?.failed || 0) > 0

    let statusColor = '#10b981' // 默认绿色
    let statusIcon = 'check'
    let statusText = '已同步'

    if (!isOnline) {
      statusColor = '#f59e0b'
      statusIcon = 'wifi-off'
      statusText = '离线模式'
    } else if (isSyncing) {
      statusColor = '#3b82f6'
      statusIcon = 'sync'
      statusText = '同步中...'
    } else if (hasConflicts) {
      statusColor = '#ef4444'
      statusIcon = 'warning'
      statusText = `${syncStats.operations.conflicts} 个冲突`
    } else if (hasFailedOperations) {
      statusColor = '#ef4444'
      statusIcon = 'error'
      statusText = `${syncStats.operations.failed} 个失败`
    } else if (hasPendingOperations) {
      statusColor = '#f59e0b'
      statusIcon = 'clock'
      statusText = `${syncStats.operations.pending} 个待同步`
    }

    return (
      <TouchableOpacity
        style={[
          styles.basicIndicator,
          position === 'bottom' && styles.bottomPosition,
          { backgroundColor: statusColor }
        ]}
        onPress={() => showDetailed && setIsDetailModalVisible(true)}
        activeOpacity={0.8}
      >
        <Animated.View
          style={[
            styles.indicatorContent,
            isSyncing && {
              opacity: animatedValue.interpolate({
                inputRange: [0, 1],
                outputRange: [0.5, 1],
              }),
            },
          ]}
        >
          <Icon name={statusIcon} size={16} color="#fff" />
          <Text style={styles.indicatorText}>{statusText}</Text>
        </Animated.View>
      </TouchableOpacity>
    )
  }

  const renderDetailModal = () => (
    <Modal
      visible={isDetailModalVisible}
      animationType="slide"
      presentationStyle="pageSheet"
      onRequestClose={() => setIsDetailModalVisible(false)}
    >
      <View style={styles.modalContainer}>
        <View style={styles.modalHeader}>
          <Text style={styles.modalTitle}>同步状态详情</Text>
          <TouchableOpacity
            onPress={() => setIsDetailModalVisible(false)}
            style={styles.closeButton}
          >
            <Icon name="close" size={24} color="#6b7280" />
          </TouchableOpacity>
        </View>

        <ScrollView
          style={styles.modalContent}
          refreshControl={
            <RefreshControl
              refreshing={isRefreshing}
              onRefresh={handleDetailModalRefresh}
              colors={['#4f46e5']}
              tintColor="#4f46e5"
            />
          }
        >
          {/* 网络状态 */}
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>网络状态</Text>
            <View style={styles.networkStatus}>
              <View style={styles.statusItem}>
                <Icon 
                  name={networkState?.isOnline ? 'wifi' : 'wifi-off'} 
                  size={20} 
                  color={networkState?.isOnline ? '#10b981' : '#ef4444'} 
                />
                <Text style={styles.statusText}>
                  {networkState?.isOnline ? '在线' : '离线'}
                </Text>
              </View>
              
              {networkState?.isOnline && (
                <View style={styles.statusItem}>
                  <Text style={styles.statusLabel}>连接类型:</Text>
                  <Text style={styles.statusValue}>{networkState.type}</Text>
                </View>
              )}
              
              {networkState?.connectionQuality && (
                <View style={styles.statusItem}>
                  <Text style={styles.statusLabel}>连接质量:</Text>
                  <Text style={[
                    styles.statusValue,
                    { color: getQualityColor(networkState.connectionQuality) }
                  ]}>
                    {getQualityText(networkState.connectionQuality)}
                  </Text>
                </View>
              )}
            </View>
          </View>

          {/* 操作统计 */}
          {syncStats?.operations && (
            <View style={styles.section}>
              <Text style={styles.sectionTitle}>操作队列</Text>
              <View style={styles.operationStats}>
                <View style={styles.statItem}>
                  <Text style={styles.statNumber}>{syncStats.operations.total}</Text>
                  <Text style={styles.statLabel}>总计</Text>
                </View>
                <View style={styles.statItem}>
                  <Text style={[styles.statNumber, { color: '#f59e0b' }]}>
                    {syncStats.operations.pending}
                  </Text>
                  <Text style={styles.statLabel}>待同步</Text>
                </View>
                <View style={styles.statItem}>
                  <Text style={[styles.statNumber, { color: '#10b981' }]}>
                    {syncStats.operations.success}
                  </Text>
                  <Text style={styles.statLabel}>成功</Text>
                </View>
                <View style={styles.statItem}>
                  <Text style={[styles.statNumber, { color: '#ef4444' }]}>
                    {syncStats.operations.failed}
                  </Text>
                  <Text style={styles.statLabel}>失败</Text>
                </View>
                <View style={styles.statItem}>
                  <Text style={[styles.statNumber, { color: '#f59e0b' }]}>
                    {syncStats.operations.conflicts}
                  </Text>
                  <Text style={styles.statLabel}>冲突</Text>
                </View>
              </View>
            </View>
          )}

          {/* 最近同步 */}
          {syncStats?.lastSync && (
            <View style={styles.section}>
              <Text style={styles.sectionTitle}>最近同步</Text>
              <View style={styles.lastSyncInfo}>
                <Text style={styles.syncTime}>
                  {new Date(syncStats.lastSync.timestamp).toLocaleString()}
                </Text>
                {syncStats.lastSync.result && (
                  <Text style={styles.syncResult}>
                    成功: {syncStats.lastSync.result.success}, 
                    失败: {syncStats.lastSync.result.failed}
                  </Text>
                )}
                {syncStats.lastSync.error && (
                  <Text style={styles.syncError}>
                    错误: {syncStats.lastSync.error}
                  </Text>
                )}
              </View>
            </View>
          )}

          {/* 操作按钮 */}
          <View style={styles.actions}>
            <TouchableOpacity
              style={[
                styles.actionButton,
                styles.syncButton,
                (!networkState?.isOnline || syncStatus?.issyncing) && styles.disabledButton
              ]}
              onPress={handleManualSync}
              disabled={!networkState?.isOnline || syncStatus?.issyncing}
            >
              <Icon name="sync" size={16} color="#fff" />
              <Text style={styles.actionButtonText}>
                {syncStatus?.issyncing ? '同步中...' : '手动同步'}
              </Text>
            </TouchableOpacity>

            {syncStats?.operations?.conflicts > 0 && (
              <TouchableOpacity
                style={[styles.actionButton, styles.conflictButton]}
                onPress={() => {
                  // 这里可以显示冲突列表或直接打开第一个冲突
                  setIsDetailModalVisible(false)
                  setIsConflictModalVisible(true)
                }}
              >
                <Icon name="warning" size={16} color="#fff" />
                <Text style={styles.actionButtonText}>解决冲突</Text>
              </TouchableOpacity>
            )}
          </View>
        </ScrollView>
      </View>
    </Modal>
  )

  return (
    <>
      {renderBasicIndicator()}
      {renderDetailModal()}
      
      <ConflictResolutionModal
        visible={isConflictModalVisible}
        conflict={currentConflict}
        onClose={() => {
          setIsConflictModalVisible(false)
          setCurrentConflict(null)
        }}
        onResolved={(operationId, strategy) => {
          console.log(`冲突已解决: ${operationId}, 策略: ${strategy}`)
          loadSyncStats()
        }}
      />
    </>
  )
}

function getQualityColor(quality: string): string {
  switch (quality) {
    case 'excellent': return '#10b981'
    case 'good': return '#3b82f6'
    case 'poor': return '#f59e0b'
    case 'offline': return '#ef4444'
    default: return '#6b7280'
  }
}

function getQualityText(quality: string): string {
  switch (quality) {
    case 'excellent': return '优秀'
    case 'good': return '良好'
    case 'poor': return '较差'
    case 'offline': return '离线'
    default: return '未知'
  }
}

const { width } = Dimensions.get('window')

const styles = StyleSheet.create({
  basicIndicator: {
    position: 'absolute',
    top: 60,
    left: 20,
    right: 20,
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 20,
    zIndex: 1000,
  },
  bottomPosition: {
    top: undefined,
    bottom: 100,
  },
  indicatorContent: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
  },
  indicatorText: {
    color: '#fff',
    fontSize: 14,
    fontWeight: '500',
  },
  modalContainer: {
    flex: 1,
    backgroundColor: '#fff',
  },
  modalHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 20,
    paddingTop: 60,
    paddingBottom: 20,
    borderBottomWidth: 1,
    borderBottomColor: '#e5e7eb',
  },
  modalTitle: {
    fontSize: 20,
    fontWeight: 'bold',
    color: '#1f2937',
  },
  closeButton: {
    padding: 8,
  },
  modalContent: {
    flex: 1,
    paddingHorizontal: 20,
  },
  section: {
    marginVertical: 16,
  },
  sectionTitle: {
    fontSize: 18,
    fontWeight: '600',
    color: '#1f2937',
    marginBottom: 12,
  },
  networkStatus: {
    backgroundColor: '#f9fafb',
    borderRadius: 8,
    padding: 16,
    gap: 8,
  },
  statusItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  statusText: {
    fontSize: 16,
    fontWeight: '500',
    color: '#1f2937',
  },
  statusLabel: {
    fontSize: 14,
    color: '#6b7280',
  },
  statusValue: {
    fontSize: 14,
    fontWeight: '500',
    color: '#1f2937',
  },
  operationStats: {
    flexDirection: 'row',
    justifyContent: 'space-around',
    backgroundColor: '#f9fafb',
    borderRadius: 8,
    padding: 16,
  },
  statItem: {
    alignItems: 'center',
    gap: 4,
  },
  statNumber: {
    fontSize: 20,
    fontWeight: 'bold',
    color: '#1f2937',
  },
  statLabel: {
    fontSize: 12,
    color: '#6b7280',
  },
  lastSyncInfo: {
    backgroundColor: '#f9fafb',
    borderRadius: 8,
    padding: 16,
    gap: 8,
  },
  syncTime: {
    fontSize: 14,
    color: '#1f2937',
  },
  syncResult: {
    fontSize: 14,
    color: '#6b7280',
  },
  syncError: {
    fontSize: 14,
    color: '#ef4444',
  },
  actions: {
    gap: 12,
    marginVertical: 20,
  },
  actionButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    paddingVertical: 12,
    borderRadius: 8,
  },
  syncButton: {
    backgroundColor: '#4f46e5',
  },
  conflictButton: {
    backgroundColor: '#f59e0b',
  },
  disabledButton: {
    backgroundColor: '#d1d5db',
  },
  actionButtonText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '500',
  },
})