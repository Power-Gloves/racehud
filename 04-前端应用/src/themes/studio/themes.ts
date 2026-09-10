import type { Theme } from '../types';
import { design, text, rect, line, values, map, gforce, dial, trace, white, ink, mono, serif } from './graphics';
export const studioThemes: Theme[] = [
    {
        id: 'apex', name: '极点转播', preview: { bg: '#161c22', border: '#ff593d', text: white, accent: '#ff593d' },
        drawHud(c, f) {
            design(c, f, () => {
                const v = values(f), red = '#ff593d';
                rect(c, 64, 64, 8, 124, red);
                rect(c, 72, 64, 340, 124, '#11191fec');
                rect(c, 72, 64, 340, 31, red);
                text(c, 'APEX / LIVE TIMING', 90, 87, 20, ink, mono);
                text(c, `LAP ${v.lap}`, 90, 126, 22);
                text(c, v.elapsed, 90, 173, 42);
                rect(c, 64, 195, 348, 42, '#11191fdc');
                text(c, 'BEST', 90, 223, 18, '#aab3bb', mono);
                text(c, v.best, 394, 224, 24, white, mono, 'right');
                map(c, f, 1610, 70, 235, 170, white);
                c.beginPath();
                c.moveTo(64, 838);
                c.lineTo(320, 838);
                c.lineTo(388, 1008);
                c.lineTo(64, 1008);
                c.closePath();
                c.fillStyle = red;
                c.fill();
                text(c, v.speed, 88, 969, 124, white);
                text(c, v.unit, 286, 985, 21, white, mono);
                rect(c, 388, 948, 278, 60, '#11191fec');
                text(c, 'DELTA', 410, 971, 16, '#aab3bb', mono);
                text(c, v.delta, 644, 992, 36, v.deltaColor, mono, 'right');
                gforce(c, f, 1777, 925, 68, white);
                text(c, 'G / 2.0', 1777, 1020, 18, white, mono, 'center');
            });
        },
    },
    {
        id: 'chrono', name: '精密计时', preview: { bg: '#162129', border: '#bbcbd3', text: white, accent: '#e9f3f8' },
        drawHud(c, f) {
            design(c, f, () => {
                const v = values(f);
                rect(c, 575, 895, 770, 127, '#111b24ed');
                line(c, 575, 895, 1345, 895, '#a9bac5', 2);
                text(c, 'CURRENT / ' + v.lap, 601, 930, 18, '#a9bac5', mono);
                text(c, v.elapsed, 601, 978, 38);
                text(c, 'PERSONAL BEST', 1319, 930, 18, '#a9bac5', mono, 'right');
                text(c, v.best, 1319, 978, 38, white, undefined, 'right');
                dial(c, f, 960, 862, 143, '#d2dfe6');
                text(c, 'CHRONO', 960, 797, 17, '#d2dfe6', mono, 'center');
                rect(c, 64, 810, 230, 212, '#111b24d9');
                map(c, f, 88, 835, 182, 140, '#d2dfe6');
                text(c, 'CIRCUIT', 179, 1005, 17, '#a9bac5', mono, 'center');
                gforce(c, f, 1750, 906, 70, '#d2dfe6');
                text(c, 'LATERAL / LONG. G', 1750, 1008, 16, '#d2dfe6', mono, 'center');
            });
        },
    },
    {
        id: 'roadbook', name: '拉力路书', preview: { bg: '#20231e', border: '#eabe65', text: '#ffe6ad', accent: '#eabe65' },
        drawHud(c, f) {
            design(c, f, () => {
                const v = values(f), amber = '#eabe65';
                rect(c, 64, 500, 270, 516, '#19201bec');
                rect(c, 64, 500, 270, 42, amber);
                text(c, 'ROADBOOK / GPS', 82, 528, 20, ink, mono);
                text(c, v.speed, 86, 661, 116, '#fff1cd');
                text(c, v.unit, 302, 695, 20, amber, mono, 'right');
                line(c, 86, 716, 312, 716, amber, 1);
                text(c, 'STAGE LAP ' + v.lap, 86, 753, 20, amber, mono);
                text(c, v.elapsed, 86, 797, 38, '#fff1cd');
                text(c, 'REFERENCE', 86, 845, 17, amber, mono);
                text(c, v.best, 86, 879, 27, '#fff1cd', mono);
                text(c, 'VS BEST', 86, 938, 17, amber, mono);
                text(c, v.delta, 86, 981, 34, v.deltaColor, mono);
                rect(c, 1566, 68, 290, 265, '#19201bd9');
                text(c, 'N', 1711, 100, 20, amber, mono, 'center');
                line(c, 1711, 110, 1711, 124, amber);
                map(c, f, 1590, 133, 242, 168, amber);
                rect(c, 1655, 934, 200, 98, '#19201bc9');
                const heading = f.current?.heading;
                text(c, heading != null && Number.isFinite(heading) ? `${String(Math.round((heading % 360 + 360) % 360) % 360).padStart(3, '0')}°` : '---°', 1825, 987, 52, amber, mono, 'right');
                text(c, 'HEADING', 1825, 1020, 18, amber, mono, 'right');
            });
        },
    },
    {
        id: 'endurance', name: '耐力工程', preview: { bg: '#15242c', border: '#81cfe2', text: white, accent: '#81cfe2' },
        drawHud(c, f) {
            design(c, f, () => {
                const v = values(f), blue = '#81cfe2';
                rect(c, 64, 856, 1792, 164, '#101c24ee');
                rect(c, 64, 851, 1792, 5, blue);
                for (const x of [346, 670, 994, 1288, 1570])
                    line(c, x, 879, x, 994, '#ffffff28', 1);
                text(c, 'VELOCITY', 88, 889, 17, blue, mono);
                text(c, v.speed, 88, 992, 99);
                text(c, v.unit, 307, 985, 18, blue, mono, 'right');
                text(c, 'LAP ' + v.lap, 372, 889, 17, blue, mono);
                text(c, v.elapsed, 372, 960, 45);
                text(c, 'CURRENT', 372, 992, 16, '#9baab3', mono);
                text(c, 'PERSONAL BEST', 695, 889, 17, blue, mono);
                text(c, v.best, 695, 960, 45);
                text(c, 'REFERENCE', 695, 992, 16, '#9baab3', mono);
                text(c, 'DELTA / S', 1020, 889, 17, blue, mono);
                text(c, v.delta, 1020, 960, 45, v.deltaColor);
                text(c, 'RELATIVE TO BEST', 1020, 992, 16, '#9baab3', mono);
                gforce(c, f, 1427, 941, 48, blue);
                text(c, 'G / 2.0', 1427, 1008, 15, blue, mono, 'center');
                trace(c, f, 1594, 904, 235, 70, blue);
                text(c, 'SPEED / LAST 8 S', 1594, 889, 16, blue, mono);
                line(c, 1594, 979, 1830, 979, '#ffffff44', 1);
                map(c, f, 1633, 602, 198, 179, blue);
            });
        },
    },
    {
        id: 'slipstream', name: '轻量尾流', preview: { bg: '#20271a', border: '#daff75', text: white, accent: '#daff75' },
        drawHud(c, f) {
            design(c, f, () => {
                const v = values(f), lime = '#daff75';
                const gradient = c.createLinearGradient(0, 790, 0, 1080);
                gradient.addColorStop(0, '#07100800');
                gradient.addColorStop(1, '#071008c9');
                rect(c, 0, 790, 1920, 290, gradient);
                text(c, v.speed, 70, 988, 162);
                text(c, v.unit, 80 + 205, 985, 23, lime, mono);
                for (let i = 0; i < 20; i++)
                    rect(c, 70 + i * 15, 1022, 9, i % 5 === 0 ? 15 : 7, i < Math.min(20, Number(v.speed) / (f.unit === 'mph' ? 5 : 8)) ? lime : '#ffffff3d');
                line(c, 510, 909, 510, 1020, lime, 3);
                text(c, 'LAP / ' + v.lap, 540, 933, 20, lime, mono);
                text(c, v.elapsed, 540, 997, 56);
                text(c, 'BEST', 1025, 933, 20, lime, mono);
                text(c, v.best, 1025, 997, 56);
                text(c, v.delta, 1845, 997, 56, v.deltaColor, undefined, 'right');
                text(c, 'DELTA', 1845, 933, 20, lime, mono, 'right');
                map(c, f, 1650, 70, 195, 150, lime);
            });
        },
    },
    {
        id: 'heritage', name: '经典勒芒', preview: { bg: '#342924', border: '#e8d9b9', text: '#f3e6cd', accent: '#b64436' },
        drawHud(c, f) {
            design(c, f, () => {
                const v = values(f), cream = '#eee2c9', red = '#9b302a';
                dial(c, f, 228, 855, 143, '#3e342a', true);
                text(c, 'LE MANS', 228, 792, 19, '#514437', serif, 'center');
                rect(c, 424, 908, 776, 112, '#eee2c9f2');
                rect(c, 424, 908, 8, 112, red);
                rect(c, 440, 908, 3, 112, red);
                text(c, 'LAP ' + v.lap, 469, 942, 19, red, mono);
                text(c, v.elapsed, 469, 990, 37, '#3e342a', serif);
                line(c, 787, 929, 787, 999, '#9e927c', 1);
                text(c, 'PERSONAL BEST', 816, 942, 18, red, mono);
                text(c, v.best, 816, 990, 37, '#3e342a', serif);
                rect(c, 1610, 790, 245, 230, '#302822dc');
                line(c, 1610, 790, 1855, 790, cream, 2);
                map(c, f, 1638, 818, 190, 143, cream);
                text(c, 'CIRCUIT / GPS', 1732, 999, 17, cream, mono, 'center');
                rect(c, 64, 64, 194, 60, '#302822c9');
                text(c, 'HERITAGE', 78, 95, 24, cream, serif);
                line(c, 78, 112, 245, 112, red, 4);
            });
        },
    },
];
