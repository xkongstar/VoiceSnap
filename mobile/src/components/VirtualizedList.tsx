import React, { memo, useMemo, useCallback, useRef, useEffect } from 'react'
import {
  FlatList,
  VirtualizedList,
  ScrollView,
  View,
  StyleSheet,
  Dimensions,
  ViewStyle,
  ListRenderItem,
  NativeSyntheticEvent,
  NativeScrollEvent
} from 'react-native'
import { useThrottle } from '../utils/performanceUtils'

// 简化的useMemoized实现
function useMemoized<T>(factory: () => T, deps: React.DependencyList): T {
  return React.useMemo(factory, deps)
}

interface VirtualizedListProps<T> {
  data: T[]
  renderItem: ListRenderItem<T>
  keyExtractor: (item: T, index: number) => string
  itemHeight?: number
  estimatedItemSize?: number
  windowSize?: number
  initialNumToRender?: number
  maxToRenderPerBatch?: number
  removeClippedSubviews?: boolean
  onEndReached?: () => void
  onEndReachedThreshold?: number
  ListHeaderComponent?: React.ComponentType<any> | React.ReactElement
  ListFooterComponent?: React.ComponentType<any> | React.ReactElement
  ListEmptyComponent?: React.ComponentType<any> | React.ReactElement
  style?: ViewStyle
  contentContainerStyle?: ViewStyle
}

/**
 * 高性能虚拟化列表组件
 */
export function VirtualizedTaskList<T>({
  data,
  renderItem,
  keyExtractor,
  itemHeight = 80,
  estimatedItemSize = 80,
  windowSize = 10,
  initialNumToRender = 10,
  maxToRenderPerBatch = 5,
  removeClippedSubviews = true,
  onEndReached,
  onEndReachedThreshold = 0.5,
  ListHeaderComponent,
  ListFooterComponent,
  ListEmptyComponent,
  style,
  contentContainerStyle
}: VirtualizedListProps<T>) {
  const scrollViewRef = useRef<FlatList>(null)

  // 使用节流的滚动事件处理
  const handleScroll = useThrottle(
    useCallback((event: NativeSyntheticEvent<NativeScrollEvent>) => {
      // 自定义滚动逻辑
    }, []),
    16 // 60fps
  )

  // 优化的渲染项目
  const optimizedRenderItem = useCallback<ListRenderItem<T>>(
    ({ item, index }) => {
      return (
        <View style={[styles.itemContainer, { minHeight: itemHeight }]}>
          {renderItem({ item, index, separators: {} as any })}
        </View>
      )
    },
    [renderItem, itemHeight]
  )

  // 获取项目布局
  const getItemLayout = useCallback(
    (data: ArrayLike<T> | null | undefined, index: number) => ({
      length: itemHeight,
      offset: itemHeight * index,
      index,
    }),
    [itemHeight]
  )

  return (
    <FlatList
      ref={scrollViewRef}
      data={data}
      renderItem={optimizedRenderItem}
      keyExtractor={keyExtractor}
      getItemLayout={getItemLayout}
      initialNumToRender={initialNumToRender}
      maxToRenderPerBatch={maxToRenderPerBatch}
      windowSize={windowSize}
      removeClippedSubviews={removeClippedSubviews}
      onEndReached={onEndReached}
      onEndReachedThreshold={onEndReachedThreshold}
      onScroll={handleScroll}
      scrollEventThrottle={16}
      ListHeaderComponent={ListHeaderComponent}
      ListFooterComponent={ListFooterComponent}
      ListEmptyComponent={ListEmptyComponent}
      style={style}
      contentContainerStyle={contentContainerStyle}
      // 性能优化选项
      legacyImplementation={false}
      disableVirtualization={false}
      maintainVisibleContentPosition={{
        minIndexForVisible: 0,
      }}
    />
  )
}

/**
 * 分页虚拟列表组件
 */
interface PaginatedVirtualListProps<T> extends Omit<VirtualizedListProps<T>, 'data'> {
  fetchData: (page: number, pageSize: number) => Promise<T[]>
  pageSize?: number
  hasMore?: boolean
  loading?: boolean
  LoadingComponent?: React.ComponentType<any>
  ErrorComponent?: React.ComponentType<{ error: any; retry: () => void }>
}

export function PaginatedVirtualList<T>({
  fetchData,
  pageSize = 20,
  hasMore = true,
  loading = false,
  LoadingComponent,
  ErrorComponent,
  ...listProps
}: PaginatedVirtualListProps<T>) {
  const [data, setData] = React.useState<T[]>([])
  const [currentPage, setCurrentPage] = React.useState(0)
  const [isLoading, setIsLoading] = React.useState(false)
  const [error, setError] = React.useState<any>(null)

  const loadMore = useCallback(async () => {
    if (isLoading || !hasMore) return

    try {
      setIsLoading(true)
      setError(null)
      
      const newData = await fetchData(currentPage + 1, pageSize)
      
      setData(prevData => [...prevData, ...newData])
      setCurrentPage(prev => prev + 1)
    } catch (err) {
      setError(err)
    } finally {
      setIsLoading(false)
    }
  }, [fetchData, currentPage, pageSize, hasMore, isLoading])

  const retry = useCallback(() => {
    setError(null)
    loadMore()
  }, [loadMore])

  const renderFooter = useCallback(() => {
    if (error && ErrorComponent) {
      return <ErrorComponent error={error} retry={retry} />
    }
    
    if (isLoading && LoadingComponent) {
      return <LoadingComponent />
    }
    
    return null
  }, [error, isLoading, ErrorComponent, LoadingComponent, retry])

  return (
    <VirtualizedTaskList
      {...listProps}
      data={data}
      onEndReached={loadMore}
      ListFooterComponent={renderFooter}
    />
  )
}

/**
 * 固定高度虚拟列表（最高性能）
 */
interface FixedHeightVirtualListProps<T> {
  data: T[]
  renderItem: (item: T, index: number) => React.ReactElement
  itemHeight: number
  containerHeight: number
  overscan?: number
  keyExtractor: (item: T, index: number) => string
}

export const FixedHeightVirtualList = memo(<T,>({
  data,
  renderItem,
  itemHeight,
  containerHeight,
  overscan = 5,
  keyExtractor
}: FixedHeightVirtualListProps<T>) => {
  const [scrollTop, setScrollTop] = React.useState(0)
  const scrollViewRef = useRef<ScrollView>(null)

  const visibleRange = useMemo(() => {
    const start = Math.floor(scrollTop / itemHeight)
    const end = Math.ceil((scrollTop + containerHeight) / itemHeight)
    
    return {
      start: Math.max(0, start - overscan),
      end: Math.min(data.length - 1, end + overscan)
    }
  }, [scrollTop, itemHeight, containerHeight, data.length, overscan])

  const visibleItems = useMemo(() => {
    const items = []
    for (let i = visibleRange.start; i <= visibleRange.end; i++) {
      if (data[i]) {
        items.push({
          item: data[i],
          index: i,
          key: keyExtractor(data[i], i)
        })
      }
    }
    return items
  }, [data, visibleRange, keyExtractor])

  const handleScroll = useThrottle(
    (event: NativeSyntheticEvent<NativeScrollEvent>) => {
      setScrollTop(event.nativeEvent.contentOffset.y)
    },
    16
  )

  const totalHeight = data.length * itemHeight

  return (
    <ScrollView
      ref={scrollViewRef}
      style={[styles.container, { height: containerHeight }]}
      onScroll={handleScroll}
      scrollEventThrottle={16}
      showsVerticalScrollIndicator={false}
    >
      <View style={{ height: totalHeight, position: 'relative' }}>
        {visibleItems.map(({ item, index, key }) => (
          <View
            key={key}
            style={[
              styles.virtualItem,
              {
                height: itemHeight,
                top: index * itemHeight,
              }
            ]}
          >
            {renderItem(item, index)}
          </View>
        ))}
      </View>
    </ScrollView>
  )
})

/**
 * 分组虚拟列表
 */
interface GroupedVirtualListProps<T> {
  sections: Array<{
    title: string
    data: T[]
  }>
  renderItem: ListRenderItem<T>
  renderSectionHeader: (info: { section: { title: string } }) => React.ReactElement
  keyExtractor: (item: T, index: number) => string
  sectionHeaderHeight?: number
  itemHeight?: number
}

export function GroupedVirtualList<T>({
  sections,
  renderItem,
  renderSectionHeader,
  keyExtractor,
  sectionHeaderHeight = 40,
  itemHeight = 80
}: GroupedVirtualListProps<T>) {
  // 将分组数据扁平化
  const flatData = useMemo(() => {
    const flattened: Array<{ type: 'header' | 'item'; data: any; sectionIndex: number; itemIndex?: number }> = []
    
    sections.forEach((section, sectionIndex) => {
      flattened.push({
        type: 'header',
        data: section,
        sectionIndex
      })
      
      section.data.forEach((item, itemIndex) => {
        flattened.push({
          type: 'item',
          data: item,
          sectionIndex,
          itemIndex
        })
      })
    })
    
    return flattened
  }, [sections])

  const renderFlatItem = useCallback<ListRenderItem<any>>(
    ({ item }) => {
      if (item.type === 'header') {
        return renderSectionHeader({ section: item.data })
      } else {
        return renderItem({ item: item.data, index: item.itemIndex!, separators: {} as any })
      }
    },
    [renderItem, renderSectionHeader]
  )

  const getFlatItemLayout = useCallback(
    (data: ArrayLike<any> | null | undefined, index: number) => {
      if (!data || index >= data.length) {
        return { length: itemHeight, offset: 0, index }
      }
      
      const item = (data as any)[index]
      const height = item?.type === 'header' ? sectionHeaderHeight : itemHeight
      
      let offset = 0
      for (let i = 0; i < index; i++) {
        const currentItem = (data as any)[i]
        offset += currentItem?.type === 'header' ? sectionHeaderHeight : itemHeight
      }
      
      return {
        length: height,
        offset,
        index
      }
    },
    [sectionHeaderHeight, itemHeight]
  )

  const flatKeyExtractor = useCallback(
    (item: any, index: number) => {
      if (item.type === 'header') {
        return `header_${item.sectionIndex}`
      } else {
        return `item_${item.sectionIndex}_${keyExtractor(item.data, item.itemIndex!)}`
      }
    },
    [keyExtractor]
  )

  return (
    <FlatList
      data={flatData}
      renderItem={renderFlatItem}
      keyExtractor={flatKeyExtractor}
      getItemLayout={getFlatItemLayout}
      removeClippedSubviews={true}
      maxToRenderPerBatch={10}
      windowSize={10}
    />
  )
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  itemContainer: {
    overflow: 'hidden',
  },
  virtualItem: {
    position: 'absolute',
    left: 0,
    right: 0,
  },
})