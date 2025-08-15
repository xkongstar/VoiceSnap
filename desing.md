
## DialectCapture 架构设计

### 1. 简化后的技术栈

**前端 (React Native)**

- **框架**: React Native 0.72+
- **状态管理**: **Zustand** (轻量级，零样板代码)
- **导航**: React Navigation 6
- **UI组件**: React Native Elements
- **音频处理**: react-native-audio-recorder-player
- **网络请求**: **Axios** (简单直接)
- **本地存储**: **AsyncStorage** (足够应对简单离线需求)


**后端 (Node.js)**

- **框架**: Express.js + TypeScript
- **数据库**: **MongoDB Atlas** (免费512MB)
- **ORM**: Mongoose
- **认证**: JWT + bcrypt
- **文件存储**: **Vercel Blob** (免费1GB)
- **部署**: **Fly.io** 或 **Render** (免费套餐)


### 2. 简化的系统架构

```plaintext
┌─────────────────┐    ┌─────────────────┐    ┌─────────────────┐
│   React Native  │    │    Node.js      │    │  MongoDB Atlas  │
│   移动端应用     │◄──►│  Express Server │◄──►│   (免费集群)    │
│                 │    │                 │    │                 │
│ • Zustand状态   │    │ • JWT认证       │    │ • 用户集合      │
│ • AsyncStorage  │    │ • 文件上传      │    │ • 任务集合      │
│ • 音频录制      │    │ • 音频处理      │    │ • 录音集合      │
└─────────────────┘    └─────────────────┘    └─────────────────┘
         │                       │
         │                       │
         ▼                       ▼
┌─────────────────┐    ┌─────────────────┐
│  AsyncStorage   │    │   Vercel Blob   │
│                 │    │                 │
│ • 离线任务缓存  │    │ • 音频文件存储  │
│ • 用户偏好设置  │    │ • 免费1GB空间   │
└─────────────────┘    └─────────────────┘
```

### 3. MongoDB 数据模型设计

```javascript
// 用户模型
const userSchema = {
  _id: ObjectId,
  username: String,
  password_hash: String,
  email: String,
  created_at: Date,
  // 统计信息直接嵌入，避免额外查询
  stats: {
    total_recordings: Number,
    total_duration: Number
  }
}

// 任务模型
const taskSchema = {
  _id: ObjectId,
  text_content: String,
  text_id: String, // 唯一标识
  is_active: Boolean,
  created_at: Date
}

// 录音记录模型 (包含用户进度信息)
const recordingSchema = {
  _id: ObjectId,
  task_id: ObjectId,
  user_id: ObjectId,
  original_text: String,
  dialect_transcription: String,
  audio_file_url: String,
  file_name: String,
  duration_seconds: Number,
  file_size_bytes: Number,
  created_at: Date,
  // 直接在录音记录中标记状态，简化查询
  status: String // 'completed', 'pending'
}
```

### 4. 前端状态管理 (Zustand)

```javascript
// store/appStore.js
import { create } from 'zustand'
import { persist } from 'zustand/middleware'

const useAppStore = create(
  persist(
    (set, get) => ({
      // 用户状态
      user: null,
      isAuthenticated: false,
      
      // 任务状态
      tasks: [],
      currentTask: null,
      
      // 录音状态
      recordings: [],
      isRecording: false,
      
      // 离线状态
      offlineRecordings: [],
      isOnline: true,
      
      // Actions
      setUser: (user) => set({ user, isAuthenticated: !!user }),
      setTasks: (tasks) => set({ tasks }),
      addOfflineRecording: (recording) => 
        set((state) => ({ 
          offlineRecordings: [...state.offlineRecordings, recording] 
        })),
      
      // 同步离线数据
      syncOfflineData: async () => {
        const { offlineRecordings } = get()
        // 同步逻辑
      }
    }),
    {
      name: 'dialect-capture-storage',
      // 只持久化必要数据
      partialize: (state) => ({
        user: state.user,
        isAuthenticated: state.isAuthenticated,
        offlineRecordings: state.offlineRecordings
      })
    }
  )
)
```

### 5. 简化的 API 设计

```javascript
// routes/api.js
const express = require('express');
const router = express.Router();

// 认证 (简化版)
router.post('/auth/login', async (req, res) => {
  // JWT登录逻辑
});

// 获取用户任务 (合并接口，减少请求)
router.get('/user/dashboard', async (req, res) => {
  const userId = req.user.id;
  
  // 一次查询获取所有需要的数据
  const [tasks, userRecordings, userStats] = await Promise.all([
    Task.find({ is_active: true }),
    Recording.find({ user_id: userId }),
    User.findById(userId).select('stats')
  ]);
  
  // 计算任务状态
  const tasksWithStatus = tasks.map(task => ({
    ...task.toObject(),
    completed: userRecordings.some(r => r.task_id.equals(task._id))
  }));
  
  res.json({
    tasks: tasksWithStatus,
    recordings: userRecordings,
    stats: userStats
  });
});

// 上传录音 (简化版)
router.post('/recordings', upload.single('audio'), async (req, res) => {
  // 直接上传到 Vercel Blob
  const audioUrl = await uploadToVercelBlob(req.file);
  
  // 保存记录
  const recording = new Recording({
    ...req.body,
    audio_file_url: audioUrl,
    user_id: req.user.id
  });
  
  await recording.save();
  res.json(recording);
});
```

### 6. 免费资源部署方案

#### 6.1 后端部署 (Fly.io)

```dockerfile
# Dockerfile
FROM node:18-alpine
WORKDIR /app
COPY package*.json ./
RUN npm ci --only=production
COPY . .
EXPOSE 3000
CMD ["npm", "start"]
```

```plaintext
# fly.toml
app = "dialect-capture-api"

[build]
  dockerfile = "Dockerfile"

[[services]]
  http_checks = []
  internal_port = 3000
  processes = ["app"]
  protocol = "tcp"

  [services.concurrency]
    hard_limit = 25
    soft_limit = 20

  [[services.ports]]
    force_https = true
    handlers = ["http"]
    port = 80

  [[services.ports]]
    handlers = ["tls", "http"]
    port = 443
```

#### 6.2 文件存储 (Vercel Blob)

```javascript
// services/uploadService.js
import { put } from '@vercel/blob';

export async function uploadAudio(file, fileName) {
  const blob = await put(fileName, file, {
    access: 'public',
    token: process.env.BLOB_READ_WRITE_TOKEN,
  });
  
  return blob.url;
}
```

### 7. 开发和运维简化

#### 7.1 环境变量管理

```shellscript
# .env
NODE_ENV=production
JWT_SECRET=your_jwt_secret
MONGODB_URI=mongodb+srv://username:password@cluster.mongodb.net/dialectcapture
BLOB_READ_WRITE_TOKEN=your_vercel_blob_token
```

#### 7.2 部署脚本

```json
{
  "scripts": {
    "dev": "nodemon src/index.js",
    "start": "node src/index.js",
    "deploy": "fly deploy"
  }
}
```

### 8. 成本估算

**完全免费运行的资源配置：**

- **MongoDB Atlas**: 免费512MB存储
- **Vercel Blob**: 免费1GB文件存储
- **Fly.io**: 免费3个共享CPU应用
- **总成本**: $0/月 (在免费额度内)


**预估容量：**

- 支持约1000个任务文本
- 存储约200-300个音频文件(平均3-5MB)
- 支持10-20个活跃用户