# 임상시험 기반 매매 신호 — 전체 시스템 문서

> **시스템명**: Clinical Trial Intelligence (CTI)
> **목적**: 임상시험 이벤트의 시장 반응을 공매도/기관/외국인 매매 신호로 정량화하여 매매 타이밍 제시

---

## 전체 데이터 흐름

```
[데이터 수집 — Cron 15분 간격]
  KST 06:00  clinical-batch        → ClinicalTrials.gov 임상 메타데이터
  KST 06:15  clinical-short-selling → KIS API 공매도 비율
  KST 06:30  clinical-investor      → KIS API 기관/외국인 순매수
  KST 06:45  clinical-recommendations → 콤보 스코어링 + 추천 생성

[분석 파이프라인]
  Raw Data → Signal Detection → Combo Scoring → Score Ranking → Decision Matrix
                                                                      ↓
                                                              BUY / SELL / HOLD / WATCH
```

---

## 0. 데이터 수집 파이프라인

### 0.1 수집 대상 종목 결정

두 가지 소스에서 제약/바이오 종목을 수집:

| 소스 | 방식 | 테이블 |
|------|------|--------|
| **수동 매핑** (관리자) | 종목코드 ↔ 스폰서명 직접 등록 | `clinical_company_mapping` |
| **DART 자동 추출** | 섹터 키워드 매칭 (`의약품`, `바이오`, `제약`, `헬스`, `의료`) | `dart_companies` |

### 0.2 임상시험 메타데이터 (ClinicalTrials.gov API v2)

| 항목 | 값 |
|------|-----|
| **Base URL** | `https://clinicaltrials.gov/api/v2` |
| **엔드포인트** | `GET /studies` |
| **Rate Limit** | 50 req/min |
| **인증** | 없음 (공개 API) |
| **용도** | 임상시험 메타데이터 검색 (스폰서명 기준) |
| **참고** | https://clinicaltrials.gov/data-api/api |

**파라미터**:

| 파라미터 | 값 | 설명 |
|----------|-----|------|
| `query.spons` | 스폰서명 | 예: `Daewoong Pharmaceutical` |
| `filter.advanced` | AREA 조합 | Phase + Status 필터 |
| `pageSize` | 100 | 페이지당 결과 수 |
| `pageToken` | 토큰 | 페이징 |

**filter.advanced 예시**:
```
AREA[Phase](PHASE2 OR PHASE3 OR PHASE4)
AND AREA[OverallStatus](RECRUITING OR ACTIVE_NOT_RECRUITING OR ENROLLING_BY_INVITATION OR COMPLETED)
```

**추출 필드**:

| 필드 | 소스 | 변환 |
|------|------|------|
| nct_id | protocolSection.identificationModule | NCT 번호 |
| drug_name | armsInterventionsModule → DRUG 타입만 | 약물명 |
| condition | conditionsModule.conditions | 쉼표 구분 질환명 |
| phase | designModule.phases | 최신 Phase (PHASE2/3/4) |
| status | statusModule.overallStatus | 진행 상태 |
| estimated_completion_date | statusModule.completionDateStruct | 날짜 정규화 (YYYY-MM → YYYY-MM-01) |
| enrollment | designModule.enrollmentInfo | 참가자 수 |

**종목 매핑 (company-mapper.ts)**:

| 단계 | 방식 | 신뢰도 |
|------|------|--------|
| 1차 | 정확 매치 (`sponsor_name_en`) | 1.0 |
| 2차 | 별칭 매치 (`sponsor_aliases`) | 0.95 |
| 3차 | Levenshtein 유사도 계산 | < 0.95 |

**수집 최적화**:
- 동시 3개 요청 (sliding window)
- Rate limiter (token bucket)
- 스마트 딜레이 (API 응답시간 포함)
- DB 배치 upsert (`onConflict: nct_id`)

### 0.3 공매도 데이터 (KIS Open API)

| 항목 | 값 |
|------|-----|
| **Base URL** | `https://openapi.koreainvestment.com:9443` |
| **엔드포인트** | `GET /uapi/domestic-stock/v1/quotations/daily-short-sale` |
| **TR ID** | `FHPST04830000` |
| **Rate Limit** | 20 req/sec → 안전마진 15 req/sec |
| **인증** | Bearer Token (appkey + appsecret → access_token) |
| **용도** | 종목별 공매도 체결 수량, 비율, 거래량 |
| **제약** | 실전 전용 (모의투자 미지원), 1회 최대 130일 |

**파라미터**:

| 파라미터 | 값 | 설명 |
|----------|-----|------|
| `FID_COND_MRKT_DIV_CODE` | `J` | 주식 |
| `FID_INPUT_ISCD` | 종목코드 | 예: `000660` |
| `FID_INPUT_DATE_1` | YYYYMMDD | 시작일 |
| `FID_INPUT_DATE_2` | YYYYMMDD | 종료일 |

**응답 → DB 변환** (`output2[]`):

| API 응답 | DB 필드 | 설명 |
|----------|---------|------|
| `stck_bsop_date` | trade_date | YYYYMMDD → YYYY-MM-DD |
| `ssts_cntg_qty` | short_selling_volume | 공매도 체결 수량 |
| `ssts_vol_rlim` | short_selling_ratio | 공매도 거래량 비중 (%) |
| `acml_vol` | total_volume | 누적 거래량 |

**장기 수집 (>130일)**: API 1회 최대 130일이므로 Multi-window 분할 수집

**재시도**: 500+ 에러 시 최대 3회, Exponential Backoff (1s → 2s → 4s)

### 0.4 기관/외국인 매매 데이터 (KIS Open API)

| 항목 | 값 |
|------|-----|
| **Base URL** | `https://openapi.koreainvestment.com:9443` |
| **엔드포인트** | `GET /uapi/domestic-stock/v1/quotations/investor-trade-by-stock-daily` |
| **TR ID** | `FHPTJ04160001` |
| **Rate Limit** | 15 req/sec |
| **인증** | Bearer Token |
| **용도** | 기관/외국인 순매수 수량 |
| **제약** | 실전 전용, 역방향 조회 (~100 거래일) |

**파라미터**:

| 파라미터 | 값 | 설명 |
|----------|-----|------|
| `FID_COND_MRKT_DIV_CODE` | `J` | 주식 |
| `FID_INPUT_ISCD` | 종목코드 | 예: `000660` |
| `FID_INPUT_DATE_1` | YYYYMMDD | 기준일 (역방향 조회 시작점) |

**응답 → DB 변환** (`output2[]`):

| API 응답 | DB 필드 | 설명 |
|----------|---------|------|
| `stck_bsop_date` | trade_date | 영업일자 |
| `orgn_ntby_qty` | institutional_net_buy | 기관계 순매수 수량 |
| `frgn_ntby_qty` | foreign_net_buy | 외국인 순매수 수량 |

**역방향 슬라이딩 알고리즘**:
```
currentEndDate = today
while currentEndDate > targetStartDate:
  records = fetch(endDate: currentEndDate)

  if 비어있음 3회 연속 → break

  earliestDate = records 중 가장 오래된 날짜
  currentEndDate = earliestDate - 1일
```

### 0.5 AI 영향도 분석 (Azure OpenAI)

| 항목 | 값 |
|------|-----|
| **엔드포인트** | `{AZURE_OPENAI_ENDPOINT}/openai/responses` |
| **인증** | `api-key` 헤더 |
| **모델** | `AZURE_OPENAI_DEPLOYMENT` (예: gpt-4o-mini) |
| **용도** | 임상시험의 주가 영향도 AI 분석 (S/A/B/C 등급) |

**영향도 등급 기준** (기존 매출 대비 예상 매출 비율):

| 등급 | 기준 | 의미 |
|------|------|------|
| **S** | 기존 매출 대비 >50% | 게임체인저 |
| **A** | 기존 매출 대비 20~50% | 주요 성장동력 |
| **B** | 기존 매출 대비 5~20% | 의미 있는 기여 |
| **C** | 기존 매출 대비 <5% | 제한적 영향 |

**AI 분석 출력**: 예상 연간 매출(억원), 매출 비율(0~1), 분석 요약, 상세(시장 규모, 경쟁 환경, 성공 확률)

### 0.6 경쟁사 매핑 (competition-mapper.ts)

같은 질환을 타겟하는 Phase 2+ 임상시험 자동 추출:

| 관계 유형 | 조건 | 예시 |
|-----------|------|------|
| `same_condition` | 동일 질환 | "Diabetes" vs "Diabetes" |
| `related_condition` | 한쪽이 다른쪽 포함 | "Type 2 Diabetes" vs "Diabetes" |

자사 임상 제외, Phase 2+ 필터, 중복 방지 (`sourceTrialId-competitorTrialId` 키)

### 0.7 Cron 스케줄 (vercel.json)

| Cron | 경로 | 시간 (KST) | 주기 | 역할 |
|------|------|------------|------|------|
| clinical-batch | `/api/cron/clinical-batch` | 06:00 | 매일 | 임상시험 메타데이터 수집 |
| clinical-short-selling | `/api/cron/clinical-short-selling` | 06:15 | 평일 | 공매도 비율 수집 (최근 7일) |
| clinical-investor | `/api/cron/clinical-investor` | 06:30 | 평일 | 기관/외국인 매매동향 (최근 7일) |
| clinical-recommendations | `/api/cron/clinical-recommendations` | 06:45 | 평일 | 콤보 스코어링 + 추천 생성 |

**인증**: `CRON_SECRET` (Bearer 토큰) + KIS API 키 (`CRON_KIS_USER_ID` → DB에서 복호화)

**Slack 알림**: 각 Cron 완료/실패 시 `notifyCronResult()`로 결과 통보

### 0.8 DB 테이블

| 테이블 | 역할 | UNIQUE 키 |
|--------|------|-----------|
| `clinical_trials` | 임상시험 마스터 | `nct_id` |
| `clinical_company_mapping` | 종목 ↔ 스폰서 매핑 | `stock_symbol` |
| `clinical_trading_signals` | 공매도 + 기관/외국인 데이터 | `stock_symbol, trade_date` |
| `clinical_scores` | 일일 종합 점수 | `stock_symbol, score_date` |
| `clinical_recommendations` | 추천 결과 | `stock_symbol, trial_id` |
| `clinical_competitors` | 경쟁사 후보 | `source_trial_id, competitor_trial_id` |
| `clinical_update_logs` | 배치 수집 로그 | — |

---

## 1. 신호 감지 (signal-detector.ts)

D-60~D-0 구간 데이터로 BULLISH / NEUTRAL / BEARISH 신호 생성.

### 데이터 분할

```
D-60 ──────── D-30 ──────── D-7 ── D-0
  baseline (30일)    recent (최근 구간)
```

### 공매도 변화율

```
shortSellingChange = ((recent평균 - baseline평균) / baseline평균) × 100
```

### 기관 트렌드 분류

| 조건 | 트렌드 |
|------|--------|
| 순매수 20%↑ 증가 | `increasing` |
| 순매수 20%↓ 감소 | `decreasing` |
| ±20% 이내 | `stable` |

### 최종 신호 판정

| 공매도 변화 | 기관 트렌드 | 신호 |
|------------|------------|------|
| > +50% (급증) | decreasing | **BEARISH** |
| < -20% (감소) | increasing | **BULLISH** |
| ±20% 이내 | any | **NEUTRAL** |
| 기타 | 기타 | **NEUTRAL** |

### 신뢰도 (0.0 ~ 1.0)

```
confidence = dataPointsFactor×0.5 + volumeConsistency×0.25 + patternStrength×0.25
```

| 데이터 포인트 | 신뢰도 범위 |
|--------------|------------|
| < 10일 | 0 ~ 0.17 |
| 10~30일 | 0.2 ~ 0.5 |
| 30~60일 | 0.5 ~ 0.8 |
| 60일+ | 0.8 ~ 1.0 |

---

## 2. 콤보 스코어링 (combo-scorer.ts)

백테스트 검증된 10종 시그널 조합으로 5단계 등급(STRONG_BUY ~ AVOID) 산출.

### 입력: SignalSnapshot

60일 데이터를 전반/후반으로 분리하여 **방향성(momentum)** 캡처:

```
D-60 ──── D-30 ──── D-day
  전반부      후반부
  (early)     (late)
```

| 필드 | 설명 |
|------|------|
| institutionalNetEarly / Late | 기관 전반·후반 순매수 합계 |
| foreignNetEarly / Late | 외국인 전반·후반 순매수 합계 |
| shortSellingRatioAvg | 전체 기간 공매도 비율 평균 (%) |
| shortSellingEarly / Late | 전반·후반 공매도 비율 평균 |
| dataPoints | 수집된 데이터 포인트 수 |

### 10종 콤보 정의

**평가 순서**: AVOID 먼저 체크 (위험 우선) → STRONG_BUY → BUY → WATCH → HOLD(폴백)

| # | 콤보명 | 등급 | 기대수익 | 승률 | 조건 |
|---|--------|------|----------|------|------|
| 1 | 기관매수 가속 + 공매도↓ | STRONG_BUY | +8.43% | 94.1% | 기관 후반>전반(가속) AND 공매도≤7% AND 후반부 공매도≤10% |
| 2 | 기관+공매도↓+외국인 | STRONG_BUY | +7.61% | 77.8% | 기관>0 AND 공매도≤7% AND 외국인>0 AND 후반부 공매도≤10% |
| 3 | 기관매수 유지 60일 | BUY | +8.37% | 80% | 기관 전반>0 AND 후반>0 |
| 4 | 기관 대규모 매수 | BUY | +4.98% | 73% | 기관 순매수 > 200K |
| 5 | 외국인 순매수 전환 | WATCH | +3.21% | 65% | 외국인 전반 매도 → 후반 매수 |
| 6 | 혼합 시그널 | WATCH | +1.52% | 55% | 기관>0 BUT 공매도>10% |
| 7 | 시그널 없음 | HOLD | +0.34% | 52% | 폴백 (항상 매칭) |
| 8 | 공매도 급증 | AVOID | -2.87% | 35% | 공매도>15% AND 가속(후반>전반) |
| 9 | 기관 매도 전환 | AVOID | -4.21% | 25% | 기관 전반 매수 → 후반 매도 |
| 10 | 기관+외국인 동반매도 | AVOID | -6.63% | 10% | 기관<0 AND 외국인<0 |

### Phase 보정 배수

| 임상 Phase | 배수 | 근거 |
|------------|------|------|
| Phase 3 | **1.5x** | 결과 발표 임박, 주가 영향 최대 |
| Phase 2 | 1.0x | 기본값 |
| Phase 4 | 0.8x | 시판 후 연구, 주가 영향 제한적 |
| Phase 1 / Early | 0.7x | 초기 단계, 불확실성 높음 |

### 출력: ComboScore

```
{
  comboId: 1,
  comboName: "기관매수 가속 + 공매도↓",
  grade: "STRONG_BUY",
  expectedReturn: 8.43,
  winRate: 0.9412,
  confidence: 0.8,              ← dataPoints 기반
  phaseMultiplier: 1.5,         ← Phase 3
  adjustedReturn: 12.65,        ← expectedReturn × phaseMultiplier
  matchedConditions: [...]      ← 조건별 매칭 상세
}
```

---

## 3. 100점 만점 종합 스코어 (scoring.ts)

5개 요소를 조합하여 종목별 매매 타이밍 점수 산출 → Score Ranking 화면에 표시.

| 요소 | 배점 | 계산 방식 |
|------|------|---------|
| **Timeline** (일정 근접도) | 25점 | D-30=25, D-90=15, D-180=8, D-365=3 |
| **Impact** (Phase 가중치) | 25점 | S=25, A(P3/4)=20, B(P2)=12, C=5 |
| **Institutional** (기관 동향) | 25점 | increasing=25, stable=12, decreasing=0 |
| **Short Signal** (공매도 신호) | 15점 | BULLISH=15, NEUTRAL=7, BEARISH=0 |
| **Competition** (경쟁사 영향) | 10점 | bullish=10, neutral=5, bearish=0 |

```
total_score = timeline + impact + institutional + short_signal + competition
```

---

## 4. 의사결정 매트릭스 (decision-matrix.ts)

복합 시그널을 조합하여 최종 매매 액션 결정.

### 시간 윈도우별 가중치

| 구간 | 가중치 | 의미 |
|------|--------|------|
| D-60 ~ D-30 | 0.5x | 사전 포지션 구간 |
| D-30 ~ D-7 | **1.0x** | 핵심 판단 구간 |
| D-7 ~ D-0 | **1.5x** | 임박 구간 (강조) |
| D+0 ~ D+7 | **2.0x** | 직후 즉시 반응 (최우선) |
| D+7 ~ | 1.0x | 사후 조정 |

### 신호 충돌 감지

```
충돌 조건:
  공매도 증가(>20%) + 기관 매수(increasing) → 상충 → WATCH
  공매도 감소(<-20%) + 기관 매도(decreasing) → 상충 → WATCH
```

### 의사결정 우선순위

| 순위 | 조건 | 액션 |
|------|------|------|
| 1 | 임상 결과 발표 (hasResults=true) | BUY 또는 SELL |
| 2 | 낮은 신뢰도 (confidence < 0.4) | WATCH |
| 3 | Phase 2 이하 + BEARISH | WATCH |
| 4 | 신호 충돌 (공매도 vs 기관 반대) | WATCH |
| 5 | D+0~D+7 + BEARISH | SELL (즉시 대응) |
| 6 | D-30~D-0 + BEARISH + Phase≥3 | RISK_MANAGE |
| 7 | BULLISH | BUY |
| 8 | BEARISH | SELL |
| 9 | NEUTRAL | HOLD |

### 최종 신뢰도

```
finalConfidence = signalConfidence × timeWeight × phaseMultiplier
```

---

## 5. 기술적 지표 (technicalIndicators.ts)

백테스트 및 차트 표시에 사용되는 보조 지표.

### RSI (14일)

```
RS = 평균 상승폭 / 평균 하락폭
RSI = 100 - (100 / (1 + RS))

> 70: 과매수   < 30: 과매도
```

### 볼린저 밴드 (20일, 2σ)

```
middle = SMA(20)
upper  = middle + 2σ
lower  = middle - 2σ
%B     = (close - lower) / (upper - lower) × 100

밴드 수축 → 관심도 상승 가능성
밴드 확장 → 강한 상승/하락 진행 중
```

### 거래량 비율

```
volumeRatio = 당일 거래량 / 20일 이동평균
> 2.0: 거래량 급증 (관심 집중)
< 0.5: 거래량 침체
```

---

## 6. 백테스트 검증 (backtest.ts)

과거 임상시험 이벤트 기준 수익률 분석으로 전략 유효성 검증.

### 분석 윈도우

```
D-30 ─────── D-7 ─── D-1 ── D ── D+7 ─────── D+30
│             │              │            │
preEvent30d   preEvent7d     │    postEvent7d  postEvent30d
                             │
                        이벤트 발생일
```

### 윈도우별 측정 항목

| 항목 | 설명 |
|------|------|
| returnPct | 구간 수익률 (%) |
| RSI | 14일 기준 모멘텀 |
| MA20 | 20일 이동평균 |
| Bollinger %B | 밴드 내 위치 |
| volumeRatio | 거래량 비율 |
| shortSellingRatio | 공매도 평균 |
| institutionalNetBuy | 기관 순매수 누적 |
| foreignNetBuy | 외국인 순매수 누적 |

---

## 7. 실전 예시

### 예: A 종목 (Phase 3, D-15)

```
[1단계: 신호 감지]
  기관: 전반 +150K → 후반 +180K (가속 중)
  외국인: 전반 +80K → 후반 +100K
  공매도: 7.5% → 6.2% (-17%)
  → 신호: BULLISH, 신뢰도: 0.75

[2단계: 콤보 매칭]
  AVOID 콤보 체크 → 해당 없음
  콤보 #1 체크:
    기관 후반(180K) > 전반(150K) ✓
    공매도(6.2%) ≤ 7% ✓
  → STRONG_BUY, 기대수익 +8.43%, 승률 94%

[3단계: Phase 보정]
  Phase 3 → 배수 1.5x
  → 보정 기대수익: 8.43% × 1.5 = 12.65%

[4단계: 스코어 합산]
  Timeline (D-15):    25점
  Impact (Phase 3):   20점
  Institutional:      25점
  Short Signal:       15점
  Competition:         5점
  → 총점: 90 / 100

[5단계: 의사결정]
  충돌 없음 → BULLISH → BUY
  시간 가중치: 1.5x (D-7~D-0 구간)
  최종 신뢰도: 0.75 × 1.5 = 1.125 → clamp(1.0)
```

---

## 8. 내부 API 레퍼런스 (Next.js Routes)

### 8.1 데이터 수집 (Cron)

| 메서드 | 경로 | 스케줄 (KST) | 인증 | 설명 |
|--------|------|-------------|------|------|
| GET | `/api/cron/clinical-batch` | 06:00 매일 | CRON_SECRET | 임상시험 메타데이터 수집 |
| GET | `/api/cron/clinical-short-selling` | 06:15 평일 | CRON_SECRET + KIS | 공매도 비율 수집 (7일) |
| GET | `/api/cron/clinical-investor` | 06:30 평일 | CRON_SECRET + KIS | 기관/외국인 매매동향 (7일) |
| GET | `/api/cron/clinical-recommendations` | 06:45 평일 | CRON_SECRET | 콤보 스코어링 + 추천 생성 |

### 8.2 수동 배치 수집 (Admin)

| 메서드 | 경로 | 인증 | 설명 |
|--------|------|------|------|
| POST | `/api/stock/clinical/batch/collect` | 로그인 + Admin | 임상시험 전체 수집 |
| POST | `/api/stock/clinical/batch/collect-short-selling` | 로그인 + Admin | 공매도 수동 수집 |
| POST | `/api/stock/clinical/batch/backfill-investor` | 로그인 + Admin | 기관/외국인 과거 데이터 백필 |
| POST | `/api/stock/clinical/batch/backfill-investor-gaps` | 로그인 + Admin | 기관/외국인 누락 구간 보충 |
| POST | `/api/stock/clinical/batch/backfill-short-selling` | 로그인 + Admin | 공매도 과거 데이터 백필 |

### 8.3 조회 API

| 메서드 | 경로 | 파라미터 | 설명 |
|--------|------|----------|------|
| GET | `/api/stock/clinical/trials` | `symbol`, `status`, `phase`, `completionWithin` | 임상시험 목록 |
| GET | `/api/stock/clinical/scores` | `sort`, `limit` | 스코어 랭킹 |
| GET | `/api/stock/clinical/trading-signals` | `symbol`, `range` | 공매도/기관/외국인 시계열 |
| GET | `/api/stock/clinical/recommendations` | `symbol`, `grade` | 추천 목록 |
| GET | `/api/stock/clinical/score-trend` | `symbol` | 스코어 추이 |
| GET | `/api/stock/clinical/competition` | `symbol` | 경쟁사 분석 |

### 8.4 액션 API

| 메서드 | 경로 | 설명 |
|--------|------|------|
| POST | `/api/stock/clinical/recommendations/refresh` | 추천 수동 갱신 |
| POST | `/api/stock/clinical/ai-impact` | AI 영향도 분석 요청 |
| GET/POST | `/api/stock/clinical/watchlist` | 관심 종목 조회/추가 |
| PATCH/DELETE | `/api/stock/clinical/watchlist/[id]` | 관심 종목 수정/삭제 |
| POST | `/api/stock/clinical/backtest` | 백테스트 실행 |

---

## 9. 인증 흐름

### KIS API 인증
```
1. CRON_KIS_USER_ID → exchange_api_keys 테이블 조회
2. AES 복호화 → appkey, appsecret 획득
3. KIS OAuth → access_token 발급
4. Bearer {access_token} + tr_id 헤더로 API 호출
```

### Cron 인증
```
Vercel → GET /api/cron/* (Authorization: Bearer {CRON_SECRET})
```

### 내부 API 인증
```
클라이언트 → Supabase Auth (JWT) → getEffectiveUserId() → 데이터 접근
Admin API → 추가 권한 체크 (user_type = 'ADMIN')
```

---

## 10. 환경변수 요약

| 변수 | 용도 | 필수 |
|------|------|------|
| `NEXT_PUBLIC_SUPABASE_URL` | Supabase REST API URL | O |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | Supabase 익명 키 | O |
| `SUPABASE_SERVICE_ROLE_KEY` | Supabase 서비스 키 (배치용 RLS 우회) | O |
| `CRON_SECRET` | Vercel Cron 인증 토큰 | O |
| `CRON_KIS_USER_ID` | KIS API 키 조회용 사용자 ID | O (Cron) |
| `AZURE_OPENAI_API_KEY` | Azure OpenAI API 키 | AI 분석 시 |
| `AZURE_OPENAI_ENDPOINT` | Azure OpenAI 엔드포인트 | AI 분석 시 |
| `AZURE_OPENAI_DEPLOYMENT` | Azure OpenAI 배포 모델명 | AI 분석 시 |

---

## 핵심 설계 원칙

| 원칙 | 적용 |
|------|------|
| **위험 우선 감지** | AVOID 콤보를 항상 먼저 체크 |
| **3중 확인** | 공매도 + 기관 + 외국인 신호 교차 검증 |
| **전반/후반 비교** | 단순 평균이 아닌 방향성(momentum) 캡처 |
| **Phase 보정** | 임상 진행도에 따른 기대수익 조정 |
| **신호 충돌 처리** | 상충 시 WATCH → 추가 확인 유도 |
| **시간 가중치** | 이벤트 임박/직후 신호에 높은 가중치 |
| **데이터 기반 신뢰도** | 데이터 포인트 수 → 자동 신뢰도 조절 |

---

## 관련 파일

### 데이터 수집

| 파일 | 역할 |
|------|------|
| `src/lib/clinical/clinicaltrials-api.ts` | ClinicalTrials.gov API v2 클라이언트 |
| `src/lib/clinical/short-selling-collector.ts` | KIS API 공매도 데이터 수집 |
| `src/lib/clinical/investor-collector.ts` | KIS API 기관/외국인 매매동향 수집 |
| `src/lib/clinical/company-mapper.ts` | 스폰서명 → 종목코드 매핑 |
| `src/lib/clinical/competition-mapper.ts` | 경쟁사 자동 매핑 |
| `src/app/api/cron/clinical-batch/route.ts` | 임상시험 수집 Cron |
| `src/app/api/cron/clinical-short-selling/route.ts` | 공매도 수집 Cron |
| `src/app/api/cron/clinical-investor/route.ts` | 기관/외국인 수집 Cron |

### 분석 & 추천

| 파일 | 역할 |
|------|------|
| `src/lib/clinical/signal-detector.ts` | BULLISH/NEUTRAL/BEARISH 신호 감지 |
| `src/lib/clinical/combo-scorer.ts` | 10종 콤보 매칭 → 5단계 등급 |
| `src/lib/clinical/scoring.ts` | 100점 만점 종합 스코어 |
| `src/lib/clinical/decision-matrix.ts` | 최종 매매 액션 결정 |
| `src/lib/clinical/technicalIndicators.ts` | RSI, 볼린저 밴드, 거래량 비율 |
| `src/lib/clinical/backtest.ts` | 이벤트 윈도우 수익률 분석 |
| `src/app/api/stock/clinical/recommendations/refresh/route.ts` | 추천 배치 갱신 |
| `src/app/api/cron/clinical-recommendations/route.ts` | 추천 Cron 배치 핸들러 |
| `src/app/api/stock/clinical/scores/route.ts` | 스코어 랭킹 API |
| `src/app/api/stock/clinical/trading-signals/route.ts` | 신호 데이터 API |
