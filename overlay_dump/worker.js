importScripts("./mediabunny.js");
const { Input, ALL_FORMATS, BlobSource, CanvasSink, VideoSampleSink } = Mediabunny;
let sink;
let duration;
let canvases;
let displayWidth;
let displayHeight;
let rotation;

const init = async ({ height, video }) => {
  const source = new BlobSource(video);
  const input = new Input({ source, formats: ALL_FORMATS });
  duration = await input.computeDuration();
  const videoTrack = await input.getPrimaryVideoTrack();
  if (!videoTrack) {
    throw new Error("File has no video track.");
  }
  if (videoTrack.codec === null) {
    throw new Error("Unsupported video codec.");
  }
  if (!(await videoTrack.canDecode())) {
    throw new Error("Unable to decode the video track.");
  }
  rotation = videoTrack.rotation;
  displayHeight = height;
  displayWidth = videoTrack.displayWidth * (displayHeight / videoTrack.displayHeight);
  sink = new VideoSampleSink(videoTrack);
  self.postMessage({ type: "initOK", data: { duration } });
};

const getCanvas = async (index) => {
  try {
    const VideoSample = await sink?.getSample(index);
    let { _data, timestamp } = VideoSample;
    timestamp = Math.ceil(timestamp);
    const offscreenCanvas = new OffscreenCanvas(displayWidth, displayHeight); // 指定宽度和高度
    const ctx = offscreenCanvas.getContext("2d");
    ctx.drawImage(_data, 0, 0, displayWidth, displayHeight);
    const blob = await offscreenCanvas.convertToBlob({ type: "image/webp" });
    const blobUrl = URL.createObjectURL(blob);
    self.postMessage({ type: "thumbnail", data: { index: timestamp, blobUrl } });
    VideoSample.close();
  } catch (error) {
    console.log("🚀 ~ getCanvas ~ error:", error);
  }
};

// 定义中断控制器，用于管理循环的中断状态
let abortController = null;

const getCanvasesAtTimestamps = async (timestamps) => {
  if (!sink) return;
  // 1. 如果有正在执行的任务，先中断它
  if (abortController) {
    abortController.abort("新的调用请求中断了当前执行");
  }

  // 2. 创建新的中断控制器
  abortController = new AbortController();
  const signal = abortController.signal;

  let i = 0;
  try {
    // 3. 遍历视频帧样本
    for await (const VideoSample of sink?.samplesAtTimestamps(timestamps)) {
      // 4. 检查是否需要中断，若需要则退出循环
      if (signal.aborted) {
        console.log("循环已被中断");
        VideoSample.close(); // 清理资源
        break;
      }

      const offscreenCanvas = new OffscreenCanvas(displayWidth, displayHeight);
      const ctx = offscreenCanvas.getContext("2d");

      if (rotation == 90) {
        // 旋转 90 度
        ctx.save(); // 保存当前状态
        ctx.translate(displayWidth, 0); // 将原点移动到画布右上角
        ctx.rotate(Math.PI / 2); // 旋转 90 度（π/2 弧度）
        ctx.drawImage(VideoSample._data, 0, 0, displayHeight, displayWidth);
        ctx.restore();
      } else if (rotation) {
        ctx.save();
        // 移动到画布右下角
        ctx.translate(displayWidth, displayHeight);
        ctx.rotate((rotation * Math.PI) / 180);
        ctx.drawImage(VideoSample._data, 0, 0, displayWidth, displayHeight);
        ctx.restore();
      } else {
        ctx.drawImage(VideoSample._data, 0, 0, displayWidth, displayHeight);
      }

      const blob = await offscreenCanvas.convertToBlob({ type: "image/webp", quality: 0.8 });
      const blobUrl = URL.createObjectURL(blob);
      self.postMessage({ type: "thumbnail", data: { index: timestamps[i], blobUrl } });

      VideoSample.close();
      i++;
    }
  } catch (error) {
    console.error("执行过程中出错:", error);
  } finally {
    // 5. 执行完成或中断后，重置中断控制器
    if (signal.aborted) {
      abortController = null;
    }
  }
};

const exportVideo = async (options) => {
  console.log("🚀 ~ exportVideo ~ options:", options);
  const { video, trim, wh } = options;
  const input = new Input({
    source: new BlobSource(video),
    formats: ALL_FORMATS,
  });
  const duration = await input.computeDuration();

  const output = new Output({
    format: new Mp4OutputFormat(), // The format of the file
    target: new BufferTarget(), // Where to write the file (here, to memory)
  });
};
// 监听主线程发送来的消息
self.addEventListener("message", (e) => {
  const { command, payload } = e.data;
  // console.log("🚀 ~ command, payload:", command, payload);

  switch (command) {
    case "init":
      init(payload);
      break;
    case "getCanvas":
      getCanvas(payload);
      break;
    case "getCanvasesAtTimestamps":
      getCanvasesAtTimestamps(payload);
      break;
    case "clearCanvases":
      canvases = null;
      break;
    case "export":
      exportVideo(payload);
      break;
    default:
      self.postMessage({ type: "error", error: "Unknown command" });
  }
});
