import mongoose, { type Document, Schema } from "mongoose"

export interface ITask extends Document {
  text_content: string
  text_id: string
  category?: string // 任务分类
  difficulty_level?: 1 | 2 | 3 | 4 | 5 // 难度级别
  dialect?: string // 方言类型
  expected_duration?: number // 预期录音时长（秒）
  tags?: string[] // 标签
  priority: number // 优先级 (1-10)
  is_active: boolean
  stats: {
    total_recordings: number
    average_duration?: number
    average_quality?: number
    completion_rate?: number // 完成率 (0-1)
  }
  metadata: {
    source?: string // 数据来源
    author?: string // 创建者
    notes?: string // 备注
    last_modified_by?: string // 最后修改者
  }
  created_at: Date
  updated_at: Date
}

const taskSchema = new Schema<ITask>({
  text_content: {
    type: String,
    required: true,
    trim: true,
    maxlength: 1000, // 限制最大长度
    index: 'text', // 文本搜索索引
  },
  text_id: {
    type: String,
    required: true,
    unique: true,
    trim: true,
    index: true, // 唯一标识符查询优化
  },
  category: {
    type: String,
    trim: true,
    index: true, // 分类查询优化
  },
  difficulty_level: {
    type: Number,
    min: 1,
    max: 5,
    index: true, // 难度查询优化
  },
  dialect: {
    type: String,
    trim: true,
    index: true, // 方言查询优化
  },
  expected_duration: {
    type: Number,
    min: 1,
    max: 600, // 最长10分钟
  },
  tags: [{
    type: String,
    trim: true,
  }],
  priority: {
    type: Number,
    default: 5,
    min: 1,
    max: 10,
    index: true, // 优先级排序
  },
  is_active: {
    type: Boolean,
    default: true,
    index: true, // 状态查询优化
  },
  stats: {
    total_recordings: {
      type: Number,
      default: 0,
      min: 0,
    },
    average_duration: {
      type: Number,
      min: 0,
    },
    average_quality: {
      type: Number,
      min: 0,
      max: 100,
    },
    completion_rate: {
      type: Number,
      min: 0,
      max: 1,
    },
  },
  metadata: {
    source: {
      type: String,
      trim: true,
    },
    author: {
      type: String,
      trim: true,
      index: true, // 作者查询优化
    },
    notes: {
      type: String,
      trim: true,
      maxlength: 500,
    },
    last_modified_by: {
      type: String,
      trim: true,
    },
  },
  created_at: {
    type: Date,
    default: Date.now,
    index: true, // 创建时间查询
  },
  updated_at: {
    type: Date,
    default: Date.now,
  },
}, {
  timestamps: { createdAt: 'created_at', updatedAt: 'updated_at' }
})

// 复合索引优化查询
// 活跃任务查询优化
taskSchema.index({ is_active: 1, priority: -1, created_at: -1 }) // 按优先级和时间排序
taskSchema.index({ is_active: 1, category: 1, difficulty_level: 1 }) // 分类和难度筛选
taskSchema.index({ is_active: 1, dialect: 1 }) // 方言筛选

// 文本搜索优化
taskSchema.index({ text_content: 'text', text_id: 1 }) // 全文搜索

// 统计查询优化
taskSchema.index({ 'stats.completion_rate': -1 }) // 按完成率排序
taskSchema.index({ 'stats.average_quality': -1 }) // 按质量排序
taskSchema.index({ 'stats.total_recordings': -1 }) // 按录音数量排序

// 管理查询优化
taskSchema.index({ 'metadata.author': 1, created_at: -1 }) // 作者的任务
taskSchema.index({ created_at: -1 }) // 最新任务
taskSchema.index({ updated_at: -1 }) // 最近更新的任务

// 标签查询优化
taskSchema.index({ tags: 1 }) // 标签搜索

export const Task = mongoose.model<ITask>("Task", taskSchema)
