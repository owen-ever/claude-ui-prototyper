#!/usr/bin/env npx tsx
/**
 * 이모지 캘리브레이션 스크립트
 *
 * 터미널 환경에서 이모지의 실제 렌더링 너비를 측정하고
 * wcwidth와의 차이를 보정하는 설정 파일을 생성합니다.
 */

import * as readline from 'readline';
import * as fs from 'fs';
import * as path from 'path';
import * as os from 'os';
import wcwidth from 'wcwidth';

// 설정 파일 경로
const GLOBAL_CONFIG_DIR = path.join(os.homedir(), '.config', 'ui-prototyper');
const GLOBAL_CONFIG_PATH = path.join(GLOBAL_CONFIG_DIR, 'emoji-config.json');
const LOCAL_CONFIG_PATH = path.join(process.cwd(), 'emoji-config.json');

// 테스트할 이모지 카테고리별 목록
const EMOJI_TEST_SET = {
  // 기본 이모지 (대부분 정상 동작)
  basic: [
    '🎓', '📊', '📈', '📉', '🔔', '👤', '🔍', '📋',
    '💡', '📌', '🤖', '💼', '📰', '🚀', '✨', '🎯',
    '🔴', '🟡', '🟢', '🔵', '🟠', '🟣', '⬛', '⬜',
  ],

  // Variation Selector (U+FE0F) 포함 - 문제 가능성 높음
  variationSelector: [
    '⚙️', '✏️', '✒️', '❤️', '☀️', '☁️', '☂️', '⛅',
    '⚡', '❄️', '☃️', '⭐', '✴️', '❇️', '⁉️', '‼️',
    'ℹ️', '✉️', '☎️', '⏰', '⌚', '⏳', '⏱️', '⏲️',
  ],

  // Keycap 이모지 (숫자 + FE0F + 20E3) - 문제 가능성 매우 높음
  keycap: [
    '0️⃣', '1️⃣', '2️⃣', '3️⃣', '4️⃣', '5️⃣', '6️⃣', '7️⃣', '8️⃣', '9️⃣',
    '#️⃣', '*️⃣',
  ],

  // 기호 이모지 - wcwidth가 1로 계산하는 경우가 많음
  symbols: [
    '⭐', '⚪', '⚫', '▲', '▼', '◀', '▶', '◆', '◇',
    '★', '☆', '♠', '♣', '♥', '♦', '✓', '✗', '✔', '✘',
  ],

  // 화폐/특수문자
  currency: [
    '₩', '¥', '€', '£', '$', '₿',
  ],

  // 플래그 이모지 (2개 Regional Indicator가 합쳐진 형태)
  flags: [
    '🇰🇷', '🇺🇸', '🇯🇵', '🇨🇳',
  ],

  // 스킨톤/ZWJ 이모지 (복잡한 조합)
  complex: [
    '👨‍💻', '👩‍💼', '👨‍👩‍👧', '🧑‍🤝‍🧑',
  ],

  // UI/설정 관련 이모지
  uiSettings: [
    '🌙', '🔊', '🔤', '💧', '🌐', '💝', '🔒', '🔓',
    '📱', '💻', '🖥️', '⌨️', '🖱️', '🔋', '📶', '📡',
    '🎨', '🎵', '🎬', '📷', '🔔', '🔕', '📧', '💬',
  ],
};

interface EmojiInfo {
  emoji: string;
  category: string;
  codePoints: string[];
  wcwidthValue: number;
  actualWidth: number | null;
  correction: number;
  hasVariationSelector: boolean;
  isKeycap: boolean;
}

interface CalibrationResult {
  timestamp: string;
  terminal: string;
  emojis: Record<string, EmojiInfo>;
  corrections: Record<string, number>;
  summary: {
    total: number;
    needsCorrection: number;
    correctionRules: CorrectionRule[];
  };
}

interface CorrectionRule {
  type: string;
  description: string;
  pattern?: string;
  correction: number;
  examples: string[];
}

// 이모지 정보 분석
function analyzeEmoji(emoji: string, category: string): EmojiInfo {
  const codePoints = [...emoji].map(c =>
    'U+' + c.codePointAt(0)!.toString(16).toUpperCase().padStart(4, '0')
  );

  const hasVariationSelector = codePoints.some(cp => cp === 'U+FE0F');
  const isKeycap = codePoints.some(cp => cp === 'U+20E3');

  return {
    emoji,
    category,
    codePoints,
    wcwidthValue: wcwidth(emoji),
    actualWidth: null, // 측정 후 설정
    correction: 0,
    hasVariationSelector,
    isKeycap,
  };
}

// ANSI 이스케이프 시퀀스로 커서 위치 측정
async function measureCursorPosition(): Promise<{ row: number; col: number }> {
  return new Promise((resolve, reject) => {
    const timeout = setTimeout(() => {
      reject(new Error('Cursor position query timeout'));
    }, 1000);

    // stdin을 raw mode로 설정
    if (process.stdin.isTTY) {
      process.stdin.setRawMode(true);
    }
    process.stdin.resume();

    let response = '';

    const onData = (data: Buffer) => {
      response += data.toString();

      // 응답 형식: \x1b[row;colR
      const match = response.match(/\x1b\[(\d+);(\d+)R/);
      if (match) {
        clearTimeout(timeout);
        process.stdin.removeListener('data', onData);
        if (process.stdin.isTTY) {
          process.stdin.setRawMode(false);
        }
        process.stdin.pause();
        resolve({ row: parseInt(match[1]), col: parseInt(match[2]) });
      }
    };

    process.stdin.on('data', onData);

    // 커서 위치 요청
    process.stdout.write('\x1b[6n');
  });
}

// 단일 이모지의 실제 너비 측정
async function measureEmojiWidth(emoji: string): Promise<number> {
  // 1. 커서를 줄 시작으로 이동
  process.stdout.write('\r');

  // 2. 시작 위치 측정
  const startPos = await measureCursorPosition();

  // 3. 이모지 출력
  process.stdout.write(emoji);

  // 4. 끝 위치 측정
  const endPos = await measureCursorPosition();

  // 5. 줄 지우기
  process.stdout.write('\r\x1b[K');

  return endPos.col - startPos.col;
}

// 대화형 캘리브레이션 (자동 측정 실패 시 사용)
async function interactiveCalibration(emojis: EmojiInfo[]): Promise<void> {
  const rl = readline.createInterface({
    input: process.stdin,
    output: process.stdout,
  });

  const question = (prompt: string): Promise<string> => {
    return new Promise(resolve => rl.question(prompt, resolve));
  };

  console.log('\n╔════════════════════════════════════════════════════════════╗');
  console.log('║          대화형 이모지 캘리브레이션                        ║');
  console.log('╠════════════════════════════════════════════════════════════╣');
  console.log('║  아래 테스트에서 우측 │가 정렬되어 있는지 확인해주세요.   ║');
  console.log('║  정렬되어 있으면 Y, 아니면 N을 입력하세요.                 ║');
  console.log('╚════════════════════════════════════════════════════════════╝\n');

  for (const info of emojis) {
    // wcwidth 값 기준으로 테스트 라인 생성
    const testWidth = 20;
    const wcw = info.wcwidthValue;
    const padWcwidth = ' '.repeat(Math.max(0, testWidth - wcw - 1));

    console.log('┌' + '─'.repeat(testWidth) + '┐');
    console.log('│ 기준선 (영문)      │');
    console.log('│ ' + info.emoji + padWcwidth + '│ ← 이 줄 확인');
    console.log('└' + '─'.repeat(testWidth) + '┘');

    const answer = await question(`${info.emoji} (${info.codePoints.join(' ')}) 정렬 맞나요? (Y/N/숫자): `);

    if (answer.toLowerCase() === 'n') {
      // 실제 너비가 더 크다고 가정 (가장 흔한 케이스)
      info.actualWidth = wcw + 1;
      info.correction = 1;
    } else if (answer.toLowerCase() === 'y') {
      info.actualWidth = wcw;
      info.correction = 0;
    } else {
      // 숫자 직접 입력
      const num = parseInt(answer);
      if (!isNaN(num)) {
        info.actualWidth = num;
        info.correction = num - wcw;
      }
    }

    console.log(`  → wcwidth: ${wcw}, 실제: ${info.actualWidth}, 보정: ${info.correction}\n`);
  }

  rl.close();
}

// 자동 캘리브레이션 시도
async function autoCalibration(emojis: EmojiInfo[]): Promise<boolean> {
  console.log('\n🔍 자동 캘리브레이션 시도 중...\n');

  try {
    for (const info of emojis) {
      const actualWidth = await measureEmojiWidth(info.emoji);
      info.actualWidth = actualWidth;
      info.correction = actualWidth - info.wcwidthValue;

      const status = info.correction === 0 ? '✅' : `⚠️  보정 필요: +${info.correction}`;
      console.log(`  ${info.emoji}  wcwidth: ${info.wcwidthValue}, 실제: ${actualWidth} ${status}`);
    }
    return true;
  } catch (error) {
    console.log('\n⚠️  자동 측정 실패. 대화형 모드로 전환합니다.\n');
    return false;
  }
}

// 보정 규칙 생성
function generateCorrectionRules(emojis: EmojiInfo[]): CorrectionRule[] {
  const rules: CorrectionRule[] = [];

  // 1. Keycap 이모지 규칙
  const keycaps = emojis.filter(e => e.isKeycap && e.correction !== 0);
  if (keycaps.length > 0) {
    const avgCorrection = Math.round(keycaps.reduce((s, e) => s + e.correction, 0) / keycaps.length);
    rules.push({
      type: 'keycap',
      description: 'Keycap 이모지 (숫자 + FE0F + 20E3)',
      pattern: 'U+FE0F U+20E3',
      correction: avgCorrection,
      examples: keycaps.slice(0, 3).map(e => e.emoji),
    });
  }

  // 2. Variation Selector 규칙
  const vsEmojis = emojis.filter(e => e.hasVariationSelector && !e.isKeycap && e.correction !== 0);
  if (vsEmojis.length > 0) {
    const avgCorrection = Math.round(vsEmojis.reduce((s, e) => s + e.correction, 0) / vsEmojis.length);
    rules.push({
      type: 'variationSelector',
      description: 'Variation Selector 포함 이모지 (U+FE0F)',
      pattern: 'U+FE0F',
      correction: avgCorrection,
      examples: vsEmojis.slice(0, 3).map(e => e.emoji),
    });
  }

  // 3. 개별 이모지 규칙 (특수 케이스)
  const specialEmojis = emojis.filter(e =>
    !e.isKeycap && !e.hasVariationSelector && e.correction !== 0
  );
  if (specialEmojis.length > 0) {
    rules.push({
      type: 'special',
      description: '특수 기호 이모지 (wcwidth 계산 불일치)',
      correction: 1, // 대부분 1칸 차이
      examples: specialEmojis.slice(0, 5).map(e => e.emoji),
    });
  }

  return rules;
}

// 설정 파일 생성
function generateConfig(result: CalibrationResult, saveGlobal: boolean): string {
  let configPath: string;

  if (saveGlobal) {
    // 전역 설정 디렉토리 생성
    if (!fs.existsSync(GLOBAL_CONFIG_DIR)) {
      fs.mkdirSync(GLOBAL_CONFIG_DIR, { recursive: true });
    }
    configPath = GLOBAL_CONFIG_PATH;
  } else {
    configPath = LOCAL_CONFIG_PATH;
  }

  fs.writeFileSync(configPath, JSON.stringify(result, null, 2), 'utf-8');
  console.log(`\n✅ 설정 파일 생성: ${configPath}`);
  return configPath;
}

// TypeScript 보정 함수 코드 생성
function generateCorrectionCode(result: CalibrationResult): string {
  const { corrections, summary } = result;

  // 보정이 필요한 이모지들을 Set으로 만들기
  const needsCorrection = Object.entries(corrections)
    .filter(([_, v]) => v !== 0)
    .map(([k, v]) => ({ emoji: k, correction: v }));

  let code = `
// 자동 생성된 이모지 보정 맵 (${result.timestamp})
// 터미널: ${result.terminal}
const EMOJI_CORRECTIONS: Map<string, number> = new Map([
${needsCorrection.map(({ emoji, correction }) =>
  `  ['${emoji}', ${correction}],  // ${[...emoji].map(c => 'U+' + c.codePointAt(0)!.toString(16).toUpperCase().padStart(4, '0')).join(' ')}`
).join('\n')}
]);

// 보정 규칙
const CORRECTION_RULES = {
${summary.correctionRules.map(rule =>
  `  ${rule.type}: { correction: ${rule.correction}, pattern: '${rule.pattern || ''}' },`
).join('\n')}
};
`;

  return code;
}

// 저장 위치 선택 (대화형)
async function selectSaveLocation(): Promise<boolean> {
  const rl = readline.createInterface({
    input: process.stdin,
    output: process.stdout,
  });

  return new Promise((resolve) => {
    console.log('\n📍 설정 파일 저장 위치를 선택하세요:');
    console.log(`  1) 전역 설정 (${GLOBAL_CONFIG_PATH})`);
    console.log(`  2) 로컬 설정 (${LOCAL_CONFIG_PATH})`);

    rl.question('입력 (1 or 2): ', (answer) => {
      rl.close();
      resolve(answer.trim() === '1');
    });
  });
}

// 메인 실행
async function main() {
  const args = process.argv.slice(2);
  const isAuto = args.includes('--auto');
  const isQuiet = args.includes('--quiet');
  const forceGlobal = args.includes('--global');
  const forceLocal = args.includes('--local');

  console.log('╔════════════════════════════════════════════════════════════╗');
  console.log('║       🎨 이모지 캘리브레이션 도구 v1.0                     ║');
  console.log('║       터미널 환경에 맞는 이모지 너비 보정값 측정           ║');
  console.log('╚════════════════════════════════════════════════════════════╝');

  // 모든 이모지 분석
  const allEmojis: EmojiInfo[] = [];

  for (const [category, emojiList] of Object.entries(EMOJI_TEST_SET)) {
    for (const emoji of emojiList) {
      allEmojis.push(analyzeEmoji(emoji, category));
    }
  }

  console.log(`\n📊 총 ${allEmojis.length}개 이모지 분석 예정\n`);

  // 카테고리별 통계 출력
  if (!isQuiet) {
    console.log('카테고리별 이모지 수:');
    for (const [category, emojiList] of Object.entries(EMOJI_TEST_SET)) {
      console.log(`  ${category}: ${emojiList.length}개`);
    }
  }

  // 캘리브레이션 실행
  let success = false;

  if (isAuto) {
    success = await autoCalibration(allEmojis);
  }

  if (!success) {
    // 자동 실패 또는 --auto 미지정 시 대화형 모드
    // 문제가 될 가능성이 높은 이모지만 선별
    const problemCandidates = allEmojis.filter(e =>
      e.isKeycap || e.hasVariationSelector ||
      ['⭐', '⚪', '⚫', '✓', '✗', '✔', '✘'].includes(e.emoji)
    );

    console.log(`\n🔎 문제 가능성이 높은 ${problemCandidates.length}개 이모지 확인\n`);

    await interactiveCalibration(problemCandidates);

    // 나머지는 wcwidth 값을 그대로 사용
    for (const info of allEmojis) {
      if (info.actualWidth === null) {
        info.actualWidth = info.wcwidthValue;
        info.correction = 0;
      }
    }
  }

  // 결과 생성
  const corrections: Record<string, number> = {};
  const emojiInfoMap: Record<string, EmojiInfo> = {};

  for (const info of allEmojis) {
    emojiInfoMap[info.emoji] = info;
    if (info.correction !== 0) {
      corrections[info.emoji] = info.correction;
    }
  }

  const rules = generateCorrectionRules(allEmojis);

  const result: CalibrationResult = {
    timestamp: new Date().toISOString(),
    terminal: process.env.TERM || 'unknown',
    emojis: emojiInfoMap,
    corrections,
    summary: {
      total: allEmojis.length,
      needsCorrection: Object.keys(corrections).length,
      correctionRules: rules,
    },
  };

  // 결과 출력
  console.log('\n' + '═'.repeat(60));
  console.log('📋 캘리브레이션 결과');
  console.log('═'.repeat(60));
  console.log(`총 이모지: ${result.summary.total}개`);
  console.log(`보정 필요: ${result.summary.needsCorrection}개`);

  if (rules.length > 0) {
    console.log('\n보정 규칙:');
    for (const rule of rules) {
      console.log(`  [${rule.type}] ${rule.description}`);
      console.log(`    보정값: +${rule.correction}, 예시: ${rule.examples.join(' ')}`);
    }
  }

  // 저장 위치 결정
  let saveGlobal: boolean;
  if (forceGlobal) {
    saveGlobal = true;
  } else if (forceLocal) {
    saveGlobal = false;
  } else {
    // 대화형으로 선택
    saveGlobal = await selectSaveLocation();
  }

  // 설정 파일 저장
  const savedPath = generateConfig(result, saveGlobal);

  // 보정 코드 생성 (설정 파일과 같은 위치에)
  const correctionCode = generateCorrectionCode(result);
  const codeDir = path.dirname(savedPath);
  const codePath = path.join(codeDir, 'emoji-corrections.ts');
  fs.writeFileSync(codePath, correctionCode, 'utf-8');
  console.log(`✅ 보정 코드 생성: ${codePath}`);

  console.log('\n🎉 캘리브레이션 완료!');
  console.log(`\n💡 사용법:`);
  console.log(`   --global : 전역 설정으로 저장`);
  console.log(`   --local  : 로컬 설정으로 저장`);
  console.log(`   --auto   : 자동 측정 모드\n`);
}

// 간단 테스트 모드 (setup.sh에서 호출)
export async function quickTest(): Promise<{ needsCalibration: boolean; problems: string[] }> {
  const testEmojis = ['⚙️', '⭐', '1️⃣', '⚪'];
  const problems: string[] = [];

  for (const emoji of testEmojis) {
    const info = analyzeEmoji(emoji, 'test');
    // wcwidth가 1인데 Variation Selector나 Keycap이면 문제 가능성 높음
    if (info.wcwidthValue === 1 && (info.hasVariationSelector || info.isKeycap)) {
      problems.push(emoji);
    }
  }

  return {
    needsCalibration: problems.length > 0,
    problems,
  };
}

// CLI 실행
if (process.argv[1].includes('emoji-calibration')) {
  main().catch(console.error);
}
