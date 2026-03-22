# CTI 스코어링 방법론 (100점 만점)

본 문서는 한국 제약/바이오 주식의 임상시험 기반 투자 신호 스코어링 시스템을 정의합니다.

## 스코어링 컴포넌트 (6개, 총 100점)

| 컴포넌트 | 최대 점수 | 설명 |
|----------|----------|------|
| Temporal Proximity | 30 | 임상시험 완료까지 남은 시간 |
| Impact | 25 | 임상시험 Phase 및 등록 규모 |
| Market Signal | 15 | 기술적 지표 (RSI, Bollinger, Volume) |
| Competition | 15 | 글로벌 경쟁 환경 |
| Pipeline | 10 | 기업의 활성 임상시험 포트폴리오 |
| Data Richness | 5 | 메타데이터 완성도 |

---

## 1. Temporal Proximity (최대 30점)

임상시험 완료일까지 남은 기간 기반 점수:

| 조건 | 점수 |
|------|------|
| 결과 게시됨 (hasResults=true) | 30 |
| D-30 이내 (완료일 ≤ 30일) | 26 |
| D-31 ~ D-90 | 19 |
| D-91 ~ D-180 | 12 |
| D-181 ~ D-365 | 6 |
| D-365+ | 2 |
| 완료일 없음 | 1 |

---

## 2. Impact (최대 25점)

Phase와 등록 규모(enrollment) 기반:

| Phase | 표준 등록 | 대규모 (>500명) |
|-------|----------|----------------|
| Phase 3 | 21 | 25 |
| Phase 2 | 12 | 15 |
| Phase 4 (post-marketing) | 8 | 8 |
| Phase 1 | 4 | 5 |
| Early Phase 1 / Unknown | 2 | 2 |

---

## 3. Market Signal (최대 15점)

기술적 지표 조합에 따른 규칙 기반 점수:

| 우선순위 | 조건 | 점수 | 설명 |
|---------|------|------|------|
| 1 | RSI < 30 AND Volume Ratio > 1.5x | 15 | 과매도 + 거래량 급증 — 강한 기술적 신호 |
| 2 | RSI < 40 AND Bollinger %B < 20% | 12 | 기술적 침체 |
| 3 | RSI 40-60 AND Volume Ratio > 2.0x | 10 | 중립 RSI + 비정상 거래량 |
| 4 | RSI 40-60 AND Volume Ratio 0.5-2.0x | 5 | 중립 기본값 |
| 5 | RSI > 70 | 2 | 과매수 — 이미 가격에 반영됨 |
| 6 | 기타 | 3 | 지배적 신호 없음 |
| — | 시장 데이터 없음 | 0 | 점수 보류 |

### 기술적 지표 계산 방법

- **RSI (14일)**: Wilder's smoothing method, 14일 기간
  - < 30: 과매도, 30-70: 중립, > 70: 과매수
- **Bollinger %B**: 20일 SMA, 2 표준편차
  - 현재가의 밴드 내 위치 (0% = 하단, 100% = 상단)
- **Volume Ratio**: 당일 거래량 / 20일 평균 거래량
  - < 0.5: 저조, 0.5-1.5: 정상, 1.5-3.0: 높음, > 3.0: 급증

---

## 4. Competition (최대 15점)

동일 condition + phase 내 경쟁 임상시험 수:

| 경쟁자 수 | 기본 점수 | 설명 |
|----------|----------|------|
| 0 | 15 | First mover (선발자) |
| 1-2 | 10 | 소수 경쟁 |
| 3-5 | 6 | 보통 경쟁 |
| 6+ | 2 | 과밀 경쟁 |

**Phase Advantage Bonus (+3)**: 대상 임상이 Phase 3이고 모든 경쟁자가 Phase 1인 경우

---

## 5. Pipeline (최대 10점)

기업의 활성(recruiting/active/enrolling) 임상시험 수:

| 활성 임상 수 | 기본 점수 |
|-------------|----------|
| 0 | 0 |
| 1 | 2 |
| 2 | 4 |
| 3-4 | 7 |
| 5+ | 10 |

**Multiple Therapeutic Areas Bonus (+2)**: 2개 이상 치료 영역에 활성 임상이 있는 경우

---

## 6. Data Richness (최대 5점)

메타데이터 필드 완성도 (각 1점):

| 필드 | 조건 |
|------|------|
| drug_name | not null, not empty |
| condition | not null, not empty |
| enrollment | not null |
| estimated_completion_date | not null, not empty |
| results_status | hasResults = true |
