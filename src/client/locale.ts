/**
 * Locale dictionary for the dsh-chart client, bound to the show_chart
 * toolview row. Interpolation is single-brace `{name}` (framework contract:
 * template.replace(/\{(\w+)\}/g, ...)).
 *
 * @module dsh-chart/client/locale
 */

export const LOCALE_NS = 'dsh-chart'

export const localeDict = {
  en: {
    'row.title': 'Chart',
    'row.preparing': 'Preparing chart…',
    'row.summary': '{type} · {count} points',
    'row.slices': '{count} slices',
    'row.invalid': 'Chart data for this call is unavailable or malformed.',
    'row.error': 'Chart call failed.',
    'row.empty': 'No positive values to chart.',
    'row.data': 'Show data',
    'row.label': 'Label',
    'row.value': 'Value',
  },
  zh: {
    'row.title': '图表',
    'row.preparing': '正在准备图表…',
    'row.summary': '{type} · {count} 个数据点',
    'row.slices': '{count} 个扇区',
    'row.invalid': '此调用的图表数据不可用或格式错误。',
    'row.error': '图表调用失败。',
    'row.empty': '没有可用于绘制的正值。',
    'row.data': '显示数据',
    'row.label': '标签',
    'row.value': '数值',
  },
} as const

export type ChartLocaleKey = keyof typeof localeDict.en
