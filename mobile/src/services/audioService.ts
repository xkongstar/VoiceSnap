import AudioRecorderPlayer, {
  AVEncoderAudioQualityIOSType,
  AVEncodingOption,
  AudioEncoderAndroidType,
  AudioSourceAndroidType,
} from "react-native-audio-recorder-player"
import RNFS from "react-native-fs"
import { PermissionsAndroid, Platform } from "react-native"

export interface RecordingResult {
  uri: string
  duration: number
  size: number
}

class AudioService {
  private audioRecorderPlayer: AudioRecorderPlayer
  private recordingPath = ""
  private isRecording = false
  private isPlaying = false

  constructor() {
    this.audioRecorderPlayer = new AudioRecorderPlayer()
    this.audioRecorderPlayer.setSubscriptionDuration(0.1) // Update every 100ms
  }

  // Request microphone permission
  async requestPermissions(): Promise<boolean> {
    if (Platform.OS === "android") {
      try {
        const granted = await PermissionsAndroid.request(PermissionsAndroid.PERMISSIONS.RECORD_AUDIO, {
          title: "录音权限",
          message: "应用需要录音权限来录制您的方言",
          buttonNeutral: "稍后询问",
          buttonNegative: "拒绝",
          buttonPositive: "允许",
        })
        return granted === PermissionsAndroid.RESULTS.GRANTED
      } catch (err) {
        console.warn("Permission request error:", err)
        return false
      }
    }
    return true // iOS permissions are handled automatically
  }

  // Generate unique recording path
  private generateRecordingPath(): string {
    const timestamp = new Date().toISOString().replace(/[:.]/g, "-")
    const fileName = `recording_${timestamp}.wav`
    return `${RNFS.CachesDirectoryPath}/${fileName}`
  }

  // Start recording
  async startRecording(
    onProgress?: (data: { currentMetering?: number; currentPosition: number }) => void,
  ): Promise<string> {
    try {
      // Check permissions
      const hasPermission = await this.requestPermissions()
      if (!hasPermission) {
        throw new Error("录音权限被拒绝")
      }

      // Generate recording path
      this.recordingPath = this.generateRecordingPath()

      // Audio settings for high quality recording
      const audioSet = {
        AudioEncoderAndroid: AudioEncoderAndroidType.AAC,
        AudioSourceAndroid: AudioSourceAndroidType.MIC,
        AVEncoderAudioQualityKeyIOS: AVEncoderAudioQualityIOSType.high,
        AVNumberOfChannelsKeyIOS: 1,
        AVFormatIDKeyIOS: AVEncodingOption.aac,
        AudioSamplingRate: 44100,
        AudioChannels: 1,
        AudioEncodingBitRate: 128000,
      }

      // Start recording
      const uri = await this.audioRecorderPlayer.startRecorder(this.recordingPath, audioSet)
      this.isRecording = true

      // Set up progress listener
      if (onProgress) {
        this.audioRecorderPlayer.addRecordBackListener(onProgress)
      }

      console.log("[v0] Recording started:", uri)
      return uri
    } catch (error) {
      console.error("[v0] Start recording error:", error)
      throw error
    }
  }

  // Stop recording
  async stopRecording(): Promise<RecordingResult> {
    try {
      if (!this.isRecording) {
        throw new Error("没有正在进行的录音")
      }

      const result = await this.audioRecorderPlayer.stopRecorder()
      this.isRecording = false

      // Remove progress listener
      this.audioRecorderPlayer.removeRecordBackListener()

      // Get file info
      const fileInfo = await RNFS.stat(this.recordingPath)

      console.log("[v0] Recording stopped:", result)

      return {
        uri: this.recordingPath,
        duration: this.parseDurationFromResult(result),
        size: fileInfo.size,
      }
    } catch (error) {
      console.error("[v0] Stop recording error:", error)
      throw error
    }
  }

  // Parse duration from recording result
  private parseDurationFromResult(result: string): number {
    // The result format is usually like "file:///path/to/file.wav"
    // Duration is tracked separately, so we'll return 0 and track it in the component
    return 0
  }

  // Start playing audio
  async startPlayer(
    uri: string,
    onProgress?: (data: { currentPosition: number; duration: number }) => void,
  ): Promise<void> {
    try {
      const msg = await this.audioRecorderPlayer.startPlayer(uri)
      this.isPlaying = true

      // Set up progress listener
      if (onProgress) {
        this.audioRecorderPlayer.addPlayBackListener(onProgress)
      }

      console.log("[v0] Playback started:", msg)
    } catch (error) {
      console.error("[v0] Start player error:", error)
      throw error
    }
  }

  // Stop playing audio
  async stopPlayer(): Promise<void> {
    try {
      await this.audioRecorderPlayer.stopPlayer()
      this.isPlaying = false
      this.audioRecorderPlayer.removePlayBackListener()
      console.log("[v0] Playback stopped")
    } catch (error) {
      console.error("[v0] Stop player error:", error)
      throw error
    }
  }

  // Pause playing audio
  async pausePlayer(): Promise<void> {
    try {
      await this.audioRecorderPlayer.pausePlayer()
      console.log("[v0] Playback paused")
    } catch (error) {
      console.error("[v0] Pause player error:", error)
      throw error
    }
  }

  // Resume playing audio
  async resumePlayer(): Promise<void> {
    try {
      await this.audioRecorderPlayer.resumePlayer()
      console.log("[v0] Playback resumed")
    } catch (error) {
      console.error("[v0] Resume player error:", error)
      throw error
    }
  }

  // Delete recording file
  async deleteRecording(uri: string): Promise<void> {
    try {
      const exists = await RNFS.exists(uri)
      if (exists) {
        await RNFS.unlink(uri)
        console.log("[v0] Recording deleted:", uri)
      }
    } catch (error) {
      console.error("[v0] Delete recording error:", error)
      throw error
    }
  }

  // Get recording duration
  async getRecordingDuration(uri: string): Promise<number> {
    try {
      // This is a simplified implementation
      // In a real app, you might want to use a library to get actual audio duration
      const fileInfo = await RNFS.stat(uri)
      // Rough estimation: 1 second ≈ 44100 samples * 2 bytes = ~88KB for WAV
      return Math.round(fileInfo.size / 88000)
    } catch (error) {
      console.error("[v0] Get duration error:", error)
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
  cleanup(): void {
    this.audioRecorderPlayer.removeRecordBackListener()
    this.audioRecorderPlayer.removePlayBackListener()
  }

  // Getters
  get recording(): boolean {
    return this.isRecording
  }

  get playing(): boolean {
    return this.isPlaying
  }
}

export const audioService = new AudioService()
