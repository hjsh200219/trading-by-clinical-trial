---
name: competition-analysis
description: "특정 적응증(condition) 또는 임상시험(NCT ID) 기준의 글로벌 경쟁 환경 분석. 동일 치료 영역에서 진행 중인 경쟁 임상시험과 스폰서를 매핑합니다. MANDATORY TRIGGERS: '경쟁', '경쟁분석', 'competition', '경쟁 환경', '경쟁사', '같은 적응증' 등 경쟁 분석 요청 시 트리거."
---

# 경쟁 환경 분석 스킬

특정 적응증(condition) 또는 NCT ID를 기준으로 동일 치료 영역의 글로벌 경쟁 임상시험을 분석합니다.

**Important**: 임상시험 메타데이터에 기반합니다. 투자 조언이 아닙니다.

---

## 워크플로우

### 1단계: 분석 대상 확인

사용자 입력 유형에 따라 분기:

- **NCT ID 제공**: 해당 임상시험의 condition을 추출
- **Condition 직접 제공**: 바로 검색
- **종목코드/기업명 제공**: best trial의 condition으로 검색

```
활용 도구:
- Clinical_Trials_MCP > get_trial_detail: NCT ID로 condition 추출
- Clinical_Trials_MCP > search_trials: 종목코드로 기업 임상 검색
```

### 2단계: 경쟁 임상시험 검색

해당 condition에 대한 모든 임상시험을 검색합니다:

```
활용 도구:
- Clinical_Trials_MCP > search_trials (keyword: condition)
- bio-research c-trials > search_trials (condition: condition)
```

### 3단계: 경쟁자 필터링

- 대상 기업의 스폰서명과 일치하는 임상시험은 제외
- `references/kr-pharma-companies.md`를 참조하여 한국 기업 여부 표시
- 최대 15건까지 표시

### 4단계: 보고서 작성

```markdown
## 경쟁 환경 분석: {condition}
**총 경쟁자**: {N}개

| 스폰서 | NCT ID | Phase | 상태 | 적응증 | 예상 완료일 | KR |
|--------|--------|-------|------|--------|-----------|-----|
{경쟁 임상시험 목록, 한국 기업은 KR 표시}

---
_임상시험 메타데이터에 기반합니다. 투자 조언이 아닙니다._
```

---

## 사용 예시

```
competition-analysis NCT04123456                    → 특정 임상의 경쟁 환경
competition-analysis --condition "Breast Cancer"    → 유방암 경쟁 환경
competition-analysis 068270                         → 셀트리온 best trial 기준 경쟁
```
