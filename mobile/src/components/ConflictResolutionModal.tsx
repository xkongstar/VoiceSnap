import React, { useState, useCallback } from 'react'
import {
  View,
  Text,
  Modal,
  TouchableOpacity,
  ScrollView,
  StyleSheet,
  Alert,
  Dimensions
} from 'react-native'
import { 
  offlineStorageManager, 
  ConflictResolutionStrategy,
  OfflineOperation,
  OfflineOperationType 
} from '../services/offlineStorageManager'
import { logInfo, logError } from '../utils/logger'

// 简化的Icon组件
const Icon = ({ name, size = 24, color = '#000' }: { name: string; size?: number; color?: string }) => (
  <Text style={{ fontSize: size, color, fontFamily: 'System' }}>
    {name === 'warning' ? '⚠️' : 
     name === 'merge' ? '🔄' : 
     name === 'client' ? '📱' : 
     name === 'server' ? '☁️' : 
     name === 'close' ? '✕' : 
     name === 'check' ? '✓' : '●'}
  </Text>
)

interface ConflictData {
  local: any
  server: any
  operation: OfflineOperation
}

interface ConflictResolutionModalProps {
  visible: boolean
  conflict: ConflictData | null
  onClose: () => void
  onResolved: (operationId: string, strategy: ConflictResolutionStrategy) => void
}

export const ConflictResolutionModal: React.FC<ConflictResolutionModalProps> = ({
  visible,
  conflict,
  onClose,
  onResolved
}) => {
  const [selectedStrategy, setSelectedStrategy] = useState<ConflictResolutionStrategy | null>(null)
  const [mergedData, setMergedData] = useState<any>(null)
  const [isResolving, setIsResolving] = useState(false)

  const handleResolveConflict = useCallback(async () => {
    if (!conflict || !selectedStrategy) return

    setIsResolving(true)
    
    try {
      logInfo(`解决冲突: ${conflict.operation.id}`, { strategy: selectedStrategy })
      
      await offlineStorageManager.resolveConflict(
        conflict.operation.id,
        selectedStrategy,
        selectedStrategy === ConflictResolutionStrategy.MERGE ? mergedData : undefined
      )

      onResolved(conflict.operation.id, selectedStrategy)
      onClose()
      
      Alert.alert('成功', '冲突已解决')
    } catch (error) {
      logError('解决冲突失败', error as Error)
      Alert.alert('错误', '解决冲突失败，请重试')
    } finally {
      setIsResolving(false)
    }
  }, [conflict, selectedStrategy, mergedData, onResolved, onClose])

  const renderOperationDetails = () => {
    if (!conflict) return null

    const { operation, local, server } = conflict

    return (
      <View style={styles.operationDetails}>
        <Text style={styles.operationTitle}>
          {getOperationTitle(operation.type)}
        </Text>
        <Text style={styles.operationTime}>
          发生时间: {new Date(operation.metadata.timestamp).toLocaleString()}
        </Text>
        
        <View style={styles.dataComparison}>
          <View style={styles.dataSection}>
            <View style={styles.dataSectionHeader}>
              <Icon name="client" size={16} color="#4f46e5" />
              <Text style={styles.dataSectionTitle}>本地数据</Text>
            </View>
            <View style={styles.dataContent}>
              {renderDataPreview(local, operation.type)}
            </View>
          </View>

          <View style={styles.dataSection}>
            <View style={styles.dataSectionHeader}>
              <Icon name="server" size={16} color="#10b981" />
              <Text style={styles.dataSectionTitle}>服务器数据</Text>
            </View>
            <View style={styles.dataContent}>
              {renderDataPreview(server, operation.type)}
            </View>
          </View>
        </View>
      </View>
    )
  }

  const renderDataPreview = (data: any, operationType: OfflineOperationType) => {
    if (!data) return <Text style={styles.noData}>无数据</Text>

    switch (operationType) {
      case OfflineOperationType.CREATE_RECORDING:
      case OfflineOperationType.UPDATE_RECORDING:
        return (
          <View>
            <Text style={styles.dataItem}>
              转录文本: {data.dialect_transcription || '无'}
            </Text>
            <Text style={styles.dataItem}>
              时长: {data.duration_seconds || 0} 秒
            </Text>
            {data.updated_at && (
              <Text style={styles.dataItem}>
                更新时间: {new Date(data.updated_at).toLocaleString()}
              </Text>
            )}
          </View>
        )
      
      case OfflineOperationType.UPDATE_PROFILE:
        return (
          <View>
            <Text style={styles.dataItem}>
              用户名: {data.username || '无'}
            </Text>
            {data.updated_at && (
              <Text style={styles.dataItem}>
                更新时间: {new Date(data.updated_at).toLocaleString()}
              </Text>
            )}
          </View>
        )
      
      default:
        return (
          <Text style={styles.dataItem}>
            {JSON.stringify(data, null, 2).substring(0, 100)}...
          </Text>
        )
    }
  }

  const renderStrategyOptions = () => (
    <View style={styles.strategyOptions}>
      <Text style={styles.sectionTitle}>选择解决策略:</Text>
      
      <TouchableOpacity
        style={[
          styles.strategyOption,
          selectedStrategy === ConflictResolutionStrategy.CLIENT_WINS && styles.selectedStrategy
        ]}
        onPress={() => setSelectedStrategy(ConflictResolutionStrategy.CLIENT_WINS)}
      >
        <View style={styles.strategyHeader}>
          <Icon name="client" size={20} color="#4f46e5" />
          <Text style={styles.strategyTitle}>使用本地数据</Text>
        </View>
        <Text style={styles.strategyDescription}>
          保留本地修改，覆盖服务器上的数据
        </Text>
      </TouchableOpacity>

      <TouchableOpacity
        style={[
          styles.strategyOption,
          selectedStrategy === ConflictResolutionStrategy.SERVER_WINS && styles.selectedStrategy
        ]}
        onPress={() => setSelectedStrategy(ConflictResolutionStrategy.SERVER_WINS)}
      >
        <View style={styles.strategyHeader}>
          <Icon name="server" size={20} color="#10b981" />
          <Text style={styles.strategyTitle}>使用服务器数据</Text>
        </View>
        <Text style={styles.strategyDescription}>
          使用服务器上的最新数据，丢弃本地修改
        </Text>
      </TouchableOpacity>

      <TouchableOpacity
        style={[
          styles.strategyOption,
          selectedStrategy === ConflictResolutionStrategy.MERGE && styles.selectedStrategy
        ]}
        onPress={() => setSelectedStrategy(ConflictResolutionStrategy.MERGE)}
      >
        <View style={styles.strategyHeader}>
          <Icon name="merge" size={20} color="#f59e0b" />
          <Text style={styles.strategyTitle}>手动合并</Text>
        </View>
        <Text style={styles.strategyDescription}>
          手动选择要保留的字段，创建合并后的数据
        </Text>
      </TouchableOpacity>
    </View>
  )

  const renderMergeInterface = () => {
    if (selectedStrategy !== ConflictResolutionStrategy.MERGE || !conflict) return null

    // 简化的合并界面，实际应用中可以更复杂
    return (
      <View style={styles.mergeInterface}>
        <Text style={styles.sectionTitle}>合并数据:</Text>
        <Text style={styles.mergeHint}>
          请手动编辑合并后的数据，或选择特定字段
        </Text>
        
        {/* 这里可以添加更复杂的合并UI */}
        <View style={styles.mergePreview}>
          <Text style={styles.mergeText}>
            {JSON.stringify({ ...conflict.local, ...conflict.server }, null, 2)}
          </Text>
        </View>
      </View>
    )
  }

  if (!visible || !conflict) return null

  return (
    <Modal
      visible={visible}
      animationType="slide"
      presentationStyle="pageSheet"
      onRequestClose={onClose}
    >
      <View style={styles.container}>
        <View style={styles.header}>
          <View style={styles.headerTitle}>
            <Icon name="warning" size={24} color="#f59e0b" />
            <Text style={styles.title}>解决数据冲突</Text>
          </View>
          <TouchableOpacity onPress={onClose} style={styles.closeButton}>
            <Icon name="close" size={24} color="#6b7280" />
          </TouchableOpacity>
        </View>

        <ScrollView style={styles.content}>
          <View style={styles.warningBox}>
            <Text style={styles.warningText}>
              检测到数据冲突。请选择如何解决这个冲突。
            </Text>
          </View>

          {renderOperationDetails()}
          {renderStrategyOptions()}
          {renderMergeInterface()}
        </ScrollView>

        <View style={styles.footer}>
          <TouchableOpacity
            style={styles.cancelButton}
            onPress={onClose}
          >
            <Text style={styles.cancelButtonText}>取消</Text>
          </TouchableOpacity>
          
          <TouchableOpacity
            style={[
              styles.resolveButton,
              (!selectedStrategy || isResolving) && styles.disabledButton
            ]}
            onPress={handleResolveConflict}
            disabled={!selectedStrategy || isResolving}
          >
            <Text style={[
              styles.resolveButtonText,
              (!selectedStrategy || isResolving) && styles.disabledButtonText
            ]}>
              {isResolving ? '解决中...' : '解决冲突'}
            </Text>
          </TouchableOpacity>
        </View>
      </View>
    </Modal>
  )
}

function getOperationTitle(type: OfflineOperationType): string {
  switch (type) {
    case OfflineOperationType.CREATE_RECORDING:
      return '创建录音'
    case OfflineOperationType.UPDATE_RECORDING:
      return '更新录音'
    case OfflineOperationType.DELETE_RECORDING:
      return '删除录音'
    case OfflineOperationType.UPDATE_PROFILE:
      return '更新用户资料'
    case OfflineOperationType.COMPLETE_TASK:
      return '完成任务'
    default:
      return '未知操作'
  }
}

const { width } = Dimensions.get('window')

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#fff',
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 20,
    paddingTop: 60,
    paddingBottom: 20,
    borderBottomWidth: 1,
    borderBottomColor: '#e5e7eb',
  },
  headerTitle: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  title: {
    fontSize: 20,
    fontWeight: 'bold',
    color: '#1f2937',
  },
  closeButton: {
    padding: 8,
  },
  content: {
    flex: 1,
    paddingHorizontal: 20,
  },
  warningBox: {
    backgroundColor: '#fef3c7',
    padding: 16,
    borderRadius: 8,
    marginVertical: 16,
    borderLeftWidth: 4,
    borderLeftColor: '#f59e0b',
  },
  warningText: {
    color: '#92400e',
    fontSize: 14,
    lineHeight: 20,
  },
  operationDetails: {
    marginBottom: 24,
  },
  operationTitle: {
    fontSize: 18,
    fontWeight: '600',
    color: '#1f2937',
    marginBottom: 8,
  },
  operationTime: {
    fontSize: 14,
    color: '#6b7280',
    marginBottom: 16,
  },
  dataComparison: {
    gap: 16,
  },
  dataSection: {
    backgroundColor: '#f9fafb',
    borderRadius: 8,
    padding: 16,
  },
  dataSectionHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginBottom: 12,
  },
  dataSectionTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: '#1f2937',
  },
  dataContent: {
    gap: 8,
  },
  dataItem: {
    fontSize: 14,
    color: '#374151',
    lineHeight: 20,
  },
  noData: {
    fontSize: 14,
    color: '#9ca3af',
    fontStyle: 'italic',
  },
  sectionTitle: {
    fontSize: 18,
    fontWeight: '600',
    color: '#1f2937',
    marginBottom: 16,
  },
  strategyOptions: {
    marginBottom: 24,
  },
  strategyOption: {
    borderWidth: 2,
    borderColor: '#e5e7eb',
    borderRadius: 12,
    padding: 16,
    marginBottom: 12,
  },
  selectedStrategy: {
    borderColor: '#4f46e5',
    backgroundColor: '#f0f9ff',
  },
  strategyHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    marginBottom: 8,
  },
  strategyTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: '#1f2937',
  },
  strategyDescription: {
    fontSize: 14,
    color: '#6b7280',
    lineHeight: 20,
  },
  mergeInterface: {
    marginBottom: 24,
  },
  mergeHint: {
    fontSize: 14,
    color: '#6b7280',
    marginBottom: 12,
  },
  mergePreview: {
    backgroundColor: '#f3f4f6',
    borderRadius: 8,
    padding: 12,
    maxHeight: 200,
  },
  mergeText: {
    fontSize: 12,
    fontFamily: 'monospace',
    color: '#374151',
  },
  footer: {
    flexDirection: 'row',
    paddingHorizontal: 20,
    paddingVertical: 16,
    borderTopWidth: 1,
    borderTopColor: '#e5e7eb',
    gap: 12,
  },
  cancelButton: {
    flex: 1,
    paddingVertical: 12,
    alignItems: 'center',
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#d1d5db',
  },
  cancelButtonText: {
    fontSize: 16,
    fontWeight: '500',
    color: '#6b7280',
  },
  resolveButton: {
    flex: 2,
    paddingVertical: 12,
    alignItems: 'center',
    borderRadius: 8,
    backgroundColor: '#4f46e5',
  },
  resolveButtonText: {
    fontSize: 16,
    fontWeight: '500',
    color: '#fff',
  },
  disabledButton: {
    backgroundColor: '#d1d5db',
  },
  disabledButtonText: {
    color: '#9ca3af',
  },
})