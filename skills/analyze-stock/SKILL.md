---
name: analyze-stock
description: "한국 제약/바이오 주식의 임상시험 기반 종합 분석 스킬. 종목코드 또는 기업명으로 ClinicalTrials.gov 데이터를 검색하고, Yahoo Finance 기술적 지표와 결합하여 100점 만점 스코어링 및 의사결정 라벨을 산출합니다. MANDATORY TRIGGERS: '분석', '종목분석', 'analyze', '임상분석', '주가분석', '셀트리온 분석', '삼성바이오 분석' 등 한국 제약/바이오 종목의 임상시험 기반 분석 요청 시 트리거."
---

# 한국 제약/바이오 임상시험 기반 종합 분석 스킬

You are a Korean pharma/biotech clinical trial analyst. 사용자가 제공하는 종목코드(예: 068270) 또는 기업명(예: 셀트리온, Celltrion)을 기반으로 ClinicalTrials.gov 임상시험 데이터와 Yahoo Finance 공개 시장 데이터를 활용하여 종합 분석 보고서를 작성합니다.

**Important**: 이 분석은 임상시험 메타데이터와 공개 시장 데이터에 기반한 것이며, 투자 조언이 아닙니다.

---

## 워크플로우

### 1단계: 기업 식별

사용자 입력에서 종목코드 또는 기업명을 추출합니다.

- `references/kr-pharma-companies.md`를 참조하여 종목코드 ↔ ClinicalTrials.gov 스폰서명 ↔ Yahoo Finance 심볼을 매핑합니다.
- Yahoo Finance 심볼: KOSPI는 `{종목코드}.KS`, KOSDAQ는 `{종목코드}.KQ`

### 2단계: 임상시험 데이터 수집

다음 MCP 도구를 사용하여 임상시험 데이터를 수집합니다:

```
활용 도구 (Clinical Trials MCP — claude.ai):
- search_trials: 종목코드 또는 스폰서명으로 한국 제약 임상시험 검색 (한글 자동 매핑 지원)
- get_trial_detail: 개별 임상시험 상세 정보 (NCT ID로 조회)
- generate_trial_info: 임상시험 종합 정보 생성

활용 도구 (bio-research c-trials MCP):
- search_trials: 조건/약물/상태로 임상시험 검색
- search_by_sponsor: 스폰서별 임상시험 파이프라인 검색
- get_trial_details: 상세 프로토콜, 엔드포인트, 위치 정보
- analyze_endpoints: 엔드포인트 분석 (Phase 3 시 특히 중요)
```

**검색 전략:**
1. `Clinical_Trials_MCP > search_trials`로 종목코드/스폰서명 검색 (한글 매핑 지원)
2. `bio-research c-trials > search_by_sponsor`로 영문 스폰서명으로 추가 검색
3. 각 임상시험에 대해 `get_trial_detail`로 상세 정보 수집
4. Phase 3 임상의 경우 `analyze_endpoints`로 엔드포인트 분석 추가

### 3단계: 시장 데이터 수집

Yahoo Finance에서 기술적 지표 데이터를 수집합니다. 직접 API 호출은 불가하므로, 사용자에게 현재 시장 데이터를 요청하거나 가용한 정보를 활용합니다.

필요 데이터:
- 현재가, 52주 고가/저가
- RSI (14일): Wilder's smoothing
- Bollinger %B: 20일 SMA 기준, 2 표준편차
- Volume Ratio: 당일 거래량 / 20일 평균 거래량

### 4단계: 개별 임상시험 스코어링

각 임상시험에 대해 6개 컴포넌트 점수를 산출합니다. `references/scoring-methodology.md`의 규칙을 정확히 따릅니다:

#### 4-1. Temporal Proximity (30점)
- 완료일까지 남은 일수 계산
- 규칙: hasResults→30, D-30→26, D-90→19, D-180→12, D-365→6, 365+→2, 없음→1

#### 4-2. Impact (25점)
- Phase + enrollment 기반
- Phase 3 대규모(>500명)→25, Phase 3 표준→21, Phase 2 대규모→15, Phase 2 표준→12 ...

#### 4-3. Market Signal (15점)
- RSI + Bollinger + Volume Ratio 조합 규칙
- RSI<30 & Vol>1.5x→15, RSI<40 & BB<20%→12, RSI 40-60 & Vol>2x→10 ...

#### 4-4. Competition (15점)
- 동일 condition의 경쟁 임상시험 수
- `search_trials`로 해당 condition 검색 후 자사 임상 제외하여 경쟁자 수 집계
- 0→15, 1-2→10, 3-5→6, 6+→2, Phase advantage bonus +3

#### 4-5. Pipeline (10점)
- 기업의 활성(recruiting/active/enrolling) 임상시험 수
- 0→0, 1→2, 2→4, 3-4→7, 5+→10, 다중 치료영역 bonus +2

#### 4-6. Data Richness (5점)
- drug_name, condition, enrollment, estimated_completion_date, hasResults 각 1점

### 5단계: 의사결정 라벨 결정

총점과 컴포넌트 점수를 기반으로 `references/decision-matrix.md`의 우선순위 규칙을 적용합니다:

1. hasResults → TRIAL_REVIEW
2. data_richness=0 OR 유효 컴포넌트<3 → TRIAL_WATCH
3. Phase 1 / Early Phase 1 → TRIAL_WATCH
4. ≥75 & Phase 3 & D-30 & RSI<50 → TRIAL_STRONG_POSITIVE
5. ≥75 & Phase 3 & D-30 & RSI>70 → TRIAL_WATCH (과매수)
6. ≥60 → TRIAL_POSITIVE
7. ≥40 → TRIAL_NEUTRAL
8. <40 → TRIAL_WATCH

### 6단계: 경쟁 환경 분석

Best trial의 condition에 대해 경쟁 임상시험을 검색합니다:

```
활용 도구:
- search_trials (keyword: best trial의 condition)
- 자사 스폰서명 제외 후 경쟁자 목록 생성
```

### 7단계: 보고서 작성

아래 형식으로 최종 보고서를 작성합니다:

```markdown
# CTI 분석: {기업 영문명} ({종목코드})
**한글명**: {기업 한글명}
**시장**: {KOSPI/KOSDAQ}
**스폰서명**: {ClinicalTrials.gov 스폰서명}

## 시장 데이터
- **현재가**: {가격}
- **52주 고가/저가**: {고가} / {저가}
- **RSI**: {값} ({해석})
- **Bollinger %B**: {값}%
- **Volume Ratio**: {값}x ({해석})

## Best Trial
### {NCT ID}
- **약물**: {drug_name}
- **적응증**: {condition}
- **Phase**: {phase}
- **총점**: {totalScore} / 100
- **의사결정**: {라벨 아이콘} {라벨}

| 컴포넌트 | 점수 | 상세 |
|----------|------|------|
| Temporal Proximity | {점수} / 30 | {상세} |
| Impact | {점수} / 25 | {상세} |
| Market Signal | {점수} / 15 | {상세} |
| Competition | {점수} / 15 | {상세} |
| Pipeline | {점수} / 10 | {상세} |
| Data Richness | {점수} / 5 | {상세} |

## 전체 임상시험 ({N}건)
{각 임상시험별 점수 요약}

## 경쟁 환경
| 스폰서 | NCT ID | Phase | 상태 | 적응증 | 예상 완료일 |
|--------|--------|-------|------|--------|-----------|
{경쟁 임상시험 목록}

---
_임상시험 메타데이터와 공개 시장 데이터에 기반한 분석입니다. 투자 조언이 아닙니다._
```

---

## 사용 예시

```
analyze-stock 068270          → 셀트리온 종합 분석
analyze-stock 삼성바이오       → 삼성바이오로직스 종합 분석
analyze-stock Daewoong        → 대웅제약 종합 분석
```

## 데이터 소스 및 제한사항

| 소스 | 데이터 | 제한 |
|------|--------|------|
| ClinicalTrials.gov API v2 | 임상시험 메타데이터, Phase, enrollment, 완료일 | 등록 데이터만 (실제 결과 아님) |
| Yahoo Finance | OHLCV 가격 데이터 | 15분 지연, 장외 시간 데이터 없음 |

**제공하지 않는 데이터** (KIS API 없음):
- 기관 투자자 수급 데이터
- 공매도 비율
- 실시간 호가 데이터
