import ffmpeg from 'fluent-ffmpeg'
import fs from 'fs'
import path from 'path'
import { randomBytes } from 'crypto'
import { logInfo, logError, logPerformance } from '../utils/logger'

export interface AudioQualityMetrics {
  snr?: number // 信噪比 (dB)
  volume_level?: number // 音量等级 (0-100)
  silence_ratio?: number // 静音比例 (0-1)
  clarity_score?: number // 清晰度评分 (0-100)
  duration_ms: number // 持续时间 (毫秒)
  sample_rate?: number // 采样率 (Hz)
  bit_rate?: number // 比特率 (bps)
  channels?: number // 声道数
  format?: string // 格式
  file_size?: number // 文件大小 (bytes)
}

export interface AudioAnalysisResult {
  success: boolean
  metrics?: AudioQualityMetrics
  error?: string
  processing_time_ms: number
}

class AudioQualityAnalyzer {
  private readonly tempDir = '/tmp'
  private readonly maxFileSize = 100 * 1024 * 1024 // 100MB
  private readonly maxDuration = 600 // 10分钟

  /**
   * 分析音频文件质量
   */
  async analyzeAudio(audioBuffer: Buffer, originalMimeType: string): Promise<AudioAnalysisResult> {
    const startTime = Date.now()
    let inputTempPath: string | undefined
    
    try {
      // 验证文件大小
      if (audioBuffer.length > this.maxFileSize) {
        throw new Error(`文件过大: ${audioBuffer.length} bytes (最大: ${this.maxFileSize} bytes)`)
      }

      // 生成临时文件路径
      const tempId = randomBytes(16).toString('hex')
      const inputExtension = this.getFileExtension(originalMimeType)
      inputTempPath = path.join(this.tempDir, `audio_analysis_${tempId}.${inputExtension}`)

      // 写入临时文件
      await fs.promises.writeFile(inputTempPath, audioBuffer)
      
      logInfo('开始音频质量分析', { 
        fileSize: audioBuffer.length, 
        mimeType: originalMimeType,
        tempPath: inputTempPath
      })

      // 获取基本信息
      const basicInfo = await this.getBasicAudioInfo(inputTempPath)
      
      // 验证持续时间
      if (basicInfo.duration_ms > this.maxDuration * 1000) {
        throw new Error(`音频过长: ${basicInfo.duration_ms}ms (最大: ${this.maxDuration * 1000}ms)`)
      }

      // 分析音量和静音
      const volumeMetrics = await this.analyzeVolumeAndSilence(inputTempPath)
      
      // 分析频谱（估算清晰度）
      const clarityScore = await this.estimateClarity(inputTempPath)
      
      // 计算信噪比（简化版本）
      const snr = await this.estimateSignalToNoiseRatio(inputTempPath)

      const metrics: AudioQualityMetrics = {
        ...basicInfo,
        ...volumeMetrics,
        clarity_score: clarityScore,
        snr: snr,
        file_size: audioBuffer.length
      }

      const processingTime = Date.now() - startTime
      logPerformance('音频质量分析', processingTime, { metrics })

      return {
        success: true,
        metrics,
        processing_time_ms: processingTime
      }

    } catch (error: any) {
      const processingTime = Date.now() - startTime
      logError('音频质量分析失败', error, { 
        fileSize: audioBuffer.length,
        mimeType: originalMimeType,
        processingTime
      })
      
      return {
        success: false,
        error: error.message || '音频分析失败',
        processing_time_ms: processingTime
      }
    } finally {
      // 清理临时文件
      if (inputTempPath) {
        try {
          await fs.promises.unlink(inputTempPath)
        } catch (cleanupError) {
          logError('清理临时文件失败', cleanupError as Error, { tempPath: inputTempPath })
        }
      }
    }
  }

  /**
   * 获取基本音频信息
   */
  private async getBasicAudioInfo(filePath: string): Promise<{
    duration_ms: number
    sample_rate?: number
    bit_rate?: number
    channels?: number
    format?: string
  }> {
    return new Promise((resolve, reject) => {
      ffmpeg.ffprobe(filePath, (err, metadata) => {
        if (err) {
          reject(new Error(`获取音频信息失败: ${err.message}`))
          return
        }

        const audioStream = metadata.streams.find(stream => stream.codec_type === 'audio')
        if (!audioStream) {
          reject(new Error('未找到音频流'))
          return
        }

        resolve({
          duration_ms: Math.round((metadata.format.duration || 0) * 1000),
          sample_rate: audioStream.sample_rate,
          bit_rate: parseInt(audioStream.bit_rate || '0'),
          channels: audioStream.channels,
          format: audioStream.codec_name
        })
      })
    })
  }

  /**
   * 分析音量和静音
   */
  private async analyzeVolumeAndSilence(filePath: string): Promise<{
    volume_level?: number
    silence_ratio?: number
  }> {
    return new Promise((resolve, reject) => {
      let volumeLevel: number | undefined
      let silenceRatio: number | undefined
      
      ffmpeg(filePath)
        .audioFilters([
          'volumedetect', // 音量检测
          'silencedetect=noise=-30dB:duration=0.5' // 静音检测
        ])
        .on('stderr', (stderrLine) => {
          // 解析音量信息
          const volumeMatch = stderrLine.match(/mean_volume: ([\\-\\d\\.]+) dB/)
          if (volumeMatch) {
            const meanVolume = parseFloat(volumeMatch[1])
            // 将dB转换为0-100的音量等级
            volumeLevel = Math.max(0, Math.min(100, (meanVolume + 60) * (100 / 60)))
          }

          // 解析静音信息
          const silenceMatch = stderrLine.match(/silence_duration: ([\\d\\.]+)/)
          if (silenceMatch) {
            const silenceDuration = parseFloat(silenceMatch[1])
            // 这里需要总时长来计算比例，简化处理
            silenceRatio = Math.min(1, silenceDuration / 10) // 假设10秒作为基准
          }
        })
        .on('end', () => {
          resolve({
            volume_level: volumeLevel,
            silence_ratio: silenceRatio || 0
          })
        })
        .on('error', (err) => {
          reject(new Error(`音量分析失败: ${err.message}`))
        })
        .format('null')
        .save('/dev/null')
    })
  }

  /**
   * 估算清晰度评分
   */
  private async estimateClarity(filePath: string): Promise<number> {
    return new Promise((resolve, reject) => {
      let clarityScore = 50 // 默认中等清晰度
      
      ffmpeg(filePath)
        .audioFilters([
          'highpass=f=300', // 高通滤波器，过滤低频噪音
          'lowpass=f=3400',  // 低通滤波器，过滤高频噪音
          'astats' // 音频统计
        ])
        .on('stderr', (stderrLine) => {
          // 解析音频统计信息来估算清晰度
          const rmsMatch = stderrLine.match(/RMS level dB: ([\\-\\d\\.]+)/)
          if (rmsMatch) {
            const rmsLevel = parseFloat(rmsMatch[1])
            // 基于RMS水平估算清晰度
            clarityScore = Math.max(0, Math.min(100, (rmsLevel + 40) * 2))
          }
        })
        .on('end', () => {
          resolve(clarityScore)
        })
        .on('error', (err) => {
          // 如果分析失败，返回默认值
          logError('清晰度分析失败，使用默认值', err, { filePath })
          resolve(50)
        })
        .format('null')
        .save('/dev/null')
    })
  }

  /**
   * 估算信噪比
   */
  private async estimateSignalToNoiseRatio(filePath: string): Promise<number> {
    return new Promise((resolve) => {
      let snr = 20 // 默认SNR值
      
      ffmpeg(filePath)
        .audioFilters([
          'astats=metadata=1:reset=1' // 音频统计，包含更多元数据
        ])
        .on('stderr', (stderrLine) => {
          // 基于音频统计估算SNR
          const dcOffsetMatch = stderrLine.match(/DC offset: ([\\-\\d\\.]+)/)
          const minLevelMatch = stderrLine.match(/Min level dB: ([\\-\\d\\.]+)/)
          const maxLevelMatch = stderrLine.match(/Max level dB: ([\\-\\d\\.]+)/)
          
          if (minLevelMatch && maxLevelMatch) {
            const minLevel = parseFloat(minLevelMatch[1])
            const maxLevel = parseFloat(maxLevelMatch[1])
            const dynamicRange = maxLevel - minLevel
            // 基于动态范围估算SNR
            snr = Math.max(0, Math.min(60, dynamicRange))
          }
        })
        .on('end', () => {
          resolve(snr)
        })
        .on('error', (err) => {
          // 如果分析失败，返回默认值
          logError('SNR分析失败，使用默认值', err, { filePath })
          resolve(20)
        })
        .format('null')
        .save('/dev/null')
    })
  }

  /**
   * 批量分析音频文件
   */
  async analyzeBatch(audioFiles: { buffer: Buffer; mimeType: string; id: string }[]): Promise<{
    results: Array<{ id: string; result: AudioAnalysisResult }>
    totalTime: number
  }> {
    const startTime = Date.now()
    const results: Array<{ id: string; result: AudioAnalysisResult }> = []
    
    // 并行处理，但限制并发数
    const chunkSize = 3 // 同时处理3个文件
    for (let i = 0; i < audioFiles.length; i += chunkSize) {
      const chunk = audioFiles.slice(i, i + chunkSize)
      const chunkResults = await Promise.all(
        chunk.map(async (file) => ({
          id: file.id,
          result: await this.analyzeAudio(file.buffer, file.mimeType)
        }))
      )
      results.push(...chunkResults)
    }
    
    const totalTime = Date.now() - startTime
    logPerformance('批量音频分析', totalTime, {
      fileCount: audioFiles.length,
      successCount: results.filter(r => r.result.success).length
    })
    
    return { results, totalTime }
  }

  /**
   * 根据MIME类型获取文件扩展名
   */
  private getFileExtension(mimeType: string): string {
    const mimeMap: { [key: string]: string } = {
      'audio/wav': 'wav',
      'audio/mpeg': 'mp3',
      'audio/mp4': 'm4a',
      'audio/aac': 'aac',
      'audio/x-m4a': 'm4a',
      'audio/ogg': 'ogg',
      'audio/webm': 'webm'
    }
    
    return mimeMap[mimeType] || 'wav'
  }

  /**
   * 生成音频质量报告
   */
  generateQualityReport(metrics: AudioQualityMetrics): {
    overall_score: number
    recommendations: string[]
    issues: string[]
  } {
    let score = 100
    const recommendations: string[] = []
    const issues: string[] = []

    // 检查音量
    if (metrics.volume_level !== undefined) {
      if (metrics.volume_level < 30) {
        score -= 20
        issues.push('音量过低')
        recommendations.push('建议靠近麦克风或提高录音音量')
      } else if (metrics.volume_level > 90) {
        score -= 15
        issues.push('音量过高')
        recommendations.push('建议降低录音音量，避免失真')
      }
    }

    // 检查静音比例
    if (metrics.silence_ratio !== undefined && metrics.silence_ratio > 0.3) {
      score -= 15
      issues.push('静音过多')
      recommendations.push('建议减少录音中的停顿和静音')
    }

    // 检查信噪比
    if (metrics.snr !== undefined && metrics.snr < 15) {
      score -= 25
      issues.push('背景噪音过多')
      recommendations.push('建议在安静环境中录音')
    }

    // 检查清晰度
    if (metrics.clarity_score !== undefined && metrics.clarity_score < 50) {
      score -= 20
      issues.push('清晰度不佳')
      recommendations.push('建议使用更好的麦克风或改善录音环境')
    }

    // 检查持续时间
    if (metrics.duration_ms < 1000) {
      score -= 30
      issues.push('录音过短')
      recommendations.push('建议录音时长至少1秒')
    } else if (metrics.duration_ms > 30000) {
      score -= 10
      issues.push('录音较长')
      recommendations.push('建议控制录音时长在30秒以内')
    }

    return {
      overall_score: Math.max(0, score),
      recommendations,
      issues
    }
  }
}

export const audioQualityAnalyzer = new AudioQualityAnalyzer()
export default AudioQualityAnalyzer