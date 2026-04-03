# CTI Pharma Analyzer

**한국 제약/바이오 임상시험 기반 주가 분석 도구**

ClinicalTrials.gov 임상시험 데이터와 Naver Finance 공개 시장 데이터를 활용하여 한국 제약/바이오 종목을 분석합니다. 100점 만점 스코어링, 의사결정 라벨, 기술적 지표를 제공합니다. KIS API 불필요.

**Clinical trial intelligence for Korean pharma stocks.**

Analyzes Korean pharma/biotech stocks using ClinicalTrials.gov data and Naver Finance public market data. Provides 100-point scoring, decision labels, and technical indicators. No KIS API required.

---

## 설치 / Installation

### Claude Code 플러그인 (권장 / Recommended)

```bash
claude plugin add github:hjsh200219/trading-by-clinical-trial
```

설치하면 MCP 서버(`cti-mcp`)가 자동 연결되고, 스킬을 바로 사용할 수 있습니다. 별도 설치 불필요.

Installs the plugin with MCP server auto-connected. No additional setup required.

### MCP 서버 직접 연결 (Claude Desktop / Claude Code)

`claude_desktop_config.json` 또는 `.mcp.json`에 추가:

```json
{
  "mcpServers": {
    "cti-mcp": {
      "type": "url",
      "url": "https://clinical-trials-mcp.up.railway.app/mcp"
    }
  }
}
```

---

## 사용법 / Usage

### Claude Code 플러그인 스킬

| 스킬 | 설명 | Description |
|------|------|-------------|
| `analyze-stock` | 종합 분석 (임상+시장+스코어+경쟁) | Full analysis with scoring and competition |
| `score-stock` | 6개 컴포넌트 상세 스코어링 | Detailed 100-point score breakdown |
| `competition-analysis` | 경쟁 환경 분석 | Competitive landscape mapping |
| `upcoming-catalysts` | 카탈리스트 추적 | Upcoming trial completion events |
| `pipeline-overview` | 파이프라인 총괄 랭킹 | Pipeline overview ranked by trials |
| `stock-technicals` | RSI/Bollinger/Volume 기술적 지표 | Technical indicators |

**사용 예시 / Examples:**

```
셀트리온 임상 분석해줘
068270 스코어 알려줘
한국 제약 파이프라인 현황 보여줘
3개월 이내 Phase 3 카탈리스트 목록
유방암 경쟁 환경 분석
알테오젠 기술적 지표
```

### MCP 서버 도구

| 도구 | 설명 | 주요 파라미터 |
|------|------|-------------|
| `analyze_stock` | 종합 분석 | `symbol`, `sponsor` |
| `search_pharma_trials` | 임상시험 검색 | `symbol`, `sponsor`, `keyword`, `phase`, `status` |
| `score_stock` | 스코어 분석 | `symbol`, `sponsor` |
| `get_competition_analysis` | 경쟁 분석 | `nct_id`, `condition`, `exclude_sponsor` |
| `get_upcoming_catalysts` | 카탈리스트 | `months`, `phase`, `symbol` |
| `get_kr_pharma_pipeline` | 파이프라인 | `top`, `phase` |
| `get_stock_technicals` | 기술적 지표 | `symbol`, `range` |

**Examples:**

```
analyze_stock({ symbol: "068270" })                    // 셀트리온
score_stock({ symbol: "207940" })                      // 삼성바이오로직스
get_upcoming_catalysts({ months: 3, phase: "Phase 3" })
get_kr_pharma_pipeline({ top: 10 })
get_competition_analysis({ condition: "Breast Cancer" })
get_stock_technicals({ symbol: "196170" })             // 알테오젠
```

---

## 스코어링 (100점) / Scoring

| 컴포넌트 | 점수 | 설명 | Description |
|----------|------|------|-------------|
| Temporal Proximity | 30 | 완료까지 남은 시간 | Time to trial completion |
| Impact | 25 | Phase 및 등록 규모 | Phase and enrollment size |
| Market Signal | 15 | 기술적 지표 | RSI, Bollinger, Volume |
| Competition | 15 | 글로벌 경쟁 환경 | Global competitor landscape |
| Pipeline | 10 | 활성 임상 포트폴리오 | Active trial portfolio |
| Data Richness | 5 | 메타데이터 완성도 | Metadata completeness |

## 의사결정 라벨 / Decision Labels

| 라벨 | 의미 | Meaning |
|------|------|---------|
| 🟢 `TRIAL_STRONG_POSITIVE` | 강한 긍정 신호 | High-confidence positive signal |
| 🟩 `TRIAL_POSITIVE` | 긍정 신호 | Positive trial signal |
| 🟡 `TRIAL_NEUTRAL` | 중립 | Insufficient signal strength |
| 🟠 `TRIAL_WATCH` | 모니터링 대상 | Worth monitoring, not actionable |
| 🔵 `TRIAL_REVIEW` | 결과 검토 필요 | Results posted, manual review needed |
| 🔴 `TRIAL_NEGATIVE` | 부정 신호 | Negative signal |

## 기술적 지표 / Technical Indicators

| 지표 | 방법 | 해석 |
|------|------|------|
| RSI (14) | Wilder's smoothing | < 30 과매도 / 30-70 중립 / > 70 과매수 |
| Bollinger %B | 20일 SMA, 2σ | 밴드 내 위치 (0%=하단, 100%=상단) |
| Volume Ratio | 당일 / 20일 평균 | < 0.5 저조 / 0.5-1.5 정상 / > 3.0 급증 |

---

## 커버리지 / Coverage

셀트리온, 삼성바이오로직스, SK바이오팜, 유한양행, 대웅제약, 한미약품, 녹십자, 알테오젠, ABL바이오 등 **32개 한국 제약/바이오 기업**.

32 Korean pharma/biotech companies including Celltrion, Samsung Biologics, SK Biopharmaceuticals, Yuhan, Daewoong, Hanmi, Green Cross, Alteogen, ABL Bio, and more.

## 데이터 소스 / Data Sources

| 소스 | 데이터 | Data |
|------|--------|------|
| ClinicalTrials.gov API v2 | 임상시험 메타데이터 | Trial metadata, phases, enrollment |
| Naver Finance (fchart) | OHLCV 가격 데이터 | Price data for KRX (KOSPI/KOSDAQ) |

**미제공 (KIS API 없음):** 기관 수급, 공매도 비율, 실시간 호가

## 개발 / Development

로컬에서 직접 빌드하여 MCP 서버를 실행할 수도 있습니다.

You can also build and run the MCP server locally.

```bash
git clone https://github.com/hjsh200219/trading-by-clinical-trial.git
cd trading-by-clinical-trial
npm install
npm run build
npm test          # 186 tests
```

`claude_desktop_config.json`에 로컬 서버 등록:

```json
{
  "mcpServers": {
    "cti-mcp": {
      "command": "node",
      "args": ["/absolute/path/to/trading-by-clinical-trial/dist/index.js"]
    }
  }
}
```

---

_임상시험 메타데이터와 공개 시장 데이터에 기반한 분석입니다. 투자 조언이 아닙니다._

_Analysis based on clinical trial metadata and public market data. Not financial advice._
