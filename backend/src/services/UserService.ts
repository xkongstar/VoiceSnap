import { User } from "../models/User"
import { Recording } from "../models/Recording"
import { Task } from "../models/Task"
import { createError } from "../middleware/errorHandler"
import { logInfo, logError } from "../utils/logger"
import { authService } from "./AuthService"
import type {
  LoginRequestDTO,
  LoginResponseDTO,
  RefreshTokenRequestDTO,
  RefreshTokenResponseDTO,
  UserProfileResponseDTO,
  UpdateUserProfileRequestDTO
} from "../types/DTOs"

// 简化的bcrypt实现
const bcrypt = {
  async compare(password: string, hash: string): Promise<boolean> {
    // 简化版本，实际应用中使用真正的bcrypt
    return password === hash // 仅供演示，不安全
  },
  async hash(password: string, saltRounds: number): Promise<string> {
    // 简化版本，实际应用中使用真正的bcrypt
    return password + '_hashed' // 仅供演示，不安全
  }
}

/**
 * 用户服务层 - 处理用户相关的业务逻辑
 */
export class UserService {
  /**
   * 用户登录
   */
  async login(loginData: LoginRequestDTO): Promise<LoginResponseDTO> {
    try {
      logInfo(`用户登录尝试: ${loginData.username}`)
      
      // 查找用户
      const user = await User.findOne({ username: loginData.username })
      if (!user) {
        throw createError('用户名或密码错误', 401)
      }

      // 验证密码
      const isPasswordValid = await bcrypt.compare(loginData.password, (user as any).password)
      if (!isPasswordValid) {
        throw createError('用户名或密码错误', 401)
      }

      // 生成令牌
      const tokens = authService.generateTokens((user._id as any).toString())

      logInfo(`用户登录成功: ${user.username} (${user._id})`)

      return {
        message: '登录成功',
        user: {
          id: (user._id as any).toString(),
          username: user.username
        },
        tokens
      }
    } catch (error) {
      if (error instanceof Error && error.message.includes('用户名或密码')) {
        throw error
      }
      logError('用户登录失败', error as Error, { username: loginData.username })
      throw createError('登录失败', 500)
    }
  }

  /**
   * 刷新访问令牌
   */
  async refreshToken(refreshData: RefreshTokenRequestDTO): Promise<RefreshTokenResponseDTO> {
    try {
      logInfo('刷新访问令牌')
      
      const accessToken = await authService.refreshAccessToken(refreshData.refreshToken)
      
      return { accessToken }
    } catch (error) {
      logError('刷新令牌失败', error as Error)
      throw createError('刷新令牌失败', 401)
    }
  }

  /**
   * 用户注册
   */
  async register(userData: { username: string; password: string }): Promise<{
    message: string
    user: { id: string; username: string }
  }> {
    try {
      logInfo(`用户注册: ${userData.username}`)
      
      // 检查用户名是否已存在
      const existingUser = await User.findOne({ username: userData.username })
      if (existingUser) {
        throw createError('用户名已存在', 409)
      }

      // 密码加密
      const saltRounds = 12
      const hashedPassword = await bcrypt.hash(userData.password, saltRounds)

      // 创建用户
      const user = new User({
        username: userData.username,
        password: hashedPassword
      })

      await user.save()

      logInfo(`用户注册成功: ${user.username} (${user._id})`)

      return {
        message: '注册成功',
        user: {
          id: (user._id as any).toString(),
          username: user.username
        }
      }
    } catch (error) {
      if (error instanceof Error && error.message.includes('已存在')) {
        throw error
      }
      logError('用户注册失败', error as Error, { username: userData.username })
      throw createError('注册失败', 500)
    }
  }

  /**
   * 获取用户个人资料
   */
  async getUserProfile(userId: string): Promise<UserProfileResponseDTO> {
    try {
      logInfo(`获取用户资料: ${userId}`)
      
      const user = await User.findById(userId).lean()
      if (!user) {
        throw createError('用户不存在', 404)
      }

      // 获取用户统计信息
      const [totalRecordings, completedTasks, allTasks] = await Promise.all([
        Recording.countDocuments({ user_id: userId }),
        Recording.find({ user_id: userId }).distinct('task_id'),
        Task.countDocuments({ is_active: true })
      ])

      // 计算总录音时长
      const recordings = await Recording.find({ user_id: userId })
        .select('duration_seconds')
        .lean()
      
      const totalDurationSeconds = recordings.reduce(
        (sum, recording) => sum + (recording.duration_seconds || 0), 
        0
      )

      const stats = {
        total_recordings: totalRecordings,
        total_duration_minutes: Math.round(totalDurationSeconds / 60 * 100) / 100,
        completed_tasks: completedTasks.length,
        pending_tasks: allTasks - completedTasks.length
      }

      return {
        _id: user._id.toString(),
        username: user.username,
        created_at: user.created_at.toISOString(),
        stats
      }
    } catch (error) {
      if (error instanceof Error && error.message.includes('不存在')) {
        throw error
      }
      logError('获取用户资料失败', error as Error, { userId })
      throw createError('获取用户资料失败', 500)
    }
  }

  /**
   * 更新用户资料
   */
  async updateUserProfile(
    userId: string, 
    updateData: UpdateUserProfileRequestDTO
  ): Promise<UserProfileResponseDTO> {
    try {
      logInfo(`更新用户资料: ${userId}`, updateData)
      
      const user = await User.findById(userId)
      if (!user) {
        throw createError('用户不存在', 404)
      }

      // 更新用户名
      if (updateData.username !== undefined) {
        // 检查用户名是否已被其他用户使用
        const existingUser = await User.findOne({ 
          username: updateData.username,
          _id: { $ne: userId }
        })
        if (existingUser) {
          throw createError('用户名已被使用', 409)
        }
        user.username = updateData.username
      }

      // 更新密码
      if (updateData.password !== undefined) {
        const saltRounds = 12
        ;(user as any).password = await bcrypt.hash(updateData.password, saltRounds)
      }

      await user.save()

      logInfo(`用户资料更新成功: ${userId}`)

      // 返回更新后的用户资料
      return await this.getUserProfile(userId)
    } catch (error) {
      if (error instanceof Error && (
        error.message.includes('不存在') || 
        error.message.includes('已被使用')
      )) {
        throw error
      }
      logError('更新用户资料失败', error as Error, { userId, updateData })
      throw createError('更新用户资料失败', 500)
    }
  }

  /**
   * 删除用户账户
   */
  async deleteUser(userId: string): Promise<void> {
    try {
      logInfo(`删除用户账户: ${userId}`)
      
      const user = await User.findById(userId)
      if (!user) {
        throw createError('用户不存在', 404)
      }

      // 删除用户的所有录音
      await Recording.deleteMany({ user_id: userId })

      // 删除用户账户
      await User.findByIdAndDelete(userId)

      logInfo(`用户账户删除成功: ${userId}`)
    } catch (error) {
      if (error instanceof Error && error.message.includes('不存在')) {
        throw error
      }
      logError('删除用户账户失败', error as Error, { userId })
      throw createError('删除用户账户失败', 500)
    }
  }

  /**
   * 用户登出（使令牌失效）
   */
  async logout(refreshToken: string): Promise<void> {
    try {
      logInfo('用户登出')
      
      // 这里可以将刷新令牌加入黑名单
      // 现在简化处理，依赖客户端清除令牌
      
      logInfo('用户登出成功')
    } catch (error) {
      logError('用户登出失败', error as Error)
      throw createError('登出失败', 500)
    }
  }

  /**
   * 验证用户密码
   */
  async verifyPassword(userId: string, password: string): Promise<boolean> {
    try {
      const user = await User.findById(userId)
      if (!user) {
        throw createError('用户不存在', 404)
      }

      return await bcrypt.compare(password, (user as any).password)
    } catch (error) {
      if (error instanceof Error && error.message.includes('不存在')) {
        throw error
      }
      logError('验证密码失败', error as Error, { userId })
      throw createError('验证密码失败', 500)
    }
  }

  /**
   * 获取用户列表（管理员功能）
   */
  async getUserList(page: number = 1, limit: number = 20): Promise<{
    users: Array<{
      _id: string
      username: string
      created_at: string
      recording_count: number
    }>
    total: number
    pagination: {
      page: number
      limit: number
      totalPages: number
    }
  }> {
    try {
      logInfo('获取用户列表', { page, limit })
      
      const skip = (page - 1) * limit
      
      const [users, total] = await Promise.all([
        User.find({})
          .select('username created_at')
          .sort({ created_at: -1 })
          .skip(skip)
          .limit(limit)
          .lean(),
        User.countDocuments({})
      ])

      // 获取每个用户的录音数量
      const usersWithStats = await Promise.all(
        users.map(async (user) => {
          const recordingCount = await Recording.countDocuments({ user_id: user._id })
          return {
            _id: user._id.toString(),
            username: user.username,
            created_at: user.created_at.toISOString(),
            recording_count: recordingCount
          }
        })
      )

      const totalPages = Math.ceil(total / limit)

      return {
        users: usersWithStats,
        total,
        pagination: {
          page,
          limit,
          totalPages
        }
      }
    } catch (error) {
      logError('获取用户列表失败', error as Error, { page, limit })
      throw createError('获取用户列表失败', 500)
    }
  }
}

// 导出单例实例
export const userService = new UserService()