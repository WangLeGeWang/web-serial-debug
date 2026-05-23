import type { EChartsOption } from './echartsCore'

export interface ChartTheme {
  background: string
  panelBackground: string
  text: string
  mutedText: string
  axis: string
  grid: string
  tooltipBackground: string
  tooltipBorder: string
  splitArea: string
  colors: string[]
}

export const grafanaDarkTheme: ChartTheme = {
  background: '#111217',
  panelBackground: '#181b1f',
  text: '#d8d9da',
  mutedText: '#8a9099',
  axis: 'rgba(204, 204, 220, 0.28)',
  grid: 'rgba(204, 204, 220, 0.12)',
  tooltipBackground: 'rgba(24, 27, 31, 0.96)',
  tooltipBorder: 'rgba(204, 204, 220, 0.18)',
  splitArea: 'rgba(204, 204, 220, 0.03)',
  colors: ['#7eb26d', '#eab839', '#6ed0e0', '#ef843c', '#e24d42', '#1f78c1', '#ba43a9', '#705da0', '#508642', '#cca300']
}

export const grafanaLightTheme: ChartTheme = {
  background: '#ffffff',
  panelBackground: '#ffffff',
  text: '#1f2933',
  mutedText: '#6b7280',
  axis: 'rgba(31, 41, 55, 0.22)',
  grid: 'rgba(31, 41, 55, 0.10)',
  tooltipBackground: 'rgba(255, 255, 255, 0.98)',
  tooltipBorder: 'rgba(31, 41, 55, 0.16)',
  splitArea: 'rgba(31, 41, 55, 0.025)',
  colors: ['#37872d', '#d68f00', '#0a92a5', '#c15c17', '#c4162a', '#1f60c4', '#8f3bb8', '#5a4c9a', '#3b7c2d', '#a67c00']
}

export const getTheme = (isDark: boolean) => isDark ? grafanaDarkTheme : grafanaLightTheme

export const createBaseOption = (theme: ChartTheme): EChartsOption => ({
  backgroundColor: theme.background,
  color: theme.colors,
  animation: false,
  grid: {
    top: 24,
    right: 20,
    bottom: 66,
    left: 54,
    containLabel: false
  },
  legend: {
    type: 'scroll',
    bottom: 28,
    left: 8,
    right: 8,
    icon: 'circle',
    itemWidth: 8,
    itemHeight: 8,
    itemGap: 16,
    textStyle: {
      color: theme.mutedText,
      fontSize: 11
    },
    pageIconColor: theme.text,
    pageIconInactiveColor: theme.axis,
    pageTextStyle: {
      color: theme.mutedText
    }
  },
  tooltip: {
    trigger: 'axis',
    confine: true,
    appendToBody: true,
    backgroundColor: theme.tooltipBackground,
    borderColor: theme.tooltipBorder,
    borderWidth: 1,
    padding: [8, 10],
    textStyle: {
      color: theme.text,
      fontSize: 12
    },
    axisPointer: {
      type: 'cross',
      lineStyle: {
        color: theme.axis,
        width: 1,
        type: 'dashed'
      },
      crossStyle: {
        color: theme.axis,
        width: 1,
        type: 'dashed'
      }
    }
  },
  toolbox: {
    top: 0,
    right: 8,
    itemSize: 13,
    iconStyle: {
      borderColor: theme.mutedText
    },
    emphasis: {
      iconStyle: {
        borderColor: theme.text
      }
    },
    feature: {
      dataZoom: {
        yAxisIndex: 'none',
        title: {
          zoom: '区域缩放',
          back: '还原缩放'
        }
      },
      restore: {
        title: '重置'
      },
      saveAsImage: {
        title: '保存图片',
        backgroundColor: theme.background
      }
    }
  },
  dataZoom: [
    {
      type: 'inside',
      xAxisIndex: 0,
      filterMode: 'none',
      throttle: 80
    },
    {
      type: 'slider',
      xAxisIndex: 0,
      height: 18,
      bottom: 4,
      borderColor: theme.tooltipBorder,
      fillerColor: 'rgba(110, 159, 255, 0.18)',
      handleStyle: {
        color: theme.text,
        borderColor: theme.tooltipBorder
      },
      moveHandleStyle: {
        color: theme.axis
      },
      textStyle: {
        color: theme.mutedText,
        fontSize: 10
      },
      dataBackground: {
        lineStyle: {
          color: theme.axis
        },
        areaStyle: {
          color: theme.splitArea
        }
      }
    }
  ]
})
