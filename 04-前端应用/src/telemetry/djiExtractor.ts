/**
 * DJI 视频内嵌遥测提取器（前端，File.slice 按需读取）
 *
 * 适配机型：DJI Osmo Action 4（dvtm_ac203.proto）
 *   - moov 在文件尾部
 *   - djmd track（handler=meta, format=djmd）逐帧一条 protobuf
 *   - 字段路径（逆向所得）：
 *       root.f3.f1.f2  = 微秒时间戳
 *       root.f3.f2.f9  = 姿态四元数 [w,x,y,z]
 *       root.f3.f2.f10 = 加速度向量 [x,y,z]（单位 g）★对齐用
 *
 * 注意：字段编号是从 Action 4 样本逆向的，换机型可能不同。
 *      probe() 通过检测 djmd track + dvtm_ac203 字符串来确认机型适配。
 */
import {
  readBytes, parseTopLevelBoxes, parseTracks, type SampleTable,
} from './mp4'
import { parsePb, pbChild, pbFloats, pbVarint } from './protobuf'
import type { VideoTelemetry, VideoTelemetryExtractor, AccelSignal } from './types'

const DJI_PROTO_MARKER = 'dvtm_ac203' // Action 4 数据模型标记

export class DjiExtractor implements VideoTelemetryExtractor {
  async probe(file: File): Promise<boolean> {
    try {
      const boxes = await parseTopLevelBoxes(file)
      if (!boxes.some(b => b.type === 'moov')) return false
      // 读 moov 找 djmd track
      const moov = boxes.find(b => b.type === 'moov')!
      const moovBuf = await readBytes(file, moov.offset, Math.min(moov.size, 8 * 1024 * 1024))
      const tracks = parseTracks(moovBuf, moov.headerSize, moovBuf.length)
      const djmd = tracks.find(t => t.format === 'djmd')
      if (!djmd || djmd.offsets.length === 0) return false
      // 读第一个样本确认 proto 标记
      const first = await readBytes(file, djmd.offsets[0], djmd.sizes[0])
      const ascii = bytesToAscii(first)
      return ascii.includes(DJI_PROTO_MARKER)
    } catch {
      return false
    }
  }

  async extract(file: File, onProgress?: (r: number) => void): Promise<VideoTelemetry> {
    const boxes = await parseTopLevelBoxes(file)
    const moov = boxes.find(b => b.type === 'moov')
    if (!moov) throw new Error('DJI: 未找到 moov box')

    const moovBuf = await readBytes(file, moov.offset, moov.size)
    const tracks = parseTracks(moovBuf, moov.headerSize, moovBuf.length)
    const djmd = tracks.find(t => t.format === 'djmd')
    if (!djmd) throw new Error('DJI: 未找到 djmd 遥测 track')

    const { accel, model, count, durationSec } = await this.readAccel(file, djmd, onProgress)

    return {
      device: 'dji',
      model: model || 'DJI (Osmo Action)',
      accel,
      hasGps: false,           // Action 4 内嵌遥测无 GPS
      durationSec,
      sampleCount: count,
    }
  }

  /** 批量读 djmd 样本，提取加速度模长 + 时间戳 */
  private async readAccel(
    file: File,
    djmd: SampleTable,
    onProgress?: (r: number) => void,
  ): Promise<{ accel: AccelSignal; model: string; count: number; durationSec: number }> {
    const n = djmd.offsets.length
    const t: number[] = []
    const mag: number[] = []
    let model = ''

    // 为减少 I/O 次数：djmd 样本在文件里基本连续，按"连续区段"批量读
    // 简化策略：找到样本覆盖的 [minOff, maxOff+lastSize)，一次性读进来（通常 ~11MB）
    // djmd 样本逐帧穿插在 mdat 里，偏移散布整个文件（可达 GB 跨度）。
    // 用滑动窗口按需读：样本偏移基本单调递增，窗口缓存能大幅减少 slice 次数。
    const WIN = 8 * 1024 * 1024
    let winStart = -1
    let winBuf: Uint8Array = new Uint8Array(0)
    const getSample = async (o: number, len: number): Promise<Uint8Array> => {
      if (winStart < 0 || o < winStart || o + len > winStart + winBuf.length) {
        winStart = o
        winBuf = await readBytes(file, o, Math.max(WIN, len))
      }
      return winBuf.subarray(o - winStart, o - winStart + len)
    }

    let firstTs: number | null = null
    let lastTs = 0
    for (let i = 0; i < n; i++) {
      const sample = await getSample(djmd.offsets[i], djmd.sizes[i])
      if (sample.length < djmd.sizes[i]) continue
      const root = parsePb(sample, 0, sample.length)
      const f3 = pbChild(root, 3) ?? root
      const f2 = pbChild(f3, 2)
      const acc = pbFloats(pbChild(f2, 10))  // 机体加速度 [x,y,z]（含重力）
      const q = pbFloats(pbChild(f2, 9))     // 姿态四元数 [w,x,y,z]
      // 时间戳 root.f3.f1.f2
      const f1 = pbChild(f3, 1)
      const ts = pbVarint(f1, 2)

      if (acc.length >= 3 && q.length >= 4) {
        // 四元数把机体加速度旋转到世界系，去重力后取水平面运动加速度模长
        // （纯重力 + 姿态干扰会淹没运动特征，必须补偿）
        const horiz = bodyAccelToWorldHorizontal(acc, q)
        mag.push(horiz)
        if (ts != null) {
          if (firstTs === null) firstTs = ts
          lastTs = ts
          t.push((ts - firstTs) / 1e6) // 微秒 → 秒（相对起点）
        } else {
          t.push(mag.length / 60) // 兜底：按 60fps 估
        }
      }
      // 型号：从第一个含 schema 的样本里抓（样本 #0 较大）
      if (!model && djmd.sizes[i] > 200) {
        const ascii = bytesToAscii(sample)
        const m = ascii.match(/DJI [A-Za-z0-9 ]+/)
        if (m) model = m[0].trim()
      }
      if (onProgress && (i & 1023) === 0) onProgress(i / n)
    }
    onProgress?.(1)

    const durationSec = firstTs !== null ? (lastTs - firstTs) / 1e6 : mag.length / 60
    const rate = mag.length > 1 && durationSec > 0 ? (mag.length - 1) / durationSec : 59.94

    return {
      accel: { t, mag, rate, source: 'dji' },
      model,
      count: mag.length,
      durationSec,
    }
  }
}

function bytesToAscii(buf: Uint8Array): string {
  let s = ''
  for (let i = 0; i < buf.length; i++) {
    const c = buf[i]
    s += c >= 0x20 && c <= 0x7e ? String.fromCharCode(c) : ' '
  }
  return s
}

/**
 * 用姿态四元数把机体坐标系加速度旋转到世界坐标系，
 * 取水平面（xy）运动加速度模长。
 *
 * 原理：DJI f2.f10 是机体系加速度（含重力，且相机姿态随卡丁车颠簸/转向变化），
 *   直接取模长会被重力 + 姿态变化主导，淹没真实运动特征。
 *   旋转到世界系后，重力固定在 z 轴，水平面 xy 分量就是车辆真实运动加速度。
 *
 * @param acc 机体加速度 [ax, ay, az]
 * @param q   姿态四元数 [w, x, y, z]
 */
function bodyAccelToWorldHorizontal(acc: number[], q: number[]): number {
  const [w, x, y, z] = q
  const [ax, ay, az] = acc
  // v' = R(q) · v，R 为四元数旋转矩阵
  const wax = (1 - 2 * (y * y + z * z)) * ax + 2 * (x * y - w * z) * ay + 2 * (x * z + w * y) * az
  const way = 2 * (x * y + w * z) * ax + (1 - 2 * (x * x + z * z)) * ay + 2 * (y * z - w * x) * az
  // 水平面模长（已隐式去掉主要在 z 轴的重力）
  return Math.hypot(wax, way)
}
