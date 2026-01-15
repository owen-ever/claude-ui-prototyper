import { Server } from "@modelcontextprotocol/sdk/server/index.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import {
  CallToolRequestSchema,
  ListToolsRequestSchema,
} from "@modelcontextprotocol/sdk/types.js";
import wcwidth from "wcwidth";
import * as fs from "fs";
import * as path from "path";
import { fileURLToPath } from "url";

// ESM에서 __dirname 대체
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// ============================================
// 이모지 보정 설정 로드
// ============================================

interface EmojiConfig {
  corrections: Record<string, number>;
  summary: {
    correctionRules: Array<{
      type: string;
      correction: number;
      pattern?: string;
    }>;
  };
}

// 기본 보정 맵 (캘리브레이션 없이도 동작)
const DEFAULT_EMOJI_CORRECTIONS: Map<string, number> = new Map([
  // Keycap 이모지
  ["0️⃣", 1],
  ["1️⃣", 1],
  ["2️⃣", 1],
  ["3️⃣", 1],
  ["4️⃣", 1],
  ["5️⃣", 1],
  ["6️⃣", 1],
  ["7️⃣", 1],
  ["8️⃣", 1],
  ["9️⃣", 1],
  ["#️⃣", 1],
  ["*️⃣", 1],
  // Variation Selector 포함
  ["⚙️", 1],
  ["✏️", 1],
  ["✒️", 1],
  ["❤️", 1],
  ["☀️", 1],
  ["☁️", 1],
  ["☂️", 1],
  ["⚡", 1],
  ["❄️", 1],
  ["☃️", 1],
  ["✴️", 1],
  ["❇️", 1],
  ["⁉️", 1],
  ["‼️", 1],
  // 특수 기호 (wcwidth가 1로 계산하지만 실제론 2)
  ["⭐", 1],
  ["⚪", 1],
  ["⚫", 1],
  // 추가 Variation Selector 포함 이모지
  ["ℹ️", 1],
  ["✉️", 1],
  ["☎️", 1],
  ["⏱️", 1],
  ["⏲️", 1],
  ["⌨️", 1],
  // 화살표/기호 (터미널에 따라 2칸으로 렌더링)
  ["▲", 1],
  ["▼", 1],
  ["◀", 1],
  ["▶", 1],
  ["△", 1],
  ["▽", 1],
  // 통화 기호
  ["₩", 1],
]);

// 전역 설정 디렉토리 경로
const GLOBAL_CONFIG_DIR = path.join(
  process.env.HOME || process.env.USERPROFILE || "~",
  ".config",
  "ui-prototyper"
);
const GLOBAL_CONFIG_PATH = path.join(GLOBAL_CONFIG_DIR, "emoji-config.json");
const LOCAL_CONFIG_PATH = path.join(__dirname, "emoji-config.json");

// 외부 설정 파일에서 보정값 로드 (우선순위: 전역 > 로컬 > 기본값)
function loadEmojiConfig(): Map<string, number> {
  // 설정 파일 경로 우선순위
  const configPaths = [
    GLOBAL_CONFIG_PATH, // 1. 전역 설정 (~/.config/ui-prototyper/)
    LOCAL_CONFIG_PATH, // 2. 로컬 설정 (프로젝트 디렉토리)
  ];

  for (const configPath of configPaths) {
    try {
      if (fs.existsSync(configPath)) {
        const configData = fs.readFileSync(configPath, "utf-8");
        const config: EmojiConfig = JSON.parse(configData);

        const corrections = new Map<string, number>();
        for (const [emoji, correction] of Object.entries(config.corrections)) {
          corrections.set(emoji, correction);
        }

        // 로드된 설정 파일 위치 기록 (디버깅용)
        // console.error(`[ui-prototyper] 이모지 설정 로드: ${configPath}`);
        return corrections;
      }
    } catch (error) {
      // 해당 경로 실패 시 다음 경로 시도
      continue;
    }
  }

  // 모든 설정 파일 없으면 기본값 사용
  return DEFAULT_EMOJI_CORRECTIONS;
}

// 보정 맵 초기화
const EMOJI_CORRECTIONS = loadEmojiConfig();

// 1. 서버 인스턴스 생성
const server = new Server(
  {
    name: "ui-prototyper",
    version: "2.0.0",
  },
  {
    capabilities: {
      tools: {},
    },
  }
);

// ============================================
// 핵심 유틸리티 함수들
// ============================================

// 시각적 너비 계산 (이모지 보정 적용)
function getVisualWidth(text: string): number {
  // 빈 문자열 처리
  if (!text) return 0;

  let totalWidth = 0;
  const chars = [...text]; // 유니코드 코드포인트 단위로 분리

  let i = 0;
  while (i < chars.length) {
    const char = chars[i];
    const code = char.codePointAt(0)!;

    // 다음 문자들 확인
    const nextChar = chars[i + 1];
    const thirdChar = chars[i + 2];

    // Variation Selector-16 (U+FE0F) 체크
    const hasVS16 = nextChar && nextChar.codePointAt(0) === 0xfe0f;

    // Keycap 이모지 체크 (문자 + FE0F + 20E3)
    const isKeycap =
      hasVS16 && thirdChar && thirdChar.codePointAt(0) === 0x20e3;

    if (isKeycap) {
      // Keycap 이모지: 3문자가 하나의 그래핌으로 합쳐짐
      const keycapEmoji = char + nextChar + thirdChar;

      // 보정 맵에서 확인
      const correction = EMOJI_CORRECTIONS.get(keycapEmoji) ?? 1;
      totalWidth += wcwidth(keycapEmoji) + correction;
      i += 3;
    } else if (hasVS16) {
      // Variation Selector가 붙은 문자
      const vsEmoji = char + nextChar;

      // 보정 맵에서 확인, 없으면 기본 +1 보정
      const correction = EMOJI_CORRECTIONS.get(vsEmoji) ?? 1;
      totalWidth += wcwidth(vsEmoji) + correction;
      i += 2;
    } else {
      // 단일 문자 또는 일반 이모지
      // 보정 맵에서 확인
      if (EMOJI_CORRECTIONS.has(char)) {
        totalWidth += wcwidth(char) + EMOJI_CORRECTIONS.get(char)!;
      } else {
        totalWidth += wcwidth(char);
      }
      i += 1;
    }
  }

  return totalWidth;
}

// 시각적 너비 기준으로 텍스트 자르기
function truncateByVisualWidth(text: string, maxWidth: number): string {
  if (!text) return "";

  const chars = [...text];
  let result = "";
  let currentWidth = 0;

  for (let i = 0; i < chars.length; i++) {
    const char = chars[i];
    const code = char.codePointAt(0)!;

    // 다음 문자들 확인 (이모지 조합 처리)
    const nextChar = chars[i + 1];
    const thirdChar = chars[i + 2];
    const hasVS16 = nextChar && nextChar.codePointAt(0) === 0xfe0f;
    const isKeycap =
      hasVS16 && thirdChar && thirdChar.codePointAt(0) === 0x20e3;

    let charWidth: number;
    let charsToAdd: string;

    if (isKeycap) {
      // Keycap 이모지: 3문자 조합
      charsToAdd = char + nextChar + thirdChar;
      const correction = EMOJI_CORRECTIONS.get(charsToAdd) ?? 1;
      charWidth = wcwidth(charsToAdd) + correction;
      i += 2; // 추가 2문자 스킵
    } else if (hasVS16) {
      // Variation Selector 포함 이모지
      charsToAdd = char + nextChar;
      const correction = EMOJI_CORRECTIONS.get(charsToAdd) ?? 1;
      charWidth = wcwidth(charsToAdd) + correction;
      i += 1; // 추가 1문자 스킵
    } else {
      // 단일 문자
      charsToAdd = char;
      if (EMOJI_CORRECTIONS.has(char)) {
        charWidth = wcwidth(char) + EMOJI_CORRECTIONS.get(char)!;
      } else {
        charWidth = wcwidth(char);
      }
    }

    // 너비 초과 체크
    if (currentWidth + charWidth > maxWidth) {
      break;
    }

    result += charsToAdd;
    currentWidth += charWidth;
  }

  return result;
}

// 텍스트 패딩
function padText(
  text: string,
  targetWidth: number,
  align: "left" | "right" | "center" = "left"
): string {
  const currentWidth = getVisualWidth(text);
  const padding = targetWidth - currentWidth;

  // 너비 초과 시 시각적 너비 기준으로 자르고, 남은 공간 채움
  if (padding < 0) {
    const truncated = truncateByVisualWidth(text, targetWidth);
    const truncatedWidth = getVisualWidth(truncated);
    const remainingPadding = targetWidth - truncatedWidth;
    // 잘린 후 남은 공간을 공백으로 채움 (2칸 문자 경계에서 1칸 부족할 수 있음)
    return truncated + " ".repeat(Math.max(0, remainingPadding));
  }

  switch (align) {
    case "right":
      return " ".repeat(padding) + text;
    case "center":
      const leftPad = Math.floor(padding / 2);
      return " ".repeat(leftPad) + text + " ".repeat(padding - leftPad);
    default:
      return text + " ".repeat(padding);
  }
}

// 박스 생성
function createBox(title: string, lines: string[], width: number): string {
  const innerWidth = width - 4;
  const topBorder = "─".repeat(
    Math.max(0, width - 2 - getVisualWidth(title) - 3)
  );
  let result = `┌─ ${title} ${topBorder}┐\n`;

  for (const line of lines) {
    result += `│ ${padText(line, innerWidth, "left")} │\n`;
  }

  result += `└${"─".repeat(width - 2)}┘`;
  return result;
}

// 테이블 행 생성
function createTableRow(columns: string[], widths: number[]): string {
  const paddedCols = columns.map((col, i) =>
    padText(col, widths[i] || 10, "left")
  );
  return "│ " + paddedCols.join(" │ ") + " │";
}

// 테이블 구분선 생성
function createTableSeparator(
  widths: number[],
  style: "top" | "middle" | "bottom" = "middle"
): string {
  const chars = {
    top: { left: "┌", mid: "┬", right: "┐", line: "─" },
    middle: { left: "├", mid: "┼", right: "┤", line: "─" },
    bottom: { left: "└", mid: "┴", right: "┘", line: "─" },
  };
  const c = chars[style];
  const segments = widths.map((w) => c.line.repeat(w + 2));
  return c.left + segments.join(c.mid) + c.right;
}

// 여러 박스를 가로로 결합
function combineHorizontal(boxes: string[], gap: number = 2): string {
  // 각 박스의 라인을 분리하고 trailing whitespace 제거
  const boxLines = boxes.map((box) =>
    box.split("\n").map((line) => line.trimEnd())
  );
  const maxLines = Math.max(...boxLines.map((lines) => lines.length), 0);

  // 각 박스의 최대 너비 계산 (trimmed 기준)
  const boxWidths = boxLines.map((lines) =>
    Math.max(...lines.map((line) => getVisualWidth(line)), 0)
  );

  const result: string[] = [];
  const gapStr = " ".repeat(gap);

  for (let i = 0; i < maxLines; i++) {
    const rowParts: string[] = [];
    for (let j = 0; j < boxLines.length; j++) {
      const line = boxLines[j][i] || "";
      rowParts.push(padText(line, boxWidths[j], "left"));
    }
    result.push(rowParts.join(gapStr));
  }

  return result.join("\n");
}

// 외곽 프레임으로 감싸기
function wrapFrame(content: string, width: number, title?: string): string {
  const lines = content.split("\n");

  // 각 라인의 trailing whitespace 제거 후 너비 계산
  const trimmedLines = lines.map((line) => line.trimEnd());

  // 내부 콘텐츠의 최대 시각적 너비 계산 (trimmed 기준)
  const maxContentWidth = Math.max(
    ...trimmedLines.map((line) => getVisualWidth(line)),
    0
  );

  // 필요한 최소 프레임 너비 계산 (콘텐츠 + 양쪽 │ + 공백 = 4)
  const minRequiredWidth = maxContentWidth + 4;

  // 지정된 width와 필요한 너비 중 큰 값 사용
  const actualWidth = Math.max(width, minRequiredWidth);
  const innerWidth = actualWidth - 4;

  let result = "";

  if (title) {
    const titleBorder = "─".repeat(
      Math.max(0, actualWidth - 2 - getVisualWidth(title) - 3)
    );
    result += `┌─ ${title} ${titleBorder}┐\n`;
  } else {
    result += `┌${"─".repeat(actualWidth - 2)}┐\n`;
  }

  // trimmed 라인을 innerWidth에 맞춰 패딩
  for (const line of trimmedLines) {
    result += `│ ${padText(line, innerWidth, "left")} │\n`;
  }

  result += `└${"─".repeat(actualWidth - 2)}┘`;
  return result;
}

// ============================================
// 배치 렌더링 - 컴포넌트 타입 정의
// ============================================

interface PadTextComponent {
  type: "pad_text";
  text: string;
  width: number;
  align?: "left" | "right" | "center";
}

interface BoxComponent {
  type: "box";
  title: string;
  lines: string[];
  width?: number;
}

interface TableRowComponent {
  type: "table_row";
  columns: string[];
  widths: number[];
}

interface TableSeparatorComponent {
  type: "table_separator";
  widths: number[];
  style?: "top" | "middle" | "bottom";
}

interface CombineHorizontalComponent {
  type: "combine_horizontal";
  items: number[]; // 결과 인덱스 참조
  gap?: number;
}

interface WrapFrameComponent {
  type: "wrap_frame";
  contentIndex: number; // 결과 인덱스 참조
  width: number;
  title?: string;
}

interface RawTextComponent {
  type: "raw";
  text: string;
}

type UIComponent =
  | PadTextComponent
  | BoxComponent
  | TableRowComponent
  | TableSeparatorComponent
  | CombineHorizontalComponent
  | WrapFrameComponent
  | RawTextComponent;

// 배치 렌더링 함수
function batchRender(components: UIComponent[]): string[] {
  const results: string[] = [];

  for (const comp of components) {
    switch (comp.type) {
      case "pad_text":
        results.push(padText(comp.text, comp.width, comp.align || "left"));
        break;

      case "box":
        results.push(createBox(comp.title, comp.lines, comp.width || 40));
        break;

      case "table_row":
        results.push(createTableRow(comp.columns, comp.widths));
        break;

      case "table_separator":
        results.push(createTableSeparator(comp.widths, comp.style || "middle"));
        break;

      case "combine_horizontal": {
        const boxes = comp.items.map((idx) => results[idx] || "");
        results.push(combineHorizontal(boxes, comp.gap || 2));
        break;
      }

      case "wrap_frame": {
        const content = results[comp.contentIndex] || "";
        results.push(wrapFrame(content, comp.width, comp.title));
        break;
      }

      case "raw":
        results.push(comp.text);
        break;
    }
  }

  return results;
}

// 가이드라인 생성
function generateGuidelines(
  requirements: string,
  concept: string,
  width: number
): string {
  const keywords = requirements.toLowerCase();
  const suggestedSections: string[] = [];

  if (
    keywords.includes("헤더") ||
    keywords.includes("header") ||
    keywords.includes("네비게이션") ||
    keywords.includes("로고")
  ) {
    suggestedSections.push("헤더 (로고, 네비게이션, 사용자 정보)");
  }
  if (
    keywords.includes("사이드바") ||
    keywords.includes("sidebar") ||
    keywords.includes("메뉴")
  ) {
    suggestedSections.push("사이드바 (메뉴 항목, 아이콘)");
  }
  if (
    keywords.includes("대시보드") ||
    keywords.includes("dashboard") ||
    keywords.includes("지표") ||
    keywords.includes("통계")
  ) {
    suggestedSections.push("대시보드 지표 카드 (숫자, 변화율, 아이콘)");
  }
  if (
    keywords.includes("테이블") ||
    keywords.includes("table") ||
    keywords.includes("목록") ||
    keywords.includes("리스트")
  ) {
    suggestedSections.push("데이터 테이블 (헤더, 행, 정렬)");
  }
  if (
    keywords.includes("차트") ||
    keywords.includes("chart") ||
    keywords.includes("그래프")
  ) {
    suggestedSections.push("차트 영역 (ASCII 그래프)");
  }
  if (
    keywords.includes("폼") ||
    keywords.includes("form") ||
    keywords.includes("입력") ||
    keywords.includes("검색")
  ) {
    suggestedSections.push("입력 폼 (텍스트 필드, 버튼)");
  }
  if (keywords.includes("카드") || keywords.includes("card")) {
    suggestedSections.push("카드 컴포넌트 (제목, 내용, 액션)");
  }
  if (keywords.includes("푸터") || keywords.includes("footer")) {
    suggestedSections.push("푸터 (저작권, 링크)");
  }

  if (suggestedSections.length === 0) {
    suggestedSections.push("헤더 영역", "메인 콘텐츠 영역", "푸터 영역");
  }

  const sectionsText = suggestedSections
    .map((s, i) => `   ${i + 1}. ${s}`)
    .join("\n");

  return `## 🎨 UI 프로토타입 가이드라인

### 📋 요구사항 분석
${requirements}

### 🎯 디자인 컨셉
${concept}

### 📐 레이아웃 기본 규칙

**너비 설정: ${width}자**

| 문자 유형 | 너비 | 예시 |
|-----------|------|------|
| 영문/숫자/기본기호 | 1칸 | a, 1, -, = |
| 한글 | 2칸 | 가, 나, 다 |
| 이모지 | 2칸 | 📊, ✨, 🚀 |
| 박스 문자 | 1칸 | ─, │, ┌, ┐ |

### 🧱 권장 섹션 구조
${sectionsText}

### 🔧 사용 가능한 도구

**batch_render** 도구를 사용하면 한 번의 호출로 모든 컴포넌트를 생성할 수 있습니다.

컴포넌트 타입:
- **box**: 박스/카드 { type: "box", title, lines, width }
- **table_row**: 테이블 행 { type: "table_row", columns, widths }
- **table_separator**: 구분선 { type: "table_separator", widths, style }
- **combine_horizontal**: 가로 결합 { type: "combine_horizontal", items: [인덱스], gap }
- **wrap_frame**: 프레임 감싸기 { type: "wrap_frame", contentIndex, width, title }
- **pad_text**: 텍스트 패딩 { type: "pad_text", text, width, align }
- **raw**: 원본 텍스트 { type: "raw", text }

### ✅ batch_render를 활용하여 한 번에 UI를 생성하세요!`;
}

// ============================================
// 도구 등록
// ============================================

server.setRequestHandler(ListToolsRequestSchema, async () => ({
  tools: [
    {
      name: "create_ui_prototype",
      description: `[필수 사용] 사용자가 UI, 화면, 대시보드, 인터페이스, 와이어프레임, 레이아웃 설계를 요청하면 반드시 이 도구를 먼저 호출하세요.

이 도구는:
1. 요구사항을 분석하여 UI 구조화 가이드라인을 제공합니다
2. 한글/이모지의 시각적 너비를 고려한 레이아웃 규칙을 안내합니다
3. 호출 후 batch_render 도구를 사용하여 한 번에 모든 컴포넌트를 생성하세요

트리거 키워드: UI, 화면, 대시보드, 프로토타입, 레이아웃, 인터페이스, 와이어프레임, 목업, 스케치`,
      inputSchema: {
        type: "object",
        properties: {
          requirements: {
            type: "string",
            description: "UI에 포함될 모든 요소와 기능을 상세히 기술",
          },
          concept: {
            type: "string",
            description: "디자인 컨셉 또는 스타일",
          },
          width: {
            type: "number",
            description: "UI 전체 너비 (기본값: 80)",
          },
        },
        required: ["requirements"],
      },
    },
    {
      name: "batch_render",
      description: `[핵심 도구] 여러 UI 컴포넌트를 한 번에 생성합니다. 한 번의 호출로 모든 컴포넌트를 렌더링합니다.

컴포넌트 타입:
1. box: { type: "box", title: string, lines: string[], width?: number }
2. table_row: { type: "table_row", columns: string[], widths: number[] }
3. table_separator: { type: "table_separator", widths: number[], style?: "top"|"middle"|"bottom" }
4. combine_horizontal: { type: "combine_horizontal", items: number[], gap?: number }
   - items는 이전 결과의 인덱스 배열 (0부터 시작)
5. wrap_frame: { type: "wrap_frame", contentIndex: number, width: number, title?: string }
6. pad_text: { type: "pad_text", text: string, width: number, align?: "left"|"right"|"center" }
7. raw: { type: "raw", text: string }

반환: 각 컴포넌트의 렌더링 결과 배열`,
      inputSchema: {
        type: "object",
        properties: {
          components: {
            type: "array",
            description: "렌더링할 컴포넌트 배열",
            items: {
              type: "object",
              properties: {
                type: {
                  type: "string",
                  enum: [
                    "box",
                    "table_row",
                    "table_separator",
                    "combine_horizontal",
                    "wrap_frame",
                    "pad_text",
                    "raw",
                  ],
                },
              },
              required: ["type"],
            },
          },
          returnIndex: {
            type: "number",
            description: "최종 반환할 결과의 인덱스 (미지정시 모든 결과 반환)",
          },
        },
        required: ["components"],
      },
    },
    {
      name: "pad_text",
      description: `텍스트를 지정된 시각적 너비에 맞게 패딩합니다. 한글(2칸), 이모지(2칸), 영문(1칸)을 정확히 계산합니다.

사용 예시:
- pad_text("안녕", 10, "left") → "안녕      " (안녕=4칸 + 공백6칸)
- pad_text("Hi", 10, "right") → "        Hi"
- pad_text("Test", 10, "center") → "   Test   "`,
      inputSchema: {
        type: "object",
        properties: {
          text: { type: "string", description: "패딩할 텍스트" },
          width: { type: "number", description: "목표 시각적 너비" },
          align: {
            type: "string",
            enum: ["left", "right", "center"],
            description: "정렬 방향 (기본값: left)",
          },
        },
        required: ["text", "width"],
      },
    },
    {
      name: "create_box",
      description: `제목과 내용으로 정렬된 박스/카드 컴포넌트를 생성합니다. 모든 행이 정확히 정렬됩니다.

출력 예시:
┌─ 제목 ────────────┐
│ 내용 1행          │
│ 내용 2행          │
└───────────────────┘`,
      inputSchema: {
        type: "object",
        properties: {
          title: { type: "string", description: "박스 제목" },
          lines: {
            type: "array",
            items: { type: "string" },
            description: "박스 내용 (각 행)",
          },
          width: { type: "number", description: "박스 전체 너비 (기본값: 40)" },
        },
        required: ["title", "lines"],
      },
    },
    {
      name: "create_table_row",
      description: `컬럼 데이터로 정렬된 테이블 행을 생성합니다. 각 컬럼이 지정된 너비에 맞게 패딩됩니다.

사용 예시:
- columns: ["이름", "나이", "직업"], widths: [10, 5, 15]
- 출력: │ 이름       │ 나이  │ 직업            │`,
      inputSchema: {
        type: "object",
        properties: {
          columns: {
            type: "array",
            items: { type: "string" },
            description: "각 컬럼의 데이터",
          },
          widths: {
            type: "array",
            items: { type: "number" },
            description: "각 컬럼의 너비",
          },
        },
        required: ["columns", "widths"],
      },
    },
    {
      name: "create_table_separator",
      description: `테이블 구분선을 생성합니다. top(상단), middle(중간), bottom(하단) 스타일을 지원합니다.

출력 예시:
- top:    ┌──────┬──────┬──────┐
- middle: ├──────┼──────┼──────┤
- bottom: └──────┴──────┴──────┘`,
      inputSchema: {
        type: "object",
        properties: {
          widths: {
            type: "array",
            items: { type: "number" },
            description: "각 컬럼의 너비",
          },
          style: {
            type: "string",
            enum: ["top", "middle", "bottom"],
            description: "구분선 스타일 (기본값: middle)",
          },
        },
        required: ["widths"],
      },
    },
    {
      name: "combine_horizontal",
      description: `여러 텍스트 블록(박스, 테이블 등)을 가로로 결합합니다. 각 블록의 높이가 다르면 짧은 쪽에 빈 줄이 추가됩니다.

사용 예시:
- boxes: ["┌─박스1─┐\\n│내용  │\\n└──────┘", "┌─박스2─┐\\n│내용  │\\n└──────┘"]
- gap: 2
- 출력: 두 박스가 2칸 간격으로 나란히 배치됨`,
      inputSchema: {
        type: "object",
        properties: {
          boxes: {
            type: "array",
            items: { type: "string" },
            description: "결합할 텍스트 블록들",
          },
          gap: { type: "number", description: "블록 사이 간격 (기본값: 2)" },
        },
        required: ["boxes"],
      },
    },
    {
      name: "wrap_frame",
      description: `콘텐츠를 외곽 프레임으로 감쌉니다. 전체 레이아웃을 하나의 프레임 안에 넣을 때 사용합니다.

출력 예시:
┌─ 제목 ────────────────────────┐
│ (내부 콘텐츠가 여기에 들어감) │
│ ...                           │
└───────────────────────────────┘`,
      inputSchema: {
        type: "object",
        properties: {
          content: { type: "string", description: "프레임 안에 넣을 콘텐츠" },
          width: { type: "number", description: "프레임 전체 너비" },
          title: { type: "string", description: "프레임 제목 (선택)" },
        },
        required: ["content", "width"],
      },
    },
  ],
}));

// ============================================
// 도구 실행 핸들러
// ============================================

server.setRequestHandler(CallToolRequestSchema, async (request) => {
  const { name, arguments: args } = request.params;

  switch (name) {
    case "create_ui_prototype": {
      const requirements = String(args?.requirements || "");
      const concept = String(args?.concept || "모던 UI");
      const width = Number(args?.width) || 80;
      return {
        content: [
          {
            type: "text",
            text: generateGuidelines(requirements, concept, width),
          },
        ],
      };
    }

    case "batch_render": {
      const components = (args?.components as UIComponent[]) || [];
      const returnIndex = args?.returnIndex as number | undefined;
      const results = batchRender(components);

      if (returnIndex !== undefined && results[returnIndex]) {
        return { content: [{ type: "text", text: results[returnIndex] }] };
      }

      // 모든 결과를 인덱스와 함께 반환
      const output = results.map((r, i) => `[${i}]\n${r}`).join("\n\n");
      return { content: [{ type: "text", text: output }] };
    }

    case "pad_text": {
      const text = String(args?.text || "");
      const width = Number(args?.width) || 10;
      const align = (args?.align as "left" | "right" | "center") || "left";
      return { content: [{ type: "text", text: padText(text, width, align) }] };
    }

    case "create_box": {
      const title = String(args?.title || "");
      const lines = (args?.lines as string[]) || [];
      const width = Number(args?.width) || 40;
      return {
        content: [{ type: "text", text: createBox(title, lines, width) }],
      };
    }

    case "create_table_row": {
      const columns = (args?.columns as string[]) || [];
      const widths = (args?.widths as number[]) || [];
      return {
        content: [{ type: "text", text: createTableRow(columns, widths) }],
      };
    }

    case "create_table_separator": {
      const widths = (args?.widths as number[]) || [];
      const style = (args?.style as "top" | "middle" | "bottom") || "middle";
      return {
        content: [{ type: "text", text: createTableSeparator(widths, style) }],
      };
    }

    case "combine_horizontal": {
      const boxes = (args?.boxes as string[]) || [];
      const gap = Number(args?.gap) || 2;
      return {
        content: [{ type: "text", text: combineHorizontal(boxes, gap) }],
      };
    }

    case "wrap_frame": {
      const content = String(args?.content || "");
      const width = Number(args?.width) || 80;
      const title = args?.title as string | undefined;
      return {
        content: [{ type: "text", text: wrapFrame(content, width, title) }],
      };
    }

    default:
      throw new Error(`Unknown tool: ${name}`);
  }
});

// 서버 실행
const transport = new StdioServerTransport();
await server.connect(transport);
