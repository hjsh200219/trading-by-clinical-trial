---
name: pipeline-overview
description: "한국 제약/바이오 기업의 파이프라인 현황 총괄. 활성 임상시험 수 기준 랭킹, Phase 분포, 가장 가까운 카탈리스트를 표시합니다. MANDATORY TRIGGERS: '파이프라인', 'pipeline', '파이프라인 현황', '기업 순위', '한국 제약 현황', '바이오 파이프라인' 등 파이프라인 총괄 요청 시 트리거."
---

# 한국 제약/바이오 파이프라인 총괄 스킬

한국 제약/바이오 기업의 활성 임상시험 파이프라인을 랭킹 형태로 총괄합니다.

**Important**: 임상시험 등록 메타데이터에 기반합니다. 투자 조언이 아닙니다.

---

## 워크플로우

### 1단계: 파라미터 설정

- **top**: 표시할 기업 수 (기본: 10, 범위: 1-50)
- **phase**: Phase 필터 (선택, 예: "Phase 3")

### 2단계: 전체 기업 파이프라인 수집

```
활용 도구:
- Clinical_Trials_MCP > list_kr_pharma_trials: 한국 제약 임상시험 전체 목록
- Clinical_Trials_MCP > search_trials: 기업별 임상시험 검색
- bio-research c-trials > search_by_sponsor: 스폰서별 파이프라인
```

**검색 절차:**
1. `references/kr-pharma-companies.md`의 전체 기업 목록 참조
2. 각 기업의 스폰서명으로 임상시험 검색
3. Phase 필터 적용 (지정된 경우)
4. 기업별 집계: 활성 임상 수, Phase 분포, 가장 가까운 카탈리스트

### 3단계: 랭킹 및 보고서

활성 임상시험 수 기준 내림차순 정렬 후 상위 N개 기업을 표시합니다.

Phase Mix 축약:
- "Phase 3" → "P3", "Phase 2" → "P2", "Phase 1" → "P1" 등

```markdown
## 한국 제약/바이오 파이프라인 현황

| 순위 | 기업 | 종목코드 | 활성 임상 수 | 가장 가까운 카탈리스트 | Phase Mix |
|------|------|---------|-------------|---------------------|-----------|
| 1 | {기업명} | {코드} | {N} | {날짜} | P3:2 P2:3 P1:1 |
{... top N개 기업}

---
_임상시험 메타데이터 기반입니다. 투자 조언이 아닙니다._
```

---

## 사용 예시

```
pipeline-overview                      → 상위 10개 기업
pipeline-overview --top 20             → 상위 20개 기업
pipeline-overview --phase "Phase 3"    → Phase 3만 필터
```
