export const colors = {
  // 主要颜色
  primary: "#4f46e5",
  primaryLight: "#6366f1",
  primaryDark: "#3730a3",
  
  // 成功/录音相关
  success: "#10b981",
  successLight: "#34d399",
  successDark: "#059669",
  
  // 警告/离线相关
  warning: "#f59e0b",
  warningLight: "#fbbf24",
  warningDark: "#d97706",
  
  // 错误/删除相关
  error: "#ef4444",
  errorLight: "#f87171",
  errorDark: "#dc2626",
  
  // 信息/回放相关
  info: "#06b6d4",
  infoLight: "#22d3ee",
  infoDark: "#0891b2",
  
  // 紫色系/转录相关
  purple: "#8b5cf6",
  purpleLight: "#a78bfa",
  purpleDark: "#7c3aed",
  
  // 中性色
  gray: {
    50: "#f8fafc",
    100: "#f1f5f9",
    200: "#e2e8f0",
    300: "#cbd5e1",
    400: "#94a3b8",
    500: "#64748b",
    600: "#475569",
    700: "#334155",
    800: "#1e293b",
    900: "#0f172a",
  },
  
  // 白色和透明度
  white: "#ffffff",
  black: "#000000",
  transparent: "transparent",
  
  // 背景色
  background: "#f8fafc",
  surface: "#ffffff",
  
  // 文本颜色
  text: {
    primary: "#1e293b",
    secondary: "#64748b",
    tertiary: "#94a3b8",
    inverse: "#ffffff",
    light: "rgba(255, 255, 255, 0.9)",
    hint: "#cbd5e1",
  },
  
  // 边框颜色
  border: {
    light: "#f1f5f9",
    default: "#e2e8f0",
    dark: "#cbd5e1",
  },
  
  // 阴影颜色
  shadow: "#1e293b",
  
  // 覆盖层
  overlay: "rgba(0, 0, 0, 0.5)",
}

export const gradients = {
  primary: ["#4f46e5", "#6366f1"],
  success: ["#10b981", "#34d399"],
  warning: ["#f59e0b", "#fbbf24"],
  error: ["#ef4444", "#f87171"],
  info: ["#06b6d4", "#22d3ee"],
  purple: ["#8b5cf6", "#a78bfa"],
}

export type Colors = typeof colors
export type Gradients = typeof gradients
