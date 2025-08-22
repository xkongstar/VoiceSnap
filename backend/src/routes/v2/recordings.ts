import express from "express"
import multer from "multer"
import { recordingController } from "../../controllers/RecordingController"
import { authenticateToken } from "../../middleware/auth"
import { 
  validateRecordingUpload,
  validateRecordingUpdate,
  validateRecordingId,
  validateBatchOperation,
  validateFileUpload,
  handleValidationErrors,
  uploadRateLimit
} from "../../middleware/validation"

const router = express.Router()

/**
 * 录音路由 v2 - 基于分层架构
 */

// 配置文件上传
const upload = multer({
  storage: multer.memoryStorage(),
  limits: {
    fileSize: 50 * 1024 * 1024, // 50MB limit
  },
  fileFilter: (req, file, cb) => {
    const allowedTypes = ["audio/wav", "audio/mpeg", "audio/mp4", "audio/aac", "audio/x-m4a"]
    if (allowedTypes.includes(file.mimetype)) {
      cb(null, true)
    } else {
      cb(new Error("不支持的文件类型，只允许音频文件"))
    }
  },
})

// 获取用户所有录音
router.get(
  "/",
  authenticateToken,
  recordingController.getUserRecordings.bind(recordingController)
)

// 获取单个录音详情
router.get(
  "/:id",
  authenticateToken,
  validateRecordingId,
  handleValidationErrors,
  recordingController.getRecordingById.bind(recordingController)
)

// 获取录音处理状态
router.get(
  "/:id/status",
  authenticateToken,
  validateRecordingId,
  handleValidationErrors,
  recordingController.getRecordingStatus.bind(recordingController)
)

// 下载录音文件
router.get(
  "/:id/download",
  authenticateToken,
  validateRecordingId,
  handleValidationErrors,
  recordingController.downloadRecording.bind(recordingController)
)

// 上传新录音
router.post(
  "/",
  authenticateToken,
  uploadRateLimit,
  upload.single("audio"),
  validateFileUpload,
  validateRecordingUpload,
  handleValidationErrors,
  recordingController.createRecording.bind(recordingController)
)

// 更新录音
router.put(
  "/:id",
  authenticateToken,
  upload.single("audio"),
  validateRecordingId,
  validateRecordingUpdate,
  handleValidationErrors,
  recordingController.updateRecording.bind(recordingController)
)

// 删除录音
router.delete(
  "/:id",
  authenticateToken,
  validateRecordingId,
  handleValidationErrors,
  recordingController.deleteRecording.bind(recordingController)
)

// 重新处理录音
router.post(
  "/:id/reprocess",
  authenticateToken,
  validateRecordingId,
  handleValidationErrors,
  recordingController.reprocessRecording.bind(recordingController)
)

// 批量操作录音
router.post(
  "/batch",
  authenticateToken,
  validateBatchOperation,
  handleValidationErrors,
  recordingController.batchOperateRecordings.bind(recordingController)
)

export { router as recordingsRouterV2 }