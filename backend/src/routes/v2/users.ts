import express from "express"
import { userController } from "../../controllers/UserController"
import { authenticateToken, optionalAuth } from "../../middleware/auth"
import { 
  validateLoginRequest,
  validateRegisterRequest,
  validateRefreshToken,
  validateUserUpdate,
  handleValidationErrors,
  authRateLimit
} from "../../middleware/validation"

const router = express.Router()

/**
 * 用户和认证路由 v2 - 基于分层架构
 */

// ================ 认证相关路由 ================

// 用户登录
router.post(
  "/auth/login",
  authRateLimit,
  validateLoginRequest,
  handleValidationErrors,
  userController.login.bind(userController)
)

// 用户注册
router.post(
  "/auth/register",
  authRateLimit,
  validateRegisterRequest,
  handleValidationErrors,
  userController.register.bind(userController)
)

// 刷新访问令牌
router.post(
  "/auth/refresh",
  validateRefreshToken,
  handleValidationErrors,
  userController.refreshToken.bind(userController)
)

// 用户登出
router.post(
  "/auth/logout",
  optionalAuth,
  userController.logout.bind(userController)
)

// ================ 用户资料相关路由 ================

// 获取当前用户信息
router.get(
  "/user/me",
  authenticateToken,
  userController.getCurrentUser.bind(userController)
)

// 获取用户个人资料
router.get(
  "/user/profile",
  authenticateToken,
  userController.getUserProfile.bind(userController)
)

// 更新用户个人资料
router.put(
  "/user/profile",
  authenticateToken,
  validateUserUpdate,
  handleValidationErrors,
  userController.updateUserProfile.bind(userController)
)

// 验证密码
router.post(
  "/user/verify-password",
  authenticateToken,
  userController.verifyPassword.bind(userController)
)

// 删除用户账户
router.delete(
  "/user/account",
  authenticateToken,
  userController.deleteUserAccount.bind(userController)
)

// ================ 管理员功能 ================

// 获取用户列表（管理员功能）
router.get(
  "/admin/users",
  authenticateToken,
  // TODO: 添加管理员权限验证中间件
  userController.getUserList.bind(userController)
)

export { router as usersRouterV2 }