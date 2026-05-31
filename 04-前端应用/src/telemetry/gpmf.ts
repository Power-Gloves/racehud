/**
 * GoPro GPMF 解析（KLV 嵌套结构）
 *
 * GPMF = Key-Length-Value 嵌套格式，每个节点：
 *   4 字节 FourCC + 1 字节 type + 1 字节 structSize + 2 字节 repeat + data(对齐到4字节)
 *   type === 0 表示 nested（容器，data 里还是 KLV）
 *
 * 关键流：
 *   GPS9  = [lat, lng, alt, speed2d, speed3d, days, secs, dop, fix]（HERO11+）
 *   GPS5  = [lat, lng, alt, speed2d, speed3d]（HERO10 及更早）
 *   ACCL  = 加速度 [x,y,z]
 *   SCAL  = 缩放因子（同 STRM 内的整数值要除以它）
 *   每个 STRM 内有独立的 SCAL
 *
 * 文档：https://github.com/gopro/gpmf-parser
 */

const TYPE_SIZE: Record<string, number> = {
  b: 1, B: 1, c: 1, d: 8, f: 4, F: 4, j: 8, J: 8, l: 4, L: 4, s: 2, S: 2,
}

function readVal(dv: DataView, p: number, t: string): number {
  switch (t) {
    case 'b': return dv.getInt8(p)
    case 'B': return dv.getUint8(p)
    case 's': return dv.getInt16(p)
    case 'S': return dv.getUint16(p)
    case 'l': return dv.getInt32(p)
    case 'L': return dv.getUint32(p)
    case 'f': return dv.getFloat32(p)
    case 'F': return dv.getUint32(p) // FourCC，当数字用
    case 'j': return Number(dv.getBigInt64(p))
    case 'J': return Number(dv.getBigUint64(p))
    case 'd': return dv.getFloat64(p)
    default: return NaN
  }
}

function asciiAt(buf: Uint8Array, off: number, len: number): string {
  let s = ''
  for (let i = 0; i < len; i++) s += String.fromCharCode(buf[off + i])
  return s
}

/** 一个 STRM 内提取到的某个流的样本（已应用 SCAL 缩放） */
export interface GpmfStream {
  fourcc: string
  /** 每条样本是一个数值数组（如 GPS9 一条 9 个值），已除以 SCAL */
  samples: number[][]
}

/** 解析单个 gpmd payload（一个视频样本对应的 GPMF 块），按 FourCC 收集指定流 */
export function parseGpmfPayload(
  buf: Uint8Array,
  wanted: Set<string>,
): Record<string, GpmfStream> {
  const dv = new DataView(buf.buffer, buf.byteOffset, buf.byteLength)
  const result: Record<string, GpmfStream> = {}

  // 递归遍历，维护当前 STRM 的 SCAL
  function walk(start: number, end: number, scalCtx: { scal: number[] | null }) {
    let p = start
    while (p < end - 8) {
      const fcc = asciiAt(buf, p, 4)
      if (!/^[\x20-\x7e!]{4}$/.test(fcc)) break
      const type = buf[p + 4]
      const structSize = buf[p + 5]
      const repeat = (buf[p + 6] << 8) | buf[p + 7]
      const dataLen = structSize * repeat
      const padded = Math.ceil(dataLen / 4) * 4
      const dstart = p + 8

      if (type === 0) {
        // nested：STRM 开启新的 SCAL 作用域
        const childCtx = fcc === 'STRM' ? { scal: null as number[] | null } : scalCtx
        walk(dstart, dstart + dataLen, childCtx)
        // STRM 内解析到的流已写入 result
      } else {
        const typeChar = String.fromCharCode(type)
        if (fcc === 'SCAL') {
          const ts = TYPE_SIZE[typeChar] || 1
          const scal: number[] = []
          for (let i = 0; i < repeat; i++) scal.push(readVal(dv, dstart + i * ts, typeChar))
          scalCtx.scal = scal
        } else if (wanted.has(fcc)) {
          // 提取该流，按 structSize 拆每条样本，每条样本里按类型读多个值
          const scal = scalCtx.scal
          const stream = result[fcc] ?? { fourcc: fcc, samples: [] }
          // GPS9/GPS5 是混合类型（用 TYPE 字段描述），但实际都是定长，
          // 这里用启发：structSize / 元素数 推每元素字节。简化：按 typeChar 统一拆。
          // GoPro GPS9 type='?'(混合)，需特殊处理；ACCL type='s' 统一。
          const elemType = typeChar
          if (elemType === '?' ) {
            // 混合类型：GPS9 = lllllllSS（7×int32 + 2×int16 = 32字节）
            for (let r = 0; r < repeat; r++) {
              const base = dstart + r * structSize
              const vals = readMixedGps(dv, base, structSize)
              stream.samples.push(scaleVals(vals, scal))
            }
          } else {
            const ts = TYPE_SIZE[elemType] || 1
            const elemCount = Math.floor(structSize / ts)
            for (let r = 0; r < repeat; r++) {
              const base = dstart + r * structSize
              const vals: number[] = []
              for (let c = 0; c < elemCount; c++) vals.push(readVal(dv, base + c * ts, elemType))
              stream.samples.push(scaleVals(vals, scal))
            }
          }
          result[fcc] = stream
        }
      }
      p += 8 + padded
    }
  }

  walk(0, buf.length, { scal: null })
  return result
}

/** GPS9 混合类型：lllllllSS（7 个 int32 + 2 个 int16） */
function readMixedGps(dv: DataView, base: number, structSize: number): number[] {
  // 标准 GPS9 = 32 字节：7×4 + 2×2
  if (structSize === 32) {
    const v: number[] = []
    let o = base
    for (let i = 0; i < 7; i++) { v.push(dv.getInt32(o)); o += 4 }
    for (let i = 0; i < 2; i++) { v.push(dv.getInt16(o)); o += 2 }
    return v
  }
  // 兜底：当全 int32
  const v: number[] = []
  const n = Math.floor(structSize / 4)
  for (let i = 0; i < n; i++) v.push(dv.getInt32(base + i * 4))
  return v
}

function scaleVals(vals: number[], scal: number[] | null): number[] {
  if (!scal || scal.length === 0) return vals
  return vals.map((v, i) => {
    const s = scal.length === 1 ? scal[0] : (scal[i] ?? scal[scal.length - 1])
    return s ? v / s : v
  })
}

/** 探测 buffer 里是否含某 FourCC（快速判断流是否存在） */
export function gpmfHasFourCC(buf: Uint8Array, fcc: string): boolean {
  const target = asciiToBytes(fcc)
  outer: for (let i = 0; i <= buf.length - 4; i++) {
    for (let j = 0; j < 4; j++) if (buf[i + j] !== target[j]) continue outer
    return true
  }
  return false
}

function asciiToBytes(s: string): number[] {
  return s.split('').map(c => c.charCodeAt(0))
}
