import mongoose, { type Document, Schema } from "mongoose"
import bcrypt from "bcrypt"

export interface IUser extends Document {
  username: string
  password_hash: string
  email?: string
  profile: {
    display_name?: string
    avatar_url?: string
    bio?: string
    language_preferences?: string[]
  }
  stats: {
    total_recordings: number
    total_duration: number // 秒
    total_file_size: number // 字节
    completed_tasks: number
    average_recording_quality?: number // 0-100
    first_recording_date?: Date
    last_recording_date?: Date
    daily_streak: number // 连续录音天数
    best_streak: number // 最长连续天数
  }
  preferences: {
    notifications_enabled: boolean
    email_notifications: boolean
    quality_threshold: number // 音频质量阈值 0-100
    auto_upload: boolean
  }
  security: {
    login_attempts: number
    locked_until?: Date
    last_login?: Date
    last_ip?: string
  }
  created_at: Date
  updated_at: Date
  comparePassword(candidatePassword: string): Promise<boolean>
}

const userSchema = new Schema<IUser>({
  username: {
    type: String,
    required: true,
    unique: true,
    trim: true,
    minlength: 3,
    maxlength: 50,
    index: true, // 用户名查询优化
  },
  password_hash: {
    type: String,
    required: true,
    minlength: 6,
  },
  email: {
    type: String,
    trim: true,
    lowercase: true,
    sparse: true, // 允许多个null值，但email不能重复
    unique: true,
    match: [/^\w+([.-]?\w+)*@\w+([.-]?\w+)*(\.\w{2,3})+$/, "Please enter a valid email"],
    index: true, // 邮箱查询优化
  },
  profile: {
    display_name: {
      type: String,
      trim: true,
      maxlength: 100,
    },
    avatar_url: {
      type: String,
      trim: true,
    },
    bio: {
      type: String,
      trim: true,
      maxlength: 500,
    },
    language_preferences: [{
      type: String,
      trim: true,
    }],
  },
  stats: {
    total_recordings: {
      type: Number,
      default: 0,
      min: 0,
    },
    total_duration: {
      type: Number,
      default: 0,
      min: 0,
    },
    total_file_size: {
      type: Number,
      default: 0,
      min: 0,
    },
    completed_tasks: {
      type: Number,
      default: 0,
      min: 0,
    },
    average_recording_quality: {
      type: Number,
      min: 0,
      max: 100,
    },
    first_recording_date: {
      type: Date,
    },
    last_recording_date: {
      type: Date,
      index: true, // 最近活动查询
    },
    daily_streak: {
      type: Number,
      default: 0,
      min: 0,
    },
    best_streak: {
      type: Number,
      default: 0,
      min: 0,
    },
  },
  preferences: {
    notifications_enabled: {
      type: Boolean,
      default: true,
    },
    email_notifications: {
      type: Boolean,
      default: false,
    },
    quality_threshold: {
      type: Number,
      default: 70,
      min: 0,
      max: 100,
    },
    auto_upload: {
      type: Boolean,
      default: true,
    },
  },
  security: {
    login_attempts: {
      type: Number,
      default: 0,
      min: 0,
    },
    locked_until: {
      type: Date,
    },
    last_login: {
      type: Date,
      index: true, // 最近登录查询
    },
    last_ip: {
      type: String,
      trim: true,
    },
  },
  created_at: {
    type: Date,
    default: Date.now,
    index: true, // 注册时间查询
  },
  updated_at: {
    type: Date,
    default: Date.now,
  },
}, {
  timestamps: { createdAt: 'created_at', updatedAt: 'updated_at' }
})

// Hash password before saving
userSchema.pre("save", async function (next) {
  if (!this.isModified("password_hash")) return next()

  try {
    const saltRounds = 12
    this.password_hash = await bcrypt.hash(this.password_hash, saltRounds)
    next()
  } catch (error) {
    next(error as Error)
  }
})

// Compare password method
userSchema.methods.comparePassword = async function (candidatePassword: string): Promise<boolean> {
  return bcrypt.compare(candidatePassword, this.password_hash)
}

// Remove password from JSON output
userSchema.methods.toJSON = function () {
  const userObject = this.toObject()
  delete userObject.password_hash
  return userObject
}

export const User = mongoose.model<IUser>("User", userSchema)
