import axios, { type AxiosInstance } from "axios"
import { useAppStore } from "../store/appStore"

// __DEV__ is a global variable in React Native

const API_BASE_URL = __DEV__ ? "https://gsfjlp-uzgwep-3000.app.cloudstudio.work/api" : "https://gsfjlp-uzgwep-3000.app.cloudstudio.work/api"

class ApiService {
  private api: AxiosInstance

  constructor() {
    this.api = axios.create({
      baseURL: API_BASE_URL,
      timeout: 30000,
      headers: {
        "Content-Type": "application/json",
      },
    })

    // Request interceptor to add auth token
    this.api.interceptors.request.use(
      (config) => {
        const token = useAppStore.getState().token
        if (token) {
          config.headers.Authorization = `Bearer ${token}`
        }
        return config
      },
      (error) => Promise.reject(error),
    )

    // Response interceptor for error handling
    this.api.interceptors.response.use(
      (response) => response,
      (error) => {
        if (error.response?.status === 401) {
          // Only logout if not on login/register endpoints
          const isAuthEndpoint = error.config?.url?.includes('/auth/')
          if (!isAuthEndpoint) {
            // Token expired or invalid
            useAppStore.getState().logout()
          }
        }
        return Promise.reject(error)
      },
    )
  }

  // Authentication
  async login(username: string, password: string) {
    const response = await this.api.post("/auth/login", { username, password })
    return response.data
  }

  async register(username: string, password: string, email?: string) {
    const response = await this.api.post("/auth/register", { username, password, email })
    return response.data
  }

  async refreshToken(token: string) {
    const response = await this.api.post("/auth/refresh", { token })
    return response.data
  }

  // Tasks
  async getTasks() {
    const response = await this.api.get("/tasks")
    return response.data
  }

  async getPendingTasks() {
    const response = await this.api.get("/tasks/pending")
    return response.data
  }

  async getCompletedTasks() {
    const response = await this.api.get("/tasks/completed")
    return response.data
  }

  async getTask(id: string) {
    const response = await this.api.get(`/tasks/${id}`)
    return response.data
  }

  // Recordings
  async getRecordings() {
    const response = await this.api.get("/recordings")
    return response.data
  }

  async getRecording(id: string) {
    const response = await this.api.get(`/recordings/${id}`)
    return response.data
  }

  async uploadRecording(formData: FormData) {
    const response = await this.api.post("/recordings", formData, {
      headers: {
        "Content-Type": "multipart/form-data",
      },
      timeout: 60000, // 60 seconds for file upload
    })
    return response.data
  }

  async updateRecording(id: string, formData: FormData) {
    const response = await this.api.put(`/recordings/${id}`, formData, {
      headers: {
        "Content-Type": "multipart/form-data",
      },
      timeout: 60000,
    })
    return response.data
  }

  async deleteRecording(id: string) {
    const response = await this.api.delete(`/recordings/${id}`)
    return response.data
  }

  // User
  async getUserProfile() {
    const response = await this.api.get("/user/profile")
    return response.data
  }

  async getUserDashboard() {
    const response = await this.api.get("/user/dashboard")
    return response.data
  }

  async getUserStatistics() {
    const response = await this.api.get("/user/statistics")
    return response.data
  }

  // File upload
  async uploadAudio(formData: FormData) {
    const response = await this.api.post("/upload/audio", formData, {
      headers: {
        "Content-Type": "multipart/form-data",
      },
      timeout: 60000,
    })
    return response.data
  }
}

export const apiService = new ApiService()
