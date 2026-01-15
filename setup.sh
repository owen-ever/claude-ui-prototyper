#!/bin/bash

# 색상 정의 (경험 시각화)
GREEN='\033[0;32m'
BLUE='\033[0;34m'
YELLOW='\033[1;33m'
CYAN='\033[0;36m'
NC='\033[0m' # No Color

echo -e "${BLUE}==========================================${NC}"
echo -e "${BLUE}   🎨 UX Prototyper Interactive Setup     ${NC}"
echo -e "${BLUE}==========================================${NC}"

# 1단계: CLI 도구 선택
echo -e "${CYAN}Step 1: 설치할 CLI 유형을 선택하세요.${NC}"
echo -e "1) Claude Code"
echo -e "2) Gemini CLI"
read -p "입력 (1 or 2): " CLI_TYPE

# 2단계: 설치 범위 선택
echo -e "\n${CYAN}Step 2: 설치 위치(Scope)를 선택하세요.${NC}"
if [ "$CLI_TYPE" == "1" ]; then
    CLI_CMD="claude"
    echo -e "1) local  (현재 디렉토리의 .claude.json에 저장)"
    echo -e "2) global (사용자 전역 설정에 저장)"
    read -p "입력 (1 or 2): " SCOPE_INPUT
    [ "$SCOPE_INPUT" == "1" ] && SCOPE="local" || SCOPE="user"
else
    CLI_CMD="gemini"
    echo -e "1) project (현재 프로젝트 단위 설치)"
    echo -e "2) user    (사용자 계정 단위 설치)"
    read -p "입력 (1 or 2): " SCOPE_INPUT
    [ "$SCOPE_INPUT" == "1" ] && SCOPE="project" || SCOPE="user"
fi

# 3단계: 빌드 프로세스
echo -e "\n${GREEN}📦 3단계: 의존성 설치 및 빌드 시작...${NC}"
npm install && npx tsc

if [ ! -f "dist/index.js" ]; then
    echo -e "${YELLOW}❌ 빌드 실패: dist/index.js를 생성하지 못했습니다.${NC}"
    exit 1
fi

# 4단계: 등록 실행
CURRENT_DIR=$(pwd)
SERVER_PATH="$CURRENT_DIR/dist/index.js"

echo -e "\n${GREEN}🔗 4단계: $CLI_CMD ($SCOPE)에 MCP 서버 등록 중...${NC}"

if [ "$CLI_CMD" == "claude" ]; then
    # Claude 전역/로컬 등록
    claude mcp remove ui-prototyper -s "$SCOPE" &> /dev/null
    claude mcp add -s "$SCOPE" ui-prototyper -- node "$SERVER_PATH"
else
    # Gemini 전역/프로젝트 등록 (명령어 구조에 맞춰 --scope 활용)
    # 실제 Gemini CLI의 명령어 규격에 따라 조정될 수 있습니다.
    gemini mcp remove ui-prototyper --scope "$SCOPE" &> /dev/null
    gemini mcp add ui-prototyper --scope "$SCOPE" -- node "$SERVER_PATH"
fi

echo -e "\n${BLUE}==========================================${NC}"
echo -e "${GREEN}✅ 모든 설정이 완료되었습니다!${NC}"
echo -e "Target CLI: ${YELLOW}$CLI_CMD${NC}"
echo -e "Scope: ${YELLOW}$SCOPE${NC}"
echo -e "\n이제 '${YELLOW}ui-prototyper${NC}'를 사용하여 제품 경험을 설계하세요."
echo -e "${BLUE}==========================================${NC}"
