/**
 * 极简 Protobuf 盲解析（无需 .proto schema）
 *
 * 只解析结构（按 wire-type），用于逆向 DJI djmd track 的字段。
 * 支持 wire type: 0(varint) / 1(64bit double) / 2(length-delimited) / 5(32bit float)
 */

export interface PbNode {
  field: number
  wire: number
  /** wire 0 */
  varint?: number
  /** wire 5 */
  float?: number
  /** wire 1 */
  double?: number
  /** wire 2 length */
  len?: number
  /** wire 2 递归解析出的子节点（若像合法子消息） */
  nested?: PbNode[]
}

function readVarint(buf: Uint8Array, p: number): { value: number; pos: number } {
  let shift = 0
  let result = 0
  while (p < buf.length) {
    const b = buf[p++]
    result += (b & 0x7f) * 2 ** shift
    if (!(b & 0x80)) break
    shift += 7
  }
  return { value: result, pos: p }
}

export function parsePb(buf: Uint8Array, start: number, end: number): PbNode[] {
  const dv = new DataView(buf.buffer, buf.byteOffset)
  const out: PbNode[] = []
  let p = start
  while (p < end) {
    const tag = readVarint(buf, p)
    p = tag.pos
    const field = Math.floor(tag.value / 8)
    const wire = tag.value % 8
    if (field === 0) break
    if (wire === 0) {
      const v = readVarint(buf, p)
      p = v.pos
      out.push({ field, wire, varint: v.value })
    } else if (wire === 5) {
      if (p + 4 > end) break
      out.push({ field, wire, float: dv.getFloat32(p, true) })
      p += 4
    } else if (wire === 1) {
      if (p + 8 > end) break
      out.push({ field, wire, double: dv.getFloat64(p, true) })
      p += 8
    } else if (wire === 2) {
      const len = readVarint(buf, p)
      p = len.pos
      const L = len.value
      if (p + L > end) break
      let nested: PbNode[] | undefined
      if (L > 0 && L < 4096) {
        try {
          const candidate = parsePb(buf, p, p + L)
          if (candidate.length > 0) nested = candidate
        } catch {
          /* 不是子消息，忽略 */
        }
      }
      out.push({ field, wire, len: L, nested })
      p += L
    } else {
      break
    }
  }
  return out
}

/** 取某 field 的子消息节点数组 */
export function pbChild(nodes: PbNode[] | null | undefined, field: number): PbNode[] | null {
  if (!nodes) return null
  const n = nodes.find(x => x.field === field && x.nested)
  return n?.nested ?? null
}

/** 取某节点数组里所有 float（wire5），按出现顺序 */
export function pbFloats(nodes: PbNode[] | null | undefined): number[] {
  if (!nodes) return []
  return nodes.filter(x => x.float !== undefined).map(x => x.float as number)
}

/** 取某 field 的 varint 值 */
export function pbVarint(nodes: PbNode[] | null | undefined, field: number): number | null {
  if (!nodes) return null
  const n = nodes.find(x => x.field === field && x.varint !== undefined)
  return n?.varint ?? null
}
