import type { Response, NextFunction } from "express"
import type { AuthRequest } from "../middleware/auth"
import { recordingService } from "../services/RecordingService"
import { createError } from "../middleware/errorHandler"
import { logInfo } from "../utils/logger"
import type {
  CreateRecordingRequestDTO,
  UpdateRecordingRequestDTO,
  ApiResponseDTO,
  BatchRecordingOperationDTO
} from "../types/DTOs"

/**
 * 录音控制器 - 处理录音相关的HTTP请求
 */
export class RecordingController {
  /**
   * 获取用户所有录音
   * GET /api/recordings
   */
  async getUserRecordings(req: AuthRequest, res: Response, next: NextFunction): Promise<void> {
    try {
      const userId = req.user?.id
      if (!userId) {
        throw createError('用户ID不存在', 401)
      }

      const page = parseInt(req.query.page as string) || 1
      const limit = parseInt(req.query.limit as string) || 20

      const result = await recordingService.getUserRecordings(userId, page, limit)
      
      const response: ApiResponseDTO = {
        success: true,
        message: '获取录音列表成功',
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
   * 获取单个录音详情
   * GET /api/recordings/:id
   */
  async getRecordingById(req: AuthRequest, res: Response, next: NextFunction): Promise<void> {
    try {
      const userId = req.user?.id
      if (!userId) {
        throw createError('用户ID不存在', 401)
      }

      const recordingId = req.params.id
      const recording = await recordingService.getRecordingById(recordingId, userId)
      
      const response: ApiResponseDTO = {
        success: true,
        message: '获取录音详情成功',
        data: { recording },
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
   * 上传新录音
   * POST /api/recordings
   */
  async createRecording(req: AuthRequest, res: Response, next: NextFunction): Promise<void> {
    try {
      const userId = req.user?.id
      if (!userId) {
        throw createError('用户ID不存在', 401)
      }

      const audioFile = req.file
      if (!audioFile) {
        throw createError('音频文件为必填', 400)
      }

      const recordingData: CreateRecordingRequestDTO = req.body

      // 验证必填字段
      if (!recordingData.task_id || !recordingData.dialect_transcription) {
        throw createError('task_id 和 dialect_transcription 为必填字段', 400)
      }

      const recording = await recordingService.createRecording(
        userId,
        recordingData,
        {
          buffer: audioFile.buffer,
          originalname: audioFile.originalname,
          mimetype: audioFile.mimetype
        }
      )
      
      const response: ApiResponseDTO = {
        success: true,
        message: '录音上传成功',
        data: { recording },
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
   * 更新录音
   * PUT /api/recordings/:id
   */
  async updateRecording(req: AuthRequest, res: Response, next: NextFunction): Promise<void> {
    try {
      const userId = req.user?.id
      if (!userId) {
        throw createError('用户ID不存在', 401)
      }

      const recordingId = req.params.id
      const updateData: UpdateRecordingRequestDTO = req.body
      const audioFile = req.file

      let audioFileData
      if (audioFile) {
        audioFileData = {
          buffer: audioFile.buffer,
          originalname: audioFile.originalname,
          mimetype: audioFile.mimetype
        }
      }

      const recording = await recordingService.updateRecording(
        recordingId,
        userId,
        updateData,
        audioFileData
      )
      
      const response: ApiResponseDTO = {
        success: true,
        message: '录音更新成功',
        data: { recording },
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
   * 删除录音
   * DELETE /api/recordings/:id
   */
  async deleteRecording(req: AuthRequest, res: Response, next: NextFunction): Promise<void> {
    try {
      const userId = req.user?.id
      if (!userId) {
        throw createError('用户ID不存在', 401)
      }

      const recordingId = req.params.id
      await recordingService.deleteRecording(recordingId, userId)
      
      const response: ApiResponseDTO = {
        success: true,
        message: '录音删除成功',
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
   * 批量操作录音
   * POST /api/recordings/batch
   */
  async batchOperateRecordings(req: AuthRequest, res: Response, next: NextFunction): Promise<void> {
    try {
      const userId = req.user?.id
      if (!userId) {
        throw createError('用户ID不存在', 401)
      }

      const batchData: BatchRecordingOperationDTO = req.body

      if (!Array.isArray(batchData.recording_ids) || batchData.recording_ids.length === 0) {
        throw createError('recording_ids 必须是非空数组', 400)
      }

      if (!batchData.operation) {
        throw createError('operation 为必填字段', 400)
      }

      let result
      switch (batchData.operation) {
        case 'delete':
          result = await recordingService.batchDeleteRecordings(batchData.recording_ids, userId)
          break
        default:
          throw createError(`不支持的批量操作: ${batchData.operation}`, 400)
      }
      
      const response: ApiResponseDTO = {
        success: true,
        message: '批量操作完成',
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
   * 重新处理录音
   * POST /api/recordings/:id/reprocess
   */
  async reprocessRecording(req: AuthRequest, res: Response, next: NextFunction): Promise<void> {
    try {
      const userId = req.user?.id
      if (!userId) {
        throw createError('用户ID不存在', 401)
      }

      const recordingId = req.params.id
      
      // 这里可以添加重新处理录音的逻辑
      // 例如重新分析音频质量、重新上传等
      
      const response: ApiResponseDTO = {
        success: true,
        message: '录音重新处理请求已提交',
        data: { recording_id: recordingId },
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
   * 获取录音处理状态
   * GET /api/recordings/:id/status
   */
  async getRecordingStatus(req: AuthRequest, res: Response, next: NextFunction): Promise<void> {
    try {
      const userId = req.user?.id
      if (!userId) {
        throw createError('用户ID不存在', 401)
      }

      const recordingId = req.params.id
      const recording = await recordingService.getRecordingById(recordingId, userId)
      
      const response: ApiResponseDTO = {
        success: true,
        message: '获取录音状态成功',
        data: {
          recording_id: recordingId,
          processing_status: recording.processing_status,
          audio_file_url: recording.audio_file_url,
          audio_quality: recording.audio_quality
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
   * 下载录音文件
   * GET /api/recordings/:id/download
   */
  async downloadRecording(req: AuthRequest, res: Response, next: NextFunction): Promise<void> {
    try {
      const userId = req.user?.id
      if (!userId) {
        throw createError('用户ID不存在', 401)
      }

      const recordingId = req.params.id
      const recording = await recordingService.getRecordingById(recordingId, userId)
      
      if (!recording.audio_file_url) {
        throw createError('录音文件不存在或正在处理中', 404)
      }

      // 重定向到文件URL或返回文件流
      res.redirect(recording.audio_file_url)
    } catch (error) {
      next(error)
    }
  }
}

// 导出单例实例
export const recordingController = new RecordingController()