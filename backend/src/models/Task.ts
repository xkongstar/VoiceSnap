import mongoose, { type Document, Schema } from "mongoose"

export interface ITask extends Document {
  text_content: string
  text_id: string
  is_active: boolean
  created_at: Date
}

const taskSchema = new Schema<ITask>({
  text_content: {
    type: String,
    required: true,
    trim: true,
  },
  text_id: {
    type: String,
    required: true,
    unique: true,
    trim: true,
  },
  is_active: {
    type: Boolean,
    default: true,
  },
  created_at: {
    type: Date,
    default: Date.now,
  },
})

// Index for efficient queries
taskSchema.index({ is_active: 1, created_at: -1 })
taskSchema.index({ text_id: 1 })

export const Task = mongoose.model<ITask>("Task", taskSchema)
