import type { Request, Response, NextFunction } from "express"
import { logError } from "../utils/logger"

export interface AppError extends Error {
  statusCode?: number
  isOperational?: boolean
}

export function errorHandler(error: AppError, req: Request, res: Response, next: NextFunction): void {
  const statusCode = error.statusCode || 500
  const message = error.message || "Internal Server Error"

  // 使用Winston记录错误
  logError(`Request error: ${message}`, error, {
    url: req.url,
    method: req.method,
    statusCode,
    userId: (req as any).user?.id || 'anonymous',
    userAgent: req.get('User-Agent'),
    ip: req.ip
  })

  // Send error response
  res.status(statusCode).json({
    error: {
      message,
      ...(process.env.NODE_ENV === "development" && {
        stack: error.stack,
      }),
    },
  })
}

export function createError(message: string, statusCode = 500): AppError {
  const error: AppError = new Error(message)
  error.statusCode = statusCode
  error.isOperational = true
  return error
}
