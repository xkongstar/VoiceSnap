import express from "express"
import multer from "multer"
import { put } from "@vercel/blob"
import { Recording } from "../models/Recording"
import { Task } from "../models/Task"
import { User } from "../models/User"
import { authenticateToken, type AuthRequest } from "../middleware/auth"
import { createError } from "../middleware/errorHandler"
import fs from "fs"
import path from "path"
import { randomBytes } from "crypto"
import ffmpeg from "fluent-ffmpeg"

const router: express.Router = express.Router()

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

/**
 * 音频标准化函数
 * 将任何格式的音频文件转换为 16kHz, 16-bit, 单声道 WAV (PCM) 格式
 * @param audioBuffer 原始音频文件的Buffer
 * @param originalMimeType 原始文件的MIME类型
 * @returns Promise<Buffer> 转换后的标准化WAV文件Buffer
 */
async function standardizeAudio(audioBuffer: Buffer, originalMimeType: string): Promise<Buffer> {
  const tempId = randomBytes(16).toString('hex')
  let inputTempPath: string | undefined
  const outputTempPath = path.join('/tmp', `converted_${tempId}.wav`)
  
  try {
    // 根据MIME类型确定输入文件的临时路径和扩展名
    let inputExtension = 'tmp'
    if (originalMimeType.includes('wav')) {
      inputExtension = 'wav'
    } else if (originalMimeType.includes('mp4') || originalMimeType.includes('m4a')) {
      inputExtension = 'm4a'
    } else if (originalMimeType.includes('aac')) {
      inputExtension = 'aac'
    } else if (originalMimeType.includes('mpeg')) {
      inputExtension = 'mp3'
    }
    
    inputTempPath = path.join('/tmp', `upload_${tempId}.${inputExtension}`)
    
    // 1. 将上传的Buffer写入临时文件
    await fs.promises.writeFile(inputTempPath, audioBuffer)
    
    // 2. 使用FFmpeg进行格式标准化
    await new Promise<void>((resolve, reject) => {
      ffmpeg(inputTempPath)
        .audioCodec('pcm_s16le')    // 16-bit PCM编码
        .audioFrequency(16000)      // 16kHz采样率
        .audioChannels(1)           // 单声道
        .format('wav')              // WAV格式
        .on('end', () => resolve())
        .on('error', (err) => reject(err))
        .save(outputTempPath)
    })
    
    // 3. 读取转换后的文件
    const standardizedBuffer = await fs.promises.readFile(outputTempPath)
    
    return standardizedBuffer
    
  } catch (error) {
    console.error('音频标准化失败:', error)
    const errorMessage = error instanceof Error ? error.message : String(error)
    throw new Error(`音频标准化处理失败: ${errorMessage}`)
  } finally {
    // 4. 清理临时文件
    try {
      if (inputTempPath && fs.existsSync(inputTempPath)) {
        await fs.promises.unlink(inputTempPath)
      }
      if (fs.existsSync(outputTempPath)) {
        await fs.promises.unlink(outputTempPath)
      }
    } catch (cleanupError) {
      console.error('清理临时文件时出错:', cleanupError)
    }
  }
}

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

    // 音频标准化处理
    let standardizedBuffer: Buffer
    let actualFileSize: number
    try {
      console.log(`正在标准化音频文件: ${audioFile.originalname}, MIME类型: ${audioFile.mimetype}`)
      standardizedBuffer = await standardizeAudio(audioFile.buffer, audioFile.mimetype)
      actualFileSize = standardizedBuffer.length
      console.log(`音频标准化完成，原始大小: ${audioFile.size} bytes, 标准化后大小: ${actualFileSize} bytes`)
    } catch (standardizeError) {
      console.error("音频标准化失败:", standardizeError)
      throw createError("音频标准化处理失败", 500)
    }

    // Generate unique filename (标准化后统一为.wav格式)
    const timestamp = new Date().toISOString().replace(/[:.]/g, "-")
    const fileName = `${task.text_id}_${userId}_${timestamp}`
    const fullFileName = `${fileName}.wav` // 统一使用.wav扩展名

    // Upload standardized audio to Vercel Blob
    let audioUrl: string | undefined
    try {
      const blob = await put(fullFileName, standardizedBuffer as any, {
        access: "public",
        token: process.env.BLOB_READ_WRITE_TOKEN,
      })
      audioUrl = blob.url
      console.log(`标准化音频文件上传成功: ${fullFileName}`)
    } catch (uploadError) {
      console.error("File upload error:", uploadError)
      throw createError("Failed to upload audio file", 500)
    }

    // Create recording record (使用标准化后的文件信息)
    const recording = new Recording({
      task_id,
      user_id: userId,
      original_text,
      dialect_transcription,
      audio_file_url: audioUrl,
      file_name: fullFileName, // 标准化后的.wav文件名
      duration_seconds: duration_seconds ? Number.parseFloat(duration_seconds) : undefined,
      file_size_bytes: actualFileSize, // 标准化后的文件大小
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
      // 音频标准化处理
      let standardizedBuffer: Buffer
      let actualFileSize: number
      try {
        console.log(`正在标准化更新的音频文件: ${audioFile.originalname}, MIME类型: ${audioFile.mimetype}`)
        standardizedBuffer = await standardizeAudio(audioFile.buffer, audioFile.mimetype)
        actualFileSize = standardizedBuffer.length
        console.log(`音频标准化完成，原始大小: ${audioFile.size} bytes, 标准化后大小: ${actualFileSize} bytes`)
      } catch (standardizeError) {
        console.error("音频标准化失败:", standardizeError)
        throw createError("音频标准化处理失败", 500)
      }

      // Generate new filename (标准化后统一为.wav格式)
      const timestamp = new Date().toISOString().replace(/[:.]/g, "-")
      const task = await Task.findById(recording.task_id)
      const fileName = `${task?.text_id}_${userId}_${timestamp}`
      const fullFileName = `${fileName}.wav` // 统一使用.wav扩展名

      // Upload standardized file to Vercel Blob
      try {
        const blob = await put(fullFileName, standardizedBuffer as any, {
          access: "public",
          token: process.env.BLOB_READ_WRITE_TOKEN,
        })

        recording.audio_file_url = blob.url
        recording.file_name = fullFileName // 标准化后的.wav文件名
        recording.file_size_bytes = actualFileSize // 标准化后的文件大小
        console.log(`标准化音频文件更新成功: ${fullFileName}`)
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
