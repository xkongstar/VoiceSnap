import express from "express"
import jwt from "jsonwebtoken"
import { User } from "../models/User"
import { createError } from "../middleware/errorHandler"

const router = express.Router()

// Register new user
router.post("/register", async (req, res, next) => {
  try {
    const { username, password, email } = req.body

    // Validation
    if (!username || !password) {
      throw createError("Username and password are required", 400)
    }

    if (password.length < 6) {
      throw createError("Password must be at least 6 characters long", 400)
    }

    // Check if user already exists
    const existingUser = await User.findOne({ username })
    if (existingUser) {
      throw createError("Username already exists", 409)
    }

    // Create new user
    const user = new User({
      username,
      password_hash: password, // Will be hashed by pre-save middleware
      email,
    })

    await user.save()

    // Generate JWT token
    const jwtSecret = process.env.JWT_SECRET
    if (!jwtSecret) {
      throw createError("JWT secret not configured", 500)
    }

    const token = jwt.sign({ userId: user._id, username: user.username }, jwtSecret, {
      expiresIn: process.env.JWT_EXPIRES_IN || "7d",
    })

    res.status(201).json({
      message: "User registered successfully",
      user: user.toJSON(),
      token,
    })
  } catch (error) {
    next(error)
  }
})

// Login user
router.post("/login", async (req, res, next) => {
  try {
    const { username, password } = req.body

    // Validation
    if (!username || !password) {
      throw createError("Username and password are required", 400)
    }

    // Find user
    const user = await User.findOne({ username })
    if (!user) {
      throw createError("Invalid username or password", 401)
    }

    // Check password
    const isPasswordValid = await user.comparePassword(password)
    if (!isPasswordValid) {
      throw createError("Invalid username or password", 401)
    }

    // Generate JWT token
    const jwtSecret = process.env.JWT_SECRET
    if (!jwtSecret) {
      throw createError("JWT secret not configured", 500)
    }

    const token = jwt.sign({ userId: user._id, username: user.username }, jwtSecret, {
      expiresIn: process.env.JWT_EXPIRES_IN || "7d",
    })

    res.json({
      message: "Login successful",
      user: user.toJSON(),
      token,
    })
  } catch (error) {
    next(error)
  }
})

// Refresh token
router.post("/refresh", async (req, res, next) => {
  try {
    const { token } = req.body

    if (!token) {
      throw createError("Refresh token required", 400)
    }

    const jwtSecret = process.env.JWT_SECRET
    if (!jwtSecret) {
      throw createError("JWT secret not configured", 500)
    }

    // Verify current token
    const decoded = jwt.verify(token, jwtSecret) as any

    // Find user to ensure they still exist
    const user = await User.findById(decoded.userId)
    if (!user) {
      throw createError("User not found", 404)
    }

    // Generate new token
    const newToken = jwt.sign({ userId: user._id, username: user.username }, jwtSecret, {
      expiresIn: process.env.JWT_EXPIRES_IN || "7d",
    })

    res.json({
      message: "Token refreshed successfully",
      token: newToken,
    })
  } catch (error) {
    if (error instanceof jwt.JsonWebTokenError) {
      next(createError("Invalid token", 401))
    } else {
      next(error)
    }
  }
})

export { router as authRoutes }
