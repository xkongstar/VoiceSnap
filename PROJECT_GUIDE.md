# DialectCapture: Complete Project Documentation

This document provides a comprehensive guide to the DialectCapture monorepo, detailing the architecture and function of each component, down to individual files.

## 1. Project Overview

**DialectCapture** is a tool designed for small, internal teams to rapidly collect dialect audio data. The primary goal is to create a simple workflow for team members to record audio for a given text prompt, provide a dialect-specific transcription, and upload the data for use in ASR (Automatic Speech Recognition) and TTS (Text-to-Speech) model training.

### 1.1. Overall Architecture

The project is a monorepo containing three distinct parts:

1.  **Backend (`backend/`):** A robust Node.js/Express API server that handles all business logic, data storage, and user authentication.
2.  **Mobile App (`mobile/`):** A feature-complete React Native application that serves as the primary tool for data collectors. It supports the full workflow, including offline recording capabilities.
3.  **Web Frontend (`app/`):** A boilerplate Next.js web application. It has been initialized with a modern tech stack and a UI component library but contains no functional pages or features. **It is a template, not a working application.**

### 1.2. Technology Stack

| Component      | Framework              | Language       | Database | State Management | UI / API                                      | Key Features                                       |
| :------------- | :--------------------- | :------------- | :------- | :--------------- | :-------------------------------------------- | :------------------------------------------------- |
| **Backend**    | Node.js / Express      | TypeScript     | MongoDB  | N/A              | Mongoose (ORM), JWT (Auth), Vercel Blob (Files) | REST API, User Auth, File Uploads, Data Persistence |
| **Mobile App** | React Native           | TypeScript     | N/A      | Zustand          | React Navigation, React Native Elements, Axios  | Audio Recording, Offline Sync, Task Management     |
| **Web Frontend** | Next.js (App Router)   | TypeScript     | N/A      | N/A              | shadcn/ui, Tailwind CSS                         | **(Boilerplate Only)** UI Kit, Theming             |

---

## 2. Backend (`backend/`) Documentation

The backend is the central nervous system of the application, responsible for all data management and business logic.

### 2.1. `package.json`
- **Purpose:** Defines dependencies, scripts, and metadata for the backend server.
- **Key Dependencies:** `express` (web server), `mongoose` (MongoDB ORM), `jsonwebtoken` & `bcrypt` (authentication), `multer` (file uploads), `@vercel/blob` (file storage client).
- **Scripts:** `dev` (starts dev server with `nodemon`), `build` (compiles TS to JS), `start` (runs production build).

### 2.2. `src/index.ts`
- **Purpose:** The main entry point for the server.
- **Functionality:**
    - Initializes the `express` app.
    - Configures middleware: `helmet` (security headers), `cors` (cross-origin requests), `morgan` (request logging), `express.json` (body parsing).
    - Registers all API routes under the `/api` prefix.
    - Establishes a connection to the database via `connectDatabase()` before starting the server.
    - Includes a `/health` check endpoint and a global error handler.

### 2.3. `src/config/database.ts`
- **Purpose:** Manages the connection to the MongoDB database.
- **Functionality:**
    - The `connectDatabase` function connects to the database using the `MONGODB_URI` from environment variables.
    - It includes robust error handling for the initial connection.
    - It sets up listeners for database events (`error`, `disconnected`) and handles graceful shutdown (`SIGINT`).

### 2.4. Middleware (`src/middleware/`)

#### `auth.ts`
- **Purpose:** Provides middleware to protect authenticated routes.
- **`authenticateToken(req, res, next)`:**
    - Extracts the JWT from the `Authorization: Bearer <token>` header.
    - Verifies the token using the `JWT_SECRET`.
    - If valid, it attaches the user's payload (`id`, `username`) to the `req.user` object.
    - If invalid, it throws a `401` or `403` error.

#### `errorHandler.ts`
- **Purpose:** Provides a centralized, global error handler.
- **`errorHandler(error, req, res, next)`:**
    - Catches all errors passed to `next()`.
    - Logs detailed error information to the console for debugging.
    - Sends a standardized JSON error response to the client.
    - **Security:** It hides the stack trace in the response when in production mode.
- **`createError(message, statusCode)`:** A helper function used throughout the app to create structured error objects.

### 2.5. Data Models (`src/models/`)

#### `User.ts`
- **Purpose:** Defines the schema for a user.
- **Fields:** `username`, `password_hash`, `email`, and an embedded `stats` object (`total_recordings`, `total_duration`).
- **Security Features:**
    - **`pre('save')` hook:** Automatically hashes the password with `bcrypt` before saving a user, preventing plain-text passwords from ever touching the database.
    - **`comparePassword()` method:** A safe method for comparing a candidate password against the stored hash during login.
    - **`toJSON()` transform:** Automatically removes the `password_hash` from the user object when it is serialized to JSON, preventing it from being leaked in API responses.

#### `Task.ts`
- **Purpose:** Defines the schema for a recording task.
- **Fields:** `text_content` (the prompt), `text_id` (a unique business ID), `is_active` (a flag for managing task availability).
- **Performance:** Includes indexes on `is_active` and `text_id` to speed up common queries.

#### `Recording.ts`
- **Purpose:** The central model, linking a User, a Task, and the collected data.
- **Fields:** `task_id` (ref to Task), `user_id` (ref to User), `original_text`, `dialect_transcription`, `audio_file_url`, and file metadata.
- **Data Integrity:** A unique compound index on `{ task_id: 1, user_id: 1 }` enforces the rule that a user can only submit one recording per task.

### 2.6. API Routes (`src/routes/`)

All routes are well-structured, using `try...catch` blocks and passing errors to the global error handler.

- **`auth.ts` (`/api/auth`):**
    - `POST /register`: Creates a new user, hashes the password, and returns a JWT.
    - `POST /login`: Validates credentials and returns a JWT.
    - `POST /refresh`: Issues a new JWT given a valid, existing one.

- **`tasks.ts` (`/api/tasks`):**
    - `GET /pending`: Returns the list of tasks the current user has **not** yet completed. Powers the "Unrecorded" tab in the mobile app.
    - `GET /completed`: Returns the list of tasks the user **has** completed, populated with their recording data. Powers the "Completed" tab.
    - `POST /` & `PUT /:id`: Admin routes for creating and updating tasks.

- **`recordings.ts` (`/api/recordings`):**
    - `POST /`: The main endpoint for submitting a recording. It uses `multer` to handle the file upload, uploads the audio to Vercel Blob, and creates the `Recording` document in the database in a single transaction. It also updates user statistics.
    - `PUT /:id`: Allows a user to update/re-record an existing submission.
    - `DELETE /:id`: Allows a user to delete a submission.

- **`user.ts` (`/api/user`):**
    - `GET /profile`: Gets the current user's profile information.
    - `GET /dashboard`: An efficient endpoint that fetches and aggregates all data needed for a dashboard view (pending tasks, completed tasks, stats) in a single API call.
    - `GET /statistics`: Provides more detailed, calculated statistics for the user.

- **`upload.ts` (`/api/upload`):**
    - Provides decoupled endpoints (`/audio`, `/metadata`) for uploading files. This offers a more flexible (but more complex) alternative to the main `POST /api/recordings` endpoint.

---

## 3. Mobile App (`mobile/`) Documentation

The mobile app is the primary client for DialectCapture, providing the full feature set for data collectors.

### 3.1. `App.tsx`
- **Purpose:** The root component and entry point for the mobile app.
- **Functionality:**
    - Initializes the `networkService` to monitor online/offline status.
    - Renders the main `AppNavigator`, delegating all screen management to it.

### 3.2. `src/navigation/AppNavigator.tsx`
- **Purpose:** Defines the entire navigation structure of the app.
- **Functionality:**
    - **Authentication Flow:** A top-level `StackNavigator` checks the `isAuthenticated` flag from the global store. It shows the `LoginScreen` if `false`, and the `MainTabs` navigator if `true`.
    - **`MainTabs`:** A `BottomTabNavigator` that provides the core post-login interface with four tabs:
        1.  **Tasks:** `TaskListScreen` (pending tasks).
        2.  **Recording:** `RecordingScreen` (active recording session).
        3.  **Completed:** `CompletedTasksScreen` (submitted tasks).
        4.  **Profile:** `ProfileScreen` (user info, stats, settings).

### 3.3. `src/store/appStore.ts`
- **Purpose:** A global state management store using **Zustand**.
- **State Managed (inferred):**
    - `user`, `token`, `isAuthenticated`: For managing the user session.
    - `pendingTasks`, `completedTasks`: Caches the task lists fetched from the API.
    - `currentTask`: The task currently selected for recording.
    - `isLoading`, `error`: Global state for loading indicators and errors.
    - `isOnline`: The network status, updated by the `networkService`.
    - `offlineRecordings`: A queue of recordings made offline, waiting to be synced.
- **Actions (inferred):** `login`, `logout`, `setPendingTasks`, `setCurrentTask`, `setIsOnline`, `addOfflineRecording`, etc.

### 3.4. Screens (`src/screens/`)

- **`LoginScreen.tsx`:** A combined login and registration screen. It handles form input, client-side validation, and calls the `apiService`. On success, it calls the `login` action in the store to trigger navigation.
- **`TaskListScreen.tsx`:** Displays a list of pending tasks using `FlatList`. Fetches data via `apiService` and allows users to select a task, which sets the `currentTask` in the store and navigates to the `RecordingScreen`.
- **`RecordingScreen.tsx`:** The core of the app. It displays the `currentTask`, handles audio recording and playback (via `audioService`), allows for dialect transcription input, and manages saving/uploading (via `uploadService`). It correctly handles both **online** (direct upload) and **offline** (save to local queue) scenarios.
- **`CompletedTasksScreen.tsx`:** Displays a list of the user's previously submitted recordings. Allows playback of the audio and deletion of old recordings.
- **`ProfileScreen.tsx`:** Shows user info and statistics. Provides crucial actions like **manual sync** for offline recordings and a **logout** button.

### 3.5. Services (`src/services/`)

This directory demonstrates excellent separation of concerns.

- **`apiService.ts`:** Handles all HTTP requests to the backend.
- **`audioService.ts`:** A wrapper around the audio library, providing a simple API for starting/stopping recording and playback.
- **`fileService.ts`:** A wrapper around `react-native-fs` for interacting with the local file system (listing/deleting files).
- **`networkService.ts`:** Manages the network state listener and orchestrates the synchronization of offline data.
- **`uploadService.ts`:** Manages the logic of uploading a recording, whether directly online or by saving it to an offline queue in AsyncStorage.

---

## 4. Web Frontend (`app/`) Documentation

The web frontend is in a non-functional, boilerplate state.

- **`app/page.tsx`:** The main page is a non-functional, syntactically incorrect placeholder file.
- **`app/layout.tsx`:** A standard Next.js root layout that sets up fonts and global CSS. Metadata suggests it was generated by Vercel's **v0.dev**.
- **`components/`:** This directory contains a full suite of UI components from **shadcn/ui** and a `theme-provider` for light/dark mode.

**Conclusion:** The web app has been initialized with a UI toolkit but **no actual application features have been built.** It cannot be considered a functional part of the project at this time.
