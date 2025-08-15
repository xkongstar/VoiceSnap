import express from "express"
import { Task } from "../models/Task"
import { Recording } from "../models/Recording"
import { authenticateToken, type AuthRequest } from "../middleware/auth"
import { createError } from "../middleware/errorHandler"

const router = express.Router()

// Get all active tasks
router.get("/", authenticateToken, async (req: AuthRequest, res, next) => {
  try {
    const tasks = await Task.find({ is_active: true }).sort({ created_at: -1 })

    res.json({
      tasks,
      total: tasks.length,
    })
  } catch (error) {
    next(error)
  }
})

// Get pending tasks for user (not yet recorded)
router.get("/pending", authenticateToken, async (req: AuthRequest, res, next) => {
  try {
    const userId = req.user?.id

    // Get all active tasks
    const allTasks = await Task.find({ is_active: true }).sort({ created_at: -1 })

    // Get user's completed recordings
    const userRecordings = await Recording.find({ user_id: userId }).select("task_id")
    const completedTaskIds = new Set(userRecordings.map((r) => r.task_id.toString()))

    // Filter out completed tasks
    const pendingTasks = allTasks.filter((task) => !completedTaskIds.has(task._id.toString()))

    res.json({
      tasks: pendingTasks,
      total: pendingTasks.length,
      completed_count: userRecordings.length,
      total_tasks: allTasks.length,
    })
  } catch (error) {
    next(error)
  }
})

// Get completed tasks for user
router.get("/completed", authenticateToken, async (req: AuthRequest, res, next) => {
  try {
    const userId = req.user?.id

    // Get user's recordings with task details
    const completedRecordings = await Recording.find({ user_id: userId })
      .populate("task_id", "text_content text_id created_at")
      .sort({ created_at: -1 })

    const completedTasks = completedRecordings.map((recording) => ({
      task: recording.task_id,
      recording: {
        _id: recording._id,
        dialect_transcription: recording.dialect_transcription,
        audio_file_url: recording.audio_file_url,
        duration_seconds: recording.duration_seconds,
        created_at: recording.created_at,
      },
    }))

    res.json({
      tasks: completedTasks,
      total: completedTasks.length,
    })
  } catch (error) {
    next(error)
  }
})

// Get single task details
router.get("/:id", authenticateToken, async (req: AuthRequest, res, next) => {
  try {
    const taskId = req.params.id
    const userId = req.user?.id

    const task = await Task.findById(taskId)
    if (!task) {
      throw createError("Task not found", 404)
    }

    // Check if user has already recorded this task
    const existingRecording = await Recording.findOne({
      task_id: taskId,
      user_id: userId,
    })

    res.json({
      task: task.toObject(),
      completed: !!existingRecording,
      recording: existingRecording || null,
    })
  } catch (error) {
    next(error)
  }
})

// Admin: Create new task
router.post("/", authenticateToken, async (req: AuthRequest, res, next) => {
  try {
    const { text_content, text_id } = req.body

    if (!text_content || !text_id) {
      throw createError("text_content and text_id are required", 400)
    }

    // Check if text_id already exists
    const existingTask = await Task.findOne({ text_id })
    if (existingTask) {
      throw createError("Task with this text_id already exists", 409)
    }

    const task = new Task({
      text_content,
      text_id,
    })

    await task.save()

    res.status(201).json({
      message: "Task created successfully",
      task,
    })
  } catch (error) {
    next(error)
  }
})

// Admin: Update task
router.put("/:id", authenticateToken, async (req: AuthRequest, res, next) => {
  try {
    const taskId = req.params.id
    const { text_content, is_active } = req.body

    const task = await Task.findById(taskId)
    if (!task) {
      throw createError("Task not found", 404)
    }

    if (text_content !== undefined) task.text_content = text_content
    if (is_active !== undefined) task.is_active = is_active

    await task.save()

    res.json({
      message: "Task updated successfully",
      task,
    })
  } catch (error) {
    next(error)
  }
})

export { router as taskRoutes }
