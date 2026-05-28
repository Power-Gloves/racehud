/** @type {import('tailwindcss').Config} */

// 0.25 步进 spacing scale，让 dragy 风格的 h-13 / w-189 / h-6.5 / w-32.5 都直接生效
// 用字符串键，避免 JS 数字键的隐式 toString 不一致
const spacing = {}
for (let i = 0; i <= 1200; i++) {
  const v = i * 0.25                                  // 0, 0.25, 0.5, 0.75, ..., 300
  // key 去掉尾部 .00：6.5 而不是 6.50；13 而不是 13.00
  const key = (Math.round(v * 100) / 100).toString()
  const rem = (v * 0.25)
  spacing[key] = `${(Math.round(rem * 10000) / 10000)}rem`
}

export default {
  content: ['./index.html', './src/**/*.{ts,tsx}'],
  theme: {
    extend: {
      colors: {
        bg: 'var(--color-bg)',                        // #252225 整页主背景
        'black-18': 'var(--color-black-18)',           // #181818 深底元素
        'gray-66': 'var(--color-gray-66)',             // #666666 灰文字
        primary: 'var(--color-primary)',               // #0078f3 主蓝
      },
      fontFamily: {
        sans: ['"Open Sans"', 'ui-sans-serif', 'system-ui', 'sans-serif'],
        kernel: ['"KernelRegular"', '"Aldrich"', '"Open Sans"', 'sans-serif'],
        aldrich: ['"Aldrich"', 'sans-serif'],
      },
      spacing,
    }
  },
  plugins: [
    function ({ addUtilities }) {
      addUtilities({
        '.flex-cc': { display: 'flex', justifyContent: 'center', alignItems: 'center' },
        '.flex-bc': { display: 'flex', justifyContent: 'space-between', alignItems: 'center' },
        '.flex-sc': { display: 'flex', justifyContent: 'flex-start', alignItems: 'center' },
      })
    }
  ],
}
