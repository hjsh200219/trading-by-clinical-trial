---
name: score-stock
description: "한국 제약/바이오 주식의 임상시험 기반 100점 스코어링 상세 분석. 6개 컴포넌트별 점수 산출 및 의사결정 라벨을 표시합니다. MANDATORY TRIGGERS: '스코어', '점수', 'score', '스코어링', '점수 분석', '평가' 등 임상시험 기반 스코어링 요청 시 트리거."
---

# 임상시험 기반 스코어링 스킬

사용자가 제공하는 종목코드 또는 기업명을 기반으로 6개 컴포넌트별 상세 점수를 산출합니다.

**Important**: 임상시험 메타데이터와 공개 시장 데이터에 기반합니다. 투자 조언이 아닙니다.

---

## 워크플로우

### 1단계: 기업 식별 및 임상시험 수집

`references/kr-pharma-companies.md`에서 종목코드 ↔ 스폰서명 매핑을 확인합니다.

```
활용 도구:
- Clinical_Trials_MCP > search_trials: 종목코드/스폰서명으로 검색
- bio-research c-trials > search_by_sponsor: 영문 스폰서명으로 검색
- Clinical_Trials_MCP > get_trial_detail: 개별 상세 정보
```

### 2단계: 각 임상시험별 6개 컴포넌트 스코어링

`references/scoring-methodology.md`의 규칙을 정확히 따릅니다:

**Temporal Proximity (30점)**: 완료일까지 남은 일수
- hasResults→30, D-30→26, D-90→19, D-180→12, D-365→6, 365+→2, 없음→1

**Impact (25점)**: Phase + enrollment(>500명 대규모)
- P3 대규모→25, P3 표준→21, P2 대규모→15, P2 표준→12, P4→8, P1 대규모→5, P1 표준→4, 미상→2

**Market Signal (15점)**: RSI + Bollinger + Volume Ratio 조합
- RSI<30 & Vol>1.5x→15, RSI<40 & BB<20%→12, RSI 40-60 & Vol>2x→10, RSI 40-60 & Vol정상→5, RSI>70→2, 기타→3, 없음→0

**Competition (15점)**: 동일 condition 경쟁 임상 수
- 경쟁자 0→15, 1-2→10, 3-5→6, 6+→2, Phase advantage bonus +3

**Pipeline (10점)**: 활성 임상 수
- 0→0, 1→2, 2→4, 3-4→7, 5+→10, 다중 치료영역 +2

**Data Richness (5점)**: 메타데이터 완성도 (각 1점)
- drug_name, condition, enrollment, estimated_completion_date, hasResults

### 3단계: 의사결정 라벨 결정

`references/decision-matrix.md`의 우선순위 규칙을 순서대로 적용합니다.

### 4단계: 보고서 작성

```markdown
# 스코어 분석: {기업명} ({종목코드})

**RSI**: {값} ({해석})

## Best Trial — {라벨 아이콘} {라벨}
### {NCT ID}
- **약물**: {drug_name}
- **적응증**: {condition}
- **Phase**: {phase}
- **총점**: {totalScore} / 100
- **의사결정**: {라벨}

| 컴포넌트 | 점수 | 상세 |
|----------|------|------|
| Temporal Proximity | {점수} / 30 | {상세} |
| Impact | {점수} / 25 | {상세} |
| Market Signal | {점수} / 15 | {상세} |
| Competition | {점수} / 15 | {상세} |
| Pipeline | {점수} / 10 | {상세} |
| Data Richness | {점수} / 5 | {상세} |

## 전체 스코어 요약
- **{NCT ID}** | {Phase} | Score: {점수} | {라벨}
{... 각 임상시험별}

---
_임상시험 메타데이터와 공개 시장 데이터에 기반합니다. 투자 조언이 아닙니다._
```

---

## 사용 예시

```
score-stock 068270       → 셀트리온 스코어 분석
score-stock 207940       → 삼성바이오로직스 스코어 분석
score-stock Yuhan        → 유한양행 스코어 분석
```
