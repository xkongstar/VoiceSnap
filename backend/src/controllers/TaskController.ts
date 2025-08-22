import type { Response, NextFunction } from "express"
import type { AuthRequest } from "../middleware/auth"
import { taskService } from "../services/TaskService"
import { createError } from "../middleware/errorHandler"
import { logInfo } from "../utils/logger"
import type {
  CreateTaskRequestDTO,
  UpdateTaskRequestDTO,
  ApiResponseDTO
} from "../types/DTOs"

/**
 * 任务控制器 - 处理任务相关的HTTP请求
 */
export class TaskController {
  /**
   * 获取所有活跃任务
   * GET /api/tasks
   */
  async getAllTasks(req: AuthRequest, res: Response, next: NextFunction): Promise<void> {
    try {
      const tasks = await taskService.getAllActiveTasks()
      
      const response: ApiResponseDTO = {
        success: true,
        message: '获取任务列表成功',
        data: {
          tasks,
          total: tasks.length
        },
        meta: {
          timestamp: new Date().toISOString()
        }
      }

      res.json(response)
    } catch (error) {
      next(error)
    }
  }

  /**
   * 获取用户待完成的任务
   * GET /api/tasks/pending
   */
  async getPendingTasks(req: AuthRequest, res: Response, next: NextFunction): Promise<void> {
    try {
      const userId = req.user?.id
      if (!userId) {
        throw createError('用户ID不存在', 401)
      }

      const result = await taskService.getPendingTasksForUser(userId)
      
      const response: ApiResponseDTO = {
        success: true,
        message: '获取待完成任务成功',
        data: result,
        meta: {
          timestamp: new Date().toISOString()
        }
      }

      res.json(response)
    } catch (error) {
      next(error)
    }
  }

  /**
   * 获取用户已完成的任务
   * GET /api/tasks/completed
   */
  async getCompletedTasks(req: AuthRequest, res: Response, next: NextFunction): Promise<void> {
    try {
      const userId = req.user?.id
      if (!userId) {
        throw createError('用户ID不存在', 401)
      }

      const result = await taskService.getCompletedTasksForUser(userId)
      
      const response: ApiResponseDTO = {
        success: true,
        message: '获取已完成任务成功',
        data: result,
        meta: {
          timestamp: new Date().toISOString()
        }
      }

      res.json(response)
    } catch (error) {
      next(error)
    }
  }

  /**
   * 获取单个任务详情
   * GET /api/tasks/:id
   */
  async getTaskById(req: AuthRequest, res: Response, next: NextFunction): Promise<void> {
    try {
      const taskId = req.params.id
      const userId = req.user?.id

      const result = await taskService.getTaskById(taskId, userId)
      
      const response: ApiResponseDTO = {
        success: true,
        message: '获取任务详情成功',
        data: result,
        meta: {
          timestamp: new Date().toISOString()
        }
      }

      res.json(response)
    } catch (error) {
      next(error)
    }
  }

  /**
   * 创建新任务
   * POST /api/tasks
   */
  async createTask(req: AuthRequest, res: Response, next: NextFunction): Promise<void> {
    try {
      const taskData: CreateTaskRequestDTO = req.body

      // 验证必填字段
      if (!taskData.text_content || !taskData.text_id) {
        throw createError('text_content 和 text_id 为必填字段', 400)
      }

      const task = await taskService.createTask(taskData)
      
      const response: ApiResponseDTO = {
        success: true,
        message: '任务创建成功',
        data: { task },
        meta: {
          timestamp: new Date().toISOString()
        }
      }

      res.status(201).json(response)
    } catch (error) {
      next(error)
    }
  }

  /**
   * 更新任务
   * PUT /api/tasks/:id
   */
  async updateTask(req: AuthRequest, res: Response, next: NextFunction): Promise<void> {
    try {
      const taskId = req.params.id
      const updateData: UpdateTaskRequestDTO = req.body

      const task = await taskService.updateTask(taskId, updateData)
      
      const response: ApiResponseDTO = {
        success: true,
        message: '任务更新成功',
        data: { task },
        meta: {
          timestamp: new Date().toISOString()
        }
      }

      res.json(response)
    } catch (error) {
      next(error)
    }
  }

  /**
   * 删除任务
   * DELETE /api/tasks/:id
   */
  async deleteTask(req: AuthRequest, res: Response, next: NextFunction): Promise<void> {
    try {
      const taskId = req.params.id

      await taskService.deleteTask(taskId)
      
      const response: ApiResponseDTO = {
        success: true,
        message: '任务删除成功',
        meta: {
          timestamp: new Date().toISOString()
        }
      }

      res.json(response)
    } catch (error) {
      next(error)
    }
  }

  /**
   * 批量更新任务
   * POST /api/tasks/batch
   */
  async batchUpdateTasks(req: AuthRequest, res: Response, next: NextFunction): Promise<void> {
    try {
      const { task_ids, update_data } = req.body

      if (!Array.isArray(task_ids) || task_ids.length === 0) {
        throw createError('task_ids 必须是非空数组', 400)
      }

      if (!update_data) {
        throw createError('update_data 为必填字段', 400)
      }

      const result = await taskService.batchUpdateTasks(task_ids, update_data)
      
      const response: ApiResponseDTO = {
        success: true,
        message: '批量更新任务完成',
        data: result,
        meta: {
          timestamp: new Date().toISOString()
        }
      }

      res.json(response)
    } catch (error) {
      next(error)
    }
  }

  /**
   * 获取任务统计信息
   * GET /api/tasks/statistics
   */
  async getTaskStatistics(req: AuthRequest, res: Response, next: NextFunction): Promise<void> {
    try {
      const statistics = await taskService.getTaskStatistics()
      
      const response: ApiResponseDTO = {
        success: true,
        message: '获取任务统计成功',
        data: statistics,
        meta: {
          timestamp: new Date().toISOString()
        }
      }

      res.json(response)
    } catch (error) {
      next(error)
    }
  }
}

// 导出单例实例
export const taskController = new TaskController()