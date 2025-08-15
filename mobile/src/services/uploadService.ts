import RNFS from "react-native-fs"
import { apiService } from "./apiService"
import { fileService } from "./fileService"
import { useAppStore } from "../store/appStore"
import type { OfflineRecording } from "../store/appStore"

export interface UploadProgress {
  loaded: number
  total: number
  percentage: number
}

export interface UploadResult {
  success: boolean
  recording?: any
  error?: string
}

class UploadService {
  private uploadQueue: OfflineRecording[] = []
  private isUploading = false

  // Upload recording to server
  async uploadRecording(
    taskId: string,
    originalText: string,
    dialectTranscription: string,
    audioUri: string,
    duration?: number,
    onProgress?: (progress: UploadProgress) => void,
  ): Promise<UploadResult> {
    try {
      // Check if file exists
      const fileExists = await RNFS.exists(audioUri)
      if (!fileExists) {
        throw new Error("音频文件不存在")
      }

      // Get file info
      const fileInfo = await fileService.getFileInfo(audioUri)
      if (!fileInfo) {
        throw new Error("无法获取文件信息")
      }

      // Create FormData
      const formData = new FormData()
      formData.append("task_id", taskId)
      formData.append("original_text", originalText)
      formData.append("dialect_transcription", dialectTranscription)

      if (duration) {
        formData.append("duration_seconds", duration.toString())
      }

      // Add audio file
      formData.append("audio", {
        uri: audioUri,
        type: fileInfo.type,
        name: fileInfo.name,
      } as any)

      console.log("[v0] Uploading recording:", {
        taskId,
        fileName: fileInfo.name,
        size: fileService.formatFileSize(fileInfo.size),
      })

      // Upload to server
      const response = await apiService.uploadRecording(formData)

      console.log("[v0] Upload successful:", response.recording._id)

      return {
        success: true,
        recording: response.recording,
      }
    } catch (error: any) {
      console.error("[v0] Upload error:", error)

      const errorMessage = error.response?.data?.error?.message || error.message || "上传失败"

      return {
        success: false,
        error: errorMessage,
      }
    }
  }

  // Save recording for offline upload
  async saveForOfflineUpload(
    taskId: string,
    originalText: string,
    dialectTranscription: string,
    audioUri: string,
    duration?: number,
  ): Promise<void> {
    try {
      // Generate unique ID for offline recording
      const offlineId = `offline_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`

      // Move file to permanent storage
      const fileName = fileService.generateFileName(taskId)
      const permanentUri = await fileService.copyToStorage(audioUri, fileName)

      // Create offline recording object
      const offlineRecording: OfflineRecording = {
        id: offlineId,
        task_id: taskId,
        original_text: originalText,
        dialect_transcription: dialectTranscription,
        audio_file_path: permanentUri,
        duration_seconds: duration,
        created_at: new Date().toISOString(),
      }

      // Add to store
      useAppStore.getState().addOfflineRecording(offlineRecording)

      console.log("[v0] Saved for offline upload:", offlineId)
    } catch (error: any) {
      console.error("[v0] Save offline error:", error)
      throw error
    }
  }

  // Sync all offline recordings
  async syncOfflineRecordings(): Promise<{ success: number; failed: number }> {
    const { offlineRecordings, isOnline } = useAppStore.getState()

    if (!isOnline || offlineRecordings.length === 0) {
      return { success: 0, failed: 0 }
    }

    if (this.isUploading) {
      console.log("[v0] Upload already in progress")
      return { success: 0, failed: 0 }
    }

    this.isUploading = true
    let successCount = 0
    let failedCount = 0

    console.log("[v0] Starting offline sync:", offlineRecordings.length, "recordings")

    for (const recording of offlineRecordings) {
      try {
        const result = await this.uploadRecording(
          recording.task_id,
          recording.original_text,
          recording.dialect_transcription,
          recording.audio_file_path,
          recording.duration_seconds,
        )

        if (result.success) {
          // Remove from offline storage
          useAppStore.getState().removeOfflineRecording(recording.id)

          // Clean up local file
          await fileService.deleteFile(recording.audio_file_path)

          successCount++
          console.log("[v0] Synced offline recording:", recording.id)
        } else {
          failedCount++
          console.error("[v0] Failed to sync recording:", recording.id, result.error)
        }
      } catch (error: any) {
        failedCount++
        console.error("[v0] Sync error for recording:", recording.id, error)
      }

      // Small delay between uploads to avoid overwhelming the server
      await new Promise((resolve) => setTimeout(resolve, 500))
    }

    this.isUploading = false

    console.log("[v0] Offline sync completed:", { success: successCount, failed: failedCount })

    return { success: successCount, failed: failedCount }
  }

  // Check if currently uploading
  get uploading(): boolean {
    return this.isUploading
  }

  // Get offline recordings count
  getOfflineCount(): number {
    return useAppStore.getState().offlineRecordings.length
  }
}

export const uploadService = new UploadService()
