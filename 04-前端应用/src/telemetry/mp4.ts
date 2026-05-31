/**
 * 轻量 MP4 box 解析 —— 浏览器端，用 File.slice 按需读取，绝不整文件加载
 *
 * 用途：定位 moov / trak / stbl / stsz / co64，从而读出某个 metadata track 的样本，
 * 而完全不碰 mdat（视频流，可能 GB 级）。
 */

/** 读取 File 的 [offset, offset+len) 字节 */
export async function readBytes(file: File, offset: number, len: number): Promise<Uint8Array> {
  const end = Math.min(file.size, offset + len)
  if (offset >= end) return new Uint8Array(0)
  const buf = await file.slice(offset, end).arrayBuffer()
  return new Uint8Array(buf)
}

export interface Box {
  type: string
  /** box 在文件/父buffer 中的起始偏移 */
  offset: number
  /** box 总大小（含 header） */
  size: number
  /** header 大小（8 或 16） */
  headerSize: number
}

/** 在一段 buffer 内顺序解析同级 box */
export function parseBoxesInBuffer(buf: Uint8Array, start: number, end: number): Box[] {
  const dv = new DataView(buf.buffer, buf.byteOffset)
  const boxes: Box[] = []
  let off = start
  while (off < end - 8) {
    let size = dv.getUint32(off)
    const type = asciiAt(buf, off + 4, 4)
    let headerSize = 8
    if (size === 1) {
      // 64-bit largesize
      const hi = dv.getUint32(off + 8)
      const lo = dv.getUint32(off + 12)
      size = hi * 2 ** 32 + lo
      headerSize = 16
    }
    if (!isPrintableType(type) || size <= 0 || off + size > end + 1) break
    boxes.push({ type, offset: off, size, headerSize })
    off += size
  }
  return boxes
}

/** 顶层 box：直接对 File 顺序读每个 box header（不读 body），跳过巨大的 mdat */
export async function parseTopLevelBoxes(file: File): Promise<Box[]> {
  const boxes: Box[] = []
  let off = 0
  while (off < file.size - 8) {
    const head = await readBytes(file, off, 16)
    if (head.length < 8) break
    const dv = new DataView(head.buffer, head.byteOffset)
    let size = dv.getUint32(0)
    const type = asciiAt(head, 4, 4)
    let headerSize = 8
    if (size === 1) {
      const hi = dv.getUint32(8)
      const lo = dv.getUint32(12)
      size = hi * 2 ** 32 + lo
      headerSize = 16
    }
    if (!isPrintableType(type) || size <= 0) break
    boxes.push({ type, offset: off, size, headerSize })
    off += size
  }
  return boxes
}

/** 在 buffer 内递归找第一个匹配 type 的 box */
export function findBox(buf: Uint8Array, start: number, end: number, type: string): Box | null {
  return parseBoxesInBuffer(buf, start, end).find(b => b.type === type) ?? null
}

export function findBoxes(buf: Uint8Array, start: number, end: number, type: string): Box[] {
  return parseBoxesInBuffer(buf, start, end).filter(b => b.type === type)
}

/** 一个 metadata track 的样本表（位置 + 大小） */
export interface SampleTable {
  format: string        // stsd 里的 4cc（djmd / dbgi / gpmd ...）
  handler: string       // hdlr 的 handler type（meta ...）
  offsets: number[]     // 每个样本在文件中的绝对偏移
  sizes: number[]       // 每个样本字节大小
}

/**
 * 从已读入内存的 moov buffer 中，解析所有 track 的样本表。
 * moovFileOffset：moov 在文件里的绝对偏移（样本 chunk 偏移是绝对的，无需加它，
 *   但 co64/stco 给的就是文件绝对偏移，直接用）。
 */
export function parseTracks(moov: Uint8Array, moovStart: number, moovEnd: number): SampleTable[] {
  const result: SampleTable[] = []
  const traks = findBoxes(moov, moovStart, moovEnd, 'trak')
  for (const trak of traks) {
    const mdia = findBox(moov, trak.offset + trak.headerSize, trak.offset + trak.size, 'mdia')
    if (!mdia) continue
    const hdlr = findBox(moov, mdia.offset + mdia.headerSize, mdia.offset + mdia.size, 'hdlr')
    const handler = hdlr ? asciiAt(moov, hdlr.offset + hdlr.headerSize + 8, 4) : '?'
    const minf = findBox(moov, mdia.offset + mdia.headerSize, mdia.offset + mdia.size, 'minf')
    if (!minf) continue
    const stbl = findBox(moov, minf.offset + minf.headerSize, minf.offset + minf.size, 'stbl')
    if (!stbl) continue

    const stsd = findBox(moov, stbl.offset + stbl.headerSize, stbl.offset + stbl.size, 'stsd')
    const format = stsd ? asciiAt(moov, stsd.offset + stsd.headerSize + 12, 4) : '?'

    const dv = new DataView(moov.buffer, moov.byteOffset)

    // stsz: 样本大小
    const stsz = findBox(moov, stbl.offset + stbl.headerSize, stbl.offset + stbl.size, 'stsz')
    if (!stsz) continue
    const stszBase = stsz.offset + stsz.headerSize
    const sampleSizeConst = dv.getUint32(stszBase + 4)
    const sampleCount = dv.getUint32(stszBase + 8)
    const sizes: number[] = []
    for (let i = 0; i < sampleCount; i++) {
      sizes.push(sampleSizeConst !== 0 ? sampleSizeConst : dv.getUint32(stszBase + 12 + i * 4))
    }

    // chunk 偏移：co64（64bit）或 stco（32bit）
    const co64 = findBox(moov, stbl.offset + stbl.headerSize, stbl.offset + stbl.size, 'co64')
    const stco = findBox(moov, stbl.offset + stbl.headerSize, stbl.offset + stbl.size, 'stco')
    const chunkOffsets: number[] = []
    if (co64) {
      const base = co64.offset + co64.headerSize
      const cnt = dv.getUint32(base + 4)
      for (let i = 0; i < cnt; i++) {
        const hi = dv.getUint32(base + 8 + i * 8)
        const lo = dv.getUint32(base + 8 + i * 8 + 4)
        chunkOffsets.push(hi * 2 ** 32 + lo)
      }
    } else if (stco) {
      const base = stco.offset + stco.headerSize
      const cnt = dv.getUint32(base + 4)
      for (let i = 0; i < cnt; i++) chunkOffsets.push(dv.getUint32(base + 8 + i * 4))
    }

    // stsc: chunk → 样本数映射
    const stsc = findBox(moov, stbl.offset + stbl.headerSize, stbl.offset + stbl.size, 'stsc')
    // 计算每个样本的绝对偏移
    const offsets = computeSampleOffsets(dv, stsc, chunkOffsets, sizes)

    result.push({ format, handler, offsets, sizes })
  }
  return result
}

/**
 * 用 stsc + chunkOffsets + sizes 还原每个样本的绝对文件偏移。
 * 处理 stsc 的"每 chunk 含几个样本"分组。
 */
function computeSampleOffsets(
  dv: DataView,
  stsc: Box | null,
  chunkOffsets: number[],
  sizes: number[],
): number[] {
  const offsets: number[] = []
  if (chunkOffsets.length === 0) return offsets

  // 解析 stsc 表：entries of {firstChunk, samplesPerChunk}
  type Entry = { firstChunk: number; samplesPerChunk: number }
  const entries: Entry[] = []
  if (stsc) {
    const base = stsc.offset + stsc.headerSize
    const cnt = dv.getUint32(base + 4)
    for (let i = 0; i < cnt; i++) {
      const e = base + 8 + i * 12
      entries.push({
        firstChunk: dv.getUint32(e),
        samplesPerChunk: dv.getUint32(e + 4),
      })
    }
  }
  // 若无 stsc，默认每 chunk 1 个样本
  if (entries.length === 0) entries.push({ firstChunk: 1, samplesPerChunk: 1 })

  let sampleIdx = 0
  for (let ci = 0; ci < chunkOffsets.length && sampleIdx < sizes.length; ci++) {
    const chunkNum = ci + 1 // 1-based
    // 找该 chunk 对应的 samplesPerChunk
    let spc = entries[0].samplesPerChunk
    for (let k = 0; k < entries.length; k++) {
      if (entries[k].firstChunk <= chunkNum) spc = entries[k].samplesPerChunk
      else break
    }
    let pos = chunkOffsets[ci]
    for (let s = 0; s < spc && sampleIdx < sizes.length; s++) {
      offsets.push(pos)
      pos += sizes[sampleIdx]
      sampleIdx++
    }
  }
  return offsets
}

function asciiAt(buf: Uint8Array, off: number, len: number): string {
  let s = ''
  for (let i = 0; i < len; i++) s += String.fromCharCode(buf[off + i])
  return s
}

function isPrintableType(t: string): boolean {
  return /^[\x20-\x7e]{4}$/.test(t)
}
