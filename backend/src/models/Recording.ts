import mongoose, { type Document, Schema } from "mongoose"

export interface AudioQuality {
  snr?: number // 信噪比 (Signal-to-Noise Ratio)
  volume_level?: number // 音量等级 (0-100)
  silence_ratio?: number // 静音比例 (0-1)
  clarity_score?: number // 清晰度评分 (0-100)
}

export interface IRecording extends Document {
  task_id: mongoose.Types.ObjectId
  user_id: mongoose.Types.ObjectId
  original_text: string
  dialect_transcription: string
  audio_file_url?: string
  file_name: string
  duration_seconds?: number
  file_size_bytes?: number
  audio_quality?: AudioQuality
  processing_status: "pending" | "processing" | "completed" | "failed"
  upload_status: "pending" | "uploading" | "completed" | "failed"
  metadata: {
    mime_type?: string
    sample_rate?: number
    bit_rate?: number
    channels?: number
    encoding?: string
  }
  created_at: Date
  updated_at: Date
}

const recordingSchema = new Schema<IRecording>({
  task_id: {
    type: Schema.Types.ObjectId,
    ref: "Task",
    required: true,
    index: true, // 单独索引提高查询性能
  },
  user_id: {
    type: Schema.Types.ObjectId,
    ref: "User",
    required: true,
    index: true, // 单独索引提高查询性能
  },
  original_text: {
    type: String,
    required: true,
    trim: true,
    maxlength: 1000, // 限制最大长度
  },
  dialect_transcription: {
    type: String,
    required: true,
    trim: true,
    maxlength: 1000, // 限制最大长度
  },
  audio_file_url: {
    type: String,
    trim: true,
  },
  file_name: {
    type: String,
    required: true,
    trim: true,
    unique: true, // 确保文件名唯一
  },
  duration_seconds: {
    type: Number,
    min: 0,
    max: 600, // 最长10分钟
  },
  file_size_bytes: {
    type: Number,
    min: 0,
    max: 100 * 1024 * 1024, // 最大100MB
  },
  audio_quality: {
    snr: {
      type: Number,
      min: -60,
      max: 60, // dB范围
    },
    volume_level: {
      type: Number,
      min: 0,
      max: 100,
    },
    silence_ratio: {
      type: Number,
      min: 0,
      max: 1,
    },
    clarity_score: {
      type: Number,
      min: 0,
      max: 100,
    },
  },
  processing_status: {
    type: String,
    enum: ["pending", "processing", "completed", "failed"],
    default: "pending",
    index: true, // 用于状态查询
  },
  upload_status: {
    type: String,
    enum: ["pending", "uploading", "completed", "failed"],
    default: "pending",
    index: true, // 用于状态查询
  },
  metadata: {
    mime_type: {
      type: String,
      trim: true,
    },
    sample_rate: {
      type: Number,
      min: 8000,
      max: 48000,
    },
    bit_rate: {
      type: Number,
      min: 32000,
      max: 320000,
    },
    channels: {
      type: Number,
      min: 1,
      max: 2,
      default: 1,
    },
    encoding: {
      type: String,
      trim: true,
    },
  },
  created_at: {
    type: Date,
    default: Date.now,
    index: true, // 用于时间排序
  },
  updated_at: {
    type: Date,
    default: Date.now,
  },
}, {
  timestamps: { createdAt: 'created_at', updatedAt: 'updated_at' } // 自动管理时间戳
})

// 复合索引优化查询
// 确保每个用户每个任务只有一个录音
recordingSchema.index({ task_id: 1, user_id: 1 }, { unique: true })

// 用户相关查询优化
recordingSchema.index({ user_id: 1, created_at: -1 }) // 用户的录音列表（按时间倒序）
recordingSchema.index({ user_id: 1, processing_status: 1 }) // 用户的处理状态查询
recordingSchema.index({ user_id: 1, upload_status: 1 }) // 用户的上传状态查询

// 任务相关查询优化
recordingSchema.index({ task_id: 1, created_at: -1 }) // 任务的录音列表
recordingSchema.index({ task_id: 1, processing_status: 1 }) // 任务的处理状态

// 状态查询优化
recordingSchema.index({ processing_status: 1, created_at: 1 }) // 处理队列
recordingSchema.index({ upload_status: 1, created_at: 1 }) // 上传队列

// 文件名查询优化
recordingSchema.index({ file_name: 1 }, { unique: true }) // 确保文件名唯一

// 时间范围查询优化
recordingSchema.index({ created_at: -1 }) // 全局时间排序
recordingSchema.index({ updated_at: -1 }) // 最近更新的录音

// 音频质量查询优化
recordingSchema.index({ 'audio_quality.snr': -1 }) // 按信噪比排序
recordingSchema.index({ 'audio_quality.clarity_score': -1 }) // 按清晰度排序

export const Recording = mongoose.model<IRecording>("Recording", recordingSchema)
