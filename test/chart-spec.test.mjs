import assert from 'node:assert/strict'
import { test } from 'node:test'
import { buildChartSpec, CHART_TYPES, MAX_POINTS, parseChartSpec } from '../lib/chart-spec.js'

test('valid spec round-trips through parse', () => {
  const spec = parseChartSpec({ type: 'pie', title: 'Share', labels: ['a', 'b'], values: [1, 2], seriesName: 'x' })
  assert.deepEqual(spec, { type: 'pie', title: 'Share', labels: ['a', 'b'], values: [1, 2], seriesName: 'x' })
})

test('optionals may be absent', () => {
  const spec = parseChartSpec({ type: 'line', labels: ['a'], values: [3] })
  assert.deepEqual(spec, { type: 'line', labels: ['a'], values: [3] })
})

test('unknown type rejected', () => {
  assert.equal(parseChartSpec({ type: 'scatter', labels: ['a'], values: [1] }), null)
})

test('label/value length mismatch rejected', () => {
  assert.equal(parseChartSpec({ type: 'bar', labels: ['a', 'b'], values: [1] }), null)
})

test('empty arrays rejected', () => {
  assert.equal(parseChartSpec({ type: 'bar', labels: [], values: [] }), null)
})

test('over MAX_POINTS rejected', () => {
  const labels = Array.from({ length: MAX_POINTS + 1 }, (_, i) => String(i))
  assert.equal(parseChartSpec({ type: 'line', labels, values: labels.map(Number) }), null)
  const ok = labels.slice(0, MAX_POINTS)
  assert.notEqual(parseChartSpec({ type: 'line', labels: ok, values: ok.map(Number) }), null)
})

test('non-finite and non-numeric values rejected', () => {
  assert.equal(parseChartSpec({ type: 'bar', labels: ['a'], values: [Number.POSITIVE_INFINITY] }), null)
  assert.equal(parseChartSpec({ type: 'bar', labels: ['a'], values: ['1'] }), null)
})

test('non-string label rejected', () => {
  assert.equal(parseChartSpec({ type: 'bar', labels: [1], values: [1] }), null)
})

test('non-object payload rejected', () => {
  assert.equal(parseChartSpec(null), null)
  assert.equal(parseChartSpec('chart'), null)
  assert.equal(parseChartSpec([]), null)
})

test('buildChartSpec copies arrays and omits unset optionals', () => {
  const labels = ['a']
  const values = [1]
  const spec = buildChartSpec({ type: 'bar', labels, values })
  assert.deepEqual(spec, { type: 'bar', labels: ['a'], values: [1] })
  labels[0] = 'mutated'
  values[0] = 99
  assert.equal(spec.labels[0], 'a')
  assert.equal(spec.values[0], 1)
})

test('CHART_TYPES covers pie, bar, line', () => {
  assert.deepEqual([...CHART_TYPES], ['pie', 'bar', 'line'])
})
