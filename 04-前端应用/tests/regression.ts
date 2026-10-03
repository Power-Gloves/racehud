import assert from 'node:assert/strict'
import { createElement } from 'react'
import { renderToString } from 'react-dom/server'
import { useLaps, interpolateSampleAt } from '../src/hooks/useLaps'
import { autoDetectLaps } from '../src/telemetry/autoLap'
import { alignAccel } from '../src/telemetry/align'
import { gpsToVideo, videoToGps, validateRange } from '../src/telemetry/time'
import { prepareTelemetry } from '../src/telemetry/prepare'
import { createStartLightsCue, getStartLightsState } from '../src/themes/startLights'
import { measureLapDistance } from '../src/telemetry/lapDistance'
import { compareTimeAt, getComparableLaps } from '../src/telemetry/lapCompare'
import { analysisAt, buildLapAnalysis } from '../src/telemetry/lapAnalysis'
import type { ComparableLap } from '../src/telemetry/lapCompare'
import { time, values } from '../src/themes/studio/graphics'
import { previewFrame } from '../src/themes/studio/preview'
import { getTheme, THEMES } from '../src/themes'

let failures = 0
function test(name: string, fn: () => void) {
  try { fn(); console.log('通过：' + name) }
  catch (e) { failures++; console.error('失败：' + name, (e as Error).message) }
}
function sample(t: number, lapNum = 1, lapTimeInLap = t) {
  return { t, lapNum, lapTimeInLap, lat: 30, lng: 114, speed: 30, heading: 0, altitude: 0, sats: 10, acceleration: 0, gLong: 0, gLat: 0, distance: 0 }
}
test('圈结束应使用下一圈过线时刻，尾部残圈不能成为最佳圈', () => {
  const samples = [sample(0), sample(59900), sample(60000, 2, 0), sample(108000, 2, 48000)]
  let result: ReturnType<typeof useLaps>
  function Probe() { result = useLaps(samples, 59950); return null }
  renderToString(createElement(Probe))
  assert.equal(result!.laps[0].lapTime, 60)
  assert.equal(result!.bestLap?.lapNum, 1)
  assert.equal(result!.currentLap?.lapNum, 1)
})
test('高采样率低速轨迹也应检测到完整圈', () => {
  const samples = Array.from({ length: 1201 }, (_, i) => {
    const a = i / 400 * Math.PI * 2
    return { ...sample(i * 50), lat: 30 + Math.sin(a) * 10 / 111195, lng: 114 + Math.cos(a) * 10 / (111195 * Math.cos(Math.PI / 6)), speed: 11.3 }
  })
  assert.ok(autoDetectLaps(samples).lapCount >= 2)
})
test('不足最小重叠的自动对齐应拒绝而非返回成功', () => {
  const sig = { t: [0, 1], mag: [0, 1], rate: 1, source: 'dlap' as const }
  assert.throws(() => alignAccel(sig, sig), /重叠|不足/)
})
test('航向跨北方时使用最短角度插值', () => {
  assert.equal(interpolateSampleAt([{ ...sample(0), heading: 359 }, { ...sample(100), heading: 1 }], 50)?.heading, 0)
})
test('正负偏移均能往返换算，导出与预览一致', () => {
  for (const offset of [-5000, 0, 7000]) {
    const gps = videoToGps(12, 100000, 50000, 50000 + offset)
    assert.equal(gps, 112000 + offset)
    assert.equal(gpsToVideo(gps, 100000, 50000, 50000 + offset), 12)
  }
  assert.deepEqual(validateRange(-2, 12, 10), { startSec: 0, endSec: 10 })
  for (const range of [[12, 13], [4, 2], [NaN, 3]]) assert.throws(() => validateRange(range[0], range[1], 10))
})
test('DLAP 默认及重置恢复原始圈号，重分圈不能污染源数据', () => {
  const samples = Array.from({ length: 1201 }, (_, i) => {
    const a = i / 400 * Math.PI * 2
    return { ...sample(i * 50, Math.floor(i / 400) + 1), lat: 30 + Math.sin(a) * .001, lng: 114 + Math.cos(a) * .001 }
  })
  const raw = { samples, meta: { startTime: 0, endTime: 60000, duration: 60000, count: samples.length, sampleRate: 20, source: 'dragy-dlap', model: '测试', columns: [] } }
  const before = JSON.stringify(raw)
  assert.equal(prepareTelemetry(raw, null).data, raw)
  assert.notEqual(prepareTelemetry(raw, .4).data, raw)
  assert.equal(JSON.stringify(raw), before)
  assert.equal(prepareTelemetry(raw, null).data, raw)
})
test('已知偏移的合成信号能恢复方向和数值', () => {
  const wave = (t: number) => Math.sin(t * .7) + .5 * Math.sin(t * 1.73) + .2 * Math.cos(t * .31)
  const make = (shift: number) => ({ t: Array.from({ length: 800 }, (_, i) => i / 10), mag: Array.from({ length: 800 }, (_, i) => wave(i / 10 - shift)), rate: 10, source: 'dlap' as const })
  const result = alignAccel(make(5), make(0), { targetRate: 10, maxLagSec: 10, minOverlapSec: 30 })
  assert.ok(Math.abs(result.lagSeconds - 5) <= .1, String(result.lagSeconds))
})
test('五灯依次点亮，冲线同时熄灭，回拖状态一致', () => {
  const cue = { startT: 10000, leadInMs: 5000 }
  assert.equal(getStartLightsState(4999, cue), null)
  for (let i = 0; i < 5; i++) {
    assert.equal(getStartLightsState(5000 + i * 1000, cue)?.lit, i + 1)
    assert.equal(getStartLightsState(5999 + i * 1000, cue)?.lit, i + 1)
  }
  assert.equal(getStartLightsState(10000, cue)?.lit, 0)
  assert.equal(getStartLightsState(10450, cue), null)
  assert.equal(getStartLightsState(6500, cue)?.lit, 2)
  assert.equal(getStartLightsState(7000), null)
})
test('冲线提示受单圈、开关、缓冲及实际视频范围约束', () => {
  const options = { enabled: true, mode: 'lap' as const, lap: { lapNum: 1, startT: 110000, endT: 120000, lapTime: 10, isBest: false, isCurrent: false }, bufferBefore: 5, dataStartT: 100000, dataOffsetMs: 50000, videoOffsetMs: 50000, videoDuration: 60 }
  assert.equal(createStartLightsCue(options)?.leadInMs, 5000)
  assert.equal(createStartLightsCue({ ...options, bufferBefore: 30 })?.leadInMs, 5000)
  const short = createStartLightsCue({ ...options, bufferBefore: 2 })
  assert.equal(short?.leadInMs, 2000)
  assert.equal(getStartLightsState(109600, short)?.lit, 5)
  assert.equal(createStartLightsCue({ ...options, videoOffsetMs: 58000 })?.leadInMs, 2000)
  assert.equal(createStartLightsCue({ ...options, bufferBefore: 0 }), undefined)
  assert.equal(createStartLightsCue({ ...options, enabled: false }), undefined)
  assert.equal(createStartLightsCue({ ...options, mode: 'full' }), undefined)
  assert.equal(createStartLightsCue({ ...options, mode: 'custom' }), undefined)
  assert.equal(createStartLightsCue({ ...options, lap: undefined }), undefined)
  assert.equal(createStartLightsCue({ ...options, videoOffsetMs: 61000 }), undefined)
  assert.equal(createStartLightsCue({ ...options, videoDuration: 5 }), undefined)
})
test('行车线距离按圈边界插值，累计里程不误当圈长', () => {
  const samples = [0, 1000, 2000, 3000].map((t, i) => ({ ...sample(t), distance: 1000 + i * 10 }))
  assert.deepEqual(measureLapDistance(samples, 500, 2500, 1500), { meters: 20, travelledMeters: 10 })
  assert.deepEqual(measureLapDistance(samples, 500, 2500, 0), { meters: 20, travelledMeters: 0 })
  assert.deepEqual(measureLapDistance(samples, 500, 2500, 3000), { meters: 20, travelledMeters: 20 })
  assert.deepEqual(measureLapDistance(samples, -500, 500), { meters: 5, travelledMeters: 5 })
  assert.equal(measureLapDistance([], 0, 1), null)
  assert.equal(measureLapDistance(samples, 4000, 5000), null)
  assert.equal(measureLapDistance(samples, 500, 500), null)
})

test('双圈对比只收录有完整冲线、GPS 与视频覆盖的圈', () => {
  const samples = [0, 1000, 2000, 3000, 4000, 5000, 6000, 7000].map(t => ({ ...sample(t, Math.floor(t / 2000) + 1, t % 2000), distance: t / 10 }))
  const laps = [
    { lapNum: 1, startT: 0, endT: 2000, lapTime: 2, isBest: false, isCurrent: false },
    { lapNum: 2, startT: 2000, endT: 4000, lapTime: 2, isBest: true, isCurrent: false },
    { lapNum: 3, startT: 4000, endT: 6000, lapTime: 2, isBest: false, isCurrent: false },
    { lapNum: 4, startT: 6000, endT: 7000, lapTime: 1, isBest: false, isCurrent: false },
  ]
  const all = getComparableLaps(samples, laps, 7, 0, 0, 0)
  assert.deepEqual(all.map(l => l.lap.lapNum), [1, 2, 3])
  assert.equal(all[0].samples[0].t, 0)
  assert.equal(all[0].samples.at(-1)?.t, 2000)
  assert.equal(compareTimeAt(all[1], 1.25), 3.25)
  assert.equal(compareTimeAt(all[1], 5), 4)
  assert.deepEqual(getComparableLaps(samples, laps, 7, 0, 0, 2500).map(l => l.lap.lapNum), [3])
})

function analysisLap(duration: number, shift = 0): ComparableLap {
  const samples = Array.from({ length: 101 }, (_, i) => ({
    ...sample(i * duration * 10), lat: 30 + Math.sin(i / 100 * Math.PI * 2) * .001,
    lng: 114 + Math.cos(i / 100 * Math.PI * 2) * .001 + shift,
    distance: i * 10, speed: 3600 / duration,
  }))
  return { samples, lap: { lapNum: 1, startT: 0, endT: duration * 1000, lapTime: duration, isBest: false, isCurrent: false }, videoStartSec: 0, videoEndSec: duration }
}

test('同位置秒差从零开始，慢圈为正，终点等于真实圈时差', () => {
  const result = buildLapAnalysis(analysisLap(60), analysisLap(66))
  assert.equal(result.alignment, 'position')
  assert.equal(result.points[0].delta, 0)
  assert.ok(Math.abs(analysisAt(result, 500)!.delta - 3) < .03)
  assert.equal(result.points[result.points.length - 1].delta, 6)
  assert.ok(result.points.every((p, i) => i === 0 || p.timeB >= result.points[i - 1].timeB))
  assert.ok(Math.abs(analysisAt(result, 30, 'timeA')!.distance - 500) < .01)
})

test('相同圈零秒差，交换参考圈反转终点符号', () => {
  const a = analysisLap(60)
  assert.ok(buildLapAnalysis(a, a).points.every(p => Math.abs(p.delta) < .001))
  const result = buildLapAnalysis(analysisLap(66), a)
  assert.equal(result.points[result.points.length - 1].delta, -6)
})

test('不同轨迹和非法距离不得伪装成可靠位置对齐', () => {
  assert.equal(buildLapAnalysis({ ...analysisLap(60), samples: [] }, analysisLap(60)).alignment, 'invalid')
  assert.equal(buildLapAnalysis(analysisLap(60), analysisLap(66, .01)).alignment, 'progress')
  const broken = analysisLap(60)
  broken.samples[30].distance = -10
  assert.equal(buildLapAnalysis(broken, analysisLap(60)).alignment, 'invalid')
  const plateau = analysisLap(66)
  plateau.samples[30].distance = plateau.samples[29].distance
  assert.ok(buildLapAnalysis(analysisLap(60), plateau).points.every(p => Number.isFinite(p.delta)))
})

test('局部得失时间来自位置用时，而不是整圈时间差线性摊分', () => {
  const a = analysisLap(60), b = analysisLap(60)
  b.samples = b.samples.map((s, i) => ({ ...s, t: s.t + Math.sin(i / 100 * Math.PI * 2) * 2000 }))
  const result = buildLapAnalysis(a, b)
  assert.ok(Math.abs(analysisAt(result, 250)!.delta - 2) < .05)
  assert.ok(Math.abs(analysisAt(result, 750)!.delta + 2) < .05)
  assert.equal(result.points.at(-1)!.delta, 0)
})
test('新主题圈时按播放时刻计算，毫秒进位和单位换算准确', () => {
  assert.equal(time(59.9996), '01:00.000')
  assert.equal(time(NaN), '--:--.---')
  const frame = {...previewFrame, current: {...sample(0),speed:100,lapTimeInLap:0},playheadT:12345}
  assert.equal(values(frame).elapsed, '00:12.345')
  assert.equal(values({...frame,unit:'mph'}).speed, '62')
  assert.equal(values({...frame,current:null}).speed, '—')
  assert.equal(values({...frame,current:{...sample(0),speed:Infinity,bestCompare:NaN}}).delta, '—')
  assert.equal(values({...frame,playheadT:100000}).elapsed, '00:59.750')
})
test('保留三个原主题，旧主题标识映射到新的布局', () => {
  assert.equal(THEMES.length,12)
  assert.equal(new Set(THEMES.map(t=>t.id)).size,12)
  for(const id of ['minimal','custom','custom-no-lap'])assert.equal(getTheme(id).id,id)
  assert.equal(getTheme('neon').id,'slipstream')
  assert.equal(getTheme('f1').id,'apex')
  assert.equal(getTheme('jdm').id,'roadbook')
  assert.equal(getTheme('race').id,'chrono')
})
if (failures) process.exitCode = 1
