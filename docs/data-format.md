# 数据格式分析

## 样本文件

| 文件 | 大小 | 状态 |
|------|------|------|
| `dragylap_20260523_202824_超级马力卡丁车.vbo` | 506 KB | ✅ 直接解析 |
| `超级马力卡丁车_2026_05_23_20_28_24.dlap` | 2.3 MB | ✅ 已破解，AES-128-CBC |

两个文件来自同一段比赛，互为冗余。DLAP 数据更全（含圈号 / 圈时对比 / 60Hz 加速度计），VBO 更轻（506KB vs 2.3MB），实际项目两种都支持。

---

## VBO 格式

RaceLogic 标准文本格式，Dragy 导出。

### 文件结构

```
File created on 23/05/2026 @ 12:28
[header]            字段名清单
[channel units]
[comments]          UTC Date Started / 设备型号
[column names]      sats time lat long velocity heading height
[data]              空格分隔的数据行
```

### 字段语义

| 字段 | 单位 | 说明 |
|------|------|------|
| `sats` | 个 | 卫星数 |
| `time` | UTC `HHMMSS.fff` | 当天时间，无日期（日期从 `[comments]` 取） |
| `lat` | 弧分 | 纬度，正北负南，转度数 = `value / 60` |
| `long` | 弧分 | 经度，**西经为正**，转度数 = `-value / 60` |
| `velocity` | km/h | 地面速度 |
| `heading` | 度 (0-360) | 朝向，0=北，顺时针 |
| `height` | 米 | 海拔（GPS 高度） |

### 采样率

10 Hz（采样间隔 100ms）

### 注意点

- VBO 的 `heading` 在低速 / 弱信号下会出现瞬间跳变（如 229.6° → 219.4° 在 0.1s 内），导致差分算 `gLat` 时出现 ±4G 的伪峰值。需要平滑或用经纬度差分推算。

---

## DLAP 格式 ✅ 已破解

### 解密流程

```
*.dlap (ZIP)
  └── *.group        ← AES-128-CBC 加密字节流
        └─ 解密 →    ZIP
                       ├── data-{id}.cir    主数据 (CSV 格式)
                       ├── acc-{id}.txt     加速度计 (~60Hz, IMU 原始)
                       ├── data.json        元数据
                       └── {id}.png         封面
```

### 解密参数

| 项 | 值 |
|----|----|
| 算法 | AES-128-CBC + PKCS7 padding |
| Key | `"i2FleZnd"` + `\0` × 8（16 字节） |
| IV | `"i3ev8len"` + `\0` × 8（16 字节） |

参数来源：从 `laptimer.com/overlay` 前端 bundle (`index-CaNhjNuN.js`) 中 `ak` 类的 `decryptFile` / `decodeGroup` / `unZip` 方法反查。Web Crypto API 实现，硬编码在前端。

### 主数据 `.cir`（CSV，无 header）

| 列 | 字段 | 单位 | 说明 |
|----|------|------|------|
| 0 | `userTime` | 秒 | **本圈** 已用时（每过 start/finish 重置） |
| 1 | `time` | 秒 | UTC 当天秒数（从 0:00 起算） |
| 2 | `speed` | km/h | 地面速度 |
| 3 | `acc` | m/s² | 设备给的纵向加速度 |
| 4 | `alt` | m | 海拔 |
| 5 | `lat` | 度 | 纬度（直接可用，**不是** arc-min） |
| 6 | `lng` | 度 | 经度（直接可用） |
| 7 | `distance` | m | **本圈** 累计距离 |
| 8 | `accuracy` | m | GPS 水平精度 |
| 9 | `satelliteNum` | 个 | 卫星数 |
| 10 | `heading` | 度 | **样本中恒为 0**，需用经纬度推算 |
| 11 | `brake` | - | 刹车信号（0/1 或模拟值） |
| 12 | `lastCompare` | 秒 | 与上一圈同位置的时间差 |
| 13 | `bestCompare` | 秒 | 与最佳圈同位置的时间差 |
| 14 | `bestTime` | 秒 | 当前最佳圈时间 |
| 15 | `idx` | 整数 | **圈号**（从 0 起） |
| 16+ | - | - | 空保留列 |

### 加速度计 `acc-{id}.txt`（~60Hz）

11 列：`time(UTC秒) ms(epoch) ax ay az ax_lin ay_lin az_lin ax_g ay_g az_g`（线性加速度 + 含重力）。本项目暂未使用，后续可用于更精确的 G 值。

### 元数据 `data.json`

关键字段：

| 字段 | 说明 |
|------|------|
| `createTime` | 创建时间（epoch ms 或 epoch sec），用于推断绝对日期 |
| `deviceName` | 设备名（`Dragy-B6132A`） |
| `firmwareVersion` | 固件版本（`Dragy_MD69_V1.0.10`） |
| `frequency` | 采样率（10） |
| `groupId` | 与 `.group` 文件名对应 |
| `dataInfoFile` | 主数据文件名（指向 `.cir`） |
| `accInfoFile` | 加速度计文件名 |
| `distance` | 总行驶距离（m） |
| `laps` | 圈分析数据 |

### 注意点

- `userTime` 和 `distance` 都是**本圈**累计，每过 start/finish 重置。要算总距离需自己用 haversine 累加经纬度。
- `heading` 列恒为 0，需要用经纬度方位角推算。中心差分（i-1 → i+1）出来的 heading 比 VBO 设备给的还更稳定。
- `time` 列是 UTC 当天秒数，跨日时要小心日期切换（用 `createTime` 兜底取年月日）。

---

## 内部统一数据模型（前后端）

VBO / DLAP 解析后都输出这个模型：

```ts
interface Sample {
  t: number;        // 绝对 UTC 毫秒时间戳
  lat: number;      // 度
  lng: number;      // 度
  speed: number;    // km/h
  heading: number;  // 度 (0-360)
  altitude: number; // 米
  sats: number;     // 卫星数

  // 派生
  acceleration: number; // m/s²
  gLong: number;        // G
  gLat: number;         // G
  distance: number;     // 累计距离（米）

  // DLAP 独有（VBO 这些字段为 undefined）
  lapNum?: number;
  lapTimeInLap?: number;
  bestTime?: number;
  lastCompare?: number;
  bestCompare?: number;
  accuracy?: number;
  brake?: number;
  accRaw?: number;
}
```

## 参考

- 解密参数原始来源：`racehud/overlay_dump/index.beautified.js`（`ak` 类的 `decryptFile` 方法）
- VBO parser：`02-数据解析/vbo.js`
- DLAP parser：`02-数据解析/dlap.js`
