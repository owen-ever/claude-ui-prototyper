# 🎭 UX Prototyper: Multi-Platform MCP Tool

> **"좋은 제품은 환경에 구애받지 않고 사용자에게 자연스럽게 스며들어야 합니다."**
> 
> 실제 개발에 들어가기 전, 경험자의 시선으로 제품의 본질을 시각화하고 사용자 경험을 검증하는 Experience Architect를 위한 전문 프로토타이핑 툴킷입니다.

---

## 🛠 지원하는 도구 (Supported Tools)

이 MCP(Model Context Protocol) 서버는 현재 다음 AI 도구들을 공식 지원합니다:

1. **Claude Code (Anthropic)**: 대화형 코딩 인터페이스 내에서 즉시 UI 명세와 ASCII 미리보기를 생성합니다.
2. **Gemini CLI (Google)**: 구글의 멀티모달 모델 환경에서도 동일한 UX 설계 도구를 활용할 수 있습니다.

---

## ✨ 핵심 가치 (Core Philosophy)

* **시각적 정교함 (Visual Accuracy):** 한글, 이모지, 특수문자의 시각적 너비(Visual Width)를 정밀하게 계산하여 어떤 터미널 환경에서도 깨지지 않는 정교한 레이아웃을 보장합니다.
* **리소스 최적화 (Resource Efficiency):** 코드 구현 전 텍스트 기반 미리보기를 통해 기획 의도를 명확히 하고, 불필요한 개발 리소스 소모를 방지합니다.
* **경험 중심 설계 (UX-Driven):** 사용자의 요구사항을 분석하여 마찰 지점(Friction Points)이 최소화된 직관적인 사용자 여정(User Journey)을 제안합니다.

---

## 🚀 설치 가이드 (Installation)

사용자의 환경에 맞는 최적의 설치를 위해 **대화형 스크립트(`setup.sh`)**를 제공합니다.

### 1. 저장소 클론 및 권한 부여
```bash
git clone [https://github.com/owen-ever/claude-ui-prototyper.git](https://github.com/owen-ever/claude-ui-prototyper.git)
cd claude-ui-prototyper

# 실행 권한 설정
chmod +x setup.sh

```

### 2. 대화형 설치 실행

```bash
./setup.sh

```

실행 후 터미널의 안내에 따라 **CLI 유형**과 **설치 범위(Scope)**를 선택하면 모든 설정이 자동으로 완료됩니다.

---

## 📂 설치 범위 안내 (Scope Options)

설치 시 선택하는 Scope에 따라 도구의 사용 범위가 결정됩니다.

| CLI Tool | Option 1 (Local/Project) | Option 2 (Global/User) |
| --- | --- | --- |
| **Claude Code** | `local` (현재 폴더 전용) | `global` (모든 프로젝트 공용) |
| **Gemini CLI** | `project` (현재 프로젝트 전용) | `user` (사용자 계정 공용) |

---

## 📐 기술적 사양 (Technical Specifications)

본 도구는 전각 문자와 반각 문자의 폭 차이를 극복하기 위해 **Anti-Break Protocol**을 사용합니다.

* **Half-width (1 unit):** 영문, 숫자, 기본 기호
* **Full-width (2 units):** 한글, 유니코드 이모지 (✨, 📝, 🚀 등)

---

## 👤 Architect's Vision

프로그래머이자 **Experience Architect**로서, 제품이 사용자에게 닿는 첫인상을 가장 효율적이고 직관적인 방법으로 설계하기 위해 이 도구를 만들었습니다.

* **Author:** [owen-ever](https://www.google.com/search?q=https://github.com/owen-ever)
* **Goal:** 누구에게나 스며드는 제품, 경험자의 시선에 가까운 설계를 지향합니다.

---

## 📄 License

MIT License.
