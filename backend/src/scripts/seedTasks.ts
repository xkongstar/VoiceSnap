import mongoose from "mongoose"
import { Task } from "../models/Task"
import dotenv from "dotenv"

dotenv.config()

const sampleTasks = [
  {
    text_id: "TASK_001",
    text_content: "请用您的方言说：今天天气真好，我们去公园散步吧。",
  },
  {
    text_id: "TASK_002",
    text_content: "请用您的方言说：这个菜做得很香，我想再吃一碗米饭。",
  },
  {
    text_id: "TASK_003",
    text_content: "请用您的方言说：明天是周末，我打算在家里休息一下。",
  },
  {
    text_id: "TASK_004",
    text_content: "请用您的方言说：这本书很有趣，我已经看了一半了。",
  },
  {
    text_id: "TASK_005",
    text_content: "请用您的方言说：我的朋友住在山上，那里空气很清新。",
  },
]

async function seedTasks() {
  try {
    // Connect to database
    await mongoose.connect(process.env.MONGODB_URI!)
    console.log("Connected to MongoDB")

    // Clear existing tasks
    await Task.deleteMany({})
    console.log("Cleared existing tasks")

    // Insert sample tasks
    await Task.insertMany(sampleTasks)
    console.log(`Inserted ${sampleTasks.length} sample tasks`)

    console.log("✅ Task seeding completed successfully")
  } catch (error) {
    console.error("❌ Error seeding tasks:", error)
  } finally {
    await mongoose.connection.close()
    console.log("Database connection closed")
  }
}

// Run the seeding script
if (require.main === module) {
  seedTasks()
}
