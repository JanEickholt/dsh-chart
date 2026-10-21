/**
 * Build for both halves of the plugin. The host half is a plain ESM library;
 * the browser half replicates the deepseek-harness client-bundle contract:
 * a closure-factory CJS artifact that hands itself to
 * window.__ModuleLoader__.load({ id, factory }) and resolves the platform
 * modules through the injected require. Anything outside the platform list is
 * inlined — a require the frozen module table cannot answer is a runtime throw.
 */
import { defineConfig } from 'tsdown'

/** The shell-seeded module specifiers (dsh-web-frontend platform seeds). */
const CLIENT_EXTERNALS: readonly string[] = [
  'react',
  'react/jsx-runtime',
  'react-dom',
  'react-dom/client',
  '@deepseek-ai/cordis',
  '@deepseek-ai/dsh-client-store',
  '@deepseek-ai/dsh-client-ui-slots',
  '@deepseek-ai/dsh-client-ui-primitives',
]

/**
 * The client bundle must self-register under the SAME name the host package is
 * mounted as; the browser loader rejects any other id. Enforced by
 * scripts/check-client-id.mjs.
 */
const PACKAGE_ID = 'dsh-chart'

export default defineConfig([
  {
    name: PACKAGE_ID,
    entry: { index: 'src/index.ts', 'chart-spec': 'src/chart-spec.ts' },
    outDir: 'lib',
    format: ['esm'],
    platform: 'node',
    target: 'es2024',
    fixedExtension: false,
    dts: false,
    sourcemap: true,
    clean: true,
    external: [/^@deepseek-ai\//],
  },
  {
    name: `${PACKAGE_ID}/client`,
    entry: { client: 'src/client/index.ts' },
    outDir: 'lib',
    format: 'cjs',
    platform: 'browser',
    dts: false,
    sourcemap: true,
    clean: false,
    // recharts inlines into this bundle; minify keeps the eager page-load cost sane.
    minify: true,
    external: [...CLIENT_EXTERNALS],
    define: {
      'process.env.NODE_ENV': JSON.stringify(process.env.NODE_ENV ?? 'production'),
      'import.meta.env.MODE': JSON.stringify(process.env.NODE_ENV ?? 'production'),
      'import.meta.env': JSON.stringify({ MODE: process.env.NODE_ENV ?? 'production' }),
    },
    noExternal: (id: string) => (CLIENT_EXTERNALS.includes(id) ? undefined : true),
    outputOptions: {
      entryFileNames: 'client.js',
      banner: `window.__ModuleLoader__.load({ id: ${JSON.stringify(PACKAGE_ID)}, factory: (require) => {`,
      footer: 'return module.exports; } });',
      intro: 'var module = { exports: {} }; var exports = module.exports;',
    },
  },
])
