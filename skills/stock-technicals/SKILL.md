---
name: stock-technicals
description: "한국 제약/바이오 주식의 기술적 지표 분석 (RSI, Bollinger Bands, Volume Ratio). Yahoo Finance 공개 데이터를 활용한 기술적 분석을 제공합니다. MANDATORY TRIGGERS: '기술적', 'technical', 'RSI', '볼린저', 'Bollinger', '거래량', 'volume', '기술적 지표', '차트 분석' 등 기술적 분석 요청 시 트리거."
---

# 기술적 지표 분석 스킬

한국 제약/바이오 주식의 기술적 지표(RSI, Bollinger Bands, Volume Ratio)를 분석합니다.

**Important**: 공개 시장 데이터에 기반합니다. 투자 조언이 아닙니다.

---

## 워크플로우

### 1단계: 기업 식별

`references/kr-pharma-companies.md`에서 종목코드 → Yahoo Finance 심볼 매핑:
- KOSPI: `{종목코드}.KS`
- KOSDAQ: `{종목코드}.KQ`

### 2단계: 시장 데이터 수집

Yahoo Finance에서 OHLCV 가격 데이터를 수집합니다.

- **range**: 데이터 기간 (기본: 3개월)
- 종가(close)와 거래량(volume) 배열 추출

### 3단계: 기술적 지표 계산

#### RSI (14일, Wilder's Smoothing)
- 14일 기간의 상승폭/하락폭 평균으로 계산
- Wilder's smoothing: `avg = (prev_avg × 13 + current) / 14`
- RSI = 100 - (100 / (1 + RS))
- **해석**: < 30 과매도, 30-70 중립, > 70 과매수
- **최소 데이터**: 15개 종가

#### Bollinger Bands (%B)
- 20일 단순이동평균(SMA) 기준
- 상단/하단 밴드: SMA ± 2 × 표준편차
- %B = (현재가 - 하단밴드) / (상단밴드 - 하단밴드) × 100
- **해석**: < 20% 하단 근접, 20-80% 중간, > 80% 상단 근접
- **최소 데이터**: 20개 종가

#### Volume Ratio
- 당일 거래량 / 20일 평균 거래량
- **해석**: < 0.5 저조, 0.5-1.5 정상, 1.5-3.0 높음, > 3.0 급증
- **최소 데이터**: 21개 거래량

### 4단계: 보고서 작성

```markdown
## {기업명} — 기술적 지표

**심볼**: {Yahoo Finance 심볼}
**현재가**: {가격}
**기간**: {range}

| 지표 | 값 | 해석 |
|------|-----|------|
| RSI (14) | {값} | {해석} |
| Bollinger %B | {값}% | {밴드 위치} |
| Volume Ratio | {값}x | {해석} |

**종합**: {RSI 해석}; {Bollinger 해석}; {Volume 해석}.

---
_Yahoo Finance 공개 데이터 기반입니다. 투자 조언이 아닙니다._
```

---

## 사용 예시

```
stock-technicals 068270              → 셀트리온 기술적 지표 (3개월)
stock-technicals 207940 --range 6mo  → 삼성바이오 기술적 지표 (6개월)
stock-technicals 알테오젠             → 알테오젠 기술적 지표
```

## Market Signal 스코어링 연계

이 스킬의 결과는 `analyze-stock`과 `score-stock`의 Market Signal (15점) 컴포넌트에 직접 활용됩니다:

| 조건 | 점수 |
|------|------|
| RSI < 30 AND Volume > 1.5x | 15 |
| RSI < 40 AND Bollinger %B < 20% | 12 |
| RSI 40-60 AND Volume > 2.0x | 10 |
| RSI 40-60 AND Volume 0.5-2.0x | 5 |
| RSI > 70 | 2 |
| 기타 | 3 |
| 데이터 없음 | 0 |
