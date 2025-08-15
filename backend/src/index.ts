import express from "express"
import cors from "cors"
import helmet from "helmet"
import morgan from "morgan"
import dotenv from "dotenv"
import { connectDatabase } from "./config/database"
import { errorHandler } from "./middleware/errorHandler"
import { authRoutes } from "./routes/auth"
import { taskRoutes } from "./routes/tasks"
import { recordingRoutes } from "./routes/recordings"
import { userRoutes } from "./routes/user"
import { uploadRoutes } from "./routes/upload"

// Load environment variables
dotenv.config()

const app = express()
const PORT = process.env.PORT || 3000

// Security middleware
app.use(helmet())
app.use(
  cors({
    origin: process.env.FRONTEND_URL || "*",
    credentials: true,
  }),
)

// Logging middleware
app.use(morgan("combined"))

// Body parsing middleware
app.use(express.json({ limit: "50mb" }))
app.use(express.urlencoded({ extended: true, limit: "50mb" }))

// Health check endpoint
app.get("/health", (req, res) => {
  res.json({
    status: "OK",
    timestamp: new Date().toISOString(),
    service: "DialectCapture API",
  })
})

// API routes
app.use("/api/auth", authRoutes)
app.use("/api/tasks", taskRoutes)
app.use("/api/recordings", recordingRoutes)
app.use("/api/user", userRoutes)
app.use("/api/upload", uploadRoutes)

// 404 handler
app.use("*", (req, res) => {
  res.status(404).json({
    error: "Route not found",
    path: req.originalUrl,
  })
})

// Global error handler
app.use(errorHandler)

// Start server
async function startServer() {
  try {
    // Connect to MongoDB
    await connectDatabase()
    console.log("✅ Database connected successfully")

    app.listen(PORT, () => {
      console.log(`🚀 Server running on port ${PORT}`)
      console.log(`📍 Health check: http://localhost:${PORT}/health`)
    })
  } catch (error) {
    console.error("❌ Failed to start server:", error)
    process.exit(1)
  }
}

startServer()
