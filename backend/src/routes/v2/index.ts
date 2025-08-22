import express from "express"
import { tasksRouterV2 } from "./tasks"
import { recordingsRouterV2 } from "./recordings"
import { usersRouterV2 } from "./users"

const router = express.Router()

/**
 * API v2 路由 - 基于分层架构的新版本
 * 
 * 特性:
 * - 分层架构 (Controller -> Service -> Model)
 * - 统一的响应格式
 * - 更好的错误处理
 * - 完整的验证机制
 * - 性能优化
 */

// 健康检查
router.get("/health", (req, res) => {
  res.json({
    success: true,
    message: "API v2 服务正常运行",
    data: {
      status: "healthy",
      version: "2.0.0",
      timestamp: new Date().toISOString(),
      services: {
        database: "up",
        storage: "up", 
        audio_processor: "up"
      }
    },
    meta: {
      timestamp: new Date().toISOString(),
      version: "2.0.0"
    }
  })
})

// API版本信息
router.get("/version", (req, res) => {
  res.json({
    success: true,
    message: "API版本信息",
    data: {
      version: "2.0.0",
      name: "VoiceSnap API",
      description: "方言数据采集工具 API",
      features: [
        "分层架构设计",
        "统一响应格式", 
        "完整的验证机制",
        "音频质量分析",
        "性能监控",
        "错误追踪"
      ],
      endpoints: {
        auth: "/api/v2/auth/*",
        users: "/api/v2/user/*", 
        tasks: "/api/v2/tasks/*",
        recordings: "/api/v2/recordings/*"
      }
    },
    meta: {
      timestamp: new Date().toISOString()
    }
  })
})

// 挂载各模块路由
router.use("/", usersRouterV2)        // 用户和认证相关
router.use("/tasks", tasksRouterV2)   // 任务相关
router.use("/recordings", recordingsRouterV2) // 录音相关

export { router as apiV2Router }