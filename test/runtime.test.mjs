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
  const slots = {
    inject(name, register) {
      slotCalls.push(name)
      register()
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

  delete globalThis.window
})
