import { Task } from "../models/Task"
import { Recording } from "../models/Recording"
import { createError } from "../middleware/errorHandler"
import { logInfo, logError } from "../utils/logger"
import type {
  CreateTaskRequestDTO,
  UpdateTaskRequestDTO,
  TaskResponseDTO,
  PendingTasksResponseDTO,
  CompletedTasksResponseDTO,
  CompletedTaskItemDTO
} from "../types/DTOs"

/**
 * 任务服务层 - 处理任务相关的业务逻辑
 */
export class TaskService {
  /**
   * 获取所有活跃任务
   */
  async getAllActiveTasks(): Promise<TaskResponseDTO[]> {
    try {
      logInfo('获取所有活跃任务')
      
      const tasks = await Task.find({ is_active: true })
        .sort({ created_at: -1 })
        .lean()

      return tasks.map(task => this.formatTaskResponse(task))
    } catch (error) {
      logError('获取活跃任务失败', error as Error)
      throw createError('获取任务列表失败', 500)
    }
  }

  /**
   * 获取用户待完成的任务
   */
  async getPendingTasksForUser(userId: string): Promise<PendingTasksResponseDTO> {
    try {
      logInfo(`获取用户待完成任务: ${userId}`)
      
      // 获取所有活跃任务
      const allTasks = await Task.find({ is_active: true })
        .sort({ created_at: -1 })
        .lean()

      // 获取用户已完成的录音
      const userRecordings = await Recording.find({ user_id: userId })
        .select("task_id")
        .lean()
      
      const completedTaskIds = new Set(
        userRecordings.map(r => r.task_id.toString())
      )

      // 过滤出待完成任务
      const pendingTasks = allTasks.filter(
        task => !completedTaskIds.has(task._id.toString())
      )

      logInfo(`用户 ${userId} 有 ${pendingTasks.length} 个待完成任务`)

      return {
        tasks: pendingTasks.map(task => this.formatTaskResponse(task)),
        total: pendingTasks.length,
        completed_count: userRecordings.length,
        total_tasks: allTasks.length
      }
    } catch (error) {
      logError('获取用户待完成任务失败', error as Error, { userId })
      throw createError('获取待完成任务失败', 500)
    }
  }

  /**
   * 获取用户已完成的任务
   */
  async getCompletedTasksForUser(userId: string): Promise<CompletedTasksResponseDTO> {
    try {
      logInfo(`获取用户已完成任务: ${userId}`)
      
      const completedRecordings = await Recording.find({ user_id: userId })
        .populate({
          path: "task_id",
          select: "text_content text_id created_at is_active"
        })
        .sort({ created_at: -1 })
        .lean()

      const completedTasks: CompletedTaskItemDTO[] = completedRecordings
        .filter(recording => recording.task_id) // 确保任务存在
        .map(recording => ({
          task: this.formatTaskResponse(recording.task_id as any),
          recording: {
            _id: recording._id.toString(),
            dialect_transcription: recording.dialect_transcription,
            audio_file_url: recording.audio_file_url,
            duration_seconds: recording.duration_seconds,
            created_at: recording.created_at.toISOString()
          }
        }))

      logInfo(`用户 ${userId} 有 ${completedTasks.length} 个已完成任务`)

      return {
        tasks: completedTasks,
        total: completedTasks.length
      }
    } catch (error) {
      logError('获取用户已完成任务失败', error as Error, { userId })
      throw createError('获取已完成任务失败', 500)
    }
  }

  /**
   * 根据ID获取任务详情
   */
  async getTaskById(taskId: string, userId?: string): Promise<{
    task: TaskResponseDTO
    completed: boolean
    recording?: any
  }> {
    try {
      logInfo(`获取任务详情: ${taskId}`)
      
      const task = await Task.findById(taskId).lean()
      if (!task) {
        throw createError('任务不存在', 404)
      }

      let completed = false
      let recording = null

      if (userId) {
        const existingRecording = await Recording.findOne({
          task_id: taskId,
          user_id: userId
        }).lean()

        completed = !!existingRecording
        recording = existingRecording
      }

      return {
        task: this.formatTaskResponse(task),
        completed,
        recording
      }
    } catch (error) {
      if (error instanceof Error && error.message.includes('不存在')) {
        throw error
      }
      logError('获取任务详情失败', error as Error, { taskId, userId })
      throw createError('获取任务详情失败', 500)
    }
  }

  /**
   * 创建新任务
   */
  async createTask(taskData: CreateTaskRequestDTO): Promise<TaskResponseDTO> {
    try {
      logInfo('创建新任务', taskData)
      
      // 检查text_id是否已存在
      const existingTask = await Task.findOne({ text_id: taskData.text_id }).lean()
      if (existingTask) {
        throw createError('该任务ID已存在', 409)
      }

      const task = new Task({
        text_content: taskData.text_content,
        text_id: taskData.text_id,
        is_active: true
      })

      await task.save()

      logInfo(`任务创建成功: ${task._id}`)

      return this.formatTaskResponse(task.toObject())
    } catch (error) {
      if (error instanceof Error && error.message.includes('已存在')) {
        throw error
      }
      logError('创建任务失败', error as Error, taskData)
      throw createError('创建任务失败', 500)
    }
  }

  /**
   * 更新任务
   */
  async updateTask(taskId: string, updateData: UpdateTaskRequestDTO): Promise<TaskResponseDTO> {
    try {
      logInfo(`更新任务: ${taskId}`, updateData)
      
      const task = await Task.findById(taskId)
      if (!task) {
        throw createError('任务不存在', 404)
      }

      // 更新字段
      if (updateData.text_content !== undefined) {
        task.text_content = updateData.text_content
      }
      if (updateData.is_active !== undefined) {
        task.is_active = updateData.is_active
      }

      await task.save()

      logInfo(`任务更新成功: ${taskId}`)

      return this.formatTaskResponse(task.toObject())
    } catch (error) {
      if (error instanceof Error && error.message.includes('不存在')) {
        throw error
      }
      logError('更新任务失败', error as Error, { taskId, updateData })
      throw createError('更新任务失败', 500)
    }
  }

  /**
   * 删除任务
   */
  async deleteTask(taskId: string): Promise<void> {
    try {
      logInfo(`删除任务: ${taskId}`)
      
      const task = await Task.findById(taskId)
      if (!task) {
        throw createError('任务不存在', 404)
      }

      // 检查是否有关联的录音
      const recordingCount = await Recording.countDocuments({ task_id: taskId })
      if (recordingCount > 0) {
        throw createError('无法删除已有录音的任务，请先删除相关录音', 400)
      }

      await Task.findByIdAndDelete(taskId)

      logInfo(`任务删除成功: ${taskId}`)
    } catch (error) {
      if (error instanceof Error && (
        error.message.includes('不存在') || 
        error.message.includes('无法删除')
      )) {
        throw error
      }
      logError('删除任务失败', error as Error, { taskId })
      throw createError('删除任务失败', 500)
    }
  }

  /**
   * 批量操作任务
   */
  async batchUpdateTasks(taskIds: string[], updateData: UpdateTaskRequestDTO): Promise<{
    success_count: number
    failed_count: number
    failed_items: Array<{ id: string; error: string }>
  }> {
    try {
      logInfo(`批量更新任务: ${taskIds.length} 个任务`, updateData)
      
      const results = {
        success_count: 0,
        failed_count: 0,
        failed_items: [] as Array<{ id: string; error: string }>
      }

      for (const taskId of taskIds) {
        try {
          await this.updateTask(taskId, updateData)
          results.success_count++
        } catch (error) {
          results.failed_count++
          results.failed_items.push({
            id: taskId,
            error: error instanceof Error ? error.message : '未知错误'
          })
        }
      }

      logInfo(`批量更新任务完成: 成功 ${results.success_count}, 失败 ${results.failed_count}`)

      return results
    } catch (error) {
      logError('批量更新任务失败', error as Error, { taskIds, updateData })
      throw createError('批量更新任务失败', 500)
    }
  }

  /**
   * 获取任务统计信息
   */
  async getTaskStatistics(): Promise<{
    total_tasks: number
    active_tasks: number
    inactive_tasks: number
    total_recordings: number
    completion_rate: number
  }> {
    try {
      logInfo('获取任务统计信息')
      
      const [totalTasks, activeTasks, totalRecordings] = await Promise.all([
        Task.countDocuments({}),
        Task.countDocuments({ is_active: true }),
        Recording.countDocuments({})
      ])

      const inactiveTasks = totalTasks - activeTasks
      const completionRate = activeTasks > 0 ? (totalRecordings / activeTasks) * 100 : 0

      return {
        total_tasks: totalTasks,
        active_tasks: activeTasks,
        inactive_tasks: inactiveTasks,
        total_recordings: totalRecordings,
        completion_rate: Math.round(completionRate * 100) / 100
      }
    } catch (error) {
      logError('获取任务统计信息失败', error as Error)
      throw createError('获取统计信息失败', 500)
    }
  }

  /**
   * 格式化任务响应数据
   */
  private formatTaskResponse(task: any): TaskResponseDTO {
    return {
      _id: task._id.toString(),
      text_content: task.text_content,
      text_id: task.text_id,
      is_active: task.is_active,
      created_at: task.created_at.toISOString(),
      updated_at: task.updated_at.toISOString()
    }
  }
}

// 导出单例实例
export const taskService = new TaskService()