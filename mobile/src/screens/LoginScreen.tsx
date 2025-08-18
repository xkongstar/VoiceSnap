import { useState } from "react"
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  StyleSheet,
  Alert,
  KeyboardAvoidingView,
  Platform,
  ScrollView,
} from "react-native"
import { useAppStore } from "../store/appStore"
import { apiService } from "../services/apiService"

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
    <KeyboardAvoidingView style={styles.container} behavior={Platform.OS === "ios" ? "padding" : "height"}>
      <ScrollView contentContainerStyle={styles.scrollContainer}>
        <View style={styles.formContainer}>
          <Text style={styles.title}>方言录制助手</Text>
          <Text style={styles.subtitle}>{isRegister ? "创建新账户" : "登录您的账户"}</Text>

          <View style={styles.inputContainer}>
            <Text style={styles.label}>用户名</Text>
            <TextInput
              style={styles.input}
              value={username}
              onChangeText={setUsername}
              placeholder="请输入用户名"
              autoCapitalize="none"
              autoCorrect={false}
            />
          </View>

          {isRegister && (
            <View style={styles.inputContainer}>
              <Text style={styles.label}>邮箱 (可选)</Text>
              <TextInput
                style={styles.input}
                value={email}
                onChangeText={setEmail}
                placeholder="请输入邮箱地址"
                keyboardType="email-address"
                autoCapitalize="none"
                autoCorrect={false}
              />
            </View>
          )}

          <View style={styles.inputContainer}>
            <Text style={styles.label}>密码</Text>
            <TextInput
              style={styles.input}
              value={password}
              onChangeText={setPassword}
              placeholder="请输入密码 (至少6位)"
              secureTextEntry
              autoCapitalize="none"
              autoCorrect={false}
            />
          </View>

          <TouchableOpacity
            style={[styles.button, isLoading && styles.buttonDisabled]}
            onPress={handleSubmit}
            disabled={isLoading}
          >
            <Text style={styles.buttonText}>{isLoading ? "处理中..." : isRegister ? "注册" : "登录"}</Text>
          </TouchableOpacity>

          <TouchableOpacity style={styles.switchButton} onPress={() => setIsRegister(!isRegister)}>
            <Text style={styles.switchButtonText}>{isRegister ? "已有账户？点击登录" : "没有账户？点击注册"}</Text>
          </TouchableOpacity>
        </View>
      </ScrollView>
    </KeyboardAvoidingView>
  )
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: "#f5f5f5",
  },
  scrollContainer: {
    flexGrow: 1,
    justifyContent: "center",
    padding: 20,
  },
  formContainer: {
    backgroundColor: "white",
    borderRadius: 10,
    padding: 30,
    shadowColor: "#000",
    shadowOffset: {
      width: 0,
      height: 2,
    },
    shadowOpacity: 0.1,
    shadowRadius: 3.84,
    elevation: 5,
  },
  title: {
    fontSize: 28,
    fontWeight: "bold",
    textAlign: "center",
    marginBottom: 10,
    color: "#2196F3",
  },
  subtitle: {
    fontSize: 16,
    textAlign: "center",
    marginBottom: 30,
    color: "#666",
  },
  inputContainer: {
    marginBottom: 20,
  },
  label: {
    fontSize: 16,
    fontWeight: "500",
    marginBottom: 8,
    color: "#333",
  },
  input: {
    borderWidth: 1,
    borderColor: "#ddd",
    borderRadius: 8,
    padding: 12,
    fontSize: 16,
    backgroundColor: "#f9f9f9",
  },
  button: {
    backgroundColor: "#2196F3",
    borderRadius: 8,
    padding: 15,
    alignItems: "center",
    marginTop: 10,
  },
  buttonDisabled: {
    backgroundColor: "#ccc",
  },
  buttonText: {
    color: "white",
    fontSize: 18,
    fontWeight: "bold",
  },
  switchButton: {
    marginTop: 20,
    alignItems: "center",
  },
  switchButtonText: {
    color: "#2196F3",
    fontSize: 16,
  },
})
