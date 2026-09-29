import assert from 'node:assert/strict'
import { webcrypto } from 'node:crypto'
import { Output, Mp4OutputFormat, EncodedAudioPacketSource, EncodedPacket } from 'mediabunny'
import { createDiskOutput } from '../src/export/storage'

// 实际 MP4 复用器连接模拟磁盘：验证写入早于 finalize，取消不提交目标文件。
async function run() {
  Object.defineProperty(globalThis, 'navigator', { configurable: true, value: { storage: { getDirectory: async () => ({}) } } })
  if (!globalThis.crypto) Object.defineProperty(globalThis, 'crypto', { value: webcrypto })
  for (const scenario of ['success', 'cancel', 'failure']) {
    let bytes = 0, closed = false, aborted = false
    const handle = {
      createWritable: async () => ({
        write: async (chunk: { data: Uint8Array }) => {
          if (scenario === 'failure') throw new Error('模拟磁盘写入失败')
          bytes += chunk.data.byteLength
        },
        close: async () => { closed = true },
        abort: async () => { aborted = true },
      }),
      getFile: async () => new Blob(),
    } as unknown as FileSystemFileHandle
    const disk = await createDiskOutput(handle)
    const output = new Output({ format: new Mp4OutputFormat({ fastStart: false }), target: disk.target })
    const source = new EncodedAudioPacketSource('opus')
    output.addAudioTrack(source)
    let failed = false
    try {
      await output.start()
      // 合成包仅测试复用/存储背压，不测试解码；实拍解码另由浏览器验证。
      for (let i = 0; i < 2048; i++) {
        await source.add(new EncodedPacket(new Uint8Array(4096), 'key', i * .02, .02),
          i === 0 ? { decoderConfig: { codec: 'opus', sampleRate: 48000, numberOfChannels: 2 } } : undefined)
      }
      assert.ok(bytes > 4 * 1024 * 1024, '编码过程中应已分批写出，不能等结束才积累输出')
      assert.equal(closed, false, '未成功 finalize 之前不能提交文件')
      if (scenario === 'cancel') { await output.cancel(); await disk.remove(); assert.equal(closed, false); assert.equal(aborted, true) }
      else { await output.finalize(); await disk.finish(); assert.equal(closed, true); assert.ok(bytes > 0) }
    } catch (error) {
      failed = true
      await output.cancel().catch(() => {})
      await disk.remove()
      if (scenario !== 'failure') throw error
      assert.match((error as Error).message, /模拟磁盘/)
      assert.equal(closed, false)
      assert.equal(aborted, true)
    }
    assert.equal(failed, scenario === 'failure')
    console.log('通过：磁盘输出 ' + scenario)
  }
}
run().catch(error => { console.error(error); process.exitCode = 1 })
