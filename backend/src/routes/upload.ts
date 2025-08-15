import express from "express"
import multer from "multer"
import { put } from "@vercel/blob"
import { authenticateToken, type AuthRequest } from "../middleware/auth"
import { createError } from "../middleware/errorHandler"

const router = express.Router()

// Configure multer for file uploads
const upload = multer({
  storage: multer.memoryStorage(),
  limits: {
    fileSize: 50 * 1024 * 1024, // 50MB limit
  },
})

// Upload audio file
router.post("/audio", authenticateToken, upload.single("audio"), async (req: AuthRequest, res, next) => {
  try {
    const audioFile = req.file
    const { filename } = req.body

    if (!audioFile) {
      throw createError("Audio file is required", 400)
    }

    // Validate file type
    const allowedTypes = ["audio/wav", "audio/mpeg", "audio/mp4", "audio/aac", "audio/x-m4a"]
    if (!allowedTypes.includes(audioFile.mimetype)) {
      throw createError("Invalid file type. Only audio files are allowed.", 400)
    }

    // Generate filename if not provided
    const timestamp = new Date().toISOString().replace(/[:.]/g, "-")
    const userId = req.user?.id
    const fileExtension = audioFile.originalname.split(".").pop() || "wav"
    const finalFilename = filename || `audio_${userId}_${timestamp}.${fileExtension}`

    // Upload to Vercel Blob
    try {
      const blob = await put(finalFilename, audioFile.buffer, {
        access: "public",
        token: process.env.BLOB_READ_WRITE_TOKEN,
      })

      res.json({
        message: "File uploaded successfully",
        url: blob.url,
        filename: finalFilename,
        size: audioFile.size,
        mimetype: audioFile.mimetype,
      })
    } catch (uploadError) {
      console.error("File upload error:", uploadError)
      throw createError("Failed to upload file", 500)
    }
  } catch (error) {
    next(error)
  }
})

// Upload metadata file
router.post("/metadata", authenticateToken, async (req: AuthRequest, res, next) => {
  try {
    const { filename, metadata } = req.body

    if (!filename || !metadata) {
      throw createError("filename and metadata are required", 400)
    }

    // Convert metadata to JSON string
    const metadataJson = JSON.stringify(metadata, null, 2)
    const metadataBuffer = Buffer.from(metadataJson, "utf-8")

    // Upload to Vercel Blob
    try {
      const blob = await put(filename, metadataBuffer, {
        access: "public",
        token: process.env.BLOB_READ_WRITE_TOKEN,
        contentType: "application/json",
      })

      res.json({
        message: "Metadata uploaded successfully",
        url: blob.url,
        filename,
        size: metadataBuffer.length,
      })
    } catch (uploadError) {
      console.error("Metadata upload error:", uploadError)
      throw createError("Failed to upload metadata", 500)
    }
  } catch (error) {
    next(error)
  }
})

export { router as uploadRoutes }
