import { useState } from "react"
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  Alert,
  KeyboardAvoidingView,
  Platform,
  ScrollView,
} from "react-native"
import { MaterialIcons as Icon } from "@expo/vector-icons"
import { useAppStore } from "../store/appStore"
import { apiService } from "../services/apiService"
import { styles } from "../styles/LoginScreenStyles"

export default function LoginScreen() {
  const [username, setUsername] = useState("")
  const [password, setPassword] = useState("")
  const [isRegister, setIsRegister] = useState(false)
  const [email, setEmail] = useState("")

  const { login, setIsLoading, setError, isLoading } = useAppStore()

  const handleSubmit = async () => {
    if (!username.trim() || !password.trim()) {
      Alert.alert("错误", "请输入用户名和密码")
      return
    }

    if (password.length < 6) {
      Alert.alert("错误", "密码至少需要6位字符")
      return
    }

    setIsLoading(true)
    setError(null)

    try {
      let response
      if (isRegister) {
        response = await apiService.register(username.trim(), password, email.trim() || undefined)
      } else {
        response = await apiService.login(username.trim(), password)
      }

      login(response.user, response.token)
      Alert.alert("成功", isRegister ? "注册成功！" : "登录成功！")
    } catch (error: any) {
      const errorMessage = error.response?.data?.error?.message || error.message || "操作失败"
      setError(errorMessage)
      Alert.alert("错误", errorMessage)
    } finally {
      setIsLoading(false)
    }
  }

  return (
    <View style={styles.container}>
      {/* 渐变背景效果 */}
      <View style={styles.gradientBackground} />
      
      {/* 装饰性圆圈 */}
      <View style={styles.circle1} />
      <View style={styles.circle2} />
      <View style={styles.circle3} />
      
      <KeyboardAvoidingView style={styles.keyboardContainer} behavior={Platform.OS === "ios" ? "padding" : "height"}>
        <ScrollView contentContainerStyle={styles.scrollContainer}>
          {/* 应用图标和标题 */}
          <View style={styles.heroSection}>
            <View style={styles.logoContainer}>
              <Icon name="record-voice-over" size={60} color="#fff" />
            </View>
            <Text style={styles.title}>方言录制助手</Text>
            <Text style={styles.subtitle}>{isRegister ? "创建新账户" : "欢迎回来"}</Text>
          </View>

          <View style={styles.formContainer}>
            <View style={styles.inputContainer}>
              <View style={styles.inputWrapper}>
                <Icon name="person" size={20} color="#666" style={styles.inputIcon} />
                <TextInput
                  style={styles.input}
                  value={username}
                  onChangeText={setUsername}
                  placeholder="请输入用户名"
                  placeholderTextColor="#999"
                  autoCapitalize="none"
                  autoCorrect={false}
                />
              </View>
            </View>

            {isRegister && (
              <View style={styles.inputContainer}>
                <View style={styles.inputWrapper}>
                  <Icon name="email" size={20} color="#666" style={styles.inputIcon} />
                  <TextInput
                    style={styles.input}
                    value={email}
                    onChangeText={setEmail}
                    placeholder="请输入邮箱地址 (可选)"
                    placeholderTextColor="#999"
                    keyboardType="email-address"
                    autoCapitalize="none"
                    autoCorrect={false}
                  />
                </View>
              </View>
            )}

            <View style={styles.inputContainer}>
              <View style={styles.inputWrapper}>
                <Icon name="lock" size={20} color="#666" style={styles.inputIcon} />
                <TextInput
                  style={styles.input}
                  value={password}
                  onChangeText={setPassword}
                  placeholder="请输入密码 (至少6位)"
                  placeholderTextColor="#999"
                  secureTextEntry
                  autoCapitalize="none"
                  autoCorrect={false}
                />
              </View>
            </View>

            <TouchableOpacity
              style={[styles.button, isLoading && styles.buttonDisabled]}
              onPress={handleSubmit}
              disabled={isLoading}
            >
              {isLoading ? (
                <>
                  <Icon name="hourglass-empty" size={20} color="#fff" />
                  <Text style={styles.buttonText}>处理中...</Text>
                </>
              ) : (
                <>
                  <Icon name={isRegister ? "person-add" : "login"} size={20} color="#fff" />
                  <Text style={styles.buttonText}>{isRegister ? "注册" : "登录"}</Text>
                </>
              )}
            </TouchableOpacity>

            <TouchableOpacity style={styles.switchButton} onPress={() => setIsRegister(!isRegister)}>
              <Text style={styles.switchButtonText}>
                {isRegister ? "已有账户？点击登录" : "没有账户？点击注册"}
              </Text>
            </TouchableOpacity>
          </View>
        </ScrollView>
      </KeyboardAvoidingView>
    </View>
  )
}


