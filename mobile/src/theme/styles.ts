import { StyleSheet, Platform } from "react-native"
import { colors } from "./colors"

export const spacing = {
  xs: 4,
  sm: 8,
  md: 12,
  lg: 16,
  xl: 20,
  xxl: 24,
  xxxl: 32,
  huge: 40,
}

export const borderRadius = {
  sm: 8,
  md: 12,
  lg: 16,
  xl: 20,
  xxl: 24,
  round: 50,
}

export const fontSize = {
  xs: 12,
  sm: 14,
  md: 16,
  lg: 18,
  xl: 20,
  xxl: 24,
  xxxl: 28,
  huge: 32,
}

export const fontWeight = {
  normal: "400" as any,
  medium: "500" as any,
  semiBold: "600" as any,
  bold: "700" as any,
  extraBold: "800" as any,
}

export const shadows = {
  sm: {
    shadowColor: colors.shadow,
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.05,
    shadowRadius: 4,
    elevation: 2,
  },
  md: {
    shadowColor: colors.shadow,
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.08,
    shadowRadius: 8,
    elevation: 4,
  },
  lg: {
    shadowColor: colors.shadow,
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.1,
    shadowRadius: 12,
    elevation: 6,
  },
  xl: {
    shadowColor: colors.shadow,
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.12,
    shadowRadius: 16,
    elevation: 8,
  },
}

export const commonStyles = StyleSheet.create({
  // 容器样式
  container: {
    flex: 1,
    backgroundColor: colors.background,
  },
  
  // 卡片样式
  card: {
    backgroundColor: colors.surface,
    borderRadius: borderRadius.xl,
    padding: spacing.xl,
    ...shadows.md,
    borderWidth: 1,
    borderColor: colors.border.light,
  },
  
  cardLarge: {
    backgroundColor: colors.surface,
    borderRadius: borderRadius.xl,
    padding: spacing.xxl,
    ...shadows.lg,
    borderWidth: 1,
    borderColor: colors.border.light,
  },
  
  // 按钮样式
  button: {
    backgroundColor: colors.primary,
    borderRadius: borderRadius.lg,
    padding: spacing.lg,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: spacing.sm,
    ...shadows.md,
  },
  
  buttonText: {
    color: colors.text.inverse,
    fontSize: fontSize.lg,
    fontWeight: fontWeight.bold,
  },
  
  buttonSecondary: {
    backgroundColor: colors.gray[100],
    borderWidth: 1,
    borderColor: colors.border.default,
  },
  
  buttonSecondaryText: {
    color: colors.text.primary,
  },
  
  // 输入框样式
  input: {
    borderWidth: 2,
    borderColor: colors.border.default,
    borderRadius: borderRadius.lg,
    padding: spacing.lg,
    fontSize: fontSize.md,
    backgroundColor: colors.gray[50],
    color: colors.text.primary,
  },
  
  inputWrapper: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: colors.gray[50],
    borderRadius: borderRadius.lg,
    borderWidth: 2,
    borderColor: colors.border.default,
    paddingHorizontal: spacing.lg,
    ...shadows.sm,
  },
  
  // 文本样式
  title: {
    fontSize: fontSize.xxxl,
    fontWeight: fontWeight.extraBold,
    color: colors.text.primary,
  },
  
  subtitle: {
    fontSize: fontSize.lg,
    fontWeight: fontWeight.medium,
    color: colors.text.secondary,
  },
  
  body: {
    fontSize: fontSize.md,
    fontWeight: fontWeight.normal,
    color: colors.text.primary,
    lineHeight: 24,
  },
  
  caption: {
    fontSize: fontSize.sm,
    color: colors.text.tertiary,
  },
  
  // 标题栏样式
  header: {
    backgroundColor: colors.surface,
    borderBottomWidth: 1,
    borderBottomColor: colors.border.light,
    ...shadows.sm,
  },
  
  headerWithGradient: {
    paddingTop: 60,
    paddingBottom: spacing.xxl,
    paddingHorizontal: spacing.xxl,
    zIndex: 1,
  },
  
  // 列表样式
  listSeparator: {
    height: spacing.sm,
  },
  
  listContainer: {
    padding: spacing.xl,
    flexGrow: 1,
  },
  
  // 徽章样式
  badge: {
    backgroundColor: colors.primary,
    borderRadius: borderRadius.round,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.xs,
    alignSelf: "flex-start",
  },
  
  badgeText: {
    color: colors.text.inverse,
    fontSize: fontSize.xs,
    fontWeight: fontWeight.semiBold,
  },
  
  // 图标容器
  iconContainer: {
    borderRadius: borderRadius.round,
    justifyContent: "center",
    alignItems: "center",
  },
  
  // 分隔线
  divider: {
    height: 1,
    backgroundColor: colors.border.default,
  },
})

export type CommonStyles = typeof commonStyles
