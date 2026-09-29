import { build } from 'esbuild'
import { mkdtemp, writeFile, rm } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { spawnSync } from 'node:child_process'
const dir = await mkdtemp(join(tmpdir(), 'racehud-test-'))
try {
  for (const entry of ['tests/regression.ts', 'tests/storage-regression.ts']) {
  const result = await build({ entryPoints: [entry], bundle: true, platform: 'node', format: 'cjs', write: false })
  const file = join(dir, 'regression.cjs')
  await writeFile(file, result.outputFiles[0].contents)
  const status = spawnSync(process.execPath, [file], { stdio: 'inherit' }).status ?? 1
  if (status) process.exitCode = status
  }
} finally { await rm(dir, { recursive: true, force: true }) }
