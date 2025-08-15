import type { Request, Response, NextFunction } from "express"

export interface AppError extends Error {
  statusCode?: number
  isOperational?: boolean
}

export function errorHandler(error: AppError, req: Request, res: Response, next: NextFunction): void {
  const statusCode = error.statusCode || 500
  const message = error.message || "Internal Server Error"

  // Log error for debugging
  console.error(`[${new Date().toISOString()}] Error:`, {
    message: error.message,
    stack: error.stack,
    url: req.url,
    method: req.method,
    statusCode,
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
