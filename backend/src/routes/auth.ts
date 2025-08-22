import express from "express"
import { authService } from "../services/AuthService"
import { createError } from "../middleware/errorHandler"
import { authenticateToken, type AuthRequest } from "../middleware/auth"
import {
  validateRegister,
  validateLogin,
  validateRefreshToken,
  handleValidationErrors,
  authRateLimit
} from "../middleware/validation"

const router: express.Router = express.Router()

// Register new user
router.post("/register", authRateLimit, validateRegister, handleValidationErrors, async (req, res, next) => {
  try {
    const { username, password, email } = req.body

    const { user, tokens } = await authService.register(username, password, email)

    res.status(201).json({
      message: "用户注册成功",
      user: user.toJSON(),
      accessToken: tokens.accessToken,
      refreshToken: tokens.refreshToken,
    })
  } catch (error) {
    next(error)
  }
})

// Login user
router.post("/login", authRateLimit, validateLogin, handleValidationErrors, async (req, res, next) => {
  try {
    const { username, password } = req.body

    const { user, tokens } = await authService.login(username, password)

    res.json({
      message: "登录成功",
      user: user.toJSON(),
      accessToken: tokens.accessToken,
      refreshToken: tokens.refreshToken,
    })
  } catch (error) {
    next(error)
  }
})

// Refresh access token
router.post("/refresh", validateRefreshToken, handleValidationErrors, async (req, res, next) => {
  try {
    const { refreshToken } = req.body

    if (!refreshToken) {
      throw createError("刷新令牌必填", 400)
    }

    const { accessToken } = await authService.refreshAccessToken(refreshToken)

    res.json({
      message: "令牌刷新成功",
      accessToken,
    })
  } catch (error) {
    next(error)
  }
})

// Logout (client should remove tokens)
router.post("/logout", authenticateToken, async (req: AuthRequest, res, next) => {
  try {
    // 在实际生产环境中，可以在这里将令牌加入黑名单
    // 目前由客户端负责删除令牌
    res.json({
      message: "退出成功"
    })
  } catch (error) {
    next(error)
  }
})

export { router as authRoutes }
