import mongoose from "mongoose"

export async function connectDatabase(): Promise<void> {
  const mongoUri = process.env.MONGODB_URI

  if (!mongoUri) {
    throw new Error("MONGODB_URI environment variable is not defined")
  }

  try {
    await mongoose.connect(mongoUri, {
      // Connection options for MongoDB Atlas
      retryWrites: true,
      w: "majority",
    })

    console.log("Connected to MongoDB Atlas")
  } catch (error) {
    console.error("MongoDB connection error:", error)
    throw error
  }
}

// Handle connection events
mongoose.connection.on("error", (error) => {
  console.error("MongoDB connection error:", error)
})

mongoose.connection.on("disconnected", () => {
  console.log("MongoDB disconnected")
})

// Graceful shutdown
process.on("SIGINT", async () => {
  try {
    await mongoose.connection.close()
    console.log("MongoDB connection closed through app termination")
    process.exit(0)
  } catch (error) {
    console.error("Error during graceful shutdown:", error)
    process.exit(1)
  }
})
