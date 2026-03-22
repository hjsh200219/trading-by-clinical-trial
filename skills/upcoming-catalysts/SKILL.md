---
name: upcoming-catalysts
description: "한국 제약/바이오 기업의 향후 N개월 이내 임상시험 완료 예정 이벤트(카탈리스트) 목록. 특정 기업 또는 전체 커버리지 기업의 예정된 임상시험 카탈리스트를 시간순으로 정리합니다. MANDATORY TRIGGERS: '카탈리스트', '촉매', 'catalyst', '다가오는', '예정된', '완료 예정', '일정', 'upcoming' 등 임상시험 카탈리스트 요청 시 트리거."
---

# 임상시험 카탈리스트 추적 스킬

향후 N개월 이내에 완료 예정인 한국 제약/바이오 임상시험 이벤트를 시간순으로 정리합니다.

**Important**: 임상시험 등록 메타데이터의 예상 완료일 기반입니다. 실제 완료일은 변경될 수 있습니다.

---

## 워크플로우

### 1단계: 파라미터 설정

- **months**: 검색 기간 (기본: 6개월, 범위: 1-36개월)
- **phase**: Phase 필터 (선택, 예: "Phase 3")
- **symbol**: 특정 종목코드 (선택, 없으면 전체 기업 검색)

### 2단계: 데이터 수집

```
활용 도구:
- Clinical_Trials_MCP > search_trials: 각 기업별 임상시험 검색
- Clinical_Trials_MCP > get_upcoming_events: 예정 이벤트 조회
- bio-research c-trials > search_by_sponsor: 스폰서별 파이프라인
```

**검색 절차:**
1. 특정 symbol이 있으면 해당 기업만, 없으면 `references/kr-pharma-companies.md`의 전체 기업 검색
2. 각 기업의 모든 스폰서명으로 임상시험 검색
3. estimatedCompletionDate가 현재 ~ cutoff(현재 + N개월) 사이인 임상만 필터
4. Phase 필터 적용 (지정된 경우)
5. 완료일 기준 오름차순 정렬

### 3단계: 보고서 작성

```markdown
## 임상시험 카탈리스트 ({N}개월 이내)

| 예정일 | 기업 | NCT ID | 약물 | 적응증 | Phase |
|--------|------|--------|------|--------|-------|
{카탈리스트 목록, 날짜순}

---
_임상시험 메타데이터 기반입니다. 투자 조언이 아닙니다._
```

---

## 사용 예시

```
upcoming-catalysts                          → 전체 기업, 6개월 이내
upcoming-catalysts --months 3               → 전체 기업, 3개월 이내
upcoming-catalysts --months 3 --phase "Phase 3"  → Phase 3만, 3개월 이내
upcoming-catalysts 068270                   → 셀트리온만, 6개월 이내
```
