import { create } from "zustand"
import { persist, createJSONStorage } from "zustand/middleware"
import { subscribeWithSelector } from "zustand/middleware"
import { shallow } from "zustand/shallow"
import AsyncStorage from "@react-native-async-storage/async-storage"

// 更新后的接口定义，包含更多性能优化字段
export interface User {
  _id: string
  username: string
  email?: string
  profile?: {
    display_name?: string
    avatar_url?: string
    bio?: string
    language_preferences?: string[]
  }
  stats: {
    total_recordings: number
    total_duration: number
    total_file_size: number
    completed_tasks: number
    average_recording_quality?: number
    first_recording_date?: string
    last_recording_date?: string
    daily_streak: number
    best_streak: number
  }
  preferences: {
    notifications_enabled: boolean
    email_notifications: boolean
    quality_threshold: number
    auto_upload: boolean
  }
}

export interface Task {
  _id: string
  text_content: string
  text_id: string
  category?: string
  difficulty_level?: 1 | 2 | 3 | 4 | 5
  dialect?: string
  priority: number
  is_active: boolean
  created_at: string
  completed?: boolean
  stats?: {
    total_recordings: number
    average_duration?: number
    average_quality?: number
    completion_rate?: number
  }
}

export interface Recording {
  _id: string
  task_id: string
  original_text: string
  dialect_transcription: string
  audio_file_url?: string
  file_name: string
  duration_seconds?: number
  file_size_bytes?: number
  audio_quality?: {
    snr?: number
    volume_level?: number
    silence_ratio?: number
    clarity_score?: number
  }
  metadata?: {
    mime_type?: string
    sample_rate?: number
    bit_rate?: number
    channels?: number
    encoding?: string
  }
  processing_status: "pending" | "processing" | "completed" | "failed"
  upload_status: "pending" | "uploading" | "completed" | "failed"
  created_at: string
  updated_at: string
}

export interface OfflineRecording {
  id: string
  task_id: string
  original_text: string
  dialect_transcription: string
  audio_file_path: string
  duration_seconds?: number
  created_at: string
  retry_count?: number
  last_error?: string
}

export interface CompletedTaskItem {
  task: Task
  recording: Recording
}

// 性能优化的缓存接口
export interface AppCache {
  lastSyncTime: number
  tasksLastFetch: number
  recordingsLastFetch: number
  pendingTasksCache?: Task[]
  completedTasksCache?: CompletedTaskItem[]
}

// === 认证相关状态 ===
interface AuthState {
  user: User | null
  token: string | null
  refreshToken: string | null
  isAuthenticated: boolean
  authLoading: boolean
  authError: string | null
  
  // Actions
  setUser: (user: User | null) => void
  setTokens: (accessToken: string | null, refreshToken?: string | null) => void
  setAuthLoading: (loading: boolean) => void
  setAuthError: (error: string | null) => void
  login: (user: User, accessToken: string, refreshToken: string) => void
  logout: () => void
  updateUserStats: (stats: Partial<User['stats']>) => void
}

export const useAuthStore = create<AuthState>()(
  persist(
    subscribeWithSelector((set, get) => ({
      user: null,
      token: null,
      refreshToken: null,
      isAuthenticated: false,
      authLoading: false,
      authError: null,

      setUser: (user) => set({ user }),
      setTokens: (accessToken, refreshToken) => 
        set({ 
          token: accessToken, 
          refreshToken: refreshToken || get().refreshToken 
        }),
      setAuthLoading: (loading) => set({ authLoading: loading }),
      setAuthError: (error) => set({ authError: error }),
      
      login: (user, accessToken, refreshToken) =>
        set({
          user,
          token: accessToken,
          refreshToken,
          isAuthenticated: true,
          authError: null,
        }),

      logout: () =>
        set({
          user: null,
          token: null,
          refreshToken: null,
          isAuthenticated: false,
          authError: null,
        }),

      updateUserStats: (stats) =>
        set((state) => ({
          user: state.user ? {
            ...state.user,
            stats: { ...state.user.stats, ...stats }
          } : null
        })),
    })),
    {
      name: "auth-storage",
      storage: createJSONStorage(() => AsyncStorage),
      partialize: (state) => ({
        user: state.user,
        token: state.token,
        refreshToken: state.refreshToken,
        isAuthenticated: state.isAuthenticated,
      }),
    },
  ),
)

// === 任务相关状态 ===
interface TaskState {
  tasks: Task[]
  pendingTasks: Task[]
  completedTasks: CompletedTaskItem[]
  currentTask: Task | null
  tasksLoading: boolean
  tasksError: string | null
  lastFetchTime: number
  
  // Actions
  setTasks: (tasks: Task[]) => void
  setPendingTasks: (tasks: Task[]) => void
  setCompletedTasks: (tasks: CompletedTaskItem[]) => void
  setCurrentTask: (task: Task | null) => void
  setTasksLoading: (loading: boolean) => void
  setTasksError: (error: string | null) => void
  updateTask: (taskId: string, updates: Partial<Task>) => void
  markTaskCompleted: (taskId: string, recording: Recording) => void
  clearTasks: () => void
}

export const useTaskStore = create<TaskState>()(
  subscribeWithSelector((set, get) => ({
    tasks: [],
    pendingTasks: [],
    completedTasks: [],
    currentTask: null,
    tasksLoading: false,
    tasksError: null,
    lastFetchTime: 0,

    setTasks: (tasks) => set({ tasks, lastFetchTime: Date.now() }),
    setPendingTasks: (pendingTasks) => set({ pendingTasks }),
    setCompletedTasks: (completedTasks) => set({ completedTasks }),
    setCurrentTask: (currentTask) => set({ currentTask }),
    setTasksLoading: (loading) => set({ tasksLoading: loading }),
    setTasksError: (error) => set({ tasksError: error }),
    
    updateTask: (taskId, updates) =>
      set((state) => ({
        tasks: state.tasks.map(task => 
          task._id === taskId ? { ...task, ...updates } : task
        ),
        pendingTasks: state.pendingTasks.map(task => 
          task._id === taskId ? { ...task, ...updates } : task
        ),
      })),

    markTaskCompleted: (taskId, recording) =>
      set((state) => {
        const task = state.tasks.find(t => t._id === taskId)
        if (!task) return state

        const completedTask: CompletedTaskItem = { task, recording }
        
        return {
          pendingTasks: state.pendingTasks.filter(t => t._id !== taskId),
          completedTasks: [completedTask, ...state.completedTasks],
          currentTask: state.currentTask?._id === taskId ? null : state.currentTask,
        }
      }),

    clearTasks: () => set({
      tasks: [],
      pendingTasks: [],
      completedTasks: [],
      currentTask: null,
      tasksError: null,
    }),
  }))
)

// === 录音相关状态 ===
interface RecordingState {
  recordings: Recording[]
  isRecording: boolean
  currentRecording: string | null
  recordingProgress: {
    duration: number
    fileSize: number
    quality?: {
      volume_level?: number
      snr?: number
    }
  }
  recordingsLoading: boolean
  recordingsError: string | null
  
  // Actions
  setRecordings: (recordings: Recording[]) => void
  setIsRecording: (isRecording: boolean) => void
  setCurrentRecording: (path: string | null) => void
  updateRecordingProgress: (progress: Partial<RecordingState['recordingProgress']>) => void
  setRecordingsLoading: (loading: boolean) => void
  setRecordingsError: (error: string | null) => void
  addRecording: (recording: Recording) => void
  updateRecording: (recordingId: string, updates: Partial<Recording>) => void
  removeRecording: (recordingId: string) => void
  clearRecordings: () => void
}

export const useRecordingStore = create<RecordingState>()(
  subscribeWithSelector((set, get) => ({
    recordings: [],
    isRecording: false,
    currentRecording: null,
    recordingProgress: {
      duration: 0,
      fileSize: 0,
    },
    recordingsLoading: false,
    recordingsError: null,

    setRecordings: (recordings) => set({ recordings }),
    setIsRecording: (isRecording) => set({ isRecording }),
    setCurrentRecording: (currentRecording) => set({ currentRecording }),
    updateRecordingProgress: (progress) =>
      set((state) => ({
        recordingProgress: { ...state.recordingProgress, ...progress }
      })),
    setRecordingsLoading: (loading) => set({ recordingsLoading: loading }),
    setRecordingsError: (error) => set({ recordingsError: error }),

    addRecording: (recording) =>
      set((state) => ({
        recordings: [recording, ...state.recordings]
      })),

    updateRecording: (recordingId, updates) =>
      set((state) => ({
        recordings: state.recordings.map(recording =>
          recording._id === recordingId ? { ...recording, ...updates } : recording
        )
      })),

    removeRecording: (recordingId) =>
      set((state) => ({
        recordings: state.recordings.filter(r => r._id !== recordingId)
      })),

    clearRecordings: () => set({
      recordings: [],
      currentRecording: null,
      recordingsError: null,
    }),
  }))
)

// === 离线相关状态 ===
interface OfflineState {
  offlineRecordings: OfflineRecording[]
  isOnline: boolean
  syncStatus: 'idle' | 'syncing' | 'success' | 'error'
  syncProgress: number
  lastSyncTime: number
  syncError: string | null
  
  // Actions
  addOfflineRecording: (recording: OfflineRecording) => void
  removeOfflineRecording: (id: string) => void
  updateOfflineRecording: (id: string, updates: Partial<OfflineRecording>) => void
  setIsOnline: (isOnline: boolean) => void
  setSyncStatus: (status: OfflineState['syncStatus']) => void
  setSyncProgress: (progress: number) => void
  setSyncError: (error: string | null) => void
  clearOfflineData: () => void
}

export const useOfflineStore = create<OfflineState>()(
  persist(
    subscribeWithSelector((set, get) => ({
      offlineRecordings: [],
      isOnline: true,
      syncStatus: 'idle',
      syncProgress: 0,
      lastSyncTime: 0,
      syncError: null,

      addOfflineRecording: (recording) =>
        set((state) => ({
          offlineRecordings: [...state.offlineRecordings, recording]
        })),

      removeOfflineRecording: (id) =>
        set((state) => ({
          offlineRecordings: state.offlineRecordings.filter(r => r.id !== id)
        })),

      updateOfflineRecording: (id, updates) =>
        set((state) => ({
          offlineRecordings: state.offlineRecordings.map(recording =>
            recording.id === id ? { ...recording, ...updates } : recording
          )
        })),

      setIsOnline: (isOnline) => set({ isOnline }),
      setSyncStatus: (syncStatus) => set({ syncStatus }),
      setSyncProgress: (progress) => set({ syncProgress: progress }),
      setSyncError: (error) => set({ syncError: error }),

      clearOfflineData: () => set({
        offlineRecordings: [],
        syncStatus: 'idle',
        syncProgress: 0,
        syncError: null,
      }),
    })),
    {
      name: "offline-storage",
      storage: createJSONStorage(() => AsyncStorage),
      partialize: (state) => ({
        offlineRecordings: state.offlineRecordings,
        lastSyncTime: state.lastSyncTime,
      }),
    },
  ),
)

// === UI状态 ===
interface UIState {
  isLoading: boolean
  error: string | null
  activeTab: string
  toastMessage: string | null
  
  // Actions
  setIsLoading: (loading: boolean) => void
  setError: (error: string | null) => void
  setActiveTab: (tab: string) => void
  showToast: (message: string) => void
  hideToast: () => void
}

export const useUIStore = create<UIState>()((set) => ({
  isLoading: false,
  error: null,
  activeTab: 'Tasks',
  toastMessage: null,

  setIsLoading: (isLoading) => set({ isLoading }),
  setError: (error) => set({ error }),
  setActiveTab: (tab) => set({ activeTab: tab }),
  showToast: (message) => set({ toastMessage: message }),
  hideToast: () => set({ toastMessage: null }),
}))

// === 性能优化的选择器 ===
export const useAuthSelector = () => useAuthStore(
  (state) => ({
    user: state.user,
    isAuthenticated: state.isAuthenticated,
    authLoading: state.authLoading,
    authError: state.authError,
  }),
  shallow
)

export const useTaskSelector = () => useTaskStore(
  (state) => ({
    pendingTasks: state.pendingTasks,
    completedTasks: state.completedTasks,
    currentTask: state.currentTask,
    tasksLoading: state.tasksLoading,
    tasksError: state.tasksError,
  }),
  shallow
)

export const useRecordingSelector = () => useRecordingStore(
  (state) => ({
    isRecording: state.isRecording,
    currentRecording: state.currentRecording,
    recordingProgress: state.recordingProgress,
    recordingsLoading: state.recordingsLoading,
  }),
  shallow
)

export const useOfflineSelector = () => useOfflineStore(
  (state) => ({
    offlineRecordings: state.offlineRecordings,
    isOnline: state.isOnline,
    syncStatus: state.syncStatus,
    syncProgress: state.syncProgress,
  }),
  shallow
)

// === 清理所有状态的函数 ===
export const clearAllStores = () => {
  useAuthStore.getState().logout()
  useTaskStore.getState().clearTasks()
  useRecordingStore.getState().clearRecordings()
  useOfflineStore.getState().clearOfflineData()
  useUIStore.getState().setError(null)
}