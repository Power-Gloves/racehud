import { build } from 'esbuild'
import { mkdtemp, writeFile, rm } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { spawnSync } from 'node:child_process'
const dir = await mkdtemp(join(tmpdir(), 'racehud-test-'))
try {
  const result = await build({ entryPoints: ['tests/regression.ts'], bundle: true, platform: 'node', format: 'cjs', write: false })
  const file = join(dir, 'regression.cjs')
  await writeFile(file, result.outputFiles[0].contents)
  process.exitCode = spawnSync(process.execPath, [file], { stdio: 'inherit' }).status ?? 1
} finally { await rm(dir, { recursive: true, force: true }) }
