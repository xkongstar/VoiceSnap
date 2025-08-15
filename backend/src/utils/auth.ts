import jwt from "jsonwebtoken"
import { createError } from "../middleware/errorHandler"

export interface TokenPayload {
  userId: string
  username: string
}

export function generateToken(payload: TokenPayload): string {
  const jwtSecret = process.env.JWT_SECRET
  if (!jwtSecret) {
    throw createError("JWT secret not configured", 500)
  }

  return (jwt as any).sign(payload, jwtSecret, {
    expiresIn: process.env.JWT_EXPIRES_IN || "7d",
  })
}

export function verifyToken(token: string): TokenPayload {
  const jwtSecret = process.env.JWT_SECRET
  if (!jwtSecret) {
    throw createError("JWT secret not configured", 500)
  }

  try {
    return (jwt as any).verify(token, jwtSecret) as TokenPayload
  } catch (error) {
    if (error instanceof jwt.JsonWebTokenError) {
      throw createError("Invalid token", 401)
    }
    throw error
  }
}
