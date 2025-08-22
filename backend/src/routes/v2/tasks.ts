import express from "express"
import { taskController } from "../../controllers/TaskController"
import { authenticateToken } from "../../middleware/auth"
import { 
  validateCreateTask,
  validateUpdateTask,
  validateTaskId,
  validateBatchOperation,
  handleValidationErrors
} from "../../middleware/validation"

const router = express.Router()

/**
 * 任务路由 v2 - 基于分层架构
 */

// 获取所有活跃任务
router.get(
  "/",
  authenticateToken,
  taskController.getAllTasks.bind(taskController)
)

// 获取用户待完成的任务
router.get(
  "/pending",
  authenticateToken,
  taskController.getPendingTasks.bind(taskController)
)

// 获取用户已完成的任务
router.get(
  "/completed",
  authenticateToken,
  taskController.getCompletedTasks.bind(taskController)
)

// 获取任务统计信息
router.get(
  "/statistics",
  authenticateToken,
  taskController.getTaskStatistics.bind(taskController)
)

// 获取单个任务详情
router.get(
  "/:id",
  authenticateToken,
  validateTaskId,
  handleValidationErrors,
  taskController.getTaskById.bind(taskController)
)

// 创建新任务
router.post(
  "/",
  authenticateToken,
  validateCreateTask,
  handleValidationErrors,
  taskController.createTask.bind(taskController)
)

// 更新任务
router.put(
  "/:id",
  authenticateToken,
  validateTaskId,
  validateUpdateTask,
  handleValidationErrors,
  taskController.updateTask.bind(taskController)
)

// 删除任务
router.delete(
  "/:id",
  authenticateToken,
  validateTaskId,
  handleValidationErrors,
  taskController.deleteTask.bind(taskController)
)

// 批量更新任务
router.post(
  "/batch",
  authenticateToken,
  validateBatchOperation,
  handleValidationErrors,
  taskController.batchUpdateTasks.bind(taskController)
)

export { router as tasksRouterV2 }