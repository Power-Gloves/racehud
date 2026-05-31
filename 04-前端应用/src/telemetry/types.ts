/**
 * 遥测来源统一抽象
 *
 * 4 种场景：
 *   1. 外部 DLAP/VBO + DJI 视频（视频只有加速度）  → 加速度互相关对齐
 *   2. 外部 DLAP/VBO + GoPro 视频                   → 加速度互相关对齐
 *   3. 无外部数据 + GoPro 视频（用内嵌 GPS）        → 无需对齐
 *   4. 无外部数据 + DJI 视频（只有加速度，无 GPS）   → HUD 数据受限
 *
 * 关键设计：
 *   - 所有遥测来源都归一到统一 Sample[] 模型（见 ../types.ts）
 *   - 视频内嵌遥测额外提供一条"高频加速度序列"专供对齐用（不降采样）
 */

/** 对齐专用的加速度信号：高频原始序列，时间戳 + 三轴模长 */
export interface AccelSignal {
  /** 每个样本的绝对/相对时间，单位秒（相对该来源自身起点即可，对齐只看相对关系） */
  t: number[]
  /** 加速度模长序列（单位 g 或 m/s²，对齐前会归一化所以单位不敏感） */
  mag: number[]
  /** 采样率 Hz（用于把 lag 的"样本数"换算成秒） */
  rate: number
  /** 数据来源标记，调试用 */
  source: 'dji' | 'gopro' | 'dlap' | 'vbo'
}

/** 视频内嵌遥测提取结果 */
export interface VideoTelemetry {
  /** 设备类型 */
  device: 'dji' | 'gopro'
  /** 设备型号（如 "DJI Osmo Action 4"），展示用 */
  model: string
  /** 对齐专用的高频加速度信号 */
  accel: AccelSignal
  /** 是否含 GPS（GoPro 通常有，DJI 运动相机通常无） */
  hasGps: boolean
  /** 视频时长（秒），从遥测时间跨度推得 */
  durationSec: number
  /** 样本总数 */
  sampleCount: number
}

/** 自动对齐结果 */
export interface AlignResult {
  /** 视频相对数据的时间偏移（秒）。
   *  正值表示视频比数据晚开始，应用时 videoOffset 相应调整 */
  lagSeconds: number
  /** 互相关峰值得分（越高越可信，用于判断对齐是否成功） */
  score: number
  /** 归一化后的置信度 0~1（score 相对于次峰的显著性） */
  confidence: number
}

/** 视频遥测提取器接口：不同设备各实现一个 */
export interface VideoTelemetryExtractor {
  /** 快速探测这个视频文件是不是本提取器支持的格式（只读文件头尾，快） */
  probe(file: File): Promise<boolean>
  /** 完整提取遥测（读 moov + 遥测 track，不读视频流） */
  extract(file: File, onProgress?: (ratio: number) => void): Promise<VideoTelemetry>
}
