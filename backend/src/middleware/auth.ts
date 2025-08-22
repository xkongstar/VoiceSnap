import type { Request, Response, NextFunction } from "express"
import { authService } from "../services/AuthService"
import { createError } from "./errorHandler"

export interface AuthRequest extends Request {
  user?: {
    id: string
    username: string
  }
}

/**
 * 认证中间件 - 验证访问令牌
 */
export function authenticateToken(req: AuthRequest, res: Response, next: NextFunction): void {
  try {
    const authHeader = req.headers["authorization"]
    const token = authHeader && authHeader.split(" ")[1] // Bearer TOKEN

    if (!token) {
      throw createError("访问令牌必填", 401)
    }

    // 使用AuthService验证令牌
    const decoded = authService.verifyAccessToken(token)
    req.user = {
      id: decoded.userId,
      username: decoded.username,
    }
    
    next()
  } catch (error) {
    next(error)
  }
}

/**
 * 可选认证中间件 - 如果有令牌则验证，没有则继续
 */
export function optionalAuth(req: AuthRequest, res: Response, next: NextFunction): void {
  try {
    const authHeader = req.headers["authorization"]
    const token = authHeader && authHeader.split(" ")[1]

    if (token) {
      const decoded = authService.verifyAccessToken(token)
      req.user = {
        id: decoded.userId,
        username: decoded.username,
      }
    }
    
    next()
  } catch (error) {
    // 可选认证失败时仍然继续，但不设置用户信息
    next()
  }
}
