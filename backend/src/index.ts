import express from "express"
import cors from "cors"
import helmet from "helmet"
import dotenv from "dotenv"
import { connectDatabase } from "./config/database"
import { globalErrorHandler } from "./utils/globalErrorHandler"
import { httpLogger, errorLogger } from "./middleware/httpLogger"
import { securityMiddleware } from "./middleware/securityMiddleware"
import logger, { logInfo, logError } from "./utils/logger"

// V1 routes (legacy)
import { authRoutes } from "./routes/auth"
import { taskRoutes } from "./routes/tasks"
import { recordingRoutes } from "./routes/recordings"
import { userRoutes } from "./routes/user"
import { uploadRoutes } from "./routes/upload"

// V2 routes (new architecture)
import { apiV2Router } from "./routes/v2/index"

// Load environment variables
dotenv.config()

const app = express()
const PORT = process.env.PORT || 3000

// Core security middleware (applied first)
app.use(helmet())
app.use(securityMiddleware.securityHeaders)
app.use(securityMiddleware.checkBlacklist)
app.use(securityMiddleware.detectSuspiciousActivity)
app.use(securityMiddleware.requestSizeLimit)

// CORS with security configuration
app.use(cors(securityMiddleware.corsConfig))

// Rate limiting and request throttling
app.use(securityMiddleware.requestSlowDown)
app.use(securityMiddleware.generalRateLimit)

// Input sanitization
app.use(securityMiddleware.sanitizeInput)

// HTTP request logging
app.use(httpLogger)

// Body parsing middleware (after security checks)
app.use(express.json({ limit: "10mb" }))
app.use(express.urlencoded({ extended: true, limit: "10mb" }))

// Health check endpoint
app.get("/health", (req, res) => {
  res.json({
    status: "OK",
    timestamp: new Date().toISOString(),
    service: "DialectCapture API",
    versions: {
      v1: "Legacy API",
      v2: "New Layered Architecture"
    }
  })
})

// API v2 routes (recommended) with enhanced security
app.use("/api/v2", securityMiddleware.apiRateLimit, apiV2Router)

// API v1 routes (legacy, for backward compatibility) with enhanced security
app.use("/api/auth", securityMiddleware.authRateLimit, authRoutes)
app.use("/api/tasks", securityMiddleware.apiRateLimit, taskRoutes)
app.use("/api/recordings", securityMiddleware.uploadRateLimit, recordingRoutes)
app.use("/api/user", securityMiddleware.apiRateLimit, userRoutes)
app.use("/api/upload", 
  securityMiddleware.uploadRateLimit,
  securityMiddleware.validateFileType,
  uploadRoutes
)

// 404 handler
app.use("*", (req, res) => {
  res.status(404).json({
    error: "Route not found",
    path: req.originalUrl,
    suggestion: "Try using /api/v2/* for the new API endpoints"
  })
})

// Error logging middleware
app.use(errorLogger)

// Global error handler (must be last)
app.use(globalErrorHandler.handleError)

// Start server
async function startServer() {
  try {
    // Connect to MongoDB
    await connectDatabase()
    logInfo("Database connected successfully")

    app.listen(PORT, () => {
      logInfo(`Server running on port ${PORT}`)
      logInfo(`Health check: http://localhost:${PORT}/health`)
      logInfo(`API v1 (legacy): http://localhost:${PORT}/api/*`)
      logInfo(`API v2 (recommended): http://localhost:${PORT}/api/v2/*`)
      logInfo(`Environment: ${process.env.NODE_ENV || 'development'}`)
    })
  } catch (error) {
    logError("Failed to start server", error as Error)
    process.exit(1)
  }
}

startServer()
