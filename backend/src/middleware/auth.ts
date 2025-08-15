import type { Request, Response, NextFunction } from "express"
import jwt from "jsonwebtoken"
import { createError } from "./errorHandler"

export interface AuthRequest extends Request {
  user?: {
    id: string
    username: string
  }
}

export function authenticateToken(req: AuthRequest, res: Response, next: NextFunction): void {
  const authHeader = req.headers["authorization"]
  const token = authHeader && authHeader.split(" ")[1] // Bearer TOKEN

  if (!token) {
    throw createError("Access token required", 401)
  }

  const jwtSecret = process.env.JWT_SECRET
  if (!jwtSecret) {
    throw createError("JWT secret not configured", 500)
  }

  try {
    const decoded = jwt.verify(token, jwtSecret) as any
    req.user = {
      id: decoded.userId,
      username: decoded.username,
    }
    next()
  } catch (error) {
    throw createError("Invalid or expired token", 403)
  }
}
