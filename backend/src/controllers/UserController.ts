import type { Response, NextFunction } from "express"
import type { AuthRequest } from "../middleware/auth"
import { userService } from "../services/UserService"
import { createError } from "../middleware/errorHandler"
import { logInfo } from "../utils/logger"
import type {
  LoginRequestDTO,
  RefreshTokenRequestDTO,
  UpdateUserProfileRequestDTO,
  ApiResponseDTO
} from "../types/DTOs"

/**
 * 用户控制器 - 处理用户相关的HTTP请求
 */
export class UserController {
  /**
   * 用户登录
   * POST /api/auth/login
   */
  async login(req: AuthRequest, res: Response, next: NextFunction): Promise<void> {
    try {
      const loginData: LoginRequestDTO = req.body

      // 验证必填字段
      if (!loginData.username || !loginData.password) {
        throw createError('用户名和密码为必填字段', 400)
      }

      const result = await userService.login(loginData)
      
      const response: ApiResponseDTO = {
        success: true,
        message: result.message,
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
   * 刷新访问令牌
   * POST /api/auth/refresh
   */
  async refreshToken(req: AuthRequest, res: Response, next: NextFunction): Promise<void> {
    try {
      const refreshData: RefreshTokenRequestDTO = req.body

      if (!refreshData.refreshToken) {
        throw createError('refreshToken 为必填字段', 400)
      }

      const result = await userService.refreshToken(refreshData)
      
      const response: ApiResponseDTO = {
        success: true,
        message: '令牌刷新成功',
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
   * 用户注册
   * POST /api/auth/register
   */
  async register(req: AuthRequest, res: Response, next: NextFunction): Promise<void> {
    try {
      const { username, password } = req.body

      // 验证必填字段
      if (!username || !password) {
        throw createError('用户名和密码为必填字段', 400)
      }

      // 基本验证
      if (username.length < 3 || username.length > 30) {
        throw createError('用户名长度必须在3-30个字符之间', 400)
      }

      if (password.length < 6) {
        throw createError('密码长度至少6个字符', 400)
      }

      const result = await userService.register({ username, password })
      
      const response: ApiResponseDTO = {
        success: true,
        message: result.message,
        data: result,
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
   * 用户登出
   * POST /api/auth/logout
   */
  async logout(req: AuthRequest, res: Response, next: NextFunction): Promise<void> {
    try {
      const { refreshToken } = req.body

      if (refreshToken) {
        await userService.logout(refreshToken)
      }
      
      const response: ApiResponseDTO = {
        success: true,
        message: '登出成功',
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
   * 获取用户个人资料
   * GET /api/user/profile
   */
  async getUserProfile(req: AuthRequest, res: Response, next: NextFunction): Promise<void> {
    try {
      const userId = req.user?.id
      if (!userId) {
        throw createError('用户ID不存在', 401)
      }

      const userProfile = await userService.getUserProfile(userId)
      
      const response: ApiResponseDTO = {
        success: true,
        message: '获取用户资料成功',
        data: userProfile,
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
   * 更新用户个人资料
   * PUT /api/user/profile
   */
  async updateUserProfile(req: AuthRequest, res: Response, next: NextFunction): Promise<void> {
    try {
      const userId = req.user?.id
      if (!userId) {
        throw createError('用户ID不存在', 401)
      }

      const updateData: UpdateUserProfileRequestDTO = req.body

      // 验证更新数据
      if (updateData.username !== undefined) {
        if (updateData.username.length < 3 || updateData.username.length > 30) {
          throw createError('用户名长度必须在3-30个字符之间', 400)
        }
      }

      if (updateData.password !== undefined) {
        if (updateData.password.length < 6) {
          throw createError('密码长度至少6个字符', 400)
        }
      }

      const userProfile = await userService.updateUserProfile(userId, updateData)
      
      const response: ApiResponseDTO = {
        success: true,
        message: '用户资料更新成功',
        data: userProfile,
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
   * 删除用户账户
   * DELETE /api/user/account
   */
  async deleteUserAccount(req: AuthRequest, res: Response, next: NextFunction): Promise<void> {
    try {
      const userId = req.user?.id
      if (!userId) {
        throw createError('用户ID不存在', 401)
      }

      const { password } = req.body
      if (!password) {
        throw createError('请输入密码确认删除操作', 400)
      }

      // 验证密码
      const isPasswordValid = await userService.verifyPassword(userId, password)
      if (!isPasswordValid) {
        throw createError('密码错误', 401)
      }

      await userService.deleteUser(userId)
      
      const response: ApiResponseDTO = {
        success: true,
        message: '用户账户删除成功',
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
   * 验证密码
   * POST /api/user/verify-password
   */
  async verifyPassword(req: AuthRequest, res: Response, next: NextFunction): Promise<void> {
    try {
      const userId = req.user?.id
      if (!userId) {
        throw createError('用户ID不存在', 401)
      }

      const { password } = req.body
      if (!password) {
        throw createError('密码为必填字段', 400)
      }

      const isValid = await userService.verifyPassword(userId, password)
      
      const response: ApiResponseDTO = {
        success: true,
        message: '密码验证完成',
        data: { valid: isValid },
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
   * 获取用户列表（管理员功能）
   * GET /api/admin/users
   */
  async getUserList(req: AuthRequest, res: Response, next: NextFunction): Promise<void> {
    try {
      // 这里应该添加管理员权限验证
      // 现在简化处理

      const page = parseInt(req.query.page as string) || 1
      const limit = parseInt(req.query.limit as string) || 20

      const result = await userService.getUserList(page, limit)
      
      const response: ApiResponseDTO = {
        success: true,
        message: '获取用户列表成功',
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
   * 获取当前用户信息
   * GET /api/user/me
   */
  async getCurrentUser(req: AuthRequest, res: Response, next: NextFunction): Promise<void> {
    try {
      const userId = req.user?.id
      const username = req.user?.username

      if (!userId || !username) {
        throw createError('用户信息不存在', 401)
      }

      const response: ApiResponseDTO = {
        success: true,
        message: '获取当前用户信息成功',
        data: {
          id: userId,
          username: username
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
}

// 导出单例实例
export const userController = new UserController()