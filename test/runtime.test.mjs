import assert from 'node:assert/strict'
import { test } from 'node:test'
import { createRequire } from 'node:module'

const require = createRequire(import.meta.url)

test('host half: apply registers the show_chart tool and it executes', async () => {
  const plugin = await import('../lib/index.js')
  assert.equal(plugin.name, 'chart')
  assert.deepEqual([...plugin.inject], ['tools'])

  let registered = null
  let disposed = null
  plugin.apply({
    effect(fn) {
      disposed = fn()
    },
    tools: {
      register(definition) {
        registered = definition
        return () => {}
      },
    },
  })
  assert.ok(registered !== null, 'tools.register not called')
  assert.equal(registered.name, 'show_chart')

  const valid = { type: 'pie', title: 'T', labels: ['a', 'b', 'c'], values: [1, 2, 3] }
  const value = await registered.execute(valid, {})
  assert.deepEqual(value, { type: 'pie', title: 'T', labels: ['a', 'b', 'c'], values: [1, 2, 3] })
  assert.equal(typeof disposed, 'function')

  await assert.rejects(
    registered.execute({ type: 'pie', labels: ['a'], values: [1, 2] }, {}),
    /invalid chart spec: labels has 1 entries but values has 2/,
  )

  const content = registered.output.render(valid, value)
  assert.equal(content[0].type, 'text')
  assert.match(content[0].text, /Chart displayed: pie "T" — 3 slices/)

  const view = registered.presentCall(valid)
  assert.deepEqual(view, { card: 'generic', title: 'Chart: T' })

  // Optional text accepts null (schema + normalisation) and blank falls back.
  const nullable = { type: 'pie', title: null, seriesName: null, labels: ['a'], values: [1] }
  assert.deepEqual(await registered.execute(nullable, {}), { type: 'pie', labels: ['a'], values: [1] })
  assert.deepEqual(registered.presentCall(nullable), { card: 'generic', title: 'Chart: pie' })
  assert.deepEqual(registered.presentCall({ ...nullable, title: '  ' }), { card: 'generic', title: 'Chart: pie' })
  assert.equal(Array.from(registered.presentCall({ ...nullable, title: 'x'.repeat(300) }).title).length, 'Chart: '.length + 80)

  // The confirmation counts drawn slices and says what was left out.
  const many = { type: 'pie', labels: 'abcdefghijkl'.split(''), values: [5, 1, 9, 2, 8, 3, 7, 0.5, 6, 4, 10, 0] }
  assert.equal(
    registered.output.render(many, await registered.execute(many, {}))[0].text,
    'Chart displayed: pie — 8 slices (the 4 smallest folded into "Other (4)"; 1 non-positive value not drawn).',
  )
  const empty = { type: 'pie', labels: ['a', 'b'], values: [0, -2] }
  assert.equal(
    registered.output.render(empty, await registered.execute(empty, {}))[0].text,
    'Chart displayed: pie — nothing drawn: a pie needs positive values (2 non-positive values not drawn).',
  )

  assert.equal(registered.isConcurrencySafe(valid), true)
  assert.equal(registered.parameters.type, 'object')
})

test('client half: bundle self-registers under the package id and injects the toolview', async () => {
  const loaded = []
  globalThis.window = { __ModuleLoader__: { load: (row) => loaded.push(row) } }

  const primitives = {
    DisclosureRow: () => null,
    IconDataOutlineRegular: () => null,
  }
  const table = {
    react: require('react'),
    'react/jsx-runtime': require('react/jsx-runtime'),
    'react-dom': require('react-dom'),
    'react-dom/client': require('react-dom/client'),
    '@deepseek-ai/cordis': require('@deepseek-ai/cordis'),
    '@deepseek-ai/dsh-client-ui-primitives': primitives,
  }
  const client = (() => {
    require('../lib/client.js') // executes: self-registers into the fake window
    const resolve = (name) => {
      if (name in table) return table[name]
      throw new Error(`module not found: ${name}`)
    }
    return loaded[0].factory(resolve)
  })()

  assert.equal(loaded.length, 1)
  assert.equal(loaded[0].id, 'dsh-chart')
  assert.deepEqual([...client.inject], ['slots', 'locale'])

  const slotCalls = []
  const localeCalls = []
  const registeredComponents = []
  const injectEffects = []
  const slots = {
    inject(name, register) {
      slotCalls.push(name)
      injectEffects.push(register())
      return () => {}
    },
    register(entry, component) {
      slotCalls.push(entry)
      registeredComponents.push(component)
      return () => {}
    },
  }
  const locale = {
    register(ns, dict) {
      localeCalls.push([ns, dict])
      return () => {}
    },
  }
  client.apply({ get: (name) => (name === 'slots' ? slots : name === 'locale' ? locale : undefined), effect: (fn) => fn() })

  assert.deepEqual(localeCalls[0][0], 'dsh-chart')
  assert.equal(localeCalls[0][1].en['row.title'], 'Chart')
  const toolviewEntry = slotCalls.find((call) => typeof call === 'object' && call.name === 'tool.call.toolview')
  assert.deepEqual(toolviewEntry, { name: 'tool.call.toolview', key: 'show_chart', locale: 'dsh-chart' })
  const tailEntry = slotCalls.find((call) => typeof call === 'object' && call.name === 'conversation.chat.turnTail')
  assert.deepEqual(tailEntry, { name: 'conversation.chat.turnTail', id: 'dsh-chart-turn', order: 1, locale: 'dsh-chart' })
  assert.equal(registeredComponents.length, 2)
  assert.equal(typeof registeredComponents[0], 'function', 'ChartRow component registered')
  assert.equal(typeof registeredComponents[1], 'function', 'ChartTail component registered')
  // SlotInjectionEffect contract: each inject callback returns its registration disposer.
  assert.deepEqual(injectEffects.map((effect) => typeof effect), ['function', 'function'])

  // ChartTail: subscribes to the Turn's tool-call source only, renders root and
  // PTC sub-call charts in call order, and skips failed or malformed calls.
  const { renderToStaticMarkup } = require('react-dom/server')
  const { createElement } = require('react')
  const ChartTail = registeredComponents[1]
  const chart = (title) => JSON.stringify({ type: 'pie', title, labels: ['1/3', '1/6', '1/6', '1/3'], values: [2, 1, 1, 2] })
  const calls = [
    { root: { kind: 'tool-result', call: { name: 'show_chart', argsRaw: chart('Root chart') }, isError: false, subCalls: [] } },
    { root: { kind: 'tool-result', call: { name: 'show_chart', argsRaw: chart('Failed chart') }, isError: true, subCalls: [] } },
    { root: { phase: 'start', name: 'show_chart', argsRaw: '{"type":"pie"', subCalls: [] } },
    {
      root: {
        kind: 'tool-result',
        call: { name: 'run_code', argsRaw: '{}' },
        isError: false,
        subCalls: [{ kind: 'tool-result', call: { name: 'show_chart', argsRaw: chart('Nested chart') }, isError: false, subCalls: [] }],
      },
    },
  ]
  const requested = []
  const source = { getSnapshot: () => calls, subscribe: () => () => {} }
  const snapshot = { nodes: { turnDataSource: (turn, kind) => { requested.push([turn, kind]); return source } } }
  const html = renderToStaticMarkup(createElement(ChartTail, {
    turn: { turn: 7 },
    seq: 0,
    openFile: () => {},
    useChat: (select) => select(snapshot),
    t: (key) => key,
  }))
  assert.deepEqual(requested, [[7, 'tool-call']])
  assert.ok(html.indexOf('Root chart') !== -1 && html.indexOf('Nested chart') > html.indexOf('Root chart'), html)
  assert.ok(!html.includes('Failed chart'), 'failed calls stay in their tool row')
  assert.equal(html.match(/row\.data/g)?.length, 2)

  // A many-slice pie draws at most 8 slices (Other last) in an HTML legend;
  // long titles and legend labels are ellipsized with the full text as title.
  const longTitle = 'T'.repeat(200)
  const longLabel = 'L'.repeat(60)
  const many = JSON.stringify({ type: 'pie', title: longTitle, labels: [longLabel, ...'bcdefghijkl'.split('')], values: [50, 1, 9, 2, 8, 3, 7, 0.5, 6, 4, 10, 1] })
  const manyCalls = [{ root: { kind: 'tool-result', call: { name: 'show_chart', argsRaw: many }, isError: false, subCalls: [] } }]
  const manySource = { getSnapshot: () => manyCalls, subscribe: () => () => {} }
  const manyHtml = renderToStaticMarkup(createElement(ChartTail, {
    turn: { turn: 1 },
    seq: 0,
    openFile: () => {},
    useChat: (select) => select({ nodes: { turnDataSource: () => manySource } }),
    t: (key, params) => (key === 'row.other' ? `Other (${params.count})` : key),
  }))
  assert.equal(manyHtml.match(/<li /g)?.length, 8)
  assert.ok(manyHtml.includes('Other (5)'), manyHtml)
  assert.ok(manyHtml.includes(`title="${longTitle}">${'T'.repeat(119)}…</div>`), 'title capped at 120 with full text in title attr')
  assert.ok(manyHtml.includes(`title="${longLabel}">`) && manyHtml.includes(`${'L'.repeat(31)}…</li>`), 'legend label capped at 32')

  // The tool row summary counts drawn slices too.
  const ChartRow = registeredComponents[0]
  const rowProps = (argsRaw) => ({
    useDisclosure: () => ({ expanded: false, setExpanded: () => {}, toggle: () => {} }),
    callId: 'c',
    toolName: 'show_chart',
    block: { kind: 'tool-result', call: { name: 'show_chart', argsRaw }, content: [], isError: false },
    t: (key, params) => `${key}:${params?.count ?? ''}`,
  })
  const rowSummary = (argsRaw) => {
    let collapsed
    primitives.DisclosureRow = (props) => { collapsed = props.collapsedContent; return null }
    renderToStaticMarkup(createElement(ChartRow, rowProps(argsRaw)))
    return renderToStaticMarkup(collapsed)
  }
  assert.match(rowSummary(many), />row\.slices:8</)
  assert.match(rowSummary(JSON.stringify({ type: 'pie', labels: ['a', 'b', 'c'], values: [1, 0, -1] })), />row\.slices:1</)
  assert.match(rowSummary(JSON.stringify({ type: 'pie', labels: ['a'], values: [0] })), />row\.empty:</)

  delete globalThis.window
})
