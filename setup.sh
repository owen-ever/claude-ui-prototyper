#!/bin/bash

# 색상 정의
GREEN='\033[0;32m'
BLUE='\033[0;34m'
YELLOW='\033[1;33m'
CYAN='\033[0;36m'
RED='\033[0;31m'
NC='\033[0m' # No Color

# 전역 설정 경로
GLOBAL_CONFIG_DIR="$HOME/.config/ui-prototyper"
GLOBAL_CONFIG_FILE="$GLOBAL_CONFIG_DIR/emoji-config.json"
LOCAL_CONFIG_FILE="emoji-config.json"

echo -e "${BLUE}==========================================${NC}"
echo -e "${BLUE}   🎨 UX Prototyper Interactive Setup     ${NC}"
echo -e "${BLUE}==========================================${NC}"

# 1단계: CLI 도구 선택
echo -e "\n${CYAN}Step 1: 설치할 CLI 유형을 선택하세요.${NC}"
echo -e "1) Claude Code"
echo -e "2) Gemini CLI"
read -p "입력 (1 or 2): " CLI_TYPE

# 2단계: 설치 범위 선택
echo -e "\n${CYAN}Step 2: 설치 위치(Scope)를 선택하세요.${NC}"
if [ "$CLI_TYPE" == "1" ]; then
    CLI_CMD="claude"
    echo -e "1) local  (현재 디렉토리 - 이 프로젝트만)"
    echo -e "2) global (사용자 전역 - 모든 프로젝트)"
    read -p "입력 (1 or 2): " SCOPE_INPUT
    if [ "$SCOPE_INPUT" == "1" ]; then
        SCOPE="local"
        IS_GLOBAL=false
    else
        SCOPE="user"
        IS_GLOBAL=true
    fi
else
    CLI_CMD="gemini"
    echo -e "1) project (현재 프로젝트만)"
    echo -e "2) user    (사용자 전역 - 모든 프로젝트)"
    read -p "입력 (1 or 2): " SCOPE_INPUT
    if [ "$SCOPE_INPUT" == "1" ]; then
        SCOPE="project"
        IS_GLOBAL=false
    else
        SCOPE="user"
        IS_GLOBAL=true
    fi
fi

# 스코프에 따른 설정 파일 경로 결정
if [ "$IS_GLOBAL" = true ]; then
    CONFIG_FILE="$GLOBAL_CONFIG_FILE"
    CONFIG_DIR="$GLOBAL_CONFIG_DIR"
    CONFIG_LOCATION="전역 (~/.config/ui-prototyper/)"
else
    CONFIG_FILE="$LOCAL_CONFIG_FILE"
    CONFIG_DIR="."
    CONFIG_LOCATION="로컬 (현재 프로젝트)"
fi

echo -e "\n${CYAN}📍 설정 위치: ${YELLOW}${CONFIG_LOCATION}${NC}"
echo -e "   MCP 스코프와 동일하게 이모지 설정도 ${SCOPE}에 저장됩니다."

# 3단계: 빌드 프로세스
echo -e "\n${GREEN}📦 Step 3: 의존성 설치 및 빌드 시작...${NC}"
npm install && npx tsc

if [ ! -f "dist/index.js" ]; then
    echo -e "${RED}❌ 빌드 실패: dist/index.js를 생성하지 못했습니다.${NC}"
    exit 1
fi

# 4단계: 이모지 캘리브레이션
echo -e "\n${CYAN}Step 4: 이모지 너비 캘리브레이션${NC}"
echo -e "터미널마다 이모지 렌더링 너비가 다를 수 있습니다.\n"

# 기존 설정 확인 (해당 스코프의 설정 파일)
if [ -f "$CONFIG_FILE" ]; then
    EXISTING_COUNT=$(grep -o '"[^"]*": [0-9]' "$CONFIG_FILE" 2>/dev/null | wc -l | tr -d ' ')
    echo -e "${GREEN}✓ 기존 설정 발견: ${CONFIG_FILE}${NC}"
    echo -e "  (${EXISTING_COUNT}개 이모지 보정값 저장됨)\n"
    echo -e "1) 기존 설정 사용"
    echo -e "2) 새로 캘리브레이션 (덮어쓰기)"
    read -p "입력 (1 or 2): " CALIB_CHOICE

    if [ "$CALIB_CHOICE" == "1" ]; then
        echo -e "${GREEN}✅ 기존 설정을 사용합니다.${NC}"
        NEED_CALIBRATION=false
    else
        NEED_CALIBRATION=true
    fi
else
    # 설정 없음 - 테스트 박스 표시
    echo -e "┌────────────────────────┐"
    echo -e "│ 기준선 (영문 20칸)     │"
    echo -e "│ ⚙️ 이모지 테스트       │"
    echo -e "│ 1️⃣ Keycap 테스트       │"
    echo -e "│ ⭐ 별 테스트           │"
    echo -e "└────────────────────────┘"

    echo -e "\n위 박스에서 ${YELLOW}우측 │ 세로선이 정렬되어 있나요?${NC}"
    echo -e "1) 예, 정렬되어 있습니다 (캘리브레이션 불필요)"
    echo -e "2) 아니요, 어긋나 있습니다 (기본 보정값 적용)"
    echo -e "3) 직접 캘리브레이션 실행 (대화형)"
    read -p "입력 (1, 2, or 3): " ALIGN_CHOICE

    case "$ALIGN_CHOICE" in
        1) NEED_CALIBRATION=false; USE_EMPTY=true ;;
        2) NEED_CALIBRATION=true; USE_INTERACTIVE=false ;;
        3) NEED_CALIBRATION=true; USE_INTERACTIVE=true ;;
        *) NEED_CALIBRATION=true; USE_INTERACTIVE=false ;;
    esac
fi

# 기본 보정 설정 JSON
DEFAULT_CONFIG='{
  "timestamp": "'$(date -u +"%Y-%m-%dT%H:%M:%SZ")'",
  "terminal": "'"$TERM"'",
  "scope": "'"$SCOPE"'",
  "emojis": {},
  "corrections": {
    "⚙️": 1, "✏️": 1, "✒️": 1, "❤️": 1, "☀️": 1,
    "☁️": 1, "☂️": 1, "⚡": 1, "❄️": 1, "☃️": 1,
    "✴️": 1, "❇️": 1, "⁉️": 1, "‼️": 1,
    "0️⃣": 1, "1️⃣": 1, "2️⃣": 1, "3️⃣": 1, "4️⃣": 1,
    "5️⃣": 1, "6️⃣": 1, "7️⃣": 1, "8️⃣": 1, "9️⃣": 1,
    "#️⃣": 1, "*️⃣": 1, "⭐": 1, "⚪": 1, "⚫": 1,
    "ℹ️": 1, "✉️": 1, "☎️": 1, "⏱️": 1, "⏲️": 1, "⌨️": 1,
    "▲": 1, "▼": 1, "◀": 1, "▶": 1, "△": 1, "▽": 1, "₩": 1
  },
  "summary": {
    "total": 42,
    "needsCorrection": 42,
    "correctionRules": [
      {"type": "keycap", "description": "Keycap 이모지", "correction": 1},
      {"type": "variationSelector", "description": "Variation Selector 포함", "correction": 1},
      {"type": "special", "description": "특수 기호", "correction": 1}
    ]
  }
}'

EMPTY_CONFIG='{
  "timestamp": "'$(date -u +"%Y-%m-%dT%H:%M:%SZ")'",
  "terminal": "'"$TERM"'",
  "scope": "'"$SCOPE"'",
  "emojis": {},
  "corrections": {},
  "summary": {"total": 0, "needsCorrection": 0, "correctionRules": []}
}'

# 캘리브레이션 적용
if [ "$NEED_CALIBRATION" = true ]; then
    echo -e "\n${GREEN}🔧 이모지 보정 설정 생성 중...${NC}"

    # 디렉토리 생성 (전역인 경우)
    if [ "$IS_GLOBAL" = true ]; then
        mkdir -p "$CONFIG_DIR"
    fi

    if [ "$USE_INTERACTIVE" = true ]; then
        # 대화형 캘리브레이션
        npx tsx emoji-calibration.ts
        # 생성된 파일을 올바른 위치로 이동
        if [ -f "emoji-config.json" ] && [ "$IS_GLOBAL" = true ]; then
            mv emoji-config.json "$CONFIG_FILE"
        fi
    else
        # 기본 보정값 적용
        echo "$DEFAULT_CONFIG" > "$CONFIG_FILE"
    fi

    echo -e "${GREEN}✅ 설정 저장: ${CONFIG_FILE}${NC}"
elif [ "$USE_EMPTY" = true ]; then
    # 보정 불필요
    if [ "$IS_GLOBAL" = true ]; then
        mkdir -p "$CONFIG_DIR"
    fi
    echo "$EMPTY_CONFIG" > "$CONFIG_FILE"
    echo -e "${GREEN}✅ 캘리브레이션 불필요 - 빈 설정 저장${NC}"
fi

# 보정 후 다시 빌드
echo -e "\n다시 빌드하여 설정을 적용합니다..."
npx tsc

# 5단계: 등록 실행
CURRENT_DIR=$(pwd)
SERVER_PATH="$CURRENT_DIR/dist/index.js"

echo -e "\n${GREEN}🔗 Step 5: $CLI_CMD ($SCOPE)에 MCP 서버 등록 중...${NC}"

if [ "$CLI_CMD" == "claude" ]; then
    claude mcp remove ui-prototyper -s "$SCOPE" &> /dev/null
    claude mcp add -s "$SCOPE" ui-prototyper -- node "$SERVER_PATH"
else
    gemini mcp remove ui-prototyper --scope "$SCOPE" &> /dev/null
    gemini mcp add ui-prototyper --scope "$SCOPE" node "$SERVER_PATH"
fi

# 최종 결과 출력
echo -e "\n${BLUE}==========================================${NC}"
echo -e "${GREEN}✅ 모든 설정이 완료되었습니다!${NC}"
echo -e "${BLUE}==========================================${NC}"
echo -e "CLI: ${YELLOW}$CLI_CMD${NC}"
echo -e "스코프: ${YELLOW}$SCOPE${NC}"

# 이모지 설정 상태 표시
if [ -f "$CONFIG_FILE" ]; then
    CONFIG_COUNT=$(grep -o '"[^"]*": [0-9]' "$CONFIG_FILE" 2>/dev/null | wc -l | tr -d ' ')
    if [ "$CONFIG_COUNT" -gt "0" ]; then
        echo -e "이모지 보정: ${YELLOW}${CONFIG_COUNT}개 적용${NC}"
    else
        echo -e "이모지 보정: ${GREEN}불필요${NC}"
    fi
    echo -e "설정 파일: ${CYAN}${CONFIG_FILE}${NC}"
fi

echo -e "\n이제 '${YELLOW}ui-prototyper${NC}'를 사용하세요!"
echo -e "${BLUE}==========================================${NC}"

# 추가 안내
echo -e "\n${CYAN}💡 팁:${NC}"
echo -e "  • 캘리브레이션 재실행: ${YELLOW}npx tsx emoji-calibration.ts${NC}"
if [ "$IS_GLOBAL" = true ]; then
    echo -e "  • 전역 설정 위치: ${CYAN}~/.config/ui-prototyper/${NC}"
else
    echo -e "  • 로컬 설정: ${CYAN}./emoji-config.json${NC}"
fi
