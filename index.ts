import { Server } from "@modelcontextprotocol/sdk/server/index.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import {
  CallToolRequestSchema,
  ListToolsRequestSchema,
} from "@modelcontextprotocol/sdk/types.js";

// 1. 서버 인스턴스 생성
const server = new Server(
  {
    name: "ui-ascii-art",
    version: "2.0.0",
  },
  {
    capabilities: {
      tools: {},
    },
  },
);

// 2. 도구 목록 등록
server.setRequestHandler(ListToolsRequestSchema, async () => ({
  tools: [
    {
      name: "create_ui_prototype",
      description:
        "사용자의 요구사항을 바탕으로 ASCII UI 미리보기를 생성합니다.",
      inputSchema: {
        type: "object",
        properties: {
          requirements: {
            type: "string",
            description: "UI에 포함될 주요 내용",
          },
          concept: { type: "string", description: "디자인 컨셉" },
        },
        required: ["requirements"],
      },
    },
  ],
}));

// 3. 도구 실행 핸들러
server.setRequestHandler(CallToolRequestSchema, async (request) => {
  if (request.params.name !== "create_ui_prototype") {
    throw new Error("Unknown tool");
  }

  const requirements = String(request.params.arguments?.requirements || "");
  const concept = String(request.params.arguments?.concept || "기본 컨셉");

  // LLM이 ASCII UI를 잘 그릴 수 있도록 가이드 반환
  const guide = `
## 🎨 ASCII UI 프로토타입 생성 가이드

### 📋 요청 정보
- **요구사항**: ${requirements}
- **디자인 컨셉**: ${concept}

### ⚠️ 필수 준수 사항: 시각적 너비(Visual Width) 규칙

ASCII UI를 그릴 때 **우측 세로선(│)이 깨지지 않도록** 아래 규칙을 반드시 준수하세요.

#### 문자별 너비 기준
| 문자 유형 | 너비 | 예시 |
|----------|------|------|
| 반각 (Half-width) | 1 | 영문, 숫자, 기본 기호 (a-z, 0-9, !, @, #) |
| 전각 (Full-width) | 2 | 한글 (가-힣), 한자, 일본어 |
| 이모지 | 2 | ✨, 📊, 🔔, ⚙️, 👤 등 대부분의 유니코드 이모지 |
| 특수 박스 문자 | 1 | ─, │, ┌, ┐, └, ┘, ├, ┤, ┬, ┴, ┼ |

#### 줄 너비 계산 방법
각 줄의 총 너비 = Σ(각 문자의 시각적 너비)

**예시 계산:**
\`\`\`
"Hello 세계 ✨"
= H(1) + e(1) + l(1) + l(1) + o(1) + 공백(1) + 세(2) + 계(2) + 공백(1) + ✨(2)
= 5 + 1 + 4 + 1 + 2 = 13
\`\`\`

#### 정렬 규칙
1. **고정 너비 결정**: 먼저 박스의 내부 너비를 정합니다 (예: 50)
2. **내용 작성 후 패딩**: 각 줄의 내용을 작성한 뒤, 남은 너비만큼 공백으로 채웁니다
3. **우측 테두리 배치**: 패딩 후 │ 문자 배치

**올바른 예시:**
\`\`\`
│ 📊 대시보드                                      │  (이모지 2 + 공백 1 + 한글 8 + 패딩)
│ Dashboard                                        │  (영문 9 + 패딩)
│ 총 자산: ₩ 45,320,000                            │  (한글 + 기호 + 숫자 + 패딩)
\`\`\`

### 📐 권장 레이아웃 구조

\`\`\`
┌─────────────────────────────────────────────────┐  ← 상단 테두리
│ [헤더 영역]                                     │
├─────────────────────────────────────────────────┤  ← 구분선
│ [본문 영역]                                     │
│                                                 │
│ ┌─────────────┐ ┌─────────────┐                 │  ← 내부 박스 (중첩 가능)
│ │ 카드 1      │ │ 카드 2      │                 │
│ └─────────────┘ └─────────────┘                 │
│                                                 │
├─────────────────────────────────────────────────┤
│ [푸터 영역]                                     │
└─────────────────────────────────────────────────┘  ← 하단 테두리
\`\`\`

### 🚨 흔한 실수와 해결책

| 실수 | 원인 | 해결책 |
|------|------|--------|
| 우측 │가 들쭉날쭉 | 이모지/한글 너비 미계산 | 각 줄마다 너비 합계 검증 |
| 박스가 비뚤어짐 | 중첩 박스 너비 불일치 | 내부 박스도 동일 규칙 적용 |
| 테이블 정렬 깨짐 | 열 너비 불균일 | 열별 최대 너비 계산 후 통일 |

### 🔬 특수기호/이모지 사전 검증 절차 (필수)

**특수기호나 이모지를 UI에 사용하기 전에 반드시 터미널 출력 테스트를 수행하세요.**

#### 검증 단계
1. **사용할 문자 목록 작성**: UI에 사용할 특수기호/이모지를 먼저 나열
2. **터미널 테스트 실행**: Bash 도구로 echo 명령어를 사용하여 실제 출력 확인
3. **너비 검증**: 출력 결과를 보고 실제 시각적 너비 확인
4. **문제 시 대체**: 깨지거나 너비가 예상과 다르면 다른 문자로 대체

#### 테스트 명령어 예시
\`\`\`bash
echo "│ 📊 테스트 │"
echo "│ ★  테스트 │"
echo "│ ⚙️ 테스트 │"
\`\`\`

#### 주의사항
- 일부 이모지(특히 결합 문자가 있는 ⚙️, 👨‍💻 등)는 터미널마다 너비가 다를 수 있음
- 검증 없이 바로 사용하면 우측 세로선이 깨질 위험이 높음
- **안전한 대안**: 검증이 어려우면 기본 ASCII 문자(*, -, +, #)로 대체

---

**이제 위 가이드를 참고하여 요청된 "${concept}" 컨셉의 UI 프로토타입을 ASCII로 그려주세요.**

**작업 순서:**
1. 먼저 사용할 특수기호/이모지 목록을 터미널에서 테스트
2. 검증된 문자만 사용하여 UI 작성
3. 모든 줄의 우측 세로선(│)이 정확히 정렬되었는지 최종 확인
`;

  return {
    content: [
      {
        type: "text",
        text: guide,
      },
    ],
  };
});

// 4. 서버 실행
const transport = new StdioServerTransport();
await server.connect(transport);
