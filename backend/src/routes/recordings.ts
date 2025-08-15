import express from "express"
import multer from "multer"
import { put } from "@vercel/blob"
import { Recording } from "../models/Recording"
import { Task } from "../models/Task"
import { User } from "../models/User"
import { authenticateToken, type AuthRequest } from "../middleware/auth"
import { createError } from "../middleware/errorHandler"

const router = express.Router()

// Configure multer for file uploads
const upload = multer({
  storage: multer.memoryStorage(),
  limits: {
    fileSize: 50 * 1024 * 1024, // 50MB limit
  },
  fileFilter: (req, file, cb) => {
    const allowedTypes = ["audio/wav", "audio/mpeg", "audio/mp4", "audio/aac", "audio/x-m4a"]
    if (allowedTypes.includes(file.mimetype)) {
      cb(null, true)
    } else {
      cb(new Error("Invalid file type. Only audio files are allowed."))
    }
  },
})

// Get all recordings for user
router.get("/", authenticateToken, async (req: AuthRequest, res, next) => {
  try {
    const userId = req.user?.id

    const recordings = await Recording.find({ user_id: userId })
      .populate("task_id", "text_content text_id")
      .sort({ created_at: -1 })

    res.json({
      recordings,
      total: recordings.length,
    })
  } catch (error) {
    next(error)
  }
})

// Get single recording
router.get("/:id", authenticateToken, async (req: AuthRequest, res, next) => {
  try {
    const recordingId = req.params.id
    const userId = req.user?.id

    const recording = await Recording.findOne({
      _id: recordingId,
      user_id: userId,
    }).populate("task_id", "text_content text_id")

    if (!recording) {
      throw createError("Recording not found", 404)
    }

    res.json({ recording })
  } catch (error) {
    next(error)
  }
})

// Upload new recording
router.post("/", authenticateToken, upload.single("audio"), async (req: AuthRequest, res, next) => {
  try {
    const userId = req.user?.id
    const { task_id, original_text, dialect_transcription, duration_seconds } = req.body
    const audioFile = req.file

    // Validation
    if (!task_id || !original_text || !dialect_transcription) {
      throw createError("task_id, original_text, and dialect_transcription are required", 400)
    }

    if (!audioFile) {
      throw createError("Audio file is required", 400)
    }

    // Verify task exists
    const task = await Task.findById(task_id)
    if (!task) {
      throw createError("Task not found", 404)
    }

    // Check if user already has a recording for this task
    const existingRecording = await Recording.findOne({
      task_id,
      user_id: userId,
    })

    if (existingRecording) {
      throw createError("Recording already exists for this task. Use PUT to update.", 409)
    }

    // Generate unique filename
    const timestamp = new Date().toISOString().replace(/[:.]/g, "-")
    const fileName = `${task.text_id}_${userId}_${timestamp}`
    const fileExtension = audioFile.originalname.split(".").pop() || "wav"
    const fullFileName = `${fileName}.${fileExtension}`

    // Upload to Vercel Blob
    let audioUrl: string | undefined
    try {
      const blob = await put(fullFileName, audioFile.buffer as any, {
        access: "public",
        token: process.env.BLOB_READ_WRITE_TOKEN,
      })
      audioUrl = blob.url
    } catch (uploadError) {
      console.error("File upload error:", uploadError)
      throw createError("Failed to upload audio file", 500)
    }

    // Create recording record
    const recording = new Recording({
      task_id,
      user_id: userId,
      original_text,
      dialect_transcription,
      audio_file_url: audioUrl,
      file_name: fullFileName,
      duration_seconds: duration_seconds ? Number.parseFloat(duration_seconds) : undefined,
      file_size_bytes: audioFile.size,
      status: "completed",
    })

    await recording.save()

    // Update user statistics
    await User.findByIdAndUpdate(userId, {
      $inc: {
        "stats.total_recordings": 1,
        "stats.total_duration": duration_seconds ? Number.parseFloat(duration_seconds) : 0,
      },
    })

    // Populate task details for response
    await recording.populate("task_id", "text_content text_id")

    res.status(201).json({
      message: "Recording uploaded successfully",
      recording,
    })
  } catch (error) {
    next(error)
  }
})

// Update existing recording (re-record)
router.put("/:id", authenticateToken, upload.single("audio"), async (req: AuthRequest, res, next) => {
  try {
    const recordingId = req.params.id
    const userId = req.user?.id
    const { dialect_transcription, duration_seconds } = req.body
    const audioFile = req.file

    // Find existing recording
    const recording = await Recording.findOne({
      _id: recordingId,
      user_id: userId,
    })

    if (!recording) {
      throw createError("Recording not found", 404)
    }

    // Update transcription if provided
    if (dialect_transcription) {
      recording.dialect_transcription = dialect_transcription
    }

    // Update audio file if provided
    if (audioFile) {
      // Generate new filename
      const timestamp = new Date().toISOString().replace(/[:.]/g, "-")
      const task = await Task.findById(recording.task_id)
      const fileName = `${task?.text_id}_${userId}_${timestamp}`
      const fileExtension = audioFile.originalname.split(".").pop() || "wav"
      const fullFileName = `${fileName}.${fileExtension}`

      // Upload new file to Vercel Blob
      try {
        const blob = await put(fullFileName, audioFile.buffer as any, {
          access: "public",
          token: process.env.BLOB_READ_WRITE_TOKEN,
        })

        recording.audio_file_url = blob.url
        recording.file_name = fullFileName
        recording.file_size_bytes = audioFile.size
      } catch (uploadError) {
        console.error("File upload error:", uploadError)
        throw createError("Failed to upload audio file", 500)
      }
    }

    // Update duration if provided
    if (duration_seconds) {
      const oldDuration = recording.duration_seconds || 0
      const newDuration = Number.parseFloat(duration_seconds)
      recording.duration_seconds = newDuration

      // Update user statistics
      await User.findByIdAndUpdate(userId, {
        $inc: {
          "stats.total_duration": newDuration - oldDuration,
        },
      })
    }

    await recording.save()
    await recording.populate("task_id", "text_content text_id")

    res.json({
      message: "Recording updated successfully",
      recording,
    })
  } catch (error) {
    next(error)
  }
})

// Delete recording
router.delete("/:id", authenticateToken, async (req: AuthRequest, res, next) => {
  try {
    const recordingId = req.params.id
    const userId = req.user?.id

    const recording = await Recording.findOne({
      _id: recordingId,
      user_id: userId,
    })

    if (!recording) {
      throw createError("Recording not found", 404)
    }

    // Update user statistics
    await User.findByIdAndUpdate(userId, {
      $inc: {
        "stats.total_recordings": -1,
        "stats.total_duration": -(recording.duration_seconds || 0),
      },
    })

    // Delete the recording
    await Recording.findByIdAndDelete(recordingId)

    res.json({
      message: "Recording deleted successfully",
    })
  } catch (error) {
    next(error)
  }
})

export { router as recordingRoutes }
