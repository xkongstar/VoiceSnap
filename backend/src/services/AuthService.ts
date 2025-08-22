import jwt from "jsonwebtoken"
import bcrypt from "bcrypt"
import { User, type IUser } from "../models/User"
import { createError } from "../middleware/errorHandler"

export interface TokenPair {
  accessToken: string
  refreshToken: string
}

export interface TokenPayload {
  userId: string
  username: string
  type?: 'access' | 'refresh'
}

export interface RefreshTokenData {
  userId: string
  username: string
  tokenId: string
  expiresAt: Date
}

export class AuthService {
  private readonly ACCESS_TOKEN_EXPIRY = '15m'
  private readonly REFRESH_TOKEN_EXPIRY = '7d'
  private readonly SALT_ROUNDS = 12

  /**
   * 生成访问令牌和刷新令牌对
   */
  generateTokens(user: IUser): TokenPair {
    const userId = (user._id as any).toString()
    
    const accessTokenPayload: TokenPayload = {
      userId,
      username: user.username,
      type: 'access'
    }

    const refreshTokenPayload: TokenPayload = {
      userId,
      username: user.username,
      type: 'refresh'
    }

    const accessToken = jwt.sign(
      accessTokenPayload,
      this.getJwtSecret(),
      { expiresIn: this.ACCESS_TOKEN_EXPIRY }
    )

    const refreshToken = jwt.sign(
      refreshTokenPayload,
      this.getJwtRefreshSecret(),
      { expiresIn: this.REFRESH_TOKEN_EXPIRY }
    )

    return { accessToken, refreshToken }
  }

  /**
   * 验证访问令牌
   */
  verifyAccessToken(token: string): TokenPayload {
    try {
      const decoded = jwt.verify(token, this.getJwtSecret()) as TokenPayload
      
      if (decoded.type !== 'access') {
        throw createError('无效的令牌类型', 401)
      }

      return decoded
    } catch (error) {
      if (error instanceof jwt.JsonWebTokenError) {
        throw createError('无效的访问令牌', 401)
      }
      if (error instanceof jwt.TokenExpiredError) {
        throw createError('访问令牌已过期', 401)
      }
      throw error
    }
  }

  /**
   * 验证刷新令牌
   */
  verifyRefreshToken(token: string): TokenPayload {
    try {
      const decoded = jwt.verify(token, this.getJwtRefreshSecret()) as TokenPayload
      
      if (decoded.type !== 'refresh') {
        throw createError('无效的刷新令牌类型', 401)
      }

      return decoded
    } catch (error) {
      if (error instanceof jwt.JsonWebTokenError) {
        throw createError('无效的刷新令牌', 401)
      }
      if (error instanceof jwt.TokenExpiredError) {
        throw createError('刷新令牌已过期', 401)
      }
      throw error
    }
  }

  /**
   * 使用刷新令牌生成新的访问令牌
   */
  async refreshAccessToken(refreshToken: string): Promise<{ accessToken: string }> {
    const decoded = this.verifyRefreshToken(refreshToken)
    
    // 验证用户是否仍然存在且处于活跃状态
    const user = await User.findById(decoded.userId)
    if (!user) {
      throw createError('用户不存在', 404)
    }

    const userId = (user._id as any).toString()
    const accessTokenPayload: TokenPayload = {
      userId,
      username: user.username,
      type: 'access'
    }

    const accessToken = jwt.sign(
      accessTokenPayload,
      this.getJwtSecret(),
      { expiresIn: this.ACCESS_TOKEN_EXPIRY }
    )

    return { accessToken }
  }

  /**
   * 用户注册
   */
  async register(username: string, password: string, email?: string): Promise<{ user: IUser; tokens: TokenPair }> {
    // 验证输入
    this.validateRegistrationInput(username, password)

    // 检查用户是否已存在
    const existingUser = await User.findOne({ username })
    if (existingUser) {
      throw createError('用户名已存在', 409)
    }

    // 哈希密码
    const hashedPassword = await bcrypt.hash(password, this.SALT_ROUNDS)

    // 创建用户
    const user = new User({
      username,
      password_hash: hashedPassword,
      email
    })

    await user.save()

    // 生成令牌
    const tokens = this.generateTokens(user)

    return { user, tokens }
  }

  /**
   * 用户登录
   */
  async login(username: string, password: string): Promise<{ user: IUser; tokens: TokenPair }> {
    // 验证输入
    if (!username || !password) {
      throw createError('用户名和密码必填', 400)
    }

    // 查找用户
    const user = await User.findOne({ username })
    if (!user) {
      throw createError('用户名或密码错误', 401)
    }

    // 验证密码
    const isPasswordValid = await bcrypt.compare(password, user.password_hash)
    if (!isPasswordValid) {
      throw createError('用户名或密码错误', 401)
    }

    // 生成令牌
    const tokens = this.generateTokens(user)

    return { user, tokens }
  }

  /**
   * 验证注册输入
   */
  private validateRegistrationInput(username: string, password: string): void {
    if (!username || !password) {
      throw createError('用户名和密码必填', 400)
    }

    if (username.length < 3 || username.length > 50) {
      throw createError('用户名长度必须在3-50个字符之间', 400)
    }

    if (password.length < 6) {
      throw createError('密码长度至少6个字符', 400)
    }

    // 密码强度检查
    const passwordRegex = /^(?=.*[a-zA-Z])(?=.*\d)/
    if (!passwordRegex.test(password)) {
      throw createError('密码必须包含至少一个字母和一个数字', 400)
    }
  }

  /**
   * 获取JWT密钥
   */
  private getJwtSecret(): string {
    const secret = process.env.JWT_SECRET
    if (!secret) {
      throw createError('JWT密钥未配置', 500)
    }
    return secret
  }

  /**
   * 获取JWT刷新密钥
   */
  private getJwtRefreshSecret(): string {
    const secret = process.env.JWT_REFRESH_SECRET
    if (!secret) {
      throw createError('JWT刷新密钥未配置', 500)
    }
    return secret
  }
}

export const authService = new AuthService()