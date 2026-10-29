import assert from 'node:assert/strict'
import { test } from 'node:test'
import { buildChartSpec, CHART_TYPES, checkChartSpec, formatTick, formatValue, MAX_POINTS, parseChartSpec, SERIES_COLORS, sliceColor } from '../lib/chart-spec.js'

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

test('checkChartSpec names the violated constraint', () => {
  assert.deepEqual(checkChartSpec({ type: 'bar', labels: ['a', 'b', 'c'], values: [1, 2] }), {
    error: 'labels has 3 entries but values has 2; they must align by index',
  })
  assert.match(checkChartSpec({ type: 'scatter', labels: ['a'], values: [1] }).error, /type must be one of pie \| bar \| line/)
  assert.match(checkChartSpec({ type: 'bar', labels: ['a', 'b'], values: [1, Number.NaN] }).error, /values\[1\] must be a finite number/)
  assert.match(checkChartSpec({ type: 'bar', labels: ['a', 2], values: [1, 2] }).error, /labels\[1\] must be a string/)
  const labels = Array.from({ length: MAX_POINTS + 1 }, (_, i) => String(i))
  assert.match(checkChartSpec({ type: 'line', labels, values: labels.map(Number) }).error, /exceed the limit of 100/)
  assert.deepEqual(checkChartSpec({ type: 'pie', labels: ['a'], values: [1] }), { spec: { type: 'pie', labels: ['a'], values: [1] } })
})

test('formatValue keeps small magnitudes significant', () => {
  // Real call: "Cache hit (warmed)" 0.014 rendered as 0.01 before the fix.
  assert.equal(formatValue(0.014), '0.014')
  assert.equal(formatValue(0.004), '0.004')
  assert.equal(formatValue(-0.123456), '-0.123')
  assert.equal(formatValue(0), '0')
  assert.equal(formatValue(-6.91), '-6.91')
  assert.equal(formatValue(33.333333), '33.33')
  assert.equal(formatValue(1234567), '1234567')
})

test('formatTick compacts large magnitudes for the narrow axis', () => {
  assert.equal(formatTick(950), '950')
  assert.equal(formatTick(12500), '12.5K')
  assert.equal(formatTick(-3000000), '-3M')
  assert.equal(formatTick(0.035), '0.035')
})

test('sliceColor never gives touching slices one color, including the ring closure', () => {
  // Real call "Thirds and sixths" (4 slices): slices 4 and 1 touch; the old
  // palette gave them blue-500 and deepseek-500 (ΔE 3.6).
  const clashesWithFirst = new Set([SERIES_COLORS[0], SERIES_COLORS[6]])
  for (let count = 2; count <= 40; count++) {
    const colors = Array.from({ length: count }, (_, index) => sliceColor(index, count))
    for (let index = 0; index < count; index++) {
      const next = (index + 1) % count
      assert.notEqual(colors[index], colors[next], `count ${count}: slices ${index} and ${next} share ${colors[index]}`)
    }
    assert.ok(!clashesWithFirst.has(colors[count - 1]), `count ${count}: last slice ${colors[count - 1]} clashes with the first`)
  }
  assert.equal(sliceColor(0, 1), SERIES_COLORS[0])
  assert.deepEqual(Array.from({ length: 4 }, (_, index) => sliceColor(index, 4)), SERIES_COLORS.slice(0, 4))
})
