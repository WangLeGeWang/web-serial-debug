import type { DisplayField, FieldStatus, ResolvedDisplayField } from './types'

const defaultTemplate = '{label}: {value} {unit}'

export function resolveDisplayField(field: DisplayField, latestData: Record<string, unknown>): ResolvedDisplayField {
  const rawValue = resolveRawValue(field, latestData)
  const value = formatValue(rawValue, field.precision)
  const text = applyTemplate(field, value, rawValue)
  const status = getFieldStatus(field, rawValue)

  return {
    id: field.id,
    label: field.label,
    rawValue,
    value,
    text,
    status
  }
}

export function resolveRawValue(field: DisplayField, latestData: Record<string, unknown>) {
  if (field.type === 'static') return field.text || ''
  if (field.type === 'mapping') {
    const raw = field.key ? latestData[field.key] : undefined
    return field.map?.[String(raw)] ?? raw ?? ''
  }
  if (field.type === 'expression') return evaluateExpression(field.expression || '', latestData)
  return field.key ? latestData[field.key] : undefined
}

export function formatValue(value: unknown, precision?: number) {
  if (value === undefined || value === null || value === '') return 'N/A'
  if (typeof value === 'number' && Number.isFinite(value)) {
    return typeof precision === 'number' ? value.toFixed(precision) : String(value)
  }
  return String(value)
}

export function applyTemplate(field: DisplayField, value: string, rawValue: unknown) {
  const template = field.template || defaultTemplate
  const unit = field.unit || ''
  const text = field.text || ''
  return template
    .replace(/\{label\}/g, field.label || '')
    .replace(/\{value\}/g, value)
    .replace(/\{unit\}/g, unit)
    .replace(/\{text\}/g, text)
    .replace(/\{raw\}/g, rawValue === undefined || rawValue === null ? '' : String(rawValue))
    .replace(/\s+$/g, '')
}

export function getFieldStatus(field: DisplayField, rawValue: unknown): FieldStatus {
  const threshold = field.threshold
  if (!threshold) return 'normal'

  const value = typeof rawValue === 'number' ? rawValue : Number(rawValue)
  if (!Number.isFinite(value)) return 'normal'

  if (threshold.mode === 'greater') {
    if (threshold.critical !== undefined && value >= threshold.critical) return 'critical'
    if (threshold.warning !== undefined && value >= threshold.warning) return 'warning'
  }

  if (threshold.mode === 'less') {
    if (threshold.critical !== undefined && value <= threshold.critical) return 'critical'
    if (threshold.warning !== undefined && value <= threshold.warning) return 'warning'
  }

  if (threshold.mode === 'range') {
    const outside = threshold.min !== undefined && value < threshold.min || threshold.max !== undefined && value > threshold.max
    return outside ? 'critical' : 'normal'
  }

  if (threshold.mode === 'equal') {
    return String(value) === String(threshold.equal) ? 'critical' : 'normal'
  }

  return 'normal'
}

export function evaluateExpression(expression: string, latestData: Record<string, unknown>) {
  const normalized = expression.trim()
  if (!normalized) return ''
  if (!/^[\w\s+\-*/().]+$/.test(normalized)) return 'ERR'

  const replaced = normalized.replace(/[A-Za-z_]\w*/g, (key) => {
    const value = latestData[key]
    if (typeof value === 'number' && Number.isFinite(value)) return String(value)
    if (typeof value === 'string' && value.trim() !== '' && Number.isFinite(Number(value))) return String(Number(value))
    return '0'
  })

  try {
    const result = Function(`"use strict"; return (${replaced})`)()
    return typeof result === 'number' && Number.isFinite(result) ? result : 'ERR'
  } catch {
    return 'ERR'
  }
}
