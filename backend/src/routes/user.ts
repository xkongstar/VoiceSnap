import express from "express"
import { User } from "../models/User"
import { Task } from "../models/Task"
import { Recording } from "../models/Recording"
import { authenticateToken, type AuthRequest } from "../middleware/auth"
import { createError } from "../middleware/errorHandler"

const router = express.Router()

// Get user profile
router.get("/profile", authenticateToken, async (req: AuthRequest, res, next) => {
  try {
    const user = await User.findById(req.user?.id)
    if (!user) {
      throw createError("User not found", 404)
    }

    res.json({
      user: user.toJSON(),
    })
  } catch (error) {
    next(error)
  }
})

// Get user dashboard data (tasks + recordings + stats)
router.get("/dashboard", authenticateToken, async (req: AuthRequest, res, next) => {
  try {
    const userId = req.user?.id

    // Fetch all data in parallel for better performance
    const [tasks, userRecordings, user] = await Promise.all([
      Task.find({ is_active: true }).sort({ created_at: -1 }),
      Recording.find({ user_id: userId }).populate("task_id", "text_content text_id"),
      User.findById(userId).select("stats"),
    ])

    if (!user) {
      throw createError("User not found", 404)
    }

    // Create a map of completed task IDs for efficient lookup
    const completedTaskIds = new Set(userRecordings.map((recording) => recording.task_id.toString()))

    // Add completion status to tasks
    const tasksWithStatus = tasks.map((task) => ({
      ...task.toObject(),
      completed: completedTaskIds.has(task._id.toString()),
    }))

    // Separate completed and pending tasks
    const completedTasks = tasksWithStatus.filter((task) => task.completed)
    const pendingTasks = tasksWithStatus.filter((task) => !task.completed)

    res.json({
      tasks: {
        pending: pendingTasks,
        completed: completedTasks,
        total: tasks.length,
      },
      recordings: userRecordings,
      stats: {
        ...user.stats,
        completion_rate: tasks.length > 0 ? (completedTasks.length / tasks.length) * 100 : 0,
      },
    })
  } catch (error) {
    next(error)
  }
})

// Get user statistics
router.get("/statistics", authenticateToken, async (req: AuthRequest, res, next) => {
  try {
    const userId = req.user?.id

    const [user, totalTasks, userRecordings] = await Promise.all([
      User.findById(userId).select("stats created_at"),
      Task.countDocuments({ is_active: true }),
      Recording.find({ user_id: userId }).select("duration_seconds created_at"),
    ])

    if (!user) {
      throw createError("User not found", 404)
    }

    // Calculate additional statistics
    const completionRate = totalTasks > 0 ? (userRecordings.length / totalTasks) * 100 : 0
    const averageDuration =
      userRecordings.length > 0
        ? userRecordings.reduce((sum, r) => sum + (r.duration_seconds || 0), 0) / userRecordings.length
        : 0

    res.json({
      stats: {
        ...user.stats,
        completion_rate: Math.round(completionRate * 100) / 100,
        average_duration: Math.round(averageDuration * 100) / 100,
        days_active: Math.ceil((Date.now() - user.created_at.getTime()) / (1000 * 60 * 60 * 24)),
      },
    })
  } catch (error) {
    next(error)
  }
})

export { router as userRoutes }
