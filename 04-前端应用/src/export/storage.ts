import { StreamTarget } from 'mediabunny'

/** 输出到浏览器私有磁盘，不在 JS 堆内累积完整视频。 */
export async function createDiskOutput(destination?: FileSystemFileHandle) {
  if (!navigator.storage?.getDirectory) throw new Error('当前浏览器不支持磁盘流式导出，请使用新版 Chrome 或 Edge')
  const root = await navigator.storage.getDirectory()
  const name = `racehud-export-${crypto.randomUUID()}.mp4`
  const handle = destination ?? await root.getFileHandle(name, { create: true })
  let writable: FileSystemWritableFileStream
  try { writable = await handle.createWritable() }
  catch (error) { if (!destination) await root.removeEntry(name).catch(() => {}); throw error }
  let closed = false
  const target = new StreamTarget(new WritableStream({
    async write(chunk) { await writable.write(chunk) },
    // 成功才提交目标文件；取消时保留原文件内容。
    async close() {},
    async abort() { if (!closed) { await writable.abort(); closed = true } },
  }), { chunked: true, chunkSize: 2 * 1024 * 1024 })
  async function remove() {
    if (!closed) { await writable.abort().catch(() => {}); closed = true }
    if (!destination) await root.removeEntry(name).catch(() => {})
  }
  return { target, remove, async finish() {
    await writable.close(); closed = true
    const file = await handle.getFile()
    if (!destination) cleanups.set(file, remove)
    return file
  } }
}

const cleanups = new WeakMap<Blob, () => Promise<void>>()
/** 下载已交给浏览器后释放临时文件；直接调用导出引擎的调用者也可显式释放。 */
export async function releaseExport(blob: Blob) {
  const cleanup = cleanups.get(blob)
  if (cleanup) { cleanups.delete(blob); await cleanup() }
}
