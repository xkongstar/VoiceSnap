/**
 * 数据传输对象(DTOs) - 定义API请求和响应的数据结构
 */

// ================ 认证相关 DTOs ================
export interface LoginRequestDTO {
  username: string
  password: string
}

export interface LoginResponseDTO {
  message: string
  user: {
    id: string
    username: string
  }
  tokens: {
    accessToken: string
    refreshToken: string
  }
}

export interface RefreshTokenRequestDTO {
  refreshToken: string
}

export interface RefreshTokenResponseDTO {
  accessToken: string
}

// ================ 任务相关 DTOs ================
export interface CreateTaskRequestDTO {
  text_content: string
  text_id: string
}

export interface UpdateTaskRequestDTO {
  text_content?: string
  is_active?: boolean
}

export interface TaskResponseDTO {
  _id: string
  text_content: string
  text_id: string
  is_active: boolean
  created_at: string
  updated_at: string
}

export interface PendingTasksResponseDTO {
  tasks: TaskResponseDTO[]
  total: number
  completed_count: number
  total_tasks: number
}

export interface CompletedTasksResponseDTO {
  tasks: CompletedTaskItemDTO[]
  total: number
}

export interface CompletedTaskItemDTO {
  task: TaskResponseDTO
  recording: {
    _id: string
    dialect_transcription: string
    audio_file_url?: string
    duration_seconds?: number
    created_at: string
  }
}

// ================ 录音相关 DTOs ================
export interface CreateRecordingRequestDTO {
  task_id: string
  original_text: string
  dialect_transcription: string
  duration_seconds?: number
}

export interface UpdateRecordingRequestDTO {
  dialect_transcription?: string
  duration_seconds?: number
}

export interface RecordingResponseDTO {
  _id: string
  task_id: string | TaskResponseDTO
  user_id: string
  dialect_transcription: string
  audio_file_url?: string
  duration_seconds?: number
  audio_quality?: AudioQualityDTO
  processing_status: 'pending' | 'processing' | 'completed' | 'failed'
  metadata?: RecordingMetadataDTO
  created_at: string
  updated_at: string
}

export interface AudioQualityDTO {
  snr_db?: number
  rms_amplitude?: number
  peak_amplitude?: number
  silence_ratio?: number
  frequency_range?: {
    low_freq: number
    high_freq: number
  }
  spectral_centroid?: number
  zero_crossing_rate?: number
  overall_score?: number
  issues?: string[]
}

export interface RecordingMetadataDTO {
  original_filename?: string
  file_size_bytes?: number
  mime_type?: string
  codec?: string
  bit_rate?: number
  sample_rate?: number
  channels?: number
  format_version?: string
  processing_time_ms?: number
  device_info?: {
    user_agent?: string
    platform?: string
  }
}

export interface RecordingsListResponseDTO {
  recordings: RecordingResponseDTO[]
  total: number
  pagination?: {
    page: number
    limit: number
    totalPages: number
  }
}

// ================ 批量操作 DTOs ================
export interface BatchRecordingOperationDTO {
  recording_ids: string[]
  operation: 'delete' | 'export' | 'analyze'
}

export interface BatchOperationResponseDTO {
  success_count: number
  failed_count: number
  failed_items?: Array<{
    id: string
    error: string
  }>
  result?: any
}

// ================ 用户相关 DTOs ================
export interface UserProfileResponseDTO {
  _id: string
  username: string
  created_at: string
  stats: {
    total_recordings: number
    total_duration_minutes: number
    completed_tasks: number
    pending_tasks: number
  }
}

export interface UpdateUserProfileRequestDTO {
  username?: string
  password?: string
}

// ================ 文件上传 DTOs ================
export interface FileUploadResponseDTO {
  message: string
  file_url: string
  file_size: number
  processing_status: string
}

// ================ 通用响应 DTOs ================
export interface ApiResponseDTO<T = any> {
  success: boolean
  message?: string
  data?: T
  error?: {
    code: string
    message: string
    details?: any
  }
  meta?: {
    timestamp: string
    request_id?: string
    version?: string
  }
}

export interface PaginationDTO {
  page: number
  limit: number
  total: number
  totalPages: number
  hasNext: boolean
  hasPrev: boolean
}

// ================ 错误响应 DTOs ================
export interface ErrorResponseDTO {
  error: {
    code: string
    message: string
    details?: any
    stack?: string // 仅在开发模式下
  }
  meta: {
    timestamp: string
    request_id?: string
    path: string
    method: string
  }
}

// ================ 验证相关 DTOs ================
export interface ValidationErrorDTO {
  field: string
  value: any
  message: string
  code: string
}

export interface ValidationErrorResponseDTO extends ErrorResponseDTO {
  error: {
    code: 'VALIDATION_ERROR'
    message: string
    details: {
      fields: ValidationErrorDTO[]
    }
  }
}

// ================ 系统状态 DTOs ================
export interface HealthCheckResponseDTO {
  status: 'healthy' | 'unhealthy'
  timestamp: string
  version: string
  services: {
    database: 'up' | 'down'
    storage: 'up' | 'down'
    audio_processor: 'up' | 'down'
  }
  metrics?: {
    uptime: number
    memory_usage: number
    cpu_usage: number
  }
}

// ================ 音频处理 DTOs ================
export interface AudioAnalysisRequestDTO {
  audio_url?: string
  audio_data?: Buffer
  analysis_type: 'quality' | 'transcription' | 'all'
}

export interface AudioAnalysisResponseDTO {
  success: boolean
  analysis_id: string
  quality_metrics?: AudioQualityDTO
  transcription?: {
    text: string
    confidence: number
    language: string
  }
  processing_time_ms: number
  error?: string
}