import mongoose, { type Document, Schema } from "mongoose"

export interface IRecording extends Document {
  task_id: mongoose.Types.ObjectId
  user_id: mongoose.Types.ObjectId
  original_text: string
  dialect_transcription: string
  audio_file_url?: string
  file_name: string
  duration_seconds?: number
  file_size_bytes?: number
  status: "completed" | "pending" | "processing"
  created_at: Date
}

const recordingSchema = new Schema<IRecording>({
  task_id: {
    type: Schema.Types.ObjectId,
    ref: "Task",
    required: true,
  },
  user_id: {
    type: Schema.Types.ObjectId,
    ref: "User",
    required: true,
  },
  original_text: {
    type: String,
    required: true,
    trim: true,
  },
  dialect_transcription: {
    type: String,
    required: true,
    trim: true,
  },
  audio_file_url: {
    type: String,
    trim: true,
  },
  file_name: {
    type: String,
    required: true,
    trim: true,
  },
  duration_seconds: {
    type: Number,
    min: 0,
  },
  file_size_bytes: {
    type: Number,
    min: 0,
  },
  status: {
    type: String,
    enum: ["completed", "pending", "processing"],
    default: "completed",
  },
  created_at: {
    type: Date,
    default: Date.now,
  },
})

// Compound index to ensure one recording per user per task
recordingSchema.index({ task_id: 1, user_id: 1 }, { unique: true })

// Index for efficient queries
recordingSchema.index({ user_id: 1, created_at: -1 })
recordingSchema.index({ status: 1 })

export const Recording = mongoose.model<IRecording>("Recording", recordingSchema)
