import React, { useState, useEffect, useMemo, useCallback } from "react";
import {
  BarChart,
  Bar,
  LineChart,
  Line,
  AreaChart,
  Area,
  PieChart,
  Pie,
  ScatterChart,
  Scatter,
  ComposedChart,
  XAxis,
  YAxis,
  ZAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  ResponsiveContainer,
  Cell,
  LabelList,
  RadarChart,
  Radar,
  PolarGrid,
  PolarAngleAxis,
  PolarRadiusAxis,
  Treemap,
  ReferenceLine,
} from "recharts";

// 성능 최적화된 대시보드 컴포넌트
function App() {
  // === 상태 관리 ===
  // 기본 상태
  const [loading, setLoading] = useState(false);
  const [allData, setAllData] = useState([]);
  const [chartData, setChartData] = useState([]);
  const [timeSeriesData, setTimeSeriesData] = useState([]);
  const [distributionData, setDistributionData] = useState([]);
  const [lastUpdated, setLastUpdated] = useState(new Date().toLocaleString());
  const [activeTab, setActiveTab] = useState("executive");
  const [showInsights, setShowInsights] = useState(true);

  // 필터 상태
  const [selectedCenter, setSelectedCenter] = useState("전체");
  const [selectedDate, setSelectedDate] = useState("전체");
  const [selectedTime, setSelectedTime] = useState("전체");
  const [availableDates, setAvailableDates] = useState([]);
  const [availableTimes, setAvailableTimes] = useState([]);
  const [viewMode, setViewMode] = useState("daily");
  const [rollingAverage, setRollingAverage] = useState(true);
  const [showProjections, setShowProjections] = useState(false);
  const [performanceTarget, setPerformanceTarget] = useState(85);

  // 예측 분석 상태 (추가됨)
  const [predictionData, setPredictionData] = useState([]);
  const [forecastHorizon, setForecastHorizon] = useState(3); // 몇 시간 예측할지
  const [forecastConfidence, setForecastConfidence] = useState(80); // 신뢰도 (%)

  // McKinsey 스타일 색상 - 메모이제이션으로 성능 최적화
  const COLORS = useMemo(
    () => [
      "#0078D4", // Primary blue
      "#50AF95", // Teal
      "#FF8C00", // Orange
      "#775DD0", // Purple
      "#107C10", // Green
      "#D83B01", // Dark Orange
      "#00B0F0", // Light Blue
      "#737373", // Gray
      "#4472C4", // Steel Blue
      "#70AD47", // Light Green
    ],
    []
  );

  // 성과 등급 - 메모이제이션으로 성능 최적화
  const PERFORMANCE_GRADES = useMemo(
    () => [
      { range: [0, 50], label: "저조함", color: "#D83B01" },
      { range: [50, 70], label: "개선 필요", color: "#FFB900" },
      { range: [70, 85], label: "양호", color: "#107C10" },
      { range: [85, 95], label: "우수", color: "#0078D4" },
      { range: [95, 100], label: "최상위", color: "#775DD0" },
    ],
    []
  );

  // 시간 처리 헬퍼 함수 - 통일된 방식으로 시간 처리
  // 업무 시간이 10:00부터 다음날 01:00까지인 특수한 상황 처리
  const timeToNumber = useCallback((timeString) => {
    if (timeString === "전체") return -1;
    const hour = parseInt(timeString.split(":")[0]);
    // 00:00-09:00은 다음날 시간이므로 24-33으로 변환
    return hour < 10 && hour >= 0 ? hour + 24 : hour;
  }, []);

  const numberToTime = useCallback((timeNumber) => {
    if (timeNumber < 0) return "전체";
    const hour = timeNumber % 24;
    return `${hour.toString().padStart(2, "0")}:00`;
  }, []);

  // 트리맵 커스텀 렌더 함수 - useCallback으로 성능 최적화
  const customTreemapContent = useCallback(
    (props) => {
      const { x, y, width, height, index } = props;

      // 인덱스 유효성 검사
      if (!chartData || index >= chartData.length) return null;

      const centerData = chartData[index];
      return (
        <g>
          <rect
            x={x}
            y={y}
            width={width}
            height={height}
            style={{
              fill: centerData.performanceColor || "#0078D4",
              stroke: "#fff",
              strokeWidth: 2,
              strokeOpacity: 1,
            }}
          />
          {width > 30 && height > 30 && (
            <text
              x={x + width / 2}
              y={y + height / 2 - 10}
              textAnchor="middle"
              fill="#FFFFFF"
              fontSize={14}
              fontWeight="bold"
            >
              {centerData.name}
            </text>
          )}
          {width > 30 && height > 30 && (
            <text
              x={x + width / 2}
              y={y + height / 2 + 10}
              textAnchor="middle"
              fill="#FFFFFF"
              fontSize={12}
            >
              {centerData.completion.toFixed(1)}%
            </text>
          )}
        </g>
      );
    },
    [chartData]
  );

  // CSV 데이터를 파싱하는 함수 수정
  const parseCSVData = useCallback((csvText) => {
    console.log("parseCSVData 시작, 입력 길이:", csvText?.length);

    try {
      const lines = csvText.trim().split("\n");
      console.log("총 라인 수:", lines.length);

      // 빈 데이터 체크
      if (lines.length < 2) {
        console.log("데이터가 없습니다.");
        return [];
      }

      // 헤더 파싱
      const headers = lines[0]
        .split(",")
        .map((h) => h.replace(/^"(.*)"$/, "$1").trim());
      console.log("헤더:", headers);

      // 한국어 헤더 -> 영어 헤더 매핑 생성
      const headerMapping = {
        날짜: "date",
        시간: "time",
        센터명: "centerName",
        전체: "total",
        "마감률(%)": "completion",
        마감: "closed",
        잔여: "remaining",
        접수: "receipt",
        할당: "assigned",
        출력: "output",
      };

      // 열 매핑 (헤더명 -> 컬럼 인덱스)
      const columnMap = {};
      headers.forEach((header, index) => {
        const cleanHeader = header.replace(/\r/g, "");

        // 한국어 헤더를 영어로 변환
        const englishHeader = headerMapping[cleanHeader] || cleanHeader;
        columnMap[englishHeader] = index;
      });
      console.log("열 매핑:", columnMap);

      const allData = [];
      const centers = new Set();
      const dates = new Set();
      const times = new Set();

      // 데이터 파싱
      for (let i = 1; i < lines.length; i++) {
        const line = lines[i].trim();
        if (!line) continue;

        // CSV 파싱에 사용할 값들
        let values = [];
        let currentValue = "";
        let inQuotes = false;

        // 쉼표가 포함된 숫자 값을 처리하기 위한 수동 파싱
        for (let j = 0; j < line.length; j++) {
          const char = line[j];

          if (char === '"') {
            inQuotes = !inQuotes;
          } else if (char === "," && !inQuotes) {
            values.push(currentValue);
            currentValue = "";
          } else {
            currentValue += char;
          }
        }
        values.push(currentValue); // 마지막 값 추가

        // 각 열의 값 추출
        const date = values[columnMap["date"]]?.trim();
        const time = values[columnMap["time"]]?.trim();
        const centerName = values[columnMap["centerName"]]?.trim();

        // 디버깅 로그 추가
        if (i <= 5) {
          console.log(`행 ${i} 값:`, {
            date,
            time,
            centerName,
            total: values[columnMap["total"]],
            completion: values[columnMap["completion"]],
          });
        }

        if (!date || !time || !centerName) {
          console.log(`데이터 누락 - Row ${i}:`, { date, time, centerName });
          continue;
        }

        dates.add(date);
        times.add(time);
        centers.add(centerName);

        // 숫자 데이터 처리 함수 - 쉼표와 따옴표 제거
        const parseNumberValue = (value) => {
          if (!value || value.trim() === "") return 0;
          return parseInt(value.replace(/["',]/g, "")) || 0;
        };

        const closed = parseNumberValue(values[columnMap["closed"]]);
        const remaining = parseNumberValue(values[columnMap["remaining"]]);
        const total = parseNumberValue(values[columnMap["total"]]);
        const completion = parseFloat(values[columnMap["completion"]]) || 0;
        const efficiency =
          parseNumberValue(values[columnMap["efficiency"]]) || 80;
        const capacity =
          parseNumberValue(values[columnMap["capacity"]]) || total * 1.2;
        const backlog = parseNumberValue(values[columnMap["backlog"]]) || 0;
        const quality_score =
          parseNumberValue(values[columnMap["quality_score"]]) || 85;
        const receipt = parseNumberValue(values[columnMap["receipt"]]) || 0;
        const assigned = parseNumberValue(values[columnMap["assigned"]]) || 0;
        const output = parseNumberValue(values[columnMap["output"]]) || 0;

        // 타임 단위 데이터 찾기 또는 생성
        let timeData = allData.find((d) => d.date === date && d.time === time);
        if (!timeData) {
          timeData = {
            date,
            time,
            centers: [],
          };
          allData.push(timeData);
        }

        // 센터 데이터 추가
        timeData.centers.push({
          name: centerName,
          closed,
          remaining,
          total,
          completion,
          efficiency,
          capacity,
          backlog,
          quality_score,
          receipt,
          assigned,
          output,
        });
      }

      console.log("파싱 완료, allData 길이:", allData.length);
      console.log("dates:", Array.from(dates));
      console.log("times:", Array.from(times));
      console.log("centers:", Array.from(centers));

      return allData;
    } catch (error) {
      console.error("CSV 파싱 오류:", error);
      console.error("오류 상세:", error.stack);
      return [];
    }
  }, []);

  // 시간 필터링 (10:00부터 01:00까지만 표시)
  const filterTimeRange = useCallback((data) => {
    if (!data || !data.length) return [];

    return data.filter((item) => {
      const hour = parseInt(item.time.split(":")[0]);
      // 10시부터 23시까지, 또는 0시와 1시 포함
      return hour >= 10 || hour === 0 || hour === 1 || hour === 9; // 9시 데이터도 포함
    });
  }, []);

  // 샘플 데이터 생성
  const generateData = useCallback(() => {
    // 센터 목록
    const centers = [
      { name: "감곡 네이버 센터", total: 4167, efficiency: 92, capacity: 5000 },
      { name: "음성1센터", total: 4000, efficiency: 88, capacity: 4500 },
      { name: "음성2센터", total: 3500, efficiency: 85, capacity: 4000 },
      { name: "음성3센터", total: 2500, efficiency: 79, capacity: 3000 },
      { name: "용인 백암센터", total: 5000, efficiency: 94, capacity: 6000 },
    ];

    // 날짜 목록 - 오늘 날짜에서 최근 8일
    const today = new Date();
    const dates = [];
    for (let i = 7; i >= 0; i--) {
      const date = new Date(today);
      date.setDate(date.getDate() - i);
      dates.push(date.toISOString().split("T")[0]);
    }

    // 시간 목록 - 9:00부터 01:00까지 (9시 추가)
    const times = [
      "09:00",
      "10:00",
      "11:00",
      "12:00",
      "13:00",
      "14:00",
      "15:00",
      "16:00",
      "17:00",
      "18:00",
      "19:00",
      "20:00",
      "21:00",
      "22:00",
      "23:00",
      "00:00",
      "01:00",
    ];

    const newAllData = [];

    dates.forEach((date) => {
      times.forEach((time) => {
        const timeData = {
          date,
          time,
          centers: centers.map((center) => {
            // 감곡 네이버 센터, 마지막 날짜, 21:00 에 대한 실제 값 설정
            if (
              center.name === "감곡 네이버 센터" &&
              date === dates[dates.length - 1] &&
              time === "21:00"
            ) {
              return {
                name: center.name,
                closed: 3500,
                remaining: 667,
                total: 4167,
                completion: 84.0,
                efficiency: center.efficiency,
                capacity: center.capacity,
                backlog: 120,
                quality_score: 92,
                receipt: 0,
                assigned: 429,
                output: 323,
              };
            }

            // 다른 경우는 시간과 날짜에 따라 현실적으로 증가하는 데이터 생성
            const timeNumber = timeToNumber(time) - timeToNumber("10:00") + 1;
            const timeProgress = timeNumber / 16; // 10:00이 1/16, 01:00이 16/16

            const dayIndex = dates.indexOf(date);
            const dayProgress = dayIndex / (dates.length - 1);

            // S자 곡선 형태로 증가하는 완료율 (더 현실적인 데이터 패턴)
            let completionRate = 0;

            // 센터별 진행 패턴 차이 (일부 센터는 빠르게, 일부는 느리게)
            const centerSpeedFactor = center.name.includes("음성1")
              ? 1.2
              : center.name.includes("음성3")
              ? 0.8
              : 1.0;

            // 시간별 패턴
            if (time === "09:00") {
              // 9시는 진행 초기
              completionRate = Math.min(0.1 * centerSpeedFactor, 0.15);
            } else if (timeNumber <= 4) {
              // 오전 (10:00-13:00): 천천히 시작
              completionRate = Math.min(
                0.15 + timeProgress * 0.2 * centerSpeedFactor,
                0.3
              );
            } else if (timeNumber <= 10) {
              // 오후 (14:00-19:00): 빠르게 진행
              completionRate = Math.min(
                0.3 + ((timeNumber - 4) / 6) * 0.4 * centerSpeedFactor,
                0.7
              );
            } else {
              // 저녁 (20:00-01:00): 마무리 단계
              completionRate = Math.min(
                0.7 + ((timeNumber - 10) / 6) * 0.25 * centerSpeedFactor,
                0.95
              );
            }

            // 날짜별 변동 (일별 편차 추가)
            const dailyVariation = Math.sin(dayIndex * 0.5) * 0.05; // -5% to +5% 변동
            completionRate = Math.max(
              0.05,
              Math.min(completionRate + dailyVariation, 0.95)
            );

            const closed = Math.floor(center.total * completionRate);
            const remaining = center.total - closed;

            // 센터별 다양한 성과 지표 추가
            const backlog = Math.floor(Math.random() * 200);
            const qualityScore = Math.floor(75 + Math.random() * 20);
            const receipt = Math.floor(Math.random() * 10);
            const assigned = Math.floor(Math.random() * 1000);
            const output = Math.floor(Math.random() * 500);

            return {
              name: center.name,
              closed,
              remaining,
              total: center.total,
              completion: parseFloat((completionRate * 100).toFixed(1)),
              efficiency: center.efficiency - Math.floor(Math.random() * 10),
              capacity: center.capacity,
              backlog: backlog,
              quality_score: qualityScore,
              receipt: receipt,
              assigned: assigned,
              output: output,
            };
          }),
        };

        newAllData.push(timeData);
      });
    });

    setAllData(newAllData);

    // 날짜와 시간을 내림차순으로 정렬
    const sortedDates = ["전체", ...dates].sort((a, b) => {
      if (a === "전체") return -1;
      if (b === "전체") return 1;
      return new Date(b) - new Date(a);
    });

    const sortedTimes = ["전체", ...times].sort((a, b) => {
      if (a === "전체") return -1;
      if (b === "전체") return 1;

      return timeToNumber(b) - timeToNumber(a);
    });

    setAvailableDates(sortedDates);
    setAvailableTimes(sortedTimes);

    // 가장 최근 날짜와 시간 설정
    setSelectedDate(dates[dates.length - 1]);
    setSelectedTime(times[times.length - 1]);

    setLastUpdated(new Date().toLocaleString());
  }, [timeToNumber]);

  // 구글 시트 데이터 가져오기 함수
  const fetchGoogleSheetData = useCallback(() => {
    setLoading(true);

    // 구글 시트 ID
    const SHEET_ID = "1_yewSz7ITIkuvajtaENVtbZfA2ujOktGZA8Z2M3DFKE";

    // 공개 시트 접근 - CSV 형식으로 내보내기
    const url = `https://docs.google.com/spreadsheets/d/${SHEET_ID}/export?format=csv`;

    // URL 배열에 이 URL을 가장 먼저 추가
    const urls = [
      // 1. 정확한 공개 CSV URL - 요청한 형식 그대로 적용
      url,
      // 2. 대체 형식 URL - 백업용
      `https://docs.google.com/spreadsheets/d/${SHEET_ID}/gviz/tq?tqx=out:csv`,
    ];

    // 각 URL로 차례로 시도
    const tryFetch = async (urlIndex = 0) => {
      if (urlIndex >= urls.length) {
        // 모든 URL 시도 실패 시 기본 샘플 데이터 사용
        console.error("모든 Google Sheets URL 접근 실패");
        generateData();
        setLoading(false);
        return;
      }

      try {
        const url = urls[urlIndex];
        console.log(`Trying URL ${urlIndex + 1}: ${url}`);

        const response = await fetch(url, {
          method: "GET",
          headers: {
            "Content-Type": "text/csv",
          },
          mode: "cors",
        });

        if (!response.ok) {
          throw new Error(`HTTP error! status: ${response.status}`);
        }

        const csvText = await response.text();

        // CSV 데이터가 비어있지 않은지 확인
        if (!csvText || csvText.trim().length === 0) {
          throw new Error("Empty CSV data");
        }

        // CSV 데이터 미리보기 로그 출력
        console.log("CSV 데이터 미리보기:", csvText.substring(0, 200));

        // CSV 데이터 파싱
        const parsedData = parseCSVData(csvText);

        console.log(
          "파싱 결과 미리보기:",
          parsedData.length > 0 ? JSON.stringify(parsedData[0]) : "데이터 없음"
        );

        if (parsedData.length === 0) {
          throw new Error("파싱된 데이터가 없습니다.");
        }

        setAllData(parsedData);

        // 날짜와 시간 목록 업데이트
        const dates = new Set();
        const times = new Set();

        parsedData.forEach((item) => {
          dates.add(item.date);
          times.add(item.time);
        });

        // 날짜와 시간 정렬
        const sortedDates = ["전체", ...Array.from(dates)].sort((a, b) => {
          if (a === "전체") return -1;
          if (b === "전체") return 1;
          return new Date(b) - new Date(a);
        });

        const sortedTimes = ["전체", ...Array.from(times)].sort((a, b) => {
          if (a === "전체") return -1;
          if (b === "전체") return 1;
          return timeToNumber(b) - timeToNumber(a);
        });

        setAvailableDates(sortedDates);
        setAvailableTimes(sortedTimes);

        // 가장 최근 날짜와 시간 설정
        if (dates.size > 0 && times.size > 0) {
          const recentDate = Array.from(dates).sort(
            (a, b) => new Date(b) - new Date(a)
          )[0];
          const recentTime = Array.from(times).sort(
            (a, b) => timeToNumber(b) - timeToNumber(a)
          )[0];
          setSelectedDate(recentDate);
          setSelectedTime(recentTime);
        }

        setLastUpdated(new Date().toLocaleString());
        setLoading(false);

        console.log("Google Sheets 데이터 로드 성공!");
      } catch (error) {
        console.error(`URL ${urlIndex + 1} 실패:`, error);
        // 다음 URL로 시도
        tryFetch(urlIndex + 1);
      }
    };

    // 첫 번째 URL로 시도 시작
    tryFetch(0);
  }, [parseCSVData, timeToNumber, generateData]);
  // 과거 데이터 기반 예측 생성 함수
  const generatePredictions = useCallback(
    (data) => {
      if (!data || data.length === 0) return;

      // 예측 데이터를 생성할 날짜와 센터 결정
      const latestDate = [...new Set(data.map((item) => item.date))].sort(
        (a, b) => new Date(b) - new Date(a)
      )[0];
      const dataSortedByTime = data
        .filter((item) => item.date === latestDate)
        .sort((a, b) => {
          return timeToNumber(a.time) - timeToNumber(b.time);
        });

      // 데이터가 부족하면 예측 불가
      if (dataSortedByTime.length < 4) {
        setPredictionData([]);
        return;
      }

      // 마지막 데이터 시점
      const lastTimeData = dataSortedByTime[dataSortedByTime.length - 1];
      const lastTime = lastTimeData.time;
      const lastTimeHour = parseInt(lastTime.split(":")[0]);

      // 각 센터별로 예측 생성
      const predictions = [];

      // 모든 센터에 대해 다음 n시간 예측
      for (let h = 1; h <= forecastHorizon; h++) {
        // 다음 시간 계산
        let nextHour = lastTimeHour + h;

        // 24시간 체계로 조정 (다음날로 넘어갈 경우)
        if (nextHour > 23) nextHour -= 24;

        const nextTime = `${nextHour.toString().padStart(2, "0")}:00`;

        // 센터별 예측 데이터 생성
        const centersPrediction = lastTimeData.centers.map((center) => {
          // 마지막 3개 데이터 포인트로 트렌드 분석
          const centerHistory = dataSortedByTime
            .slice(-4)
            .map((timePoint) =>
              timePoint.centers.find((c) => c.name === center.name)
            );

          if (centerHistory.some((point) => !point)) {
            // 이력 데이터가 부족하면 단순 직선 예측
            const completion = Math.min(center.completion + h * 5, 100); // 시간당 평균 5% 증가
            const closed = Math.min(
              center.closed + h * center.total * 0.05,
              center.total
            );
            const remaining = center.total - closed;

            return {
              ...center,
              completion,
              closed: Math.round(closed),
              remaining: Math.round(remaining),
              isPrediction: true,
              // 예측 경계 추가 (최소/최대값)
              minCompletion: Math.max(0, completion - 5),
              maxCompletion: Math.min(100, completion + 5),
            };
          }

          // 비선형 예측 (마감률은 시간이 지날수록 감소하는 속도로 증가)
          const completionDeltas = [];
          for (let i = 1; i < centerHistory.length; i++) {
            completionDeltas.push(
              centerHistory[i].completion - centerHistory[i - 1].completion
            );
          }

          // 가중 평균 계산 (최근 값에 더 높은 가중치)
          const weights = [0.2, 0.3, 0.5]; // 시간순 가중치
          const weightedDelta = completionDeltas.reduce(
            (sum, delta, i) => sum + delta * weights[i],
            0
          );

          // 비선형 조정 (시간이 지날수록 증가율 감소)
          const adjustedDelta = weightedDelta * Math.pow(0.9, h);

          // 예측 계산
          const completion = Math.min(
            center.completion + adjustedDelta * h,
            100
          );
          const completionRate = completion / 100;
          const closed = Math.min(center.total * completionRate, center.total);
          const remaining = center.total - closed;

          // 예측 신뢰 구간 계산 (시간이 지날수록 불확실성 증가)
          const uncertaintyFactor = h * (1 - forecastConfidence / 100) * 10;

          return {
            ...center,
            completion,
            closed: Math.round(closed),
            remaining: Math.round(remaining),
            isPrediction: true,
            forecastHour: h,
            // 예측 구간 (신뢰도에 따라 조정)
            minCompletion: Math.max(0, completion - uncertaintyFactor),
            maxCompletion: Math.min(100, completion + uncertaintyFactor),
          };
        });

        predictions.push({
          date: latestDate,
          time: nextTime,
          centers: centersPrediction,
          isPrediction: true,
          forecastHour: h,
        });
      }

      setPredictionData(predictions);
    },
    [forecastHorizon, forecastConfidence, timeToNumber]
  );

  // === 데이터 처리 및 분석 함수 ===

  // 성과 기준 구하기
  const getPerformanceGrade = useCallback(
    (completion) => {
      const grade =
        PERFORMANCE_GRADES.find(
          (gradeItem) =>
            completion >= gradeItem.range[0] && completion < gradeItem.range[1]
        ) || PERFORMANCE_GRADES[PERFORMANCE_GRADES.length - 1];

      return grade;
    },
    [PERFORMANCE_GRADES]
  );

  // 주요 인사이트 생성
  const generateInsights = useCallback(() => {
    if (!chartData || chartData.length === 0) return [];

    const insights = [];

    // 1. 최고 성과 센터
    const topPerformer = [...chartData].sort(
      (a, b) => b.completion - a.completion
    )[0];
    insights.push({
      title: "최고 성과 센터",
      content: `${topPerformer.name}이(가) ${topPerformer.completion.toFixed(
        1
      )}% 마감률로 최고 성과를 보이고 있습니다.`,
      icon: "📈",
      type: "positive",
    });

    // 2. 개선 필요 센터
    const lowPerformer = [...chartData].sort(
      (a, b) => a.completion - b.completion
    )[0];
    if (lowPerformer.completion < 70) {
      insights.push({
        title: "개선 필요 센터",
        content: `${
          lowPerformer.name
        }의 마감률이 ${lowPerformer.completion.toFixed(
          1
        )}%로 목표치에 미달합니다.`,
        icon: "⚠️",
        type: "warning",
      });
    }

    // 3. 목표 달성 현황
    const centersAboveTarget = chartData.filter(
      (center) => center.completion >= performanceTarget
    ).length;
    const totalCenters = chartData.length;
    insights.push({
      title: "목표 달성 현황",
      content: `전체 ${totalCenters}개 센터 중 ${centersAboveTarget}개 센터가 목표 마감률(${performanceTarget}%)을 달성했습니다.`,
      icon: "🎯",
      type: centersAboveTarget / totalCenters >= 0.7 ? "positive" : "neutral",
    });

    // 4. 마감 물량 진행 상황
    const totalClosed = chartData.reduce((sum, item) => sum + item.closed, 0);
    const totalItems = chartData.reduce((sum, item) => sum + item.total, 0);
    const totalClosedPercent =
      totalItems > 0 ? (totalClosed / totalItems) * 100 : 0;

    insights.push({
      title: "전체 마감 현황",
      content: `전체 물량 ${totalItems.toLocaleString()}개 중 ${totalClosed.toLocaleString()}개(${totalClosedPercent.toFixed(
        1
      )}%)가 마감되었습니다.`,
      icon: "📊",
      type:
        totalClosedPercent >= 80
          ? "positive"
          : totalClosedPercent >= 60
          ? "neutral"
          : "warning",
    });

    // 5. 잔여 물량 우선순위
    const highRemainingCenter = [...chartData].sort(
      (a, b) => b.remaining - a.remaining
    )[0];
    insights.push({
      title: "잔여 물량 우선순위",
      content: `${
        highRemainingCenter.name
      }에 ${highRemainingCenter.remaining.toLocaleString()}개의 잔여 물량이 있습니다.`,
      icon: "🔍",
      type: "action",
    });

    return insights;
  }, [chartData, performanceTarget]);

  // 데이터 필터링 - useCallback으로 성능 최적화
  const filterData = useCallback(() => {
    if (!allData.length) return;

    // 시간대로 필터링된 데이터
    let filteredAllData = filterTimeRange(allData);
    let filteredTimeData = [...filteredAllData];

    if (selectedDate !== "전체") {
      filteredTimeData = filteredTimeData.filter(
        (item) => item.date === selectedDate
      );
    }

    if (selectedTime !== "전체") {
      filteredTimeData = filteredTimeData.filter(
        (item) => item.time === selectedTime
      );
    }

    if (filteredTimeData.length === 0) {
      filteredTimeData = [filteredAllData[filteredAllData.length - 1]];
    }

    const latestData = filteredTimeData[filteredTimeData.length - 1];
    let centerData = latestData.centers;

    if (selectedCenter !== "전체") {
      centerData = centerData.filter((item) => item.name === selectedCenter);
    }

    // 센터 데이터 성과 점수 및 등급 부여
    const enhancedCenterData = centerData.map((center) => {
      const grade = getPerformanceGrade(center.completion);
      return {
        ...center,
        performanceGrade: grade.label,
        performanceColor: grade.color,
        indexScore: Math.round(
          center.completion * 0.6 + (center.efficiency || 80) * 0.4
        ),
        closingSpeed:
          center.closed / (parseInt(latestData.time.split(":")[0]) || 1),
        target: performanceTarget,
        gap: center.completion - performanceTarget,
      };
    });

    setChartData(enhancedCenterData);

    const newDistributionData = enhancedCenterData.map((center) => ({
      name: center.name,
      value: center.closed,
      completion: center.completion,
      color: center.performanceColor,
    }));

    setDistributionData(newDistributionData);

    // 시간별 추이 데이터 생성
    const dateData = filteredAllData.filter((item) =>
      selectedDate === "전체"
        ? item.date === availableDates[availableDates.indexOf("전체") + 1]
        : item.date === selectedDate
    );

    // 시간 정렬 및 현재 시간까지만 필터링
    const sortedDateData = [...dateData].sort((a, b) => {
      return timeToNumber(a.time) - timeToNumber(b.time);
    });

    const newTimeSeriesData = sortedDateData.map((item) => {
      const totalClosed = item.centers.reduce(
        (sum, center) => sum + center.closed,
        0
      );
      const totalRemaining = item.centers.reduce(
        (sum, center) => sum + center.remaining,
        0
      );

      const totalCompletion =
        item.centers.length > 0
          ? item.centers.reduce((sum, center) => sum + center.completion, 0) /
            item.centers.length
          : 0;

      const timeData = {
        time: item.time,
        totalClosed,
        totalRemaining,
        avgCompletion: totalCompletion,
        target: performanceTarget,
        isPrediction: false,
      };

      // 각 센터별 데이터 추가
      item.centers.forEach((center) => {
        timeData[center.name] = center.closed;
        timeData[`${center.name}_completion`] = center.completion;
      });

      return timeData;
    });

    setTimeSeriesData(newTimeSeriesData);
  }, [
    allData,
    selectedCenter,
    selectedDate,
    selectedTime,
    performanceTarget,
    availableDates,
    filterTimeRange,
    getPerformanceGrade,
    timeToNumber,
  ]);

  // === 성능 지표 및 차트 데이터 생성 함수 ===

  // 성과 지수 계산 함수
  const calculatePerformanceIndex = useCallback((center) => {
    const completion = center.completion || 0; // 마감률
    const efficiency = center.efficiency || 80; // 효율성
    const qualityScore = center.quality_score || 85; // 품질 점수

    // 가중치 적용 계산
    return Math.round(completion * 0.5 + efficiency * 0.3 + qualityScore * 0.2);
  }, []);

  // 센터별 성과 지표 데이터 생성
  const generatePerformanceMetrics = useCallback(() => {
    if (!chartData || chartData.length === 0) return [];

    return chartData
      .map((center) => {
        const performanceIndex = calculatePerformanceIndex(center);

        return {
          name: center.name,
          performanceIndex,
          completion: center.completion,
          efficiency: center.efficiency || Math.round(70 + Math.random() * 25),
          quality: center.quality_score || Math.round(70 + Math.random() * 25),
          backlog: center.backlog || Math.round(Math.random() * 200),
          capacity: center.capacity || center.total * 1.2,
          closed: center.closed || 0,
          remaining: center.remaining || 0,
          total: center.total || 0,
          receipt: center.receipt || 0,
          assigned: center.assigned || 0,
          output: center.output || 0,
        };
      })
      .sort((a, b) => b.performanceIndex - a.performanceIndex);
  }, [chartData, calculatePerformanceIndex]);

  // 마감 속도 계산 - 시간당 마감량
  const calculateClosingSpeed = useCallback(
    (center) => {
      // 더 정확한 시간당 마감량 계산
      const currentHourStr = selectedTime === "전체" ? "01:00" : selectedTime;

      const elapsedHours =
        timeToNumber(currentHourStr) >= timeToNumber("10:00")
          ? timeToNumber(currentHourStr) - timeToNumber("10:00") + 1
          : timeToNumber(currentHourStr) + 24 - timeToNumber("10:00") + 1; // 다음날 시간 고려

      // 영업 시간이 아니거나 시간이 0이면 오류 방지
      if (elapsedHours <= 0) return 0;

      return Math.round((center.closed / elapsedHours) * 10) / 10;
    },
    [selectedTime, timeToNumber]
  );

  // 목표 달성률 계산
  const calculateTargetAchievement = useCallback(
    (completion) => {
      return (completion / performanceTarget) * 100;
    },
    [performanceTarget]
  );

  // 남은 작업시간 대비 잔여 물량 비율 계산
  const calculateRemainingWorkload = useCallback(
    (center) => {
      // 현재 시간에서 마감 시간(01:00)까지 남은 시간 계산
      const currentTimeStr = selectedTime === "전체" ? "10:00" : selectedTime;

      // 01:00은 다음날이므로 timeToNumber("01:00")은 25로 변환됨
      const timeToEndOfDay =
        timeToNumber("01:00") - timeToNumber(currentTimeStr);
      const remainingHours = timeToEndOfDay > 0 ? timeToEndOfDay : 0;

      // 0 방지
      if (remainingHours <= 0) return 0;

      // 남은 물량 / 남은 시간 (시간당 처리해야 할 물량)
      return center.remaining / remainingHours;
    },
    [selectedTime, timeToNumber]
  );

  // 초기 데이터 로드
  useEffect(() => {
    fetchGoogleSheetData();

    // 10분마다 자동 갱신
    const intervalId = setInterval(() => {
      fetchGoogleSheetData();
    }, 10 * 60 * 1000);

    // 컴포넌트 언마운트 시 인터벌 정리
    return () => clearInterval(intervalId);
  }, [fetchGoogleSheetData]);

  // 필터링 효과
  useEffect(() => {
    filterData();
  }, [
    selectedCenter,
    selectedDate,
    selectedTime,
    allData,
    performanceTarget,
    filterData,
  ]);

  // allData 변경 시 예측 데이터 생성
  useEffect(() => {
    if (allData.length > 0) {
      generatePredictions(allData);
    }
  }, [allData, generatePredictions]);

  // === UI 스타일 및 컴포넌트 ===

  // 맥킨지 스타일 배경색 및 폰트 변경
  const mcKinseyStyle = {
    backgroundColor: "#F5F7FA",
    color: "#333333",
    padding: "24px",
    minHeight: "100vh",
    fontFamily: "'Segoe UI', Arial, sans-serif",
  };

  // 대시보드 컴포넌트 스타일
  const dashboardComponent = {
    backgroundColor: "#FFFFFF",
    borderRadius: "8px",
    boxShadow: "0 1px 3px rgba(0, 0, 0, 0.12), 0 1px 2px rgba(0, 0, 0, 0.24)",
    padding: "20px",
    marginBottom: "24px",
    transition: "box-shadow 0.3s ease-in-out",
  };

  // 컴포넌트 제목 스타일
  const componentTitle = {
    fontSize: "18px",
    fontWeight: "600",
    color: "#333333",
    marginBottom: "16px",
    paddingBottom: "8px",
    borderBottom: "1px solid #E0E0E0",
  };

  // 인사이트 카드 스타일
  const insightCardStyle = (type) => {
    const colors = {
      positive: "#E6F7EE",
      warning: "#FFF4E5",
      neutral: "#E3F2FD",
      action: "#F5F0FF",
    };

    return {
      backgroundColor: colors[type] || "#F8F9FA",
      borderRadius: "8px",
      padding: "16px",
      marginBottom: "12px",
      boxShadow: "0 1px 2px rgba(0, 0, 0, 0.05)",
      transition: "transform 0.2s ease, box-shadow 0.2s ease",
    };
  };

  // 로딩 화면
  if (loading) {
    return (
      <div
        style={{
          backgroundColor: "#F5F7FA",
          color: "#333333",
          padding: "16px",
          minHeight: "100vh",
          display: "flex",
          justifyContent: "center",
          alignItems: "center",
          fontFamily: "'Segoe UI', Arial, sans-serif",
        }}
      >
        <div style={{ textAlign: "center" }}>
          <h2>데이터 분석 중...</h2>
          <div
            style={{
              width: "50px",
              height: "50px",
              border: "5px solid rgba(0,120,212,0.3)",
              borderRadius: "50%",
              borderTop: "5px solid #0078D4",
              margin: "20px auto",
              animation: "spin 1s linear infinite",
            }}
          />
          <p style={{ color: "#666" }}>
            고급 분석 대시보드를 준비하고 있습니다
          </p>
        </div>
        <style>{`
          @keyframes spin {
            0% { transform: rotate(0deg); }
            100% { transform: rotate(360deg); }
          }
        `}</style>
      </div>
    );
  }
  return (
    <div style={mcKinseyStyle}>
      {/* 헤더 */}
      <div
        style={{
          display: "flex",
          justifyContent: "space-between",
          alignItems: "center",
          marginBottom: "24px",
        }}
      >
        <div>
          <h1
            style={{
              fontSize: "28px",
              fontWeight: "600",
              marginBottom: "4px",
              color: "#0078D4",
            }}
          >
            품고 센터별 물량 분석
          </h1>
          <p style={{ fontSize: "14px", color: "#666666" }}>
            마지막 업데이트: {lastUpdated}
          </p>
        </div>

        <div style={{ display: "flex", gap: "12px" }}>
          <button
            onClick={() => setShowInsights(!showInsights)}
            style={{
              padding: "8px 16px",
              backgroundColor: showInsights ? "#0078D4" : "#FFFFFF",
              color: showInsights ? "#FFFFFF" : "#0078D4",
              border: "1px solid #0078D4",
              borderRadius: "4px",
              cursor: "pointer",
              fontWeight: "500",
              transition: "all 0.3s",
            }}
          >
            {showInsights ? "인사이트 숨기기" : "인사이트 보기"}
          </button>
          <button
            onClick={() => setShowProjections(!showProjections)}
            style={{
              padding: "8px 16px",
              backgroundColor: showProjections ? "#107C10" : "#FFFFFF",
              color: showProjections ? "#FFFFFF" : "#107C10",
              border: "1px solid #107C10",
              borderRadius: "4px",
              cursor: "pointer",
              fontWeight: "500",
              transition: "all 0.3s",
            }}
          >
            {showProjections ? "예측 보기 중" : "예측 보기"}
          </button>
          <button
            onClick={fetchGoogleSheetData}
            style={{
              padding: "8px 16px",
              backgroundColor: "#0078D4",
              color: "white",
              border: "none",
              borderRadius: "4px",
              cursor: "pointer",
              fontWeight: "500",
              transition: "all 0.3s",
              display: "flex",
              alignItems: "center",
              gap: "6px",
            }}
          >
            <span style={{ fontSize: "16px" }}>↻</span>
            데이터 새로고침
          </button>
        </div>
      </div>

      {/* 탭 네비게이션 */}
      <div style={{ marginBottom: "24px" }}>
        <div
          style={{
            display: "flex",
            backgroundColor: "#FFFFFF",
            borderRadius: "8px",
            padding: "4px",
            boxShadow: "0 1px 3px rgba(0, 0, 0, 0.1)",
          }}
        >
          {[
            "executive",
            "performance",
            "trends",
            "centers",
            "comparison",
            "prediction",
          ].map((tab) => (
            <button
              key={tab}
              onClick={() => setActiveTab(tab)}
              style={{
                flex: 1,
                padding: "12px 24px",
                backgroundColor: activeTab === tab ? "#0078D4" : "transparent",
                color: activeTab === tab ? "#FFFFFF" : "#666666",
                border: "none",
                cursor: "pointer",
                fontWeight: activeTab === tab ? "600" : "normal",
                borderRadius: "4px",
                transition: "all 0.3s",
              }}
            >
              {tab === "executive"
                ? "핵심 요약"
                : tab === "performance"
                ? "성과 분석"
                : tab === "trends"
                ? "추이 분석"
                : tab === "centers"
                ? "센터별 성과"
                : tab === "comparison"
                ? "비교 분석"
                : "예측 분석"}
            </button>
          ))}
        </div>
      </div>

      {/* 필터 영역 */}
      <div
        style={{
          ...dashboardComponent,
          marginBottom: "24px",
          display: "flex",
          gap: "16px",
          flexWrap: "wrap",
        }}
      >
        <div style={{ flex: "1", minWidth: "180px" }}>
          <label
            style={{
              display: "block",
              marginBottom: "8px",
              color: "#666666",
              fontWeight: "500",
            }}
          >
            센터 선택
          </label>
          <select
            value={selectedCenter}
            onChange={(e) => setSelectedCenter(e.target.value)}
            style={{
              width: "100%",
              padding: "10px",
              borderRadius: "4px",
              border: "1px solid #E0E0E0",
              backgroundColor: "#FFFFFF",
              color: "#333333",
            }}
          >
            <option value="전체">전체 센터</option>
            {allData.length > 0 &&
              allData[0].centers.map((center, idx) => (
                <option key={idx} value={center.name}>
                  {center.name}
                </option>
              ))}
          </select>
        </div>

        <div style={{ flex: "1", minWidth: "180px" }}>
          <label
            style={{
              display: "block",
              marginBottom: "8px",
              color: "#666666",
              fontWeight: "500",
            }}
          >
            날짜 선택
          </label>
          <select
            value={selectedDate}
            onChange={(e) => setSelectedDate(e.target.value)}
            style={{
              width: "100%",
              padding: "10px",
              borderRadius: "4px",
              border: "1px solid #E0E0E0",
              backgroundColor: "#FFFFFF",
              color: "#333333",
            }}
          >
            {availableDates.map((date, idx) => (
              <option key={idx} value={date}>
                {date === "전체" ? "전체 기간" : date}
              </option>
            ))}
          </select>
        </div>

        <div style={{ flex: "1", minWidth: "180px" }}>
          <label
            style={{
              display: "block",
              marginBottom: "8px",
              color: "#666666",
              fontWeight: "500",
            }}
          >
            시간 선택
          </label>
          <select
            value={selectedTime}
            onChange={(e) => setSelectedTime(e.target.value)}
            style={{
              width: "100%",
              padding: "10px",
              borderRadius: "4px",
              border: "1px solid #E0E0E0",
              backgroundColor: "#FFFFFF",
              color: "#333333",
            }}
          >
            {availableTimes.map((time, idx) => (
              <option key={idx} value={time}>
                {time === "전체" ? "전체 시간" : time}
              </option>
            ))}
          </select>
        </div>

        <div style={{ flex: "1", minWidth: "180px" }}>
          <label
            style={{
              display: "block",
              marginBottom: "8px",
              color: "#666666",
              fontWeight: "500",
            }}
          >
            목표 마감률 (%)
          </label>
          <input
            type="number"
            value={performanceTarget}
            onChange={(e) =>
              setPerformanceTarget(parseInt(e.target.value) || 0)
            }
            min="0"
            max="100"
            style={{
              width: "100%",
              padding: "10px",
              borderRadius: "4px",
              border: "1px solid #E0E0E0",
              backgroundColor: "#FFFFFF",
              color: "#333333",
            }}
          />
        </div>

        {/* 예측 설정 추가 */}
        {showProjections && (
          <div style={{ flex: "1", minWidth: "180px" }}>
            <label
              style={{
                display: "block",
                marginBottom: "8px",
                color: "#666666",
                fontWeight: "500",
              }}
            >
              예측 범위 (시간)
            </label>
            <select
              value={forecastHorizon}
              onChange={(e) => {
                setForecastHorizon(parseInt(e.target.value));
                // 범위 변경 시 예측 데이터 다시 생성
                generatePredictions(allData);
              }}
              style={{
                width: "100%",
                padding: "10px",
                borderRadius: "4px",
                border: "1px solid #E0E0E0",
                backgroundColor: "#FFFFFF",
                color: "#333333",
              }}
            >
              {[1, 2, 3, 4, 5, 6].map((hours) => (
                <option key={hours} value={hours}>
                  {hours}시간
                </option>
              ))}
            </select>
          </div>
        )}
      </div>

      {/* 대시보드 인사이트 섹션 (모든 탭에 표시) */}
      {showInsights && (
        <div style={{ marginBottom: "24px" }}>
          <div style={dashboardComponent}>
            <h3 style={componentTitle}>핵심 인사이트</h3>
            <div>
              {generateInsights().map((insight, index) => (
                <div
                  key={index}
                  style={insightCardStyle(insight.type)}
                  onMouseOver={(e) => {
                    e.currentTarget.style.transform = "translateY(-2px)";
                    e.currentTarget.style.boxShadow =
                      "0 4px 8px rgba(0, 0, 0, 0.1)";
                  }}
                  onMouseOut={(e) => {
                    e.currentTarget.style.transform = "translateY(0)";
                    e.currentTarget.style.boxShadow =
                      "0 1px 2px rgba(0, 0, 0, 0.05)";
                  }}
                >
                  <div
                    style={{
                      display: "flex",
                      alignItems: "center",
                      marginBottom: "8px",
                    }}
                  >
                    <span style={{ fontSize: "24px", marginRight: "12px" }}>
                      {insight.icon}
                    </span>
                    <h4
                      style={{ margin: 0, fontWeight: "600", color: "#333333" }}
                    >
                      {insight.title}
                    </h4>
                  </div>
                  <p style={{ margin: 0, color: "#555555" }}>
                    {insight.content}
                  </p>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* 핵심 요약 탭 내용 */}
      {activeTab === "executive" && (
        <div>
          {/* 주요 지표 카드 */}
          <div
            style={{
              display: "grid",
              gridTemplateColumns: "repeat(auto-fit, minmax(200px, 1fr))",
              gap: "16px",
              marginBottom: "24px",
            }}
          >
            {/* 마감 물량 카드 */}
            <div
              style={{
                ...dashboardComponent,
                marginBottom: 0,
                transition: "transform 0.3s, box-shadow 0.3s",
                borderTop: "4px solid #0078D4",
              }}
              onMouseOver={(e) => {
                e.currentTarget.style.transform = "translateY(-5px)";
                e.currentTarget.style.boxShadow =
                  "0 4px 8px rgba(0, 0, 0, 0.12), 0 2px 4px rgba(0, 0, 0, 0.08)";
              }}
              onMouseOut={(e) => {
                e.currentTarget.style.transform = "translateY(0)";
                e.currentTarget.style.boxShadow =
                  "0 1px 3px rgba(0, 0, 0, 0.12), 0 1px 2px rgba(0, 0, 0, 0.24)";
              }}
            >
              <h3
                style={{
                  fontSize: "14px",
                  color: "#666666",
                  margin: "0 0 8px 0",
                  fontWeight: "500",
                }}
              >
                마감 물량
              </h3>
              <p
                style={{
                  fontSize: "28px",
                  fontWeight: "bold",
                  margin: "0 0 8px 0",
                  color: "#0078D4",
                }}
              >
                {chartData
                  .reduce((sum, item) => sum + item.closed, 0)
                  .toLocaleString()}
              </p>
              <p style={{ fontSize: "13px", color: "#888888", margin: 0 }}>
                {selectedCenter === "전체" ? "전체 센터 기준" : selectedCenter}
              </p>
            </div>

            {/* 잔여 물량 카드 */}
            <div
              style={{
                ...dashboardComponent,
                marginBottom: 0,
                transition: "transform 0.3s, box-shadow 0.3s",
                borderTop: "4px solid #D83B01",
              }}
              onMouseOver={(e) => {
                e.currentTarget.style.transform = "translateY(-5px)";
                e.currentTarget.style.boxShadow =
                  "0 4px 8px rgba(0, 0, 0, 0.12), 0 2px 4px rgba(0, 0, 0, 0.08)";
              }}
              onMouseOut={(e) => {
                e.currentTarget.style.transform = "translateY(0)";
                e.currentTarget.style.boxShadow =
                  "0 1px 3px rgba(0, 0, 0, 0.12), 0 1px 2px rgba(0, 0, 0, 0.24)";
              }}
            >
              <h3
                style={{
                  fontSize: "14px",
                  color: "#666666",
                  margin: "0 0 8px 0",
                  fontWeight: "500",
                }}
              >
                잔여 물량
              </h3>
              <p
                style={{
                  fontSize: "28px",
                  fontWeight: "bold",
                  margin: "0 0 8px 0",
                  color: "#D83B01",
                }}
              >
                {chartData
                  .reduce((sum, item) => sum + item.remaining, 0)
                  .toLocaleString()}
              </p>
              <p style={{ fontSize: "13px", color: "#888888", margin: 0 }}>
                {selectedCenter === "전체" ? "전체 센터 기준" : selectedCenter}
              </p>
            </div>

            {/* 마감률 카드 */}
            <div
              style={{
                ...dashboardComponent,
                marginBottom: 0,
                transition: "transform 0.3s, box-shadow 0.3s",
                borderTop: "4px solid #107C10",
              }}
              onMouseOver={(e) => {
                e.currentTarget.style.transform = "translateY(-5px)";
                e.currentTarget.style.boxShadow =
                  "0 4px 8px rgba(0, 0, 0, 0.12), 0 2px 4px rgba(0, 0, 0, 0.08)";
              }}
              onMouseOut={(e) => {
                e.currentTarget.style.transform = "translateY(0)";
                e.currentTarget.style.boxShadow =
                  "0 1px 3px rgba(0, 0, 0, 0.12), 0 1px 2px rgba(0, 0, 0, 0.24)";
              }}
            >
              <h3
                style={{
                  fontSize: "14px",
                  color: "#666666",
                  margin: "0 0 8px 0",
                  fontWeight: "500",
                }}
              >
                마감률
              </h3>
              <p
                style={{
                  fontSize: "28px",
                  fontWeight: "bold",
                  margin: "0 0 8px 0",
                  color: "#107C10",
                }}
              >
                {chartData.length > 0
                  ? (
                      chartData.reduce(
                        (sum, item) => sum + item.completion,
                        0
                      ) / chartData.length
                    ).toFixed(1)
                  : 0}
                %
              </p>
              <div
                style={{
                  fontSize: "13px",
                  color: "#888888",
                  margin: 0,
                  display: "flex",
                  alignItems: "center",
                }}
              >
                <div
                  style={{
                    width: "8px",
                    height: "8px",
                    borderRadius: "50%",
                    backgroundColor:
                      chartData.length > 0 &&
                      chartData.reduce(
                        (sum, item) => sum + item.completion,
                        0
                      ) /
                        chartData.length >=
                        performanceTarget
                        ? "#107C10"
                        : "#D83B01",
                    marginRight: "6px",
                  }}
                ></div>
                {chartData.length > 0 &&
                chartData.reduce((sum, item) => sum + item.completion, 0) /
                  chartData.length >=
                  performanceTarget
                  ? "목표 달성"
                  : "목표 미달"}
              </div>
            </div>

            {/* 전체 물량 카드 */}
            <div
              style={{
                ...dashboardComponent,
                marginBottom: 0,
                transition: "transform 0.3s, box-shadow 0.3s",
                borderTop: "4px solid #00B0F0",
              }}
              onMouseOver={(e) => {
                e.currentTarget.style.transform = "translateY(-5px)";
                e.currentTarget.style.boxShadow =
                  "0 4px 8px rgba(0, 0, 0, 0.12), 0 2px 4px rgba(0, 0, 0, 0.08)";
              }}
              onMouseOut={(e) => {
                e.currentTarget.style.transform = "translateY(0)";
                e.currentTarget.style.boxShadow =
                  "0 1px 3px rgba(0, 0, 0, 0.12), 0 1px 2px rgba(0, 0, 0, 0.24)";
              }}
            >
              <h3
                style={{
                  fontSize: "14px",
                  color: "#666666",
                  margin: "0 0 8px 0",
                  fontWeight: "500",
                }}
              >
                전체 물량
              </h3>
              <p
                style={{
                  fontSize: "28px",
                  fontWeight: "bold",
                  margin: "0 0 8px 0",
                  color: "#00B0F0",
                }}
              >
                {chartData
                  .reduce((sum, item) => sum + item.total, 0)
                  .toLocaleString()}
              </p>
              <p style={{ fontSize: "13px", color: "#888888", margin: 0 }}>
                {selectedCenter === "전체" ? "전체 센터 기준" : selectedCenter}
              </p>
            </div>
          </div>

          {/* 주요 분석 영역 (2x2 그리드) */}
          <div
            style={{
              display: "grid",
              gridTemplateColumns: "repeat(2, 1fr)",
              gap: "24px",
              marginBottom: "24px",
            }}
          >
            {/* 센터별 마감률 비교 */}
            <div style={dashboardComponent}>
              <h3 style={componentTitle}>센터별 마감률 vs 목표</h3>
              <ResponsiveContainer width="100%" height={300}>
                <BarChart
                  data={chartData}
                  margin={{ top: 5, right: 30, left: 20, bottom: 5 }}
                  layout="vertical"
                >
                  <CartesianGrid strokeDasharray="3 3" stroke="#EEEEEE" />
                  <XAxis type="number" domain={[0, 100]} />
                  <YAxis dataKey="name" type="category" width={100} />
                  <Tooltip
                    contentStyle={{
                      backgroundColor: "#FFFFFF",
                      border: "1px solid #E0E0E0",
                    }}
                    formatter={(value, name) => [`${value.toFixed(1)}%`, name]}
                  />
                  <Legend />
                  <ReferenceLine
                    x={performanceTarget}
                    stroke="#0078D4"
                    strokeDasharray="3 3"
                    label={{
                      position: "top",
                      value: `목표 ${performanceTarget}%`,
                      fill: "#0078D4",
                      fontSize: 12,
                    }}
                  />
                  <Bar
                    dataKey="completion"
                    name="마감률(%)"
                    radius={[0, 4, 4, 0]}
                    animationDuration={300}
                  >
                    {chartData.map((entry, index) => (
                      <Cell
                        key={`cell-${index}`}
                        fill={entry.performanceColor || COLORS[0]}
                      />
                    ))}
                    <LabelList
                      dataKey="completion"
                      position="right"
                      formatter={(value) => `${value.toFixed(1)}%`}
                    />
                  </Bar>
                </BarChart>
              </ResponsiveContainer>
            </div>

            {/* 센터별 성과 지수 */}
            <div style={dashboardComponent}>
              <h3 style={componentTitle}>종합 성과 지수</h3>
              <ResponsiveContainer width="100%" height={300}>
                <RadarChart
                  outerRadius={90}
                  data={generatePerformanceMetrics()}
                >
                  <PolarGrid gridType="polygon" />
                  <PolarAngleAxis dataKey="name" />
                  <PolarRadiusAxis angle={30} domain={[0, 100]} />
                  <Radar
                    name="마감률"
                    dataKey="completion"
                    stroke="#0078D4"
                    fill="#0078D4"
                    fillOpacity={0.3}
                    animationDuration={300}
                  />
                  <Radar
                    name="효율성"
                    dataKey="efficiency"
                    stroke="#107C10"
                    fill="#107C10"
                    fillOpacity={0.2}
                    animationDuration={300}
                  />
                  <Radar
                    name="품질"
                    dataKey="quality"
                    stroke="#775DD0"
                    fill="#775DD0"
                    fillOpacity={0.1}
                    animationDuration={300}
                  />
                  <Legend />
                  <Tooltip formatter={(value) => [`${value.toFixed(1)}`, ""]} />
                </RadarChart>
              </ResponsiveContainer>
            </div>

            {/* 시간별 마감 추이 */}
            <div style={dashboardComponent}>
              <h3 style={componentTitle}>시간별 마감 추이</h3>
              <ResponsiveContainer width="100%" height={300}>
                <AreaChart
                  data={timeSeriesData}
                  margin={{ top: 5, right: 30, left: 20, bottom: 5 }}
                >
                  <CartesianGrid strokeDasharray="3 3" stroke="#EEEEEE" />
                  <XAxis dataKey="time" />
                  <YAxis />
                  <Tooltip
                    contentStyle={{
                      backgroundColor: "#FFFFFF",
                      border: "1px solid #E0E0E0",
                    }}
                    formatter={(value, name) => {
                      return name === "avgCompletion"
                        ? [`${value.toFixed(1)}%`, "평균 마감률"]
                        : [value.toLocaleString(), name];
                    }}
                    labelFormatter={(value) => `시간: ${value}`}
                  />
                  <Legend />
                  <Area
                    type="monotone"
                    dataKey="totalClosed"
                    name="총 마감 물량"
                    stroke="#0078D4"
                    fill="#0078D4"
                    fillOpacity={0.2}
                    animationDuration={300}
                  />
                  <ReferenceLine
                    y={performanceTarget}
                    stroke="#107C10"
                    strokeDasharray="3 3"
                    label={{
                      position: "right",
                      value: `목표 ${performanceTarget}%`,
                      fill: "#107C10",
                      fontSize: 12,
                    }}
                  />
                </AreaChart>
              </ResponsiveContainer>
            </div>

            {/* 센터별 마감/잔여 물량 스택 바 차트 */}
            <div style={dashboardComponent}>
              <h3 style={componentTitle}>센터별 물량 현황</h3>
              <ResponsiveContainer width="100%" height={300}>
                <BarChart
                  data={chartData}
                  margin={{ top: 5, right: 30, left: 20, bottom: 5 }}
                >
                  <CartesianGrid strokeDasharray="3 3" stroke="#EEEEEE" />
                  <XAxis dataKey="name" />
                  <YAxis />
                  <Tooltip
                    contentStyle={{
                      backgroundColor: "#FFFFFF",
                      border: "1px solid #E0E0E0",
                    }}
                    formatter={(value) => value.toLocaleString()}
                  />
                  <Legend />
                  <Bar
                    dataKey="closed"
                    name="마감 물량"
                    stackId="a"
                    fill="#0078D4"
                    radius={[4, 4, 0, 0]}
                    animationDuration={300}
                  />
                  <Bar
                    dataKey="remaining"
                    name="잔여 물량"
                    stackId="a"
                    fill="#D83B01"
                    radius={[4, 4, 0, 0]}
                    animationDuration={300}
                  />
                </BarChart>
              </ResponsiveContainer>
            </div>
          </div>

          {/* 성과 지수 요약 */}
          <div style={{ ...dashboardComponent, marginBottom: "24px" }}>
            <h3 style={componentTitle}>센터별 종합 성과 평가</h3>
            <div
              style={{
                display: "grid",
                gridTemplateColumns: "repeat(auto-fill, minmax(200px, 1fr))",
                gap: "16px",
              }}
            >
              {generatePerformanceMetrics().map((center, index) => (
                <div
                  key={index}
                  style={{
                    padding: "16px",
                    borderRadius: "8px",
                    border: "1px solid #E0E0E0",
                    backgroundColor:
                      center.performanceIndex >= 85
                        ? "#E6F7EE"
                        : center.performanceIndex >= 70
                        ? "#E3F2FD"
                        : "#FFF4E5",
                    transition: "transform 0.2s, box-shadow 0.2s",
                  }}
                  onMouseOver={(e) => {
                    e.currentTarget.style.transform = "translateY(-5px)";
                    e.currentTarget.style.boxShadow =
                      "0 4px 8px rgba(0, 0, 0, 0.1)";
                  }}
                  onMouseOut={(e) => {
                    e.currentTarget.style.transform = "translateY(0)";
                    e.currentTarget.style.boxShadow = "none";
                  }}
                >
                  <h4
                    style={{
                      margin: "0 0 12px 0",
                      fontSize: "16px",
                      fontWeight: "600",
                    }}
                  >
                    {center.name}
                  </h4>

                  <div
                    style={{
                      display: "flex",
                      alignItems: "center",
                      marginBottom: "12px",
                    }}
                  >
                    <div
                      style={{
                        width: "50px",
                        height: "50px",
                        borderRadius: "50%",
                        background: `conic-gradient(${
                          center.performanceIndex >= 85
                            ? "#107C10"
                            : center.performanceIndex >= 70
                            ? "#0078D4"
                            : "#D83B01"
                        } ${center.performanceIndex}%, #E0E0E0 0)`,
                        display: "flex",
                        alignItems: "center",
                        justifyContent: "center",
                        position: "relative",
                        marginRight: "12px",
                      }}
                    >
                      <div
                        style={{
                          width: "40px",
                          height: "40px",
                          borderRadius: "50%",
                          backgroundColor: "#FFFFFF",
                          display: "flex",
                          alignItems: "center",
                          justifyContent: "center",
                          fontWeight: "bold",
                          fontSize: "16px",
                          color:
                            center.performanceIndex >= 85
                              ? "#107C10"
                              : center.performanceIndex >= 70
                              ? "#0078D4"
                              : "#D83B01",
                        }}
                      >
                        {center.performanceIndex}
                      </div>
                    </div>
                    <div>
                      <div style={{ fontSize: "14px", color: "#666666" }}>
                        성과 지수
                      </div>
                      <div
                        style={{
                          fontSize: "12px",
                          color: "#888888",
                          marginTop: "4px",
                        }}
                      >
                        {center.performanceIndex >= 85
                          ? "우수"
                          : center.performanceIndex >= 70
                          ? "양호"
                          : "개선 필요"}
                      </div>
                    </div>
                  </div>

                  <div style={{ fontSize: "13px", color: "#666666" }}>
                    <div
                      style={{
                        display: "flex",
                        justifyContent: "space-between",
                        marginBottom: "6px",
                      }}
                    >
                      <span>마감률:</span>
                      <span>{center.completion.toFixed(1)}%</span>
                    </div>
                    <div
                      style={{
                        display: "flex",
                        justifyContent: "space-between",
                        marginBottom: "6px",
                      }}
                    >
                      <span>효율성:</span>
                      <span>{center.efficiency}%</span>
                    </div>
                    <div
                      style={{
                        display: "flex",
                        justifyContent: "space-between",
                      }}
                    >
                      <span>품질:</span>
                      <span>{center.quality}%</span>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}
      {/* 성과 분석 탭 내용 */}
      {activeTab === "performance" && (
        <div>
          {/* 성과 메트릭스 차트 */}
          <div
            style={{
              display: "grid",
              gridTemplateColumns: "repeat(2, 1fr)",
              gap: "24px",
              marginBottom: "24px",
            }}
          >
            {/* 마감률 vs 효율성 분석 */}
            <div style={dashboardComponent}>
              <h3 style={componentTitle}>마감률 vs 효율성 매트릭스 분석</h3>
              <ResponsiveContainer width="100%" height={350}>
                <ScatterChart
                  margin={{ top: 20, right: 20, bottom: 20, left: 20 }}
                >
                  <CartesianGrid strokeDasharray="3 3" stroke="#EEEEEE" />
                  <XAxis
                    type="number"
                    dataKey="completion"
                    name="마감률"
                    domain={[0, 100]}
                    label={{
                      value: "마감률 (%)",
                      position: "bottom",
                      offset: 0,
                    }}
                  />
                  <YAxis
                    type="number"
                    dataKey="efficiency"
                    name="효율성"
                    domain={[0, 100]}
                    label={{
                      value: "효율성 (%)",
                      angle: -90,
                      position: "left",
                    }}
                  />
                  <Tooltip
                    contentStyle={{
                      backgroundColor: "#FFFFFF",
                      border: "1px solid #E0E0E0",
                    }}
                    formatter={(value, name) => [`${value}%`, name]}
                    labelFormatter={(value) => ""}
                    cursor={{ strokeDasharray: "3 3" }}
                  />
                  <Legend />
                  <Scatter
                    name="센터별 성과"
                    data={chartData}
                    fill="#0078D4"
                    shape="circle"
                  >
                    {chartData.map((entry, index) => (
                      <Cell
                        key={`cell-${index}`}
                        fill={entry.performanceColor || COLORS[0]}
                      />
                    ))}
                  </Scatter>
                  {/* 중앙값 참조선 */}
                  <ReferenceLine
                    x={performanceTarget}
                    stroke="#0078D4"
                    strokeDasharray="3 3"
                    label={{
                      position: "top",
                      value: `목표 ${performanceTarget}%`,
                      fill: "#0078D4",
                      fontSize: 12,
                    }}
                  />
                  <ReferenceLine
                    y={80}
                    stroke="#107C10"
                    strokeDasharray="3 3"
                    label={{
                      position: "right",
                      value: "목표 80%",
                      fill: "#107C10",
                      fontSize: 12,
                    }}
                  />
                </ScatterChart>
              </ResponsiveContainer>
            </div>

            {/* 마감물량 vs 잔여물량 분석 */}
            <div style={dashboardComponent}>
              <h3 style={componentTitle}>마감 진행률 분석</h3>
              <ResponsiveContainer width="100%" height={350}>
                <ComposedChart
                  data={chartData}
                  margin={{ top: 20, right: 20, bottom: 20, left: 20 }}
                  barGap={0}
                >
                  <CartesianGrid strokeDasharray="3 3" stroke="#EEEEEE" />
                  <XAxis dataKey="name" />
                  <YAxis yAxisId="left" orientation="left" />
                  <YAxis
                    yAxisId="right"
                    orientation="right"
                    domain={[0, 100]}
                  />
                  <Tooltip
                    contentStyle={{
                      backgroundColor: "#FFFFFF",
                      border: "1px solid #E0E0E0",
                    }}
                    formatter={(value, name) => {
                      return name === "completion"
                        ? [`${value.toFixed(1)}%`, "마감률"]
                        : [value.toLocaleString(), name];
                    }}
                  />
                  <Legend />
                  <Bar
                    yAxisId="left"
                    dataKey="closed"
                    name="마감 물량"
                    fill="#0078D4"
                    radius={[4, 4, 0, 0]}
                    animationDuration={300}
                  />
                  <Bar
                    yAxisId="left"
                    dataKey="remaining"
                    name="잔여 물량"
                    fill="#D83B01"
                    radius={[4, 4, 0, 0]}
                    animationDuration={300}
                  />
                  <Line
                    yAxisId="right"
                    type="monotone"
                    dataKey="completion"
                    name="마감률 (%)"
                    stroke="#107C10"
                    strokeWidth={3}
                    dot={{ stroke: "#107C10", strokeWidth: 2, r: 4 }}
                    animationDuration={500}
                  />
                  <ReferenceLine
                    yAxisId="right"
                    y={performanceTarget}
                    stroke="#107C10"
                    strokeDasharray="3 3"
                    label={{
                      position: "right",
                      value: `목표 ${performanceTarget}%`,
                      fill: "#107C10",
                      fontSize: 12,
                    }}
                  />
                </ComposedChart>
              </ResponsiveContainer>
            </div>

            {/* 성과 등급별 센터 분포 */}
            <div style={dashboardComponent}>
              <h3 style={componentTitle}>성과 등급별 센터 분포</h3>
              <ResponsiveContainer width="100%" height={300}>
                <PieChart>
                  <Pie
                    data={PERFORMANCE_GRADES.map((grade) => {
                      const centersInGrade = chartData.filter(
                        (center) =>
                          center.completion >= grade.range[0] &&
                          center.completion < grade.range[1]
                      );
                      return {
                        name: grade.label,
                        value: centersInGrade.length,
                        color: grade.color,
                      };
                    }).filter((item) => item.value > 0)}
                    cx="50%"
                    cy="50%"
                    labelLine={true}
                    outerRadius={100}
                    fill="#8884d8"
                    dataKey="value"
                    animationDuration={500}
                  >
                    {PERFORMANCE_GRADES.map((entry, index) => {
                      return <Cell key={`cell-${index}`} fill={entry.color} />;
                    })}
                    <LabelList
                      dataKey="name"
                      position="outside"
                      style={{ fontSize: "12px", fill: "#333333" }}
                    />
                  </Pie>
                  <Tooltip
                    contentStyle={{
                      backgroundColor: "#FFFFFF",
                      border: "1px solid #E0E0E0",
                    }}
                    formatter={(value, name) => [value, name]}
                  />
                  <Legend />
                </PieChart>
              </ResponsiveContainer>
            </div>

            {/* 효율성 지표 */}
            <div style={dashboardComponent}>
              <h3 style={componentTitle}>센터별 효율성 지표</h3>
              <ResponsiveContainer width="100%" height={300}>
                <BarChart
                  data={chartData}
                  margin={{ top: 5, right: 30, left: 20, bottom: 5 }}
                >
                  <CartesianGrid strokeDasharray="3 3" stroke="#EEEEEE" />
                  <XAxis dataKey="name" />
                  <YAxis domain={[0, 100]} />
                  <Tooltip
                    contentStyle={{
                      backgroundColor: "#FFFFFF",
                      border: "1px solid #E0E0E0",
                    }}
                    formatter={(value, name) => [`${value}%`, name]}
                  />
                  <Legend />
                  <Bar
                    dataKey="efficiency"
                    name="작업 효율성 (%)"
                    fill="#50AF95"
                    radius={[4, 4, 0, 0]}
                    animationDuration={300}
                  >
                    {chartData.map((entry, index) => (
                      <Cell
                        key={`cell-${index}`}
                        fill={
                          entry.efficiency >= 90
                            ? "#107C10"
                            : entry.efficiency >= 80
                            ? "#50AF95"
                            : entry.efficiency >= 70
                            ? "#FFB900"
                            : "#D83B01"
                        }
                      />
                    ))}
                    <LabelList
                      dataKey="efficiency"
                      position="top"
                      formatter={(value) => `${value}%`}
                    />
                  </Bar>
                  <ReferenceLine
                    y={80}
                    stroke="#107C10"
                    strokeDasharray="3 3"
                    label={{
                      position: "right",
                      value: "목표 80%",
                      fill: "#107C10",
                      fontSize: 12,
                    }}
                  />
                </BarChart>
              </ResponsiveContainer>
            </div>
          </div>
          {/* 종합 성과 평가 표 */}
          <div style={dashboardComponent}>
            <h3 style={componentTitle}>종합 성과 평가 표</h3>
            <div
              style={{
                backgroundColor: "#FFFFFF",
                borderRadius: "8px",
                overflow: "hidden",
                boxShadow: "0 1px 2px rgba(0, 0, 0, 0.05)",
              }}
            >
              <table style={{ width: "100%", borderCollapse: "collapse" }}>
                <thead>
                  <tr style={{ backgroundColor: "#F5F7FA", textAlign: "left" }}>
                    <th
                      style={{
                        padding: "12px 16px",
                        borderBottom: "1px solid #E0E0E0",
                      }}
                    >
                      센터명
                    </th>
                    <th
                      style={{
                        padding: "12px 16px",
                        borderBottom: "1px solid #E0E0E0",
                        textAlign: "center",
                      }}
                    >
                      성과 지수
                    </th>
                    <th
                      style={{
                        padding: "12px 16px",
                        borderBottom: "1px solid #E0E0E0",
                        textAlign: "center",
                      }}
                    >
                      마감률
                    </th>
                    <th
                      style={{
                        padding: "12px 16px",
                        borderBottom: "1px solid #E0E0E0",
                        textAlign: "center",
                      }}
                    >
                      효율성
                    </th>
                    <th
                      style={{
                        padding: "12px 16px",
                        borderBottom: "1px solid #E0E0E0",
                        textAlign: "center",
                      }}
                    >
                      품질
                    </th>
                    <th
                      style={{
                        padding: "12px 16px",
                        borderBottom: "1px solid #E0E0E0",
                        textAlign: "center",
                      }}
                    >
                      목표 대비
                    </th>
                    <th
                      style={{
                        padding: "12px 16px",
                        borderBottom: "1px solid #E0E0E0",
                        textAlign: "center",
                      }}
                    >
                      등급
                    </th>
                  </tr>
                </thead>
                <tbody>
                  {generatePerformanceMetrics().map((center, index) => (
                    <tr
                      key={index}
                      style={{
                        backgroundColor:
                          index % 2 === 0 ? "#FFFFFF" : "#F9FAFC",
                        transition: "all 0.2s",
                      }}
                      onMouseOver={(e) => {
                        e.currentTarget.style.backgroundColor = "#F0F7FF";
                      }}
                      onMouseOut={(e) => {
                        e.currentTarget.style.backgroundColor =
                          index % 2 === 0 ? "#FFFFFF" : "#F9FAFC";
                      }}
                    >
                      <td
                        style={{
                          padding: "12px 16px",
                          borderBottom: "1px solid #E0E0E0",
                          fontWeight: "500",
                        }}
                      >
                        {center.name}
                      </td>
                      <td
                        style={{
                          padding: "12px 16px",
                          borderBottom: "1px solid #E0E0E0",
                          textAlign: "center",
                        }}
                      >
                        <div
                          style={{
                            backgroundColor:
                              center.performanceIndex >= 85
                                ? "#E6F7EE"
                                : center.performanceIndex >= 70
                                ? "#E3F2FD"
                                : "#FFF4E5",
                            padding: "4px 8px",
                            borderRadius: "4px",
                            display: "inline-block",
                            color:
                              center.performanceIndex >= 85
                                ? "#107C10"
                                : center.performanceIndex >= 70
                                ? "#0078D4"
                                : "#D83B01",
                            fontWeight: "bold",
                          }}
                        >
                          {center.performanceIndex}
                        </div>
                      </td>
                      <td
                        style={{
                          padding: "12px 16px",
                          borderBottom: "1px solid #E0E0E0",
                          textAlign: "center",
                        }}
                      >
                        {center.completion.toFixed(1)}%
                      </td>
                      <td
                        style={{
                          padding: "12px 16px",
                          borderBottom: "1px solid #E0E0E0",
                          textAlign: "center",
                        }}
                      >
                        {center.efficiency}%
                      </td>
                      <td
                        style={{
                          padding: "12px 16px",
                          borderBottom: "1px solid #E0E0E0",
                          textAlign: "center",
                        }}
                      >
                        {center.quality}%
                      </td>
                      <td
                        style={{
                          padding: "12px 16px",
                          borderBottom: "1px solid #E0E0E0",
                          textAlign: "center",
                        }}
                      >
                        <div
                          style={{
                            color:
                              center.completion >= performanceTarget
                                ? "#107C10"
                                : "#D83B01",
                            fontWeight: "500",
                          }}
                        >
                          {center.completion >= performanceTarget
                            ? `+${(
                                center.completion - performanceTarget
                              ).toFixed(1)}%`
                            : `${(
                                center.completion - performanceTarget
                              ).toFixed(1)}%`}
                        </div>
                      </td>
                      <td
                        style={{
                          padding: "12px 16px",
                          borderBottom: "1px solid #E0E0E0",
                          textAlign: "center",
                        }}
                      >
                        <div
                          style={{
                            backgroundColor:
                              center.performanceIndex >= 85
                                ? "#E6F7EE"
                                : center.performanceIndex >= 70
                                ? "#E3F2FD"
                                : "#FFF4E5",
                            padding: "4px 8px",
                            borderRadius: "4px",
                            display: "inline-block",
                            color:
                              center.performanceIndex >= 85
                                ? "#107C10"
                                : center.performanceIndex >= 70
                                ? "#0078D4"
                                : "#D83B01",
                          }}
                        >
                          {center.performanceIndex >= 85
                            ? "우수"
                            : center.performanceIndex >= 70
                            ? "양호"
                            : "개선 필요"}
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}
      {/* 추이 분석 탭 내용 */}
      {activeTab === "trends" && (
        <div>
          {/* 추가 필터 옵션 */}
          <div style={{ display: "flex", gap: "20px", marginBottom: "20px" }}>
            <div style={{ display: "flex", alignItems: "center" }}>
              <label style={{ marginRight: "12px", fontWeight: "500" }}>
                보기 모드:
              </label>
              <div
                style={{
                  display: "flex",
                  backgroundColor: "#FFFFFF",
                  borderRadius: "4px",
                  border: "1px solid #E0E0E0",
                }}
              >
                {["daily", "weekly", "monthly"].map((mode) => (
                  <button
                    key={mode}
                    onClick={() => setViewMode(mode)}
                    style={{
                      padding: "8px 16px",
                      backgroundColor:
                        viewMode === mode ? "#0078D4" : "transparent",
                      color: viewMode === mode ? "#FFFFFF" : "#666666",
                      border: "none",
                      cursor: "pointer",
                      fontWeight: viewMode === mode ? "600" : "normal",
                    }}
                  >
                    {mode === "daily"
                      ? "일별"
                      : mode === "weekly"
                      ? "주별"
                      : "월별"}
                  </button>
                ))}
              </div>
            </div>

            <div style={{ display: "flex", alignItems: "center" }}>
              <label
                style={{
                  display: "flex",
                  alignItems: "center",
                  cursor: "pointer",
                }}
              >
                <input
                  type="checkbox"
                  checked={rollingAverage}
                  onChange={() => setRollingAverage(!rollingAverage)}
                  style={{ marginRight: "8px" }}
                />
                이동 평균 표시
              </label>
            </div>

            <div style={{ display: "flex", alignItems: "center" }}>
              <label
                style={{
                  display: "flex",
                  alignItems: "center",
                  cursor: "pointer",
                }}
              >
                <input
                  type="checkbox"
                  checked={showProjections}
                  onChange={() => setShowProjections(!showProjections)}
                  style={{ marginRight: "8px" }}
                />
                예측 추이 표시
              </label>
            </div>
          </div>

          <div
            style={{
              display: "grid",
              gridTemplateColumns: "repeat(2, 1fr)",
              gap: "24px",
              marginBottom: "24px",
            }}
          >
            {/* 시간별 마감률 추이 */}
            <div style={dashboardComponent}>
              <h3 style={componentTitle}>시간별 마감률 추이</h3>
              <ResponsiveContainer width="100%" height={350}>
                <LineChart
                  data={timeSeriesData}
                  margin={{ top: 5, right: 30, left: 20, bottom: 5 }}
                >
                  <CartesianGrid strokeDasharray="3 3" stroke="#EEEEEE" />
                  <XAxis dataKey="time" />
                  <YAxis domain={[0, 100]} />
                  <Tooltip
                    contentStyle={{
                      backgroundColor: "#FFFFFF",
                      border: "1px solid #E0E0E0",
                    }}
                    formatter={(value, name) => [`${value.toFixed(1)}%`, name]}
                  />
                  <Legend />
                  <ReferenceLine
                    y={performanceTarget}
                    stroke="#107C10"
                    strokeDasharray="3 3"
                    label={{
                      value: `목표 ${performanceTarget}%`,
                      fill: "#107C10",
                      fontSize: 12,
                    }}
                  />
                  {selectedCenter === "전체" ? (
                    // 전체 센터 선택 시
                    allData.length > 0 &&
                    allData[0].centers.map((center, index) => (
                      <Line
                        key={index}
                        type="monotone"
                        dataKey={`${center.name}_completion`}
                        name={center.name}
                        stroke={COLORS[index % COLORS.length]}
                        strokeWidth={2}
                        dot={{
                          stroke: COLORS[index % COLORS.length],
                          strokeWidth: 2,
                          r: 3,
                        }}
                        activeDot={{ r: 6 }}
                        animationDuration={500}
                      />
                    ))
                  ) : (
                    // 특정 센터 선택 시
                    <Line
                      type="monotone"
                      dataKey={`${selectedCenter}_completion`}
                      name={selectedCenter}
                      stroke="#0078D4"
                      strokeWidth={2}
                      dot={{ stroke: "#0078D4", strokeWidth: 2, r: 4 }}
                      animationDuration={500}
                    />
                  )}
                  {rollingAverage && (
                    <Line
                      type="monotone"
                      dataKey="avgCompletion"
                      name="평균 마감률"
                      stroke="#000000"
                      strokeWidth={3}
                      dot={false}
                      strokeDasharray="5 5"
                    />
                  )}
                </LineChart>
              </ResponsiveContainer>
            </div>

            {/* 마감 물량 시간별 추이 */}
            <div style={dashboardComponent}>
              <h3 style={componentTitle}>마감 물량 시간별 추이</h3>
              <ResponsiveContainer width="100%" height={350}>
                <ComposedChart
                  data={timeSeriesData}
                  margin={{ top: 5, right: 30, left: 20, bottom: 5 }}
                >
                  <CartesianGrid strokeDasharray="3 3" stroke="#EEEEEE" />
                  <XAxis dataKey="time" />
                  <YAxis />
                  <YAxis
                    yAxisId="right"
                    orientation="right"
                    domain={[0, 100]}
                  />
                  <Tooltip
                    contentStyle={{
                      backgroundColor: "#FFFFFF",
                      border: "1px solid #E0E0E0",
                    }}
                    formatter={(value, name) => {
                      if (name === "avgCompletion")
                        return [`${value.toFixed(1)}%`, "평균 마감률"];
                      return [value.toLocaleString(), name];
                    }}
                  />
                  <Legend />
                  <Area
                    type="monotone"
                    dataKey="totalClosed"
                    name="마감 물량"
                    fill="#0078D4"
                    stroke="#0078D4"
                    fillOpacity={0.2}
                    animationDuration={500}
                  />
                  <Area
                    type="monotone"
                    dataKey="totalRemaining"
                    name="잔여 물량"
                    fill="#D83B01"
                    stroke="#D83B01"
                    fillOpacity={0.1}
                    animationDuration={500}
                  />
                  <Line
                    yAxisId="right"
                    type="monotone"
                    dataKey="avgCompletion"
                    name="평균 마감률 (%)"
                    stroke="#107C10"
                    strokeWidth={2}
                    dot={false}
                    animationDuration={800}
                  />
                  <ReferenceLine
                    yAxisId="right"
                    y={performanceTarget}
                    stroke="#107C10"
                    strokeDasharray="3 3"
                    label={{
                      position: "right",
                      value: `목표 ${performanceTarget}%`,
                      fill: "#107C10",
                      fontSize: 12,
                    }}
                  />
                </ComposedChart>
              </ResponsiveContainer>
            </div>
          </div>

          {/* 마감률 vs 목표 갭 분석 */}
          <div style={dashboardComponent}>
            <h3 style={componentTitle}>마감률 vs 목표 갭 분석</h3>
            <ResponsiveContainer width="100%" height={350}>
              <ComposedChart
                data={chartData}
                margin={{ top: 20, right: 30, left: 20, bottom: 20 }}
              >
                <CartesianGrid strokeDasharray="3 3" stroke="#EEEEEE" />
                <XAxis dataKey="name" />
                <YAxis domain={[-30, 30]} />
                <Tooltip
                  contentStyle={{
                    backgroundColor: "#FFFFFF",
                    border: "1px solid #E0E0E0",
                  }}
                  formatter={(value, name) => [
                    value > 0
                      ? `+${value.toFixed(1)}%`
                      : `${value.toFixed(1)}%`,
                    name,
                  ]}
                />
                <Legend />
                <ReferenceLine y={0} stroke="#666666" />
                <Bar
                  dataKey="gap"
                  name="목표 대비 (%p)"
                  radius={[4, 4, 0, 0]}
                  animationDuration={500}
                >
                  {chartData.map((entry, index) => (
                    <Cell
                      key={`cell-${index}`}
                      fill={
                        entry.gap >= 10
                          ? "#107C10"
                          : entry.gap >= 0
                          ? "#0078D4"
                          : entry.gap >= -10
                          ? "#FFB900"
                          : "#D83B01"
                      }
                    />
                  ))}
                  <LabelList
                    dataKey="gap"
                    position="top"
                    formatter={(value) =>
                      value > 0
                        ? `+${value.toFixed(1)}%`
                        : `${value.toFixed(1)}%`
                    }
                  />
                </Bar>
              </ComposedChart>
            </ResponsiveContainer>
          </div>

          {/* 마감 속도 분석 - 시간당 마감량 계산 수정된 부분 */}
          <div style={dashboardComponent}>
            <h3 style={componentTitle}>센터별 마감 속도 분석</h3>
            <ResponsiveContainer width="100%" height={350}>
              <BarChart
                data={chartData.map((center) => ({
                  ...center,
                  closingSpeed: calculateClosingSpeed(center),
                }))}
                margin={{ top: 5, right: 30, left: 20, bottom: 5 }}
              >
                <CartesianGrid strokeDasharray="3 3" />
                <XAxis dataKey="name" />
                <YAxis />
                <Tooltip
                  contentStyle={{
                    backgroundColor: "#FFFFFF",
                    border: "1px solid #E0E0E0",
                  }}
                  formatter={(value, name) => {
                    if (name === "closingSpeed")
                      return [`${value.toFixed(1)}개/시간`, "마감 속도"];
                    return [value.toLocaleString(), name];
                  }}
                />
                <Legend />
                <Bar
                  dataKey="closingSpeed"
                  name="시간당 마감량"
                  fill="#775DD0"
                  radius={[4, 4, 0, 0]}
                >
                  <LabelList
                    dataKey="closingSpeed"
                    position="top"
                    formatter={(value) => `${value.toFixed(1)}`}
                  />
                </Bar>
              </BarChart>
            </ResponsiveContainer>

            <div style={{ marginTop: "20px" }}>
              <p
                style={{
                  fontSize: "14px",
                  color: "#666666",
                  margin: "0 0 8px 0",
                  fontWeight: "500",
                }}
              >
                핵심 지표
              </p>
              <div style={{ display: "flex", gap: "12px" }}>
                <div
                  style={{
                    flex: 1,
                    padding: "12px",
                    backgroundColor: "#F5F7FA",
                    borderRadius: "8px",
                    textAlign: "center",
                  }}
                >
                  <p
                    style={{
                      fontSize: "12px",
                      color: "#666666",
                      margin: "0 0 4px 0",
                    }}
                  >
                    효율성
                  </p>
                  <p
                    style={{
                      fontSize: "18px",
                      fontWeight: "bold",
                      margin: 0,
                      color:
                        chartData.length > 0 && chartData[0].efficiency >= 80
                          ? "#107C10"
                          : "#FFB900",
                    }}
                  >
                    {chartData.length > 0 ? chartData[0].efficiency || 0 : 0}%
                  </p>
                </div>
                <div
                  style={{
                    flex: 1,
                    padding: "12px",
                    backgroundColor: "#F5F7FA",
                    borderRadius: "8px",
                    textAlign: "center",
                  }}
                >
                  <p
                    style={{
                      fontSize: "12px",
                      color: "#666666",
                      margin: "0 0 4px 0",
                    }}
                  >
                    품질 점수
                  </p>
                  <p
                    style={{
                      fontSize: "18px",
                      fontWeight: "bold",
                      margin: 0,
                      color:
                        ((chartData.length > 0 && chartData[0].quality_score) ||
                          0) >= 90
                          ? "#107C10"
                          : "#0078D4",
                    }}
                  >
                    {chartData.length > 0 ? chartData[0].quality_score || 0 : 0}
                  </p>
                </div>
                <div
                  style={{
                    flex: 1,
                    padding: "12px",
                    backgroundColor: "#F5F7FA",
                    borderRadius: "8px",
                    textAlign: "center",
                  }}
                >
                  <p
                    style={{
                      fontSize: "12px",
                      color: "#666666",
                      margin: "0 0 4px 0",
                    }}
                  >
                    시간당 마감량
                  </p>
                  <p
                    style={{
                      fontSize: "18px",
                      fontWeight: "bold",
                      margin: 0,
                      color: "#775DD0",
                    }}
                  >
                    {chartData.length > 0
                      ? calculateClosingSpeed(chartData[0]).toFixed(1)
                      : 0}
                  </p>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}
      {/* 센터별 성과 탭 내용 */}
      {activeTab === "centers" && (
        <div>
          {/* 성과 카드 그리드 */}
          <div
            style={{
              display: "grid",
              gridTemplateColumns: "repeat(auto-fit, minmax(300px, 1fr))",
              gap: "24px",
              marginBottom: "24px",
            }}
          >
            {generatePerformanceMetrics().map((center, index) => (
              <div
                key={index}
                style={{
                  ...dashboardComponent,
                  marginBottom: 0,
                  transition: "transform 0.3s, box-shadow 0.3s",
                  borderLeft: `4px solid ${
                    center.performanceIndex >= 85
                      ? "#107C10"
                      : center.performanceIndex >= 70
                      ? "#0078D4"
                      : "#D83B01"
                  }`,
                }}
                onClick={() => setSelectedCenter(center.name)}
                onMouseOver={(e) => {
                  e.currentTarget.style.transform = "translateY(-5px)";
                  e.currentTarget.style.boxShadow =
                    "0 8px 16px rgba(0, 0, 0, 0.1)";
                  e.currentTarget.style.cursor = "pointer";
                }}
                onMouseOut={(e) => {
                  e.currentTarget.style.transform = "translateY(0)";
                  e.currentTarget.style.boxShadow =
                    "0 1px 3px rgba(0, 0, 0, 0.12), 0 1px 2px rgba(0, 0, 0, 0.24)";
                }}
              >
                <div
                  style={{
                    display: "flex",
                    justifyContent: "space-between",
                    alignItems: "flex-start",
                    marginBottom: "12px",
                  }}
                >
                  <h3
                    style={{
                      fontSize: "18px",
                      fontWeight: "600",
                      margin: 0,
                      color: "#333333",
                    }}
                  >
                    {center.name}
                  </h3>
                  <div
                    style={{
                      backgroundColor:
                        center.performanceIndex >= 85
                          ? "#E6F7EE"
                          : center.performanceIndex >= 70
                          ? "#E3F2FD"
                          : "#FFF4E5",
                      padding: "4px 8px",
                      borderRadius: "4px",
                      fontSize: "14px",
                      fontWeight: "500",
                      color:
                        center.performanceIndex >= 85
                          ? "#107C10"
                          : center.performanceIndex >= 70
                          ? "#0078D4"
                          : "#D83B01",
                    }}
                  >
                    {center.performanceIndex >= 85
                      ? "우수"
                      : center.performanceIndex >= 70
                      ? "양호"
                      : "개선 필요"}
                  </div>
                </div>

                <div
                  style={{
                    display: "flex",
                    alignItems: "center",
                    marginBottom: "16px",
                  }}
                >
                  <div
                    style={{
                      width: "60px",
                      height: "60px",
                      borderRadius: "50%",
                      background: `conic-gradient(${
                        center.completion >= performanceTarget
                          ? "#107C10"
                          : "#D83B01"
                      } ${Math.min(
                        (center.completion / performanceTarget) * 100,
                        100
                      )}%, #E0E0E0 0)`,
                      display: "flex",
                      alignItems: "center",
                      justifyContent: "center",
                      marginRight: "16px",
                    }}
                  >
                    <div
                      style={{
                        width: "50px",
                        height: "50px",
                        borderRadius: "50%",
                        backgroundColor: "white",
                        display: "flex",
                        alignItems: "center",
                        justifyContent: "center",
                        flexDirection: "column",
                      }}
                    >
                      <span
                        style={{
                          fontSize: "16px",
                          fontWeight: "bold",
                          color:
                            center.completion >= performanceTarget
                              ? "#107C10"
                              : "#D83B01",
                        }}
                      >
                        {center.completion.toFixed(1)}%
                      </span>
                      <span
                        style={{
                          fontSize: "10px",
                          color: "#666666",
                        }}
                      >
                        마감률
                      </span>
                    </div>
                  </div>
                  <div>
                    <div
                      style={{
                        fontSize: "14px",
                        color: "#666666",
                        marginBottom: "4px",
                      }}
                    >
                      성과 지수: {center.performanceIndex}
                    </div>
                    <div
                      style={{
                        fontSize: "14px",
                        color:
                          center.completion >= performanceTarget
                            ? "#107C10"
                            : "#D83B01",
                        fontWeight: "500",
                      }}
                    >
                      목표 대비:{" "}
                      {center.completion >= performanceTarget
                        ? `+${(center.completion - performanceTarget).toFixed(
                            1
                          )}%`
                        : `${(center.completion - performanceTarget).toFixed(
                            1
                          )}%`}
                    </div>
                  </div>
                </div>

                <div
                  style={{
                    display: "grid",
                    gridTemplateColumns: "1fr 1fr",
                    gap: "8px",
                    marginBottom: "12px",
                  }}
                >
                  <div
                    style={{
                      backgroundColor: "#F5F7FA",
                      borderRadius: "4px",
                      padding: "8px",
                      textAlign: "center",
                    }}
                  >
                    <div
                      style={{
                        fontSize: "20px",
                        fontWeight: "bold",
                        color: "#0078D4",
                      }}
                    >
                      {center.closed?.toLocaleString() || "0"}
                    </div>
                    <div style={{ fontSize: "12px", color: "#666666" }}>
                      마감 물량
                    </div>
                  </div>
                  <div
                    style={{
                      backgroundColor: "#F5F7FA",
                      borderRadius: "4px",
                      padding: "8px",
                      textAlign: "center",
                    }}
                  >
                    <div
                      style={{
                        fontSize: "20px",
                        fontWeight: "bold",
                        color: "#D83B01",
                      }}
                    >
                      {center.remaining?.toLocaleString() || "0"}
                    </div>
                    <div style={{ fontSize: "12px", color: "#666666" }}>
                      잔여 물량
                    </div>
                  </div>
                </div>

                <div style={{ marginBottom: "12px" }}>
                  <div
                    style={{
                      display: "flex",
                      justifyContent: "space-between",
                      alignItems: "center",
                      marginBottom: "4px",
                    }}
                  >
                    <span style={{ fontSize: "13px", color: "#666666" }}>
                      효율성
                    </span>
                    <span
                      style={{
                        fontSize: "13px",
                        fontWeight: "500",
                        color: center.efficiency >= 80 ? "#107C10" : "#FFB900",
                      }}
                    >
                      {center.efficiency}%
                    </span>
                  </div>
                  <div
                    style={{
                      width: "100%",
                      height: "6px",
                      backgroundColor: "#E0E0E0",
                      borderRadius: "3px",
                      overflow: "hidden",
                    }}
                  >
                    <div
                      style={{
                        width: `${center.efficiency}%`,
                        height: "100%",
                        backgroundColor:
                          center.efficiency >= 80 ? "#107C10" : "#FFB900",
                      }}
                    ></div>
                  </div>
                </div>

                <div>
                  <div
                    style={{
                      display: "flex",
                      justifyContent: "space-between",
                      alignItems: "center",
                      marginBottom: "4px",
                    }}
                  >
                    <span style={{ fontSize: "13px", color: "#666666" }}>
                      품질 점수
                    </span>
                    <span
                      style={{
                        fontSize: "13px",
                        fontWeight: "500",
                        color: center.quality >= 90 ? "#107C10" : "#0078D4",
                      }}
                    >
                      {center.quality}
                    </span>
                  </div>
                  <div
                    style={{
                      width: "100%",
                      height: "6px",
                      backgroundColor: "#E0E0E0",
                      borderRadius: "3px",
                      overflow: "hidden",
                    }}
                  >
                    <div
                      style={{
                        width: `${center.quality}%`,
                        height: "100%",
                        backgroundColor:
                          center.quality >= 90 ? "#107C10" : "#0078D4",
                      }}
                    ></div>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
      {/* 비교 분석 탭 내용 */}
      {activeTab === "comparison" && (
        <div>
          {/* 센터별 종합 비교 차트 */}
          <div
            style={{
              display: "grid",
              gridTemplateColumns: "repeat(2, 1fr)",
              gap: "24px",
              marginBottom: "24px",
            }}
          >
            {/* 레이더 차트로 센터별 종합 성과 비교 */}
            <div style={dashboardComponent}>
              <h3 style={componentTitle}>종합 성과 비교</h3>
              <ResponsiveContainer width="100%" height={400}>
                <RadarChart
                  outerRadius={150}
                  data={generatePerformanceMetrics()}
                >
                  <PolarGrid gridType="polygon" />
                  <PolarAngleAxis dataKey="name" />
                  <PolarRadiusAxis angle={30} domain={[0, 100]} />
                  <Radar
                    name="마감률"
                    dataKey="completion"
                    stroke="#0078D4"
                    fill="#0078D4"
                    fillOpacity={0.3}
                    animationDuration={500}
                  />
                  <Radar
                    name="효율성"
                    dataKey="efficiency"
                    stroke="#107C10"
                    fill="#107C10"
                    fillOpacity={0.2}
                    animationDuration={500}
                  />
                  <Radar
                    name="품질"
                    dataKey="quality"
                    stroke="#775DD0"
                    fill="#775DD0"
                    fillOpacity={0.1}
                    animationDuration={500}
                  />
                  <Legend />
                  <Tooltip
                    formatter={(value) => [`${value.toFixed(1)}`, ""]}
                    contentStyle={{
                      backgroundColor: "#FFFFFF",
                      border: "1px solid #E0E0E0",
                    }}
                  />
                </RadarChart>
              </ResponsiveContainer>
            </div>

            {/* 트리맵으로 센터별 물량 및 마감률 비교 - 시각적 개선 */}
            <div style={dashboardComponent}>
              <h3 style={componentTitle}>센터별 물량 및 마감률 비교</h3>
              <ResponsiveContainer width="100%" height={400}>
                <Treemap
                  data={chartData.map((center) => ({
                    name: center.name,
                    size: center.total,
                    total: center.total,
                    completion: center.completion,
                    performanceColor: center.performanceColor,
                  }))}
                  dataKey="size"
                  ratio={4 / 3}
                  stroke="#FFFFFF"
                  fill="#8884d8"
                  content={customTreemapContent}
                  animationDuration={800}
                >
                  <Tooltip
                    formatter={(value, name, props) => {
                      if (name === "size")
                        return [value.toLocaleString(), "전체 물량"];
                      if (name === "total")
                        return [value.toLocaleString(), "전체 물량"];
                      if (name === "completion")
                        return [`${value.toFixed(1)}%`, "마감률"];
                      return [value, name];
                    }}
                    contentStyle={{
                      backgroundColor: "#FFFFFF",
                      border: "1px solid #E0E0E0",
                    }}
                  />
                </Treemap>
              </ResponsiveContainer>
            </div>

            {/* 센터별 마감률 vs 효율성 비교 */}
            <div style={dashboardComponent}>
              <h3 style={componentTitle}>마감률 vs 효율성 비교</h3>
              <ResponsiveContainer width="100%" height={350}>
                <ScatterChart
                  margin={{ top: 20, right: 20, bottom: 20, left: 20 }}
                >
                  <CartesianGrid strokeDasharray="3 3" stroke="#EEEEEE" />
                  <XAxis
                    type="number"
                    dataKey="completion"
                    name="마감률"
                    domain={[0, 100]}
                    label={{
                      value: "마감률 (%)",
                      position: "bottom",
                      offset: 0,
                    }}
                  />
                  <YAxis
                    type="number"
                    dataKey="efficiency"
                    name="효율성"
                    domain={[0, 100]}
                    label={{
                      value: "효율성 (%)",
                      angle: -90,
                      position: "left",
                    }}
                  />
                  <Tooltip
                    contentStyle={{
                      backgroundColor: "#FFFFFF",
                      border: "1px solid #E0E0E0",
                    }}
                    formatter={(value, name) => [`${value.toFixed(1)}%`, name]}
                    labelFormatter={(value) => ""}
                    cursor={{ strokeDasharray: "3 3" }}
                  />
                  <Legend />
                  <Scatter
                    name="센터별 성과"
                    data={chartData}
                    fill="#0078D4"
                    shape="circle"
                  >
                    {chartData.map((entry, index) => (
                      <Cell
                        key={`cell-${index}`}
                        fill={entry.performanceColor || COLORS[0]}
                      />
                    ))}
                  </Scatter>
                  {/* 사분면 참조선 */}
                  <ReferenceLine
                    x={performanceTarget}
                    stroke="#0078D4"
                    strokeDasharray="3 3"
                    label={{
                      value: `마감률 목표 ${performanceTarget}%`,
                      position: "top",
                      fill: "#0078D4",
                      fontSize: 12,
                    }}
                  />
                  <ReferenceLine
                    y={80}
                    stroke="#107C10"
                    strokeDasharray="3 3"
                    label={{
                      value: "효율성 목표 80%",
                      position: "right",
                      fill: "#107C10",
                      fontSize: 12,
                    }}
                  />
                </ScatterChart>
              </ResponsiveContainer>
            </div>

            {/* 센터별 마감물량 비교 */}
            <div style={dashboardComponent}>
              <h3 style={componentTitle}>센터별 물량 비교</h3>
              <ResponsiveContainer width="100%" height={350}>
                <ComposedChart
                  data={chartData}
                  margin={{ top: 5, right: 30, left: 20, bottom: 5 }}
                >
                  <CartesianGrid strokeDasharray="3 3" stroke="#EEEEEE" />
                  <XAxis dataKey="name" />
                  <YAxis />
                  <YAxis
                    yAxisId="right"
                    orientation="right"
                    domain={[0, 100]}
                  />
                  <Tooltip
                    contentStyle={{
                      backgroundColor: "#FFFFFF",
                      border: "1px solid #E0E0E0",
                    }}
                    formatter={(value, name) => {
                      if (name === "completion")
                        return [`${value.toFixed(1)}%`, "마감률"];
                      return [value.toLocaleString(), name];
                    }}
                  />
                  <Legend />
                  <Bar
                    dataKey="closed"
                    name="마감 물량"
                    fill="#0078D4"
                    radius={[4, 4, 0, 0]}
                    animationDuration={500}
                  />
                  <Bar
                    dataKey="remaining"
                    name="잔여 물량"
                    fill="#D83B01"
                    radius={[4, 4, 0, 0]}
                    animationDuration={500}
                  />
                  <Line
                    yAxisId="right"
                    type="monotone"
                    dataKey="completion"
                    name="마감률 (%)"
                    stroke="#107C10"
                    strokeWidth={2}
                    dot={{ r: 5 }}
                    activeDot={{ r: 8 }}
                    animationDuration={800}
                  />
                  <ReferenceLine
                    yAxisId="right"
                    y={performanceTarget}
                    stroke="#107C10"
                    strokeDasharray="3 3"
                    label={{
                      value: `목표 ${performanceTarget}%`,
                      position: "right",
                      fill: "#107C10",
                      fontSize: 12,
                    }}
                  />
                </ComposedChart>
              </ResponsiveContainer>
            </div>
          </div>
          {/* 종합 성과 평가 */}
          <div style={dashboardComponent}>
            <h3 style={componentTitle}>센터별 종합 성과 평가</h3>
            <div
              style={{
                display: "grid",
                gridTemplateColumns: "repeat(auto-fill, minmax(300px, 1fr))",
                gap: "20px",
              }}
            >
              {generatePerformanceMetrics().map((center, index) => (
                <div
                  key={index}
                  style={{
                    borderRadius: "8px",
                    overflow: "hidden",
                    boxShadow:
                      "0 1px 3px rgba(0, 0, 0, 0.12), 0 1px 2px rgba(0, 0, 0, 0.24)",
                    backgroundColor: "#FFFFFF",
                    transition: "transform 0.3s ease, box-shadow 0.3s ease",
                  }}
                  onMouseOver={(e) => {
                    e.currentTarget.style.transform = "translateY(-5px)";
                    e.currentTarget.style.boxShadow =
                      "0 8px 16px rgba(0, 0, 0, 0.1)";
                  }}
                  onMouseOut={(e) => {
                    e.currentTarget.style.transform = "translateY(0)";
                    e.currentTarget.style.boxShadow =
                      "0 1px 3px rgba(0, 0, 0, 0.12), 0 1px 2px rgba(0, 0, 0, 0.24)";
                  }}
                >
                  <div
                    style={{
                      backgroundColor:
                        center.performanceIndex >= 85
                          ? "#107C10"
                          : center.performanceIndex >= 70
                          ? "#0078D4"
                          : "#D83B01",
                      padding: "16px",
                      color: "#FFFFFF",
                    }}
                  >
                    <h4
                      style={{ margin: 0, fontWeight: "600", fontSize: "18px" }}
                    >
                      {center.name}
                    </h4>
                    <p style={{ margin: "4px 0 0 0", fontSize: "14px" }}>
                      성과 지수: {center.performanceIndex}점 (
                      {center.performanceIndex >= 85
                        ? "우수"
                        : center.performanceIndex >= 70
                        ? "양호"
                        : "개선 필요"}
                      )
                    </p>
                  </div>

                  <div style={{ padding: "16px" }}>
                    <div style={{ marginBottom: "16px" }}>
                      <p
                        style={{
                          fontSize: "14px",
                          color: "#666666",
                          margin: "0 0 4px 0",
                          fontWeight: "500",
                        }}
                      >
                        마감률
                      </p>

                      <div
                        style={{
                          height: "8px",
                          backgroundColor: "#EEEEEE",
                          borderRadius: "4px",
                          overflow: "hidden",
                          marginBottom: "4px",
                          position: "relative",
                        }}
                      >
                        <div
                          style={{
                            width: `${Math.min(center.completion, 100)}%`,
                            height: "100%",
                            backgroundColor:
                              center.completion >= performanceTarget
                                ? "#107C10"
                                : center.completion >= performanceTarget * 0.8
                                ? "#FFB900"
                                : "#D83B01",
                            borderRadius: "4px",
                          }}
                        />
                        {/* 목표 마커 */}
                        {performanceTarget > 0 && performanceTarget < 100 && (
                          <div
                            style={{
                              position: "absolute",
                              top: 0,
                              left: `${performanceTarget}%`,
                              width: "2px",
                              height: "8px",
                              backgroundColor: "#107C10",
                              zIndex: 1,
                            }}
                          />
                        )}
                      </div>
                      <div
                        style={{
                          display: "flex",
                          justifyContent: "space-between",
                          fontSize: "13px",
                        }}
                      >
                        <span style={{ fontWeight: "600" }}>
                          {center.completion.toFixed(1)}%
                        </span>
                        <span
                          style={{
                            color:
                              center.completion >= performanceTarget
                                ? "#107C10"
                                : "#D83B01",
                            fontWeight: "500",
                          }}
                        >
                          목표 대비:{" "}
                          {center.completion >= performanceTarget
                            ? `+${(
                                center.completion - performanceTarget
                              ).toFixed(1)}%`
                            : `${(
                                center.completion - performanceTarget
                              ).toFixed(1)}%`}
                        </span>
                      </div>
                    </div>

                    <div style={{ marginBottom: "16px" }}>
                      <p
                        style={{
                          fontSize: "14px",
                          color: "#666666",
                          margin: "0 0 4px 0",
                          fontWeight: "500",
                        }}
                      >
                        효율성
                      </p>
                      <div
                        style={{
                          height: "8px",
                          backgroundColor: "#EEEEEE",
                          borderRadius: "4px",
                          overflow: "hidden",
                          marginBottom: "4px",
                          position: "relative",
                        }}
                      >
                        <div
                          style={{
                            width: `${Math.min(center.efficiency, 100)}%`,
                            height: "100%",
                            backgroundColor:
                              center.efficiency >= 80
                                ? "#107C10"
                                : center.efficiency >= 70
                                ? "#FFB900"
                                : "#D83B01",
                            borderRadius: "4px",
                          }}
                        />
                        {/* 목표 마커 */}
                        <div
                          style={{
                            position: "absolute",
                            top: 0,
                            left: "80%",
                            width: "2px",
                            height: "8px",
                            backgroundColor: "#107C10",
                            zIndex: 1,
                          }}
                        />
                      </div>
                      <div
                        style={{
                          display: "flex",
                          justifyContent: "space-between",
                          fontSize: "13px",
                        }}
                      >
                        <span style={{ fontWeight: "600" }}>
                          {center.efficiency}%
                        </span>
                        <span
                          style={{
                            color:
                              center.efficiency >= 80 ? "#107C10" : "#D83B01",
                            fontWeight: "500",
                          }}
                        >
                          목표 대비:{" "}
                          {center.efficiency >= 80
                            ? `+${(center.efficiency - 80).toFixed(1)}%`
                            : `${(center.efficiency - 80).toFixed(1)}%`}
                        </span>
                      </div>
                    </div>

                    <div style={{ marginBottom: "16px" }}>
                      <p
                        style={{
                          fontSize: "14px",
                          color: "#666666",
                          margin: "0 0 4px 0",
                          fontWeight: "500",
                        }}
                      >
                        품질
                      </p>
                      <div
                        style={{
                          height: "8px",
                          backgroundColor: "#EEEEEE",
                          borderRadius: "4px",
                          overflow: "hidden",
                          marginBottom: "4px",
                          position: "relative",
                        }}
                      >
                        <div
                          style={{
                            width: `${Math.min(center.quality, 100)}%`,
                            height: "100%",
                            backgroundColor:
                              center.quality >= 90
                                ? "#107C10"
                                : center.quality >= 80
                                ? "#0078D4"
                                : "#FFB900",
                            borderRadius: "4px",
                          }}
                        />
                        {/* 목표 마커 */}
                        <div
                          style={{
                            position: "absolute",
                            top: 0,
                            left: "85%",
                            width: "2px",
                            height: "8px",
                            backgroundColor: "#107C10",
                            zIndex: 1,
                          }}
                        />
                      </div>
                      <div
                        style={{
                          display: "flex",
                          justifyContent: "space-between",
                          fontSize: "13px",
                        }}
                      >
                        <span style={{ fontWeight: "600" }}>
                          {center.quality}
                        </span>
                        <span
                          style={{
                            color: center.quality >= 85 ? "#107C10" : "#D83B01",
                            fontWeight: "500",
                          }}
                        >
                          목표 대비:{" "}
                          {center.quality >= 85
                            ? `+${(center.quality - 85).toFixed(1)}`
                            : `${(center.quality - 85).toFixed(1)}`}
                        </span>
                      </div>
                    </div>

                    <div
                      style={{ marginTop: "20px", display: "flex", gap: "8px" }}
                    >
                      <div
                        style={{
                          flex: 1,
                          textAlign: "center",
                          padding: "8px",
                          backgroundColor: "#F5F7FA",
                          borderRadius: "4px",
                        }}
                      >
                        <p
                          style={{
                            margin: "0 0 4px 0",
                            fontSize: "13px",
                            color: "#666666",
                          }}
                        >
                          전체 물량
                        </p>
                        <p
                          style={{
                            margin: 0,
                            fontWeight: "600",
                            color: "#0078D4",
                          }}
                        >
                          {center.total.toLocaleString()}
                        </p>
                      </div>
                      <div
                        style={{
                          flex: 1,
                          textAlign: "center",
                          padding: "8px",
                          backgroundColor: "#F5F7FA",
                          borderRadius: "4px",
                        }}
                      >
                        <p
                          style={{
                            margin: "0 0 4px 0",
                            fontSize: "13px",
                            color: "#666666",
                          }}
                        >
                          마감 물량
                        </p>
                        <p
                          style={{
                            margin: 0,
                            fontWeight: "600",
                            color: "#333333",
                          }}
                        >
                          {center.closed.toLocaleString()}
                        </p>
                      </div>
                      <div
                        style={{
                          flex: 1,
                          textAlign: "center",
                          padding: "8px",
                          backgroundColor: "#F5F7FA",
                          borderRadius: "4px",
                        }}
                      >
                        <p
                          style={{
                            margin: "0 0 4px 0",
                            fontSize: "13px",
                            color: "#666666",
                          }}
                        >
                          잔여 건수
                        </p>
                        <p
                          style={{
                            margin: 0,
                            fontWeight: "600",
                            color: "#D83B01",
                          }}
                        >
                          {center.remaining.toLocaleString()}
                        </p>
                      </div>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}
      {/* 예측 분석 탭 - 새로 추가 */}
      {activeTab === "prediction" && (
        <div>
          {/* 예측 설정 컨트롤 */}
          <div style={dashboardComponent}>
            <h3 style={componentTitle}>예측 설정</h3>
            <div style={{ display: "flex", gap: "24px", flexWrap: "wrap" }}>
              <div style={{ flex: "1", minWidth: "180px" }}>
                <label
                  style={{
                    display: "block",
                    marginBottom: "8px",
                    color: "#666666",
                    fontWeight: "500",
                  }}
                >
                  예측 범위 (시간)
                </label>
                <select
                  value={forecastHorizon}
                  onChange={(e) => {
                    setForecastHorizon(parseInt(e.target.value));
                    // 범위 변경 시 예측 데이터 다시 생성
                    generatePredictions(allData);
                  }}
                  style={{
                    width: "100%",
                    padding: "10px",
                    borderRadius: "4px",
                    border: "1px solid #E0E0E0",
                    backgroundColor: "#FFFFFF",
                    color: "#333333",
                  }}
                >
                  {[1, 2, 3, 4, 5, 6].map((hours) => (
                    <option key={hours} value={hours}>
                      {hours}시간
                    </option>
                  ))}
                </select>
              </div>

              <div style={{ flex: "1", minWidth: "180px" }}>
                <label
                  style={{
                    display: "block",
                    marginBottom: "8px",
                    color: "#666666",
                    fontWeight: "500",
                  }}
                >
                  예측 신뢰도 (%)
                </label>
                <input
                  type="range"
                  min="70"
                  max="95"
                  step="5"
                  value={forecastConfidence}
                  onChange={(e) => {
                    setForecastConfidence(parseInt(e.target.value));
                    // 신뢰도 변경 시 예측 데이터 다시 생성
                    generatePredictions(allData);
                  }}
                  style={{
                    width: "100%",
                    padding: "10px 0",
                  }}
                />
                <div
                  style={{
                    textAlign: "center",
                    fontSize: "14px",
                    color: "#666666",
                  }}
                >
                  {forecastConfidence}%
                </div>
              </div>

              <div
                style={{
                  flex: "2",
                  minWidth: "300px",
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                }}
              >
                <div
                  style={{
                    backgroundColor: "#F0F4FF",
                    padding: "12px 16px",
                    borderRadius: "8px",
                    fontSize: "14px",
                    color: "#333333",
                    lineHeight: "1.4",
                    border: "1px dashed #775DD0",
                  }}
                >
                  <p style={{ margin: "0 0 8px 0", fontWeight: "500" }}>
                    <span style={{ marginRight: "8px", fontSize: "16px" }}>
                      🔮
                    </span>
                    예측 알고리즘 정보
                  </p>
                  <p style={{ margin: "0 0 4px 0" }}>
                    • 과거 시간별 추이 데이터 기반 비선형 추세 분석
                  </p>
                  <p style={{ margin: "0 0 4px 0" }}>
                    • 최근 데이터에 가중치 적용 (시간별 가속/감속 반영)
                  </p>
                  <p
                    style={{ margin: "0", fontSize: "13px", color: "#666666" }}
                  >
                    신뢰도는 예측 구간의 폭을 조정합니다. 높을수록 더 좁은
                    범위를 예측합니다.
                  </p>
                </div>
              </div>
            </div>
          </div>

          {/* 예측 차트 영역 */}
          <div
            style={{
              display: "grid",
              gridTemplateColumns: "repeat(2, 1fr)",
              gap: "24px",
              marginBottom: "24px",
            }}
          >
            {/* 마감률 예측 추이 */}
            <div style={dashboardComponent}>
              <h3 style={componentTitle}>마감률 예측 추이</h3>
              <ResponsiveContainer width="100%" height={350}>
                <ComposedChart
                  data={timeSeriesData}
                  margin={{ top: 20, right: 30, left: 20, bottom: 20 }}
                >
                  <CartesianGrid strokeDasharray="3 3" stroke="#EEEEEE" />
                  <XAxis
                    dataKey="time"
                    tick={{ fill: "#333333" }}
                    axisLine={{ stroke: "#E0E0E0" }}
                  />
                  <YAxis
                    domain={[0, 100]}
                    tickFormatter={(value) => `${value}%`}
                    tick={{ fill: "#333333" }}
                    axisLine={{ stroke: "#E0E0E0" }}
                  />
                  <Tooltip
                    contentStyle={{
                      backgroundColor: "#FFFFFF",
                      border: "1px solid #E0E0E0",
                      borderRadius: "4px",
                    }}
                    formatter={(value, name) => {
                      if (name === "avgCompletion")
                        return [`${value.toFixed(1)}%`, "마감률"];
                      return [value.toFixed(1), name];
                    }}
                    labelFormatter={(label) => `시간: ${label}`}
                  />
                  <Legend />

                  {/* 과거 데이터 */}
                  <Line
                    type="monotone"
                    dataKey="avgCompletion"
                    name="실제 마감률"
                    stroke="#0078D4"
                    strokeWidth={3}
                    dot={{ fill: "#0078D4", stroke: "#0078D4", r: 4 }}
                    activeDot={{ r: 8 }}
                    isAnimationActive={true}
                    animationDuration={800}
                  />

                  {/* 목표선 */}
                  <ReferenceLine
                    y={performanceTarget}
                    stroke="#107C10"
                    strokeDasharray="5 5"
                    label={{
                      value: `목표 ${performanceTarget}%`,
                      position: "right",
                      fill: "#107C10",
                      fontSize: 12,
                    }}
                  />
                </ComposedChart>
              </ResponsiveContainer>
            </div>
            {/* 센터별 예상 완료 시간 */}
            <div style={dashboardComponent}>
              <h3 style={componentTitle}>센터별 예상 완료 시간</h3>
              <ResponsiveContainer width="100%" height={350}>
                <BarChart
                  data={(() => {
                    // 센터별 완료 예측 데이터 생성
                    if (!predictionData.length || !chartData.length) return [];

                    return chartData
                      .map((center) => {
                        // 센터의 예측 데이터 찾기
                        const targetCompletion = 95; // 95%를 완료 기준으로 설정

                        // 해당 센터의 각 시간대별 예측 데이터를 찾아서 배열로 구성
                        const centerPredictions = predictionData
                          .map((timePoint) => {
                            return timePoint.centers.find(
                              (c) => c.name === center.name
                            );
                          })
                          .filter((pred) => pred);

                        // 95% 이상 도달하는 첫 시간 찾기
                        const completionPoint = centerPredictions.find(
                          (pred) => pred && pred.completion >= targetCompletion
                        );

                        // 마지막 예측 시점의 마감률
                        const finalPrediction = centerPredictions.length
                          ? centerPredictions[centerPredictions.length - 1]
                          : null;

                        // 완료 시간 예측
                        let estimatedHoursToCompletion = null;

                        if (completionPoint) {
                          // 이미 예측 내에 95% 이상 도달하는 시간대가 있음
                          estimatedHoursToCompletion =
                            completionPoint.forecastHour;
                        } else if (
                          finalPrediction &&
                          center.completion < targetCompletion
                        ) {
                          // 예측 기간 내에 95% 미달성 시, 추세 기반 추정
                          const hourlyRate =
                            finalPrediction && forecastHorizon > 0
                              ? (finalPrediction.completion -
                                  center.completion) /
                                forecastHorizon
                              : 0;

                          if (hourlyRate > 0) {
                            estimatedHoursToCompletion = Math.ceil(
                              forecastHorizon +
                                (targetCompletion -
                                  finalPrediction.completion) /
                                  hourlyRate
                            );
                          } else {
                            // 증가율이 없거나 음수면 완료 불가로 판단
                            estimatedHoursToCompletion = null;
                          }
                        } else if (center.completion >= targetCompletion) {
                          // 이미 목표 달성
                          estimatedHoursToCompletion = 0;
                        }

                        return {
                          name: center.name,
                          estimatedHours: estimatedHoursToCompletion,
                          currentCompletion: center.completion,
                          predictedCompletion: finalPrediction
                            ? finalPrediction.completion
                            : center.completion,
                          color:
                            estimatedHoursToCompletion === null
                              ? "#D83B01"
                              : estimatedHoursToCompletion <= 3
                              ? "#107C10"
                              : estimatedHoursToCompletion <= 6
                              ? "#0078D4"
                              : "#FFB900",
                        };
                      })
                      .filter((item) => item !== null)
                      .sort((a, b) => {
                        // null 값은 가장 뒤로
                        if (a.estimatedHours === null) return 1;
                        if (b.estimatedHours === null) return -1;
                        // 시간 순서로 정렬
                        return a.estimatedHours - b.estimatedHours;
                      });
                  })()}
                  margin={{ top: 5, right: 30, left: 20, bottom: 5 }}
                  layout="vertical"
                >
                  <CartesianGrid strokeDasharray="3 3" stroke="#EEEEEE" />
                  <XAxis
                    type="number"
                    domain={[0, "dataMax"]}
                    label={{
                      value: "예상 소요 시간",
                      position: "insideBottom",
                      offset: -5,
                    }}
                  />
                  <YAxis dataKey="name" type="category" width={100} />
                  <Tooltip
                    contentStyle={{
                      backgroundColor: "#FFFFFF",
                      border: "1px solid #E0E0E0",
                    }}
                    formatter={(value, name, props) => {
                      if (name === "estimatedHours") {
                        return value === null
                          ? ["예측 불가", "완료 예상 시간"]
                          : value === 0
                          ? ["이미 완료", "완료 예상 시간"]
                          : [`${value}시간 후`, "완료 예상 시간"];
                      }
                      return [value, name];
                    }}
                  />
                  <Legend />
                  <Bar
                    dataKey="estimatedHours"
                    name="완료 예상 시간 (시간)"
                    fill="#0078D4"
                    radius={[0, 4, 4, 0]}
                    animationDuration={800}
                  >
                    {/* 동적 셀 색상 */}
                    {(data) => {
                      return data.map((entry, index) => (
                        <Cell
                          key={`cell-${index}`}
                          fill={entry.color || "#0078D4"}
                        />
                      ));
                    }}
                    <LabelList
                      dataKey="estimatedHours"
                      position="right"
                      formatter={(value) =>
                        value === null
                          ? "예측 불가"
                          : value === 0
                          ? "완료됨"
                          : `${value}시간`
                      }
                    />
                  </Bar>
                </BarChart>
              </ResponsiveContainer>
            </div>
          </div>

          {/* 마감 물량 예측 */}
          <div style={dashboardComponent}>
            <h3 style={componentTitle}>마감 물량 예측</h3>
            <ResponsiveContainer width="100%" height={350}>
              <ComposedChart
                data={timeSeriesData}
                margin={{ top: 20, right: 30, left: 20, bottom: 20 }}
              >
                <CartesianGrid strokeDasharray="3 3" stroke="#EEEEEE" />
                <XAxis dataKey="time" />
                <YAxis />
                <Tooltip
                  contentStyle={{
                    backgroundColor: "#FFFFFF",
                    border: "1px solid #E0E0E0",
                  }}
                  formatter={(value, name) => [value.toLocaleString(), name]}
                  labelFormatter={(label) => `시간: ${label}`}
                />
                <Legend />

                {/* 실제 데이터 */}
                <Area
                  type="monotone"
                  dataKey="totalClosed"
                  name="실제 마감 물량"
                  fill="#0078D4"
                  stroke="#0078D4"
                  fillOpacity={0.2}
                />
              </ComposedChart>
            </ResponsiveContainer>
          </div>

          {/* 예측 인사이트 */}
          <div style={dashboardComponent}>
            <h3 style={componentTitle}>예측 인사이트</h3>

            {predictionData.length > 0 ? (
              <div
                style={{
                  display: "grid",
                  gridTemplateColumns: "repeat(auto-fit, minmax(300px, 1fr))",
                  gap: "20px",
                }}
              >
                {(() => {
                  // 주요 예측 인사이트 생성
                  const insights = [];

                  // 1. 가장 빠르게 완료될 센터
                  const completionTimes = chartData
                    .map((center) => {
                      // 센터의 예측 데이터 찾기
                      const centerPredictions = predictionData
                        .map((timePoint) => {
                          return timePoint.centers.find(
                            (c) => c.name === center.name
                          );
                        })
                        .filter((pred) => pred);

                      // 95% 이상 도달하는 첫 시간 찾기
                      const completionPoint = centerPredictions.find(
                        (pred) => pred && pred.completion >= 95
                      );

                      // 마지막 예측 시점의 마감률
                      const finalPrediction = centerPredictions.length
                        ? centerPredictions[centerPredictions.length - 1]
                        : null;

                      // 예상 완료 시간
                      let estimatedHours = null;
                      if (completionPoint) {
                        estimatedHours = completionPoint.forecastHour;
                      } else if (finalPrediction && center.completion < 95) {
                        const hourlyRate =
                          finalPrediction && forecastHorizon > 0
                            ? (finalPrediction.completion - center.completion) /
                              forecastHorizon
                            : 0;

                        if (hourlyRate > 0) {
                          estimatedHours = Math.ceil(
                            forecastHorizon +
                              (95 - finalPrediction.completion) / hourlyRate
                          );
                        }
                      } else if (center.completion >= 95) {
                        estimatedHours = 0;
                      }

                      return {
                        name: center.name,
                        hours: estimatedHours,
                        completion: center.completion,
                        predicted: finalPrediction
                          ? finalPrediction.completion
                          : center.completion,
                      };
                    })
                    .filter((item) => item.hours !== null)
                    .sort((a, b) => a.hours - b.hours);

                  if (completionTimes.length > 0) {
                    const fastest = completionTimes[0];
                    insights.push({
                      title: "가장 빠른 완료 예상",
                      content:
                        fastest.hours === 0
                          ? `${fastest.name}은(는) 이미 95% 이상 마감되었습니다.`
                          : `${fastest.name}이(가) ${fastest.hours}시간 후 95% 이상 마감될 것으로 예상됩니다.`,
                      icon: "🏆",
                      type: "positive",
                    });
                  }

                  // 2. 전체 마감률 달성 예측
                  const avgCurrentCompletion =
                    chartData.length > 0
                      ? chartData.reduce(
                          (sum, center) => sum + center.completion,
                          0
                        ) / chartData.length
                      : 0;

                  const avgPredictedCompletion =
                    predictionData.length > 0 &&
                    predictionData[predictionData.length - 1].centers.length > 0
                      ? predictionData[
                          predictionData.length - 1
                        ].centers.reduce(
                          (sum, center) => sum + center.completion,
                          0
                        ) /
                        predictionData[predictionData.length - 1].centers.length
                      : avgCurrentCompletion;

                  const diffWithTarget =
                    avgPredictedCompletion - performanceTarget;

                  insights.push({
                    title: "전체 목표 달성 예측",
                    content:
                      diffWithTarget >= 0
                        ? `예측기간 후 전체 마감률은 ${avgPredictedCompletion.toFixed(
                            1
                          )}%로 목표를 ${diffWithTarget.toFixed(
                            1
                          )}%p 초과할 것으로 예상됩니다.`
                        : `예측기간 후 전체 마감률은 ${avgPredictedCompletion.toFixed(
                            1
                          )}%로 목표 대비 ${(-diffWithTarget).toFixed(
                            1
                          )}%p 부족할 것으로 예상됩니다.`,
                    icon: diffWithTarget >= 0 ? "🎯" : "🔍",
                    type: diffWithTarget >= 0 ? "positive" : "neutral",
                  });

                  // 인사이트 카드 렌더링
                  return insights.map((insight, index) => (
                    <div
                      key={index}
                      style={{
                        backgroundColor:
                          insight.type === "positive"
                            ? "#E6F7EE"
                            : insight.type === "warning"
                            ? "#FFF4E5"
                            : insight.type === "neutral"
                            ? "#E3F2FD"
                            : "#F5F0FF",
                        borderRadius: "8px",
                        padding: "16px",
                        transition: "transform 0.2s, box-shadow 0.2s",
                      }}
                      onMouseOver={(e) => {
                        e.currentTarget.style.transform = "translateY(-3px)";
                        e.currentTarget.style.boxShadow =
                          "0 4px 8px rgba(0, 0, 0, 0.1)";
                      }}
                      onMouseOut={(e) => {
                        e.currentTarget.style.transform = "translateY(0)";
                        e.currentTarget.style.boxShadow = "none";
                      }}
                    >
                      <div
                        style={{
                          display: "flex",
                          alignItems: "center",
                          marginBottom: "12px",
                        }}
                      >
                        <span style={{ fontSize: "24px", marginRight: "12px" }}>
                          {insight.icon}
                        </span>
                        <h4
                          style={{
                            margin: 0,
                            fontWeight: "600",
                            color: "#333333",
                          }}
                        >
                          {insight.title}
                        </h4>
                      </div>
                      <p style={{ margin: 0, color: "#555555" }}>
                        {insight.content}
                      </p>
                    </div>
                  ));
                })()}
              </div>
            ) : (
              <div
                style={{
                  textAlign: "center",
                  padding: "40px",
                  color: "#666666",
                }}
              >
                <p>예측 데이터를 생성하는 중입니다...</p>
                <p>
                  데이터가 충분하지 않으면 예측 데이터를 생성할 수 없습니다.
                </p>
              </div>
            )}
          </div>
        </div>
      )}

      {/* 푸터 */}
      <div
        style={{
          textAlign: "center",
          padding: "24px 0",
          color: "#666666",
          fontSize: "14px",
          marginTop: "40px",
        }}
      >
        <p style={{ margin: 0 }}>
          품고 센터별 물량 분석 대시보드 - ZOAR v2.0 © 2025
        </p>
        <p style={{ margin: "4px 0 0 0", fontSize: "12px", color: "#888888" }}>
          품고 심장박동, 센터별 물량으로 확인하세요 (문권: '나는 삽질한다, 고로
          존재한다)
        </p>
      </div>
    </div>
  );
}

export default App;
