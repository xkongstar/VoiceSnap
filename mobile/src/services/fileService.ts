import RNFS from "react-native-fs"
import { useAppStore } from "../store/appStore"

export interface FileInfo {
  uri: string
  name: string
  size: number
  type: string
}

class FileService {
  private readonly RECORDINGS_DIR = `${RNFS.DocumentDirectoryPath}/recordings`

  constructor() {
    this.ensureDirectoryExists()
  }

  // Ensure recordings directory exists
  private async ensureDirectoryExists(): Promise<void> {
    try {
      const exists = await RNFS.exists(this.RECORDINGS_DIR)
      if (!exists) {
        await RNFS.mkdir(this.RECORDINGS_DIR)
        console.log("[v0] Created recordings directory")
      }
    } catch (error) {
      console.error("[v0] Error creating directory:", error)
    }
  }

  // Move file to permanent storage
  async moveToStorage(tempUri: string, fileName: string): Promise<string> {
    try {
      await this.ensureDirectoryExists()
      const permanentPath = `${this.RECORDINGS_DIR}/${fileName}`

      await RNFS.moveFile(tempUri, permanentPath)
      console.log("[v0] File moved to storage:", permanentPath)

      return permanentPath
    } catch (error) {
      console.error("[v0] Error moving file:", error)
      throw error
    }
  }

  // Copy file to storage (keep original)
  async copyToStorage(sourceUri: string, fileName: string): Promise<string> {
    try {
      await this.ensureDirectoryExists()
      const permanentPath = `${this.RECORDINGS_DIR}/${fileName}`

      await RNFS.copyFile(sourceUri, permanentPath)
      console.log("[v0] File copied to storage:", permanentPath)

      return permanentPath
    } catch (error) {
      console.error("[v0] Error copying file:", error)
      throw error
    }
  }

  // Delete file
  async deleteFile(uri: string): Promise<void> {
    try {
      const exists = await RNFS.exists(uri)
      if (exists) {
        await RNFS.unlink(uri)
        console.log("[v0] File deleted:", uri)
      }
    } catch (error) {
      console.error("[v0] Error deleting file:", error)
      throw error
    }
  }

  // Get file info
  async getFileInfo(uri: string): Promise<FileInfo | null> {
    try {
      const exists = await RNFS.exists(uri)
      if (!exists) return null

      const stat = await RNFS.stat(uri)
      const fileName = uri.split("/").pop() || "unknown"
      const fileExtension = fileName.split(".").pop()?.toLowerCase() || ""

      return {
        uri,
        name: fileName,
        size: stat.size,
        type: this.getFileType(fileExtension),
      }
    } catch (error) {
      console.error("[v0] Error getting file info:", error)
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
      const files = await RNFS.readDir(this.RECORDINGS_DIR)

      const recordings: FileInfo[] = []
      for (const file of files) {
        if (file.isFile()) {
          const fileInfo = await this.getFileInfo(file.path)
          if (fileInfo) {
            recordings.push(fileInfo)
          }
        }
      }

      return recordings.sort((a, b) => b.name.localeCompare(a.name)) // Sort by name descending
    } catch (error) {
      console.error("[v0] Error listing recordings:", error)
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
      const tempDir = RNFS.CachesDirectoryPath
      const files = await RNFS.readDir(tempDir)

      const now = Date.now()
      const maxAge = 24 * 60 * 60 * 1000 // 24 hours

      for (const file of files) {
        if (file.name.startsWith("recording_") && file.isFile()) {
          const fileAge = now - new Date(file.mtime).getTime()
          if (fileAge > maxAge) {
            await RNFS.unlink(file.path)
            console.log("[v0] Cleaned up old temp file:", file.name)
          }
        }
      }
    } catch (error) {
      console.error("[v0] Error cleaning up temp files:", error)
    }
  }
}

export const fileService = new FileService()
