# CTI 의사결정 매트릭스

본 문서는 스코어링 결과를 의사결정 라벨로 변환하는 규칙을 정의합니다.

## 의사결정 라벨

| 라벨 | 의미 | 아이콘 |
|------|------|--------|
| TRIAL_STRONG_POSITIVE | 강한 긍정 신호 (높은 점수 + Phase 3 + D-30 + 유리한 RSI) | 🟢 |
| TRIAL_POSITIVE | 긍정 신호 | 🟩 |
| TRIAL_NEUTRAL | 중립 — 신호 강도 부족 | 🟡 |
| TRIAL_WATCH | 모니터링 대상, 아직 행동 불가 | 🟠 |
| TRIAL_REVIEW | 결과 게시됨, 수동 검토 필요 | 🔵 |
| TRIAL_NEGATIVE | 부정 신호 (활성 임상 없음, 파이프라인 빈약) | 🔴 |

**주의**: 이 라벨은 임상시험 데이터 기반 신호이며, 투자 조언이 아닙니다.

---

## 의사결정 규칙 (우선순위 순서)

아래 규칙은 위에서부터 순서대로 평가하며, 첫 번째 매칭 규칙이 적용됩니다.

### Priority 1: TRIAL_REVIEW
```
조건: trial.hasResults == true
라벨: TRIAL_REVIEW
이유: 임상시험 결과가 게시됨 — 수동 분석 필요
```

### Priority 2: TRIAL_WATCH (데이터 부족)
```
조건: data_richness 점수 == 0 OR 점수를 받은 컴포넌트 < 3개
라벨: TRIAL_WATCH
이유: 데이터 신뢰도 부족
```

### Priority 3: TRIAL_WATCH (초기 Phase)
```
조건: phase == "Phase 1" OR phase == "Early Phase 1"
라벨: TRIAL_WATCH
이유: 초기 Phase로 높은 리스크
```

### Priority 4: TRIAL_STRONG_POSITIVE
```
조건: totalScore >= 75 AND phase == "Phase 3" AND D-30 이내 AND RSI < 50
라벨: TRIAL_STRONG_POSITIVE
이유: 높은 점수 + Phase 3 + 임박한 완료 + RSI 유리
```

### Priority 5: TRIAL_WATCH (과매수 경고)
```
조건: totalScore >= 75 AND phase == "Phase 3" AND D-30 이내 AND RSI > 70
라벨: TRIAL_WATCH
이유: 강한 임상 펀더멘탈이지만 RSI 과매수 — 이미 가격 반영
```

### Priority 4b: TRIAL_STRONG_POSITIVE (RSI 없음)
```
조건: totalScore >= 75 AND phase == "Phase 3" AND D-30 이내 AND RSI == null
라벨: TRIAL_STRONG_POSITIVE
이유: RSI 데이터 없이 강한 임상 신호로 기본 강한 긍정
```

### Priority 6: TRIAL_POSITIVE
```
조건: totalScore >= 60
라벨: TRIAL_POSITIVE
이유: 긍정적 임상 전망
```

### Priority 7: TRIAL_NEUTRAL
```
조건: totalScore >= 40
라벨: TRIAL_NEUTRAL
이유: 중립 범위 (40-59)
```

### Priority 8: TRIAL_WATCH
```
조건: totalScore < 40
라벨: TRIAL_WATCH
이유: 점수 부족
```

---

## 신뢰도 수준 (Confidence Level)

| 수준 | 조건 |
|------|------|
| HIGH | totalScore >= 70 AND data_richness >= 4 |
| MEDIUM | totalScore >= 40 AND data_richness >= 2 |
| LOW | 기타 |
