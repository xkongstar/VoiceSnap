import { create } from "zustand"
import { persist, createJSONStorage } from "zustand/middleware"
import AsyncStorage from "@react-native-async-storage/async-storage"

export interface User {
  _id: string
  username: string
  email?: string
  stats: {
    total_recordings: number
    total_duration: number
  }
}

export interface Task {
  _id: string
  text_content: string
  text_id: string
  is_active: boolean
  created_at: string
  completed?: boolean
}

export interface Recording {
  _id: string
  task_id: string
  original_text: string
  dialect_transcription: string
  audio_file_url?: string
  file_name: string
  duration_seconds?: number
  created_at: string
}

export interface OfflineRecording {
  id: string
  task_id: string
  original_text: string
  dialect_transcription: string
  audio_file_path: string
  duration_seconds?: number
  created_at: string
}

interface AppState {
  // Authentication
  user: User | null
  token: string | null
  isAuthenticated: boolean

  // Tasks
  tasks: Task[]
  pendingTasks: Task[]
  completedTasks: Task[]
  currentTask: Task | null

  // Recordings
  recordings: Recording[]
  isRecording: boolean
  currentRecording: string | null

  // Offline data
  offlineRecordings: OfflineRecording[]
  isOnline: boolean

  // UI state
  isLoading: boolean
  error: string | null

  // Actions
  setUser: (user: User | null) => void
  setToken: (token: string | null) => void
  setTasks: (tasks: Task[]) => void
  setPendingTasks: (tasks: Task[]) => void
  setCompletedTasks: (tasks: Task[]) => void
  setCurrentTask: (task: Task | null) => void
  setRecordings: (recordings: Recording[]) => void
  setIsRecording: (isRecording: boolean) => void
  setCurrentRecording: (path: string | null) => void
  addOfflineRecording: (recording: OfflineRecording) => void
  removeOfflineRecording: (id: string) => void
  setIsOnline: (isOnline: boolean) => void
  setIsLoading: (isLoading: boolean) => void
  setError: (error: string | null) => void

  // Auth actions
  login: (user: User, token: string) => void
  logout: () => void

  // Sync actions
  syncOfflineData: () => Promise<void>
  clearAllData: () => void
}

export const useAppStore = create<AppState>()(
  persist(
    (set, get) => ({
      // Initial state
      user: null,
      token: null,
      isAuthenticated: false,
      tasks: [],
      pendingTasks: [],
      completedTasks: [],
      currentTask: null,
      recordings: [],
      isRecording: false,
      currentRecording: null,
      offlineRecordings: [],
      isOnline: true,
      isLoading: false,
      error: null,

      // Basic setters
      setUser: (user) => set({ user }),
      setToken: (token) => set({ token }),
      setTasks: (tasks) => set({ tasks }),
      setPendingTasks: (pendingTasks) => set({ pendingTasks }),
      setCompletedTasks: (completedTasks) => set({ completedTasks }),
      setCurrentTask: (currentTask) => set({ currentTask }),
      setRecordings: (recordings) => set({ recordings }),
      setIsRecording: (isRecording) => set({ isRecording }),
      setCurrentRecording: (currentRecording) => set({ currentRecording }),
      setIsOnline: (isOnline) => set({ isOnline }),
      setIsLoading: (isLoading) => set({ isLoading }),
      setError: (error) => set({ error }),

      // Offline recordings
      addOfflineRecording: (recording) =>
        set((state) => ({
          offlineRecordings: [...state.offlineRecordings, recording],
        })),

      removeOfflineRecording: (id) =>
        set((state) => ({
          offlineRecordings: state.offlineRecordings.filter((r) => r.id !== id),
        })),

      // Authentication
      login: (user, token) =>
        set({
          user,
          token,
          isAuthenticated: true,
          error: null,
        }),

      logout: () =>
        set({
          user: null,
          token: null,
          isAuthenticated: false,
          tasks: [],
          pendingTasks: [],
          completedTasks: [],
          recordings: [],
          currentTask: null,
          error: null,
        }),

      // Sync offline data
      syncOfflineData: async () => {
        const { offlineRecordings, isOnline } = get()

        if (!isOnline || offlineRecordings.length === 0) {
          return
        }

        // This will be implemented in the upload service
        console.log("Syncing offline recordings:", offlineRecordings.length)
      },

      // Clear all data
      clearAllData: () =>
        set({
          user: null,
          token: null,
          isAuthenticated: false,
          tasks: [],
          pendingTasks: [],
          completedTasks: [],
          recordings: [],
          currentTask: null,
          offlineRecordings: [],
          isRecording: false,
          currentRecording: null,
          isLoading: false,
          error: null,
        }),
    }),
    {
      name: "dialect-capture-storage",
      storage: createJSONStorage(() => AsyncStorage),
      partialize: (state) => ({
        user: state.user,
        token: state.token,
        isAuthenticated: state.isAuthenticated,
        offlineRecordings: state.offlineRecordings,
      }),
    },
  ),
)
