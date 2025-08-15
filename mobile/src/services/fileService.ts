import * as FileSystem from "expo-file-system"
import { useAppStore } from "../store/appStore"

export interface FileInfo {
  uri: string
  name: string
  size: number
  type: string
}

class FileService {
  private readonly RECORDINGS_DIR = `${FileSystem.documentDirectory}recordings`

  constructor() {
    this.ensureDirectoryExists()
  }

  // Ensure recordings directory exists
  private async ensureDirectoryExists(): Promise<void> {
    try {
      const dirInfo = await FileSystem.getInfoAsync(this.RECORDINGS_DIR)
      if (!dirInfo.exists) {
        await FileSystem.makeDirectoryAsync(this.RECORDINGS_DIR, { intermediates: true })
        console.log("[v1] Created recordings directory")
      }
    } catch (error) {
      console.error("[v1] Error creating directory:", error)
    }
  }

  // Move file to permanent storage
  async moveToStorage(tempUri: string, fileName: string): Promise<string> {
    try {
      await this.ensureDirectoryExists()
      const permanentPath = `${this.RECORDINGS_DIR}/${fileName}`

      await FileSystem.moveAsync({ from: tempUri, to: permanentPath })
      console.log("[v1] File moved to storage:", permanentPath)

      return permanentPath
    } catch (error) {
      console.error("[v1] Error moving file:", error)
      throw error
    }
  }

  // Copy file to storage (keep original)
  async copyToStorage(sourceUri: string, fileName: string): Promise<string> {
    try {
      await this.ensureDirectoryExists()
      const permanentPath = `${this.RECORDINGS_DIR}/${fileName}`

      await FileSystem.copyAsync({ from: sourceUri, to: permanentPath })
      console.log("[v1] File copied to storage:", permanentPath)

      return permanentPath
    } catch (error) {
      console.error("[v1] Error copying file:", error)
      throw error
    }
  }

  // Delete file
  async deleteFile(uri: string): Promise<void> {
    try {
      await FileSystem.deleteAsync(uri, { idempotent: true })
      console.log("[v1] File deleted:", uri)
    } catch (error) {
      console.error("[v1] Error deleting file:", error)
    }
  }

  // Get file info
  async getFileInfo(uri: string): Promise<FileInfo | null> {
    try {
      const fileInfo = await FileSystem.getInfoAsync(uri)
      if (!fileInfo.exists || fileInfo.isDirectory) {
        return null
      }

      const fileName = uri.split("/").pop() || "unknown"
      const fileExtension = fileName.split(".").pop()?.toLowerCase() || ""

      return {
        uri,
        name: fileName,
        size: fileInfo.size,
        type: this.getFileType(fileExtension),
      }
    } catch (error) {
      console.error("[v1] Error getting file info:", error)
      return null
    }
  }

  // Get file type from extension
  private getFileType(extension: string): string {
    const audioTypes: { [key: string]: string } = {
      wav: "audio/wav",
      mp3: "audio/mpeg",
      m4a: "audio/mp4",
      aac: "audio/aac",
    }

    return audioTypes[extension] || "application/octet-stream"
  }

  // List all recordings
  async listRecordings(): Promise<FileInfo[]> {
    try {
      await this.ensureDirectoryExists()
      const fileNames = await FileSystem.readDirectoryAsync(this.RECORDINGS_DIR)

      const recordings: FileInfo[] = []
      for (const fileName of fileNames) {
        const fileUri = `${this.RECORDINGS_DIR}/${fileName}`
        const fileInfo = await this.getFileInfo(fileUri)
        if (fileInfo) {
          recordings.push(fileInfo)
        }
      }

      return recordings.sort((a, b) => b.name.localeCompare(a.name)) // Sort by name descending
    } catch (error) {
      console.error("[v1] Error listing recordings:", error)
      return []
    }
  }

  // Generate unique filename
  generateFileName(taskId: string, extension = "wav"): string {
    const timestamp = new Date().toISOString().replace(/[:.]/g, "-")
    const { user } = useAppStore.getState()
    const userId = user?._id || "unknown"

    return `${taskId}_${userId}_${timestamp}.${extension}`
  }

  // Format file size for display
  formatFileSize(bytes: number): string {
    if (bytes === 0) return "0 Bytes"

    const k = 1024
    const sizes = ["Bytes", "KB", "MB", "GB"]
    const i = Math.floor(Math.log(bytes) / Math.log(k))

    return Number.parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + " " + sizes[i]
  }

  // Clean up old temporary files
  async cleanupTempFiles(): Promise<void> {
    try {
      const tempDir = FileSystem.cacheDirectory
      if (!tempDir) return

      const files = await FileSystem.readDirectoryAsync(tempDir)
      const now = Date.now()
      const maxAge = 24 * 60 * 60 * 1000 // 24 hours

      for (const file of files) {
        const filePath = `${tempDir}${file}`
        const fileInfo = await FileSystem.getInfoAsync(filePath)

        if (fileInfo.exists && !fileInfo.isDirectory && file.startsWith("recording_")) {
          const fileAge = now - fileInfo.modificationTime * 1000
          if (fileAge > maxAge) {
            await FileSystem.deleteAsync(filePath, { idempotent: true })
            console.log("[v1] Cleaned up old temp file:", file)
          }
        }
      }
    } catch (error) {
      console.error("[v1] Error cleaning up temp files:", error)
    }
  }
}

export const fileService = new FileService()
