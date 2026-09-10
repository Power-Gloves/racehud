import { alignAccel } from './align'

// 互相关计算放到后台线程，长视频对齐期间界面仍可操作。
self.onmessage = (event) => {
  try {
    const { video, data } = event.data
    self.postMessage({ result: alignAccel(video, data) })
  } catch (e) {
    self.postMessage({ error: e instanceof Error ? e.message : String(e) })
  }
}
