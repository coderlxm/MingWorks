export const WARN_RATIO = 0.8

const percentFormat = new Intl.NumberFormat('zh-CN', { style: 'percent', maximumFractionDigits: 0 })
const gbFormat = new Intl.NumberFormat('zh-CN', { maximumFractionDigits: 1 })
const loadFormat = new Intl.NumberFormat('zh-CN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })

export const formatPercent = (ratio: number) => percentFormat.format(ratio)
export const formatGb = (bytes: number) => `${gbFormat.format(bytes / 1024 ** 3)} GB`
export const formatLoad = (value: number) => loadFormat.format(value)
