import type { Express } from "express"

export function generateFileName(textId: string, userId: string, extension = "wav"): string {
  const timestamp = new Date().toISOString().replace(/[:.]/g, "-")
  return `${textId}_${userId}_${timestamp}.${extension}`
}

export function validateAudioFile(file: Express.Multer.File): boolean {
  const allowedTypes = ["audio/wav", "audio/mpeg", "audio/mp4", "audio/aac", "audio/x-m4a"]
  const maxSize = 50 * 1024 * 1024 // 50MB

  return allowedTypes.includes(file.mimetype) && file.size <= maxSize
}

export function getFileExtension(filename: string): string {
  return filename.split(".").pop()?.toLowerCase() || "wav"
}

export function formatFileSize(bytes: number): string {
  if (bytes === 0) return "0 Bytes"

  const k = 1024
  const sizes = ["Bytes", "KB", "MB", "GB"]
  const i = Math.floor(Math.log(bytes) / Math.log(k))

  return Number.parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + " " + sizes[i]
}
