import { Audio } from "expo-av"
import * as FileSystem from "expo-file-system"
import { fileService } from "./fileService"

export interface RecordingResult {
  uri: string
  duration: number
  size: number
}

export interface PlaybackStatus {
  isLoaded: boolean
  isPlaying: boolean
  durationMillis?: number
  positionMillis?: number
}

class AudioService {
  private recording: Audio.Recording | null = null
  private sound: Audio.Sound | null = null
  private isRecording = false
  private isPlaying = false

  constructor() {
    this.configureAudioSession()
  }

  private async configureAudioSession() {
    try {
      await Audio.setAudioModeAsync({
        allowsRecordingIOS: true,
        playsInSilentModeIOS: true,
        interruptionModeIOS: 1, // Do not mix
        interruptionModeAndroid: 1, // Do not mix
        shouldDuckAndroid: false,
        playThroughEarpieceAndroid: false,
        staysActiveInBackground: true,
      })
    } catch (error) {
      console.error("[v1] Failed to set audio mode", error)
    }
  }

  // Request microphone permission
  async requestPermissions(): Promise<boolean> {
    const { status } = await Audio.requestPermissionsAsync()
    if (status !== "granted") {
      alert("抱歉，我们需要录音权限才能继续！")
      return false
    }
    return true
  }

  // Start recording
  async startRecording(
    onProgress?: (status: { durationMillis: number; metering?: number }) => void,
  ): Promise<string> {
    try {
      const hasPermission = await this.requestPermissions()
      if (!hasPermission) {
        throw new Error("录音权限被拒绝")
      }

      this.recording = new Audio.Recording()

      if (onProgress) {
        this.recording.setOnRecordingStatusUpdate(status => {
          if (status.isRecording) {
            onProgress({
              durationMillis: status.durationMillis,
              metering: status.metering,
            })
          }
        })
      }

      await this.recording.prepareToRecordAsync(Audio.RecordingOptionsPresets.HIGH_QUALITY)
      await this.recording.startAsync()

      this.isRecording = true
      const uri = this.recording.getURI()
      console.log("[v1] Recording started:", uri)
      return uri || ""
    } catch (error) {
      console.error("[v1] Start recording error:", error)
      throw error
    }
  }

  // Stop recording
  async stopRecording(): Promise<RecordingResult | null> {
    if (!this.recording) {
      throw new Error("没有正在进行的录音")
    }

    try {
      const status = await this.recording.stopAndUnloadAsync()
      this.isRecording = false
      const uri = this.recording.getURI()

      if (!uri) {
        throw new Error("无法获取录音文件 URI")
      }

      const fileInfo = await fileService.getFileInfo(uri)
      console.log("[v1] Recording stopped:", uri)

      this.recording = null

      return {
        uri,
        duration: status.durationMillis,
        size: fileInfo?.size || 0,
      }
    } catch (error) {
      console.error("[v1] Stop recording error:", error)
      throw error
    }
  }

  // Start playing audio
  async startPlayer(
    uri: string,
    onProgress?: (status: PlaybackStatus) => void,
  ): Promise<void> {
    try {
      if (this.sound) {
        await this.sound.unloadAsync()
        this.sound = null
      }

      const { sound } = await Audio.Sound.createAsync({ uri }, { shouldPlay: true }, onProgress)
      this.sound = sound
      this.isPlaying = true

      console.log("[v1] Playback started")
    } catch (error) {
      console.error("[v1] Start player error:", error)
      throw error
    }
  }

  // Stop playing audio
  async stopPlayer(): Promise<void> {
    try {
      if (this.sound) {
        await this.sound.stopAsync()
        await this.sound.unloadAsync()
        this.sound = null
      }
      this.isPlaying = false
      console.log("[v1] Playback stopped")
    } catch (error) {
      console.error("[v1] Stop player error:", error)
      throw error
    }
  }

  // Pause playing audio
  async pausePlayer(): Promise<void> {
    try {
      if (this.sound) {
        await this.sound.pauseAsync()
        this.isPlaying = false
        console.log("[v1] Playback paused")
      }
    } catch (error) {
      console.error("[v1] Pause player error:", error)
      throw error
    }
  }

  // Resume playing audio
  async resumePlayer(): Promise<void> {
    try {
      if (this.sound) {
        await this.sound.playAsync()
        this.isPlaying = true
        console.log("[v1] Playback resumed")
      }
    } catch (error) {
      console.error("[v1] Resume player error:", error)
      throw error
    }
  }

  // Delete recording file
  async deleteRecording(uri: string): Promise<void> {
    try {
      await FileSystem.deleteAsync(uri, { idempotent: true })
      console.log("[v1] Recording deleted:", uri)
    } catch (error) {
      console.error("[v1] Delete recording error:", error)
      throw error
    }
  }

  // Get recording duration
  async getRecordingDuration(uri: string): Promise<number> {
    try {
      if (this.sound) {
        await this.sound.unloadAsync()
        this.sound = null
      }
      const { sound } = await Audio.Sound.createAsync({ uri })
      const status = await sound.getStatusAsync()
      await sound.unloadAsync()

      // @ts-ignore
      return status.durationMillis || 0
    } catch (error) {
      console.error("[v1] Get duration error:", error)
      return 0
    }
  }

  // Format time for display
  formatTime(milliseconds: number): string {
    const totalSeconds = Math.floor(milliseconds / 1000)
    const minutes = Math.floor(totalSeconds / 60)
    const seconds = totalSeconds % 60
    return `${minutes.toString().padStart(2, "0")}:${seconds.toString().padStart(2, "0")}`
  }

  // Cleanup
  async cleanup(): Promise<void> {
    if (this.recording) {
      await this.recording.stopAndUnloadAsync()
      this.isRecording = false
      this.recording = null
    }
    if (this.sound) {
      await this.sound.unloadAsync()
      this.sound = null
      this.isPlaying = false
    }
  }

  // Getters
  get recordingStatus(): boolean {
    return this.isRecording
  }

  get playingStatus(): boolean {
    return this.isPlaying
  }
}

export const audioService = new AudioService()
