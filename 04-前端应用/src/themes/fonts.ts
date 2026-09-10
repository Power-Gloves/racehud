let ready: Promise<unknown> | undefined;
/** 本地字体先就绪再编码，避免第一帧与后续帧字形跳变。 */
export function loadHudFonts(): Promise<unknown> {
    if (typeof document === 'undefined' || !document.fonts)
        return Promise.resolve();
    return ready ??= Promise.all([
        document.fonts.load('600 24px "Race Condensed"'),
        document.fonts.load('500 24px "Race Mono"'),
        document.fonts.load('600 24px "Race Serif"'),
    ]);
}
