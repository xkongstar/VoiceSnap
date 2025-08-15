import mongoose, { type Document, Schema } from "mongoose"
import bcrypt from "bcrypt"

export interface IUser extends Document {
  username: string
  password_hash: string
  email?: string
  created_at: Date
  stats: {
    total_recordings: number
    total_duration: number
  }
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
    match: [/^\w+([.-]?\w+)*@\w+([.-]?\w+)*(\.\w{2,3})+$/, "Please enter a valid email"],
  },
  created_at: {
    type: Date,
    default: Date.now,
  },
  stats: {
    total_recordings: {
      type: Number,
      default: 0,
    },
    total_duration: {
      type: Number,
      default: 0,
    },
  },
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
