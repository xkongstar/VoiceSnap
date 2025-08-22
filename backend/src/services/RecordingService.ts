import { Recording } from "../models/Recording"
import { Task } from "../models/Task"
import { createError } from "../middleware/errorHandler"
import { logInfo, logError, logPerformance } from "../utils/logger"
import { audioQualityAnalyzer } from "./AudioQualityAnalyzer"
import type {
  CreateRecordingRequestDTO,
  UpdateRecordingRequestDTO,
  RecordingResponseDTO,
  RecordingsListResponseDTO,
  BatchOperationResponseDTO,
  AudioQualityDTO,
  RecordingMetadataDTO
} from "../types/DTOs"
import { put } from "@vercel/blob"
import { randomBytes } from "crypto"
import fs from "fs"
import path from "path"
import ffmpeg from "fluent-ffmpeg"

/**
 * 录音服务层 - 处理录音相关的业务逻辑
 */
export class RecordingService {
  /**
   * 获取用户的所有录音
   */
  async getUserRecordings(
    userId: string, 
    page: number = 1, 
    limit: number = 20
  ): Promise<RecordingsListResponseDTO> {
    try {
      logInfo(`获取用户录音列表: ${userId}`, { page, limit })
      
      const skip = (page - 1) * limit
      
      const [recordings, total] = await Promise.all([
        Recording.find({ user_id: userId })
          .populate("task_id", "text_content text_id")
          .sort({ created_at: -1 })
          .skip(skip)
          .limit(limit)
          .lean(),
        Recording.countDocuments({ user_id: userId })
      ])

      const totalPages = Math.ceil(total / limit)

      return {
        recordings: recordings.map(recording => this.formatRecordingResponse(recording)),
        total,
        pagination: {
          page,
          limit,
          totalPages,
        }
      }
    } catch (error) {
      logError('获取用户录音列表失败', error as Error, { userId, page, limit })
      throw createError('获取录音列表失败', 500)
    }
  }

  /**
   * 根据ID获取录音详情
   */
  async getRecordingById(recordingId: string, userId: string): Promise<RecordingResponseDTO> {
    try {
      logInfo(`获取录音详情: ${recordingId}`)
      
      const recording = await Recording.findOne({
        _id: recordingId,
        user_id: userId
      }).populate("task_id", "text_content text_id").lean()

      if (!recording) {
        throw createError('录音不存在', 404)
      }

      return this.formatRecordingResponse(recording)
    } catch (error) {
      if (error instanceof Error && error.message.includes('不存在')) {
        throw error
      }
      logError('获取录音详情失败', error as Error, { recordingId, userId })
      throw createError('获取录音详情失败', 500)
    }
  }

  /**
   * 创建新录音
   */
  async createRecording(
    userId: string,
    recordingData: CreateRecordingRequestDTO,
    audioFile: {
      buffer: Buffer
      originalname: string
      mimetype: string
    }
  ): Promise<RecordingResponseDTO> {
    const startTime = Date.now()
    
    try {
      logInfo('创建新录音', { userId, taskId: recordingData.task_id })

      // 验证任务存在
      const task = await Task.findById(recordingData.task_id).lean()
      if (!task) {
        throw createError('任务不存在', 404)
      }

      // 检查是否已有录音
      const existingRecording = await Recording.findOne({
        task_id: recordingData.task_id,
        user_id: userId
      }).lean()

      if (existingRecording) {
        throw createError('该任务已有录音记录，请使用更新功能', 409)
      }

      // 创建录音记录（初始状态）
      const recording = new Recording({
        task_id: recordingData.task_id,
        user_id: userId,
        dialect_transcription: recordingData.dialect_transcription,
        duration_seconds: recordingData.duration_seconds,
        processing_status: 'processing',
        metadata: {
          original_filename: audioFile.originalname,
          file_size_bytes: audioFile.buffer.length,
          mime_type: audioFile.mimetype,
          processing_time_ms: 0
        }
      })

      await recording.save()

      // 异步处理音频文件
      this.processAudioFile((recording._id as any).toString(), audioFile)
        .catch(error => {
          logError('音频文件处理失败', error, { recordingId: recording._id })
        })

      logPerformance('录音创建', Date.now() - startTime, { recordingId: recording._id })

      return this.formatRecordingResponse(recording.toObject())
    } catch (error) {
      if (error instanceof Error && (
        error.message.includes('不存在') || 
        error.message.includes('已有录音')
      )) {
        throw error
      }
      logError('创建录音失败', error as Error, { userId, recordingData })
      throw createError('创建录音失败', 500)
    }
  }

  /**
   * 更新录音
   */
  async updateRecording(
    recordingId: string,
    userId: string,
    updateData: UpdateRecordingRequestDTO,
    audioFile?: {
      buffer: Buffer
      originalname: string
      mimetype: string
    }
  ): Promise<RecordingResponseDTO> {
    try {
      logInfo(`更新录音: ${recordingId}`, updateData)
      
      const recording = await Recording.findOne({
        _id: recordingId,
        user_id: userId
      })

      if (!recording) {
        throw createError('录音不存在', 404)
      }

      // 更新基本信息
      if (updateData.dialect_transcription !== undefined) {
        recording.dialect_transcription = updateData.dialect_transcription
      }
      if (updateData.duration_seconds !== undefined) {
        recording.duration_seconds = updateData.duration_seconds
      }

      // 如果有新的音频文件，重新处理
      if (audioFile) {
        recording.processing_status = 'processing'
        recording.metadata = {
          ...recording.metadata,
          file_size_bytes: audioFile.buffer.length,
          mime_type: audioFile.mimetype
        } as any

        await recording.save()

        // 异步处理新音频文件
        this.processAudioFile(recordingId, audioFile)
          .catch(error => {
            logError('音频文件重新处理失败', error, { recordingId })
          })
      } else {
        await recording.save()
      }

      logInfo(`录音更新成功: ${recordingId}`)

      return this.formatRecordingResponse(recording.toObject())
    } catch (error) {
      if (error instanceof Error && error.message.includes('不存在')) {
        throw error
      }
      logError('更新录音失败', error as Error, { recordingId, userId, updateData })
      throw createError('更新录音失败', 500)
    }
  }

  /**
   * 删除录音
   */
  async deleteRecording(recordingId: string, userId: string): Promise<void> {
    try {
      logInfo(`删除录音: ${recordingId}`)
      
      const recording = await Recording.findOne({
        _id: recordingId,
        user_id: userId
      })

      if (!recording) {
        throw createError('录音不存在', 404)
      }

      await Recording.findByIdAndDelete(recordingId)

      logInfo(`录音删除成功: ${recordingId}`)
    } catch (error) {
      if (error instanceof Error && error.message.includes('不存在')) {
        throw error
      }
      logError('删除录音失败', error as Error, { recordingId, userId })
      throw createError('删除录音失败', 500)
    }
  }

  /**
   * 批量删除录音
   */
  async batchDeleteRecordings(recordingIds: string[], userId: string): Promise<BatchOperationResponseDTO> {
    try {
      logInfo(`批量删除录音: ${recordingIds.length} 个录音`)
      
      const results = {
        success_count: 0,
        failed_count: 0,
        failed_items: [] as Array<{ id: string; error: string }>
      }

      for (const recordingId of recordingIds) {
        try {
          await this.deleteRecording(recordingId, userId)
          results.success_count++
        } catch (error) {
          results.failed_count++
          results.failed_items.push({
            id: recordingId,
            error: error instanceof Error ? error.message : '未知错误'
          })
        }
      }

      logInfo(`批量删除录音完成: 成功 ${results.success_count}, 失败 ${results.failed_count}`)

      return results
    } catch (error) {
      logError('批量删除录音失败', error as Error, { recordingIds, userId })
      throw createError('批量删除录音失败', 500)
    }
  }

  /**
   * 音频标准化处理
   */
  private async standardizeAudio(audioBuffer: Buffer, originalMimeType: string): Promise<Buffer> {
    const tempId = randomBytes(16).toString('hex')
    let inputTempPath: string | undefined
    const outputTempPath = path.join('/tmp', `converted_${tempId}.wav`)
    
    try {
      // 根据MIME类型确定输入文件扩展名
      let inputExtension = 'tmp'
      if (originalMimeType.includes('wav')) {
        inputExtension = 'wav'
      } else if (originalMimeType.includes('mp4') || originalMimeType.includes('m4a')) {
        inputExtension = 'm4a'
      } else if (originalMimeType.includes('aac')) {
        inputExtension = 'aac'
      } else if (originalMimeType.includes('mpeg')) {
        inputExtension = 'mp3'
      }
      
      inputTempPath = path.join('/tmp', `upload_${tempId}.${inputExtension}`)
      
      // 写入临时文件
      await fs.promises.writeFile(inputTempPath, audioBuffer)
      
      // 使用FFmpeg进行格式标准化
      await new Promise<void>((resolve, reject) => {
        ffmpeg(inputTempPath)
          .audioCodec('pcm_s16le')    // 16-bit PCM编码
          .audioFrequency(16000)      // 16kHz采样率
          .audioChannels(1)           // 单声道
          .format('wav')              // WAV格式
          .on('end', () => resolve())
          .on('error', (err) => reject(err))
          .save(outputTempPath)
      })
      
      // 读取转换后的文件
      return await fs.promises.readFile(outputTempPath)
      
    } catch (error) {
      logError('音频标准化失败', error as Error)
      throw new Error(`音频标准化处理失败: ${error instanceof Error ? error.message : '未知错误'}`)
    } finally {
      // 清理临时文件
      try {
        if (inputTempPath && fs.existsSync(inputTempPath)) {
          await fs.promises.unlink(inputTempPath)
        }
        if (fs.existsSync(outputTempPath)) {
          await fs.promises.unlink(outputTempPath)
        }
      } catch (cleanupError) {
        logError('清理临时文件失败', cleanupError as Error)
      }
    }
  }

  /**
   * 异步处理音频文件
   */
  private async processAudioFile(
    recordingId: string,
    audioFile: {
      buffer: Buffer
      originalname: string
      mimetype: string
    }
  ): Promise<void> {
    const startTime = Date.now()
    
    try {
      logInfo(`开始处理音频文件: ${recordingId}`)

      // 音频质量分析
      let qualityAnalysis
      try {
        qualityAnalysis = await audioQualityAnalyzer.analyzeAudio(
          audioFile.buffer, 
          audioFile.mimetype
        )
      } catch (analysisError) {
        logError('音频质量分析失败', analysisError as Error, { recordingId })
      }

      // 音频标准化
      let standardizedAudio: Buffer
      try {
        standardizedAudio = await this.standardizeAudio(audioFile.buffer, audioFile.mimetype)
      } catch (standardizeError) {
        logError('音频标准化失败', standardizeError as Error, { recordingId })
        standardizedAudio = audioFile.buffer // 使用原文件
      }

      // 上传到云存储
      let audioUrl: string
      try {
        const fileName = `recordings/${recordingId}_${Date.now()}.wav`
        const blob = await put(fileName, standardizedAudio, {
          access: 'public',
          contentType: 'audio/wav'
        })
        audioUrl = blob.url
      } catch (uploadError) {
        logError('音频文件上传失败', uploadError as Error, { recordingId })
        throw uploadError
      }

      // 更新录音记录
      const updateData: any = {
        audio_file_url: audioUrl,
        processing_status: 'completed',
        'metadata.processing_time_ms': Date.now() - startTime
      }

      if (qualityAnalysis?.success && qualityAnalysis.metrics) {
        updateData.audio_quality = qualityAnalysis.metrics
      }

      await Recording.findByIdAndUpdate(recordingId, updateData)

      logPerformance('音频文件处理', Date.now() - startTime, { recordingId })
      logInfo(`音频文件处理完成: ${recordingId}`)

    } catch (error) {
      logError('音频文件处理失败', error as Error, { recordingId })
      
      // 更新状态为失败
      await Recording.findByIdAndUpdate(recordingId, {
        processing_status: 'failed',
        'metadata.processing_time_ms': Date.now() - startTime
      })
    }
  }

  /**
   * 格式化录音响应数据
   */
  private formatRecordingResponse(recording: any): RecordingResponseDTO {
    return {
      _id: recording._id.toString(),
      task_id: recording.task_id,
      user_id: recording.user_id,
      dialect_transcription: recording.dialect_transcription,
      audio_file_url: recording.audio_file_url,
      duration_seconds: recording.duration_seconds,
      audio_quality: recording.audio_quality,
      processing_status: recording.processing_status || 'pending',
      metadata: recording.metadata,
      created_at: recording.created_at.toISOString(),
      updated_at: recording.updated_at.toISOString()
    }
  }
}

// 导出单例实例
export const recordingService = new RecordingService()