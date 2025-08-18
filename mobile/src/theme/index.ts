export { colors, gradients } from "./colors"
export { spacing, borderRadius, fontSize, fontWeight, shadows, commonStyles } from "./styles"
export type { Colors, Gradients } from "./colors"
export type { CommonStyles } from "./styles"

// 主题配置
export const theme = {
  colors: {
    primary: "#4f46e5",
    success: "#10b981",
    warning: "#f59e0b",
    error: "#ef4444",
    info: "#06b6d4",
    purple: "#8b5cf6",
    background: "#f8fafc",
    surface: "#ffffff",
    text: "#1e293b",
  },
  spacing: {
    xs: 4,
    sm: 8,
    md: 12,
    lg: 16,
    xl: 20,
    xxl: 24,
  },
  borderRadius: {
    sm: 8,
    md: 12,
    lg: 16,
    xl: 20,
  },
  shadows: {
    sm: {
      shadowColor: "#1e293b",
      shadowOffset: { width: 0, height: 2 },
      shadowOpacity: 0.05,
      shadowRadius: 4,
      elevation: 2,
    },
    md: {
      shadowColor: "#1e293b",
      shadowOffset: { width: 0, height: 4 },
      shadowOpacity: 0.08,
      shadowRadius: 8,
      elevation: 4,
    },
    lg: {
      shadowColor: "#1e293b",
      shadowOffset: { width: 0, height: 6 },
      shadowOpacity: 0.1,
      shadowRadius: 12,
      elevation: 6,
    },
  },
}

export type Theme = typeof theme
