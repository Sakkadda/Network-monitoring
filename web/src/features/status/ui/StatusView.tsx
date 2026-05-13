import { useEffect, useMemo, useRef, useState } from 'react';

import { LIVE_REFETCH_MS, useGetDevicesQuery, useGetMetricsQuery } from '../../../shared/api/monitoringApi';
import { translateLocation } from '../../../shared/lib/display';
import { uiText } from '../../../shared/lib/i18n';
import type { Language } from '../../../shared/lib/language';
import { formatUnit } from '../../../shared/lib/language';

type StatusKey = 'online' | 'warning' | 'offline';
type MetricKey = 'ping_latency' | 'cpu_usage' | 'memory_usage' | 'packet_loss';
type MetricHistoryPoint = {
  timestamp: string;
  value: number;
};

type ChartPoint = {
  timestamp: string;
  value: number;
  x: number;
  y: number;
};

type ChartScale = {
  min: number;
  max: number;
  labels: string[];
};

const metricLineColors: Record<MetricKey, string> = {
  ping_latency: '#0f6a72',
  cpu_usage: '#2f7ed8',
  memory_usage: '#6b5bd2',
  packet_loss: '#c94848',
};

const metricOrder: MetricKey[] = ['cpu_usage', 'memory_usage', 'ping_latency', 'packet_loss'];
const chartPaddingX = 10;
const chartPaddingY = 12;
const chartPlotHeight = 170;
const historyLimit = 12;

const metricHistoryStore: Record<MetricKey, MetricHistoryPoint[]> = {
  ping_latency: [],
  cpu_usage: [],
  memory_usage: [],
  packet_loss: [],
};

let lastMetricSnapshotSignature = '';

function formatValue(value: number, unit: string, language: Language) {
  const suffix = formatUnit(unit, language);
  return `${value.toFixed(unit === '%' ? 1 : 2)} ${suffix}`;
}

function buildChartScale(metricKey: MetricKey, language: Language): ChartScale {
  if (metricKey === 'ping_latency') {
    return {
      min: 0,
      max: 300,
      labels: language === 'en'
        ? ['300 ms', '250 ms', '200 ms', '150 ms', '100 ms', '50 ms', '0 ms']
        : ['300 мс', '250 мс', '200 мс', '150 мс', '100 мс', '50 мс', '0 мс'],
    };
  }

  return {
    min: 0,
    max: 100,
    labels: ['100%', '80%', '60%', '40%', '20%', '0%'],
  };
}

function toChartPoints(points: MetricHistoryPoint[], minValue: number, maxValue: number, width: number, height: number): ChartPoint[] {
  if (points.length === 0) {
    return [];
  }

  const drawWidth = Math.max(width - chartPaddingX * 2, 1);
  const drawHeight = Math.max(height - chartPaddingY * 2, 1);
  const scaleRange = Math.max(maxValue - minValue, 1);

  return points.map((point, index) => {
    const normalizedValue = Math.min(Math.max(point.value, minValue), maxValue);
    const xRatio = points.length === 1 ? 0.5 : index / (points.length - 1);
    const yRatio = (normalizedValue - minValue) / scaleRange;

    return {
      ...point,
      x: chartPaddingX + drawWidth * xRatio,
      y: chartPaddingY + drawHeight * (1 - yRatio),
    };
  });
}

function buildLinePath(points: ChartPoint[], width: number) {
  if (points.length === 0) {
    return '';
  }

  if (points.length === 1) {
    return `M ${chartPaddingX} ${points[0].y.toFixed(2)} L ${(Math.max(width - chartPaddingX, chartPaddingX)).toFixed(2)} ${points[0].y.toFixed(2)}`;
  }

  return points
    .map((point, index) => {
      return `${index === 0 ? 'M' : 'L'} ${point.x.toFixed(2)} ${point.y.toFixed(2)}`;
    })
    .join(' ');
}

function buildVisibleXLabels(points: ChartPoint[]) {
  if (points.length === 0) {
    return [];
  }

  const indexes = new Set<number>();

  if (points.length <= 6) {
    points.forEach((_, index) => indexes.add(index));
  } else {
    const step = Math.ceil((points.length - 1) / 5);
    for (let index = 0; index < points.length; index += step) {
      indexes.add(index);
    }
    indexes.add(points.length - 1);
  }

  return [...indexes]
    .sort((left, right) => left - right)
    .map((index) => ({
      key: `${points[index].timestamp}-${index}`,
      left: points[index].x,
      timestamp: points[index].timestamp,
    }));
}

function useElementWidth<T extends HTMLElement>() {
  const ref = useRef<T | null>(null);
  const [width, setWidth] = useState(0);

  useEffect(() => {
    const element = ref.current;
    if (!element) {
      return;
    }

    const updateWidth = () => {
      setWidth(element.clientWidth);
    };

    updateWidth();

    const observer = new ResizeObserver(() => updateWidth());
    observer.observe(element);

    return () => observer.disconnect();
  }, []);

  return { ref, width };
}

type TrendCardData = {
  key: MetricKey;
  label: string;
  average: number;
  unit: string;
  points: MetricHistoryPoint[];
  scale: ChartScale;
  lastTimestamp: string;
};

function MetricTrendCard({ item, language }: { item: TrendCardData; language: Language }) {
  const { ref, width } = useElementWidth<HTMLDivElement>();
  const text = uiText[language].status;

  const chartGeometry = useMemo(() => {
    const safeWidth = Math.max(width, 240);
    const points = toChartPoints(item.points, item.scale.min, item.scale.max, safeWidth, chartPlotHeight);
    const path = buildLinePath(points, safeWidth);
    const xLabels = buildVisibleXLabels(points);

    return {
      width: safeWidth,
      height: chartPlotHeight,
      points,
      path,
      xLabels,
    };
  }, [item.points, item.scale.max, item.scale.min, width]);

  return (
    <article className="metric-trend-card">
      <div className="metric-trend-card__header">
        <div>
          <h3>{item.label}</h3>
          <span>{text.lastUpdate}: {item.lastTimestamp}</span>
        </div>
        <strong>{formatValue(item.average, item.unit, language)}</strong>
      </div>
      <div className="metric-trend-chart">
        <div className="metric-trend-chart__y-axis">
          {item.scale.labels.map((label) => (
            <span key={label}>{label}</span>
          ))}
        </div>
        <div className="metric-trend-chart__plot">
          <div
            className="metric-trend-chart__grid"
            style={{ gridTemplateRows: `repeat(${item.scale.labels.length}, 1fr)` }}
          >
            {item.scale.labels.map((label) => (
              <span key={`${item.key}-grid-${label}`} />
            ))}
          </div>
          <div ref={ref} className="metric-trend-chart__surface">
            <svg
              viewBox={`0 0 ${chartGeometry.width} ${chartGeometry.height}`}
              preserveAspectRatio="none"
              className="metric-trend-chart__svg"
            >
              <path
                d={chartGeometry.path}
                fill="none"
                stroke={metricLineColors[item.key]}
                strokeWidth="1.4"
                strokeLinecap="round"
                strokeLinejoin="round"
                vectorEffect="non-scaling-stroke"
              />
              {chartGeometry.points.map((point, index) => (
                <circle
                  key={`${item.key}-${point.timestamp}-${index}`}
                  cx={point.x}
                  cy={point.y}
                  r="1.7"
                  fill={metricLineColors[item.key]}
                  className="metric-trend-chart__point"
                />
              ))}
            </svg>
            <div className="metric-trend-chart__x-axis">
              {chartGeometry.xLabels.length > 0 ? chartGeometry.xLabels.map((label) => (
                <span key={label.key} style={{ left: `${label.left}px` }}>{label.timestamp}</span>
              )) : <span style={{ left: '50%' }}>--:--:--</span>}
            </div>
          </div>
        </div>
      </div>
    </article>
  );
}

export function StatusView({ language }: { language: Language }) {
  const text = uiText[language].status;
  const [metricHistory, setMetricHistory] = useState<Record<MetricKey, MetricHistoryPoint[]>>(() => ({
    ping_latency: [...metricHistoryStore.ping_latency],
    cpu_usage: [...metricHistoryStore.cpu_usage],
    memory_usage: [...metricHistoryStore.memory_usage],
    packet_loss: [...metricHistoryStore.packet_loss],
  }));

  const { data: devices = [], isLoading: devicesLoading, isError: devicesError } = useGetDevicesQuery(undefined, {
    pollingInterval: LIVE_REFETCH_MS,
    refetchOnFocus: true,
    refetchOnReconnect: true,
  });
  const { data: metrics = [], isLoading: metricsLoading, isError: metricsError } = useGetMetricsQuery(undefined, {
    pollingInterval: LIVE_REFETCH_MS,
    refetchOnFocus: true,
    refetchOnReconnect: true,
  });

  const statusSummary = useMemo(() => {
    const summary = {
      total: devices.length,
      online: 0,
      warning: 0,
      offline: 0,
    };

    for (const item of devices) {
      if (item.status === 'online') {
        summary.online += 1;
      } else if (item.status === 'warning') {
        summary.warning += 1;
      } else if (item.status === 'offline') {
        summary.offline += 1;
      }
    }

    const total = summary.total || 1;

    return {
      ...summary,
      onlinePercent: (summary.online / total) * 100,
      warningPercent: (summary.warning / total) * 100,
      offlinePercent: (summary.offline / total) * 100,
    };
  }, [devices]);

  const chartStyle = useMemo(() => ({
    background: `conic-gradient(
      #4aa35a 0% ${statusSummary.onlinePercent}%,
      #E0A13A ${statusSummary.onlinePercent}% ${statusSummary.onlinePercent + statusSummary.warningPercent}%,
      #c94848 ${statusSummary.onlinePercent + statusSummary.warningPercent}% 100%
    )`,
  }), [statusSummary]);

  const latestMetricMap = useMemo(() => {
    const map = new Map<string, (typeof metrics)[number]>();

    [...metrics]
      .sort((left, right) => new Date(right.collectedAt).getTime() - new Date(left.collectedAt).getTime())
      .forEach((item) => {
        const key = `${item.deviceId}:${item.metricType}`;
        if (!map.has(key)) {
          map.set(key, item);
        }
      });

    return map;
  }, [metrics]);

  const metricAverages = useMemo(() => {
    return metricOrder.map((metricKey) => {
      const values: number[] = [];
      let detectedUnit = metricKey === 'ping_latency' ? 'ms' : '%';

      for (const item of devices) {
        const metric = latestMetricMap.get(`${item.id}:${metricKey}`);
        if (metric) {
          values.push(metric.value);
          detectedUnit = metric.unit;
        }
      }

      const average = values.length > 0 ? values.reduce((sum, current) => sum + current, 0) / values.length : 0;

      return {
        key: metricKey,
        label: text.metricLabels[metricKey],
        average,
        unit: detectedUnit,
        fillWidth: metricKey === 'ping_latency'
          ? Math.min((average / 120) * 100, 100)
          : Math.min(average, 100),
      };
    });
  }, [devices, latestMetricMap, text.metricLabels]);

  useEffect(() => {
    if (devices.length === 0 || metricAverages.length === 0) {
      return;
    }

    const snapshotSignature = metricAverages
      .map((item) => `${item.key}:${item.average.toFixed(4)}`)
      .join('|');

    if (snapshotSignature === lastMetricSnapshotSignature) {
      return;
    }

    const timestamp = new Date().toLocaleTimeString(language === 'en' ? 'en-GB' : 'ru-RU', {
      hour: '2-digit',
      minute: '2-digit',
      second: '2-digit',
    });

    setMetricHistory((current) => {
      const nextState = { ...current };

      for (const metricItem of metricAverages) {
        const nextPoints = [...current[metricItem.key], { timestamp, value: metricItem.average }].slice(-historyLimit);
        nextState[metricItem.key] = nextPoints;
        metricHistoryStore[metricItem.key] = nextPoints;
      }

      lastMetricSnapshotSignature = snapshotSignature;
      return nextState;
    });
  }, [devices.length, language, metricAverages]);

  const chartCards = useMemo(() => {
    return metricAverages.map((item) => {
      const rawPoints = metricHistory[item.key];
      const scale = buildChartScale(item.key, language);

      return {
        ...item,
        points: rawPoints,
        scale,
        lastTimestamp: rawPoints.length > 0 ? rawPoints[rawPoints.length - 1].timestamp : '--:--:--',
      };
    });
  }, [language, metricAverages, metricHistory]);

  const sortedDevices = useMemo(() => {
    const weight: Record<string, number> = {
      offline: 0,
      warning: 1,
      online: 2,
      unknown: 3,
    };

    return [...devices].sort((left, right) => {
      const leftWeight = weight[left.status] ?? 9;
      const rightWeight = weight[right.status] ?? 9;

      if (leftWeight !== rightWeight) {
        return leftWeight - rightWeight;
      }

      return left.name.localeCompare(right.name, language === 'en' ? 'en' : 'ru');
    });
  }, [devices, language]);

  if (devicesLoading || metricsLoading) {
    return <div className="panel-empty">{text.loading}</div>;
  }

  if (devicesError || metricsError) {
    return <div className="panel-empty">{text.error}</div>;
  }

  return (
    <div className="page-grid">
      <section className="status-visual-grid">
        <article className="panel status-chart-panel">
          <div className="section-heading section-heading--stacked">
            <div>
              <h2>{text.distribution}</h2>
              <span>{text.liveRefresh}</span>
            </div>
          </div>
          <div className="status-donut-layout">
            <div className="status-donut" style={chartStyle}>
              <div className="status-donut__center">
                <strong>{statusSummary.total}</strong>
                <span>{text.devices}</span>
              </div>
            </div>
              <div className="status-donut-legend">
                <div className="status-donut-legend__item">
                  <span className="status-dot status-dot--online" />
                  <div className="status-donut-legend__content">
                    <strong>{statusSummary.online}</strong>
                    <span>{text.statusLabels.online}</span>
                  </div>
                  <small>{statusSummary.onlinePercent.toFixed(0)}%</small>
                </div>
                <div className="status-donut-legend__item">
                  <span className="status-dot status-dot--warning" />
                  <div className="status-donut-legend__content">
                    <strong>{statusSummary.warning}</strong>
                    <span>{text.statusLabels.warning}</span>
                  </div>
                  <small>{statusSummary.warningPercent.toFixed(0)}%</small>
                </div>
                <div className="status-donut-legend__item">
                  <span className="status-dot status-dot--offline" />
                  <div className="status-donut-legend__content">
                    <strong>{statusSummary.offline}</strong>
                    <span>{text.statusLabels.offline}</span>
                  </div>
                  <small>{statusSummary.offlinePercent.toFixed(0)}%</small>
                </div>
            </div>
          </div>
        </article>

        <article className="panel status-bar-panel">
          <div className="section-heading">
            <h2>{text.liveScale}</h2>
            <span>{text.infraState}</span>
          </div>
          <div className="status-stack">
            <div className="status-stack__segment status-stack__segment--online" style={{ width: `${statusSummary.onlinePercent}%` }} />
            <div className="status-stack__segment status-stack__segment--warning" style={{ width: `${statusSummary.warningPercent}%` }} />
            <div className="status-stack__segment status-stack__segment--offline" style={{ width: `${statusSummary.offlinePercent}%` }} />
          </div>
          <div className="status-stack__labels">
            <span>{text.statusLabels.online}: {statusSummary.online}</span>
            <span>{text.statusLabels.warning}: {statusSummary.warning}</span>
            <span>{text.statusLabels.offline}: {statusSummary.offline}</span>
          </div>

          <div className="status-metric-bars">
            {metricAverages.map((item) => (
              <div key={item.key} className="status-metric-bars__item">
                <div className="status-metric-bars__head">
                  <span>{item.label}</span>
                  <strong>{formatValue(item.average, item.unit, language)}</strong>
                </div>
                <div className="status-metric-bars__track">
                  <div
                    className={`status-metric-bars__fill status-metric-bars__fill--${item.key}`}
                    style={{ width: `${item.fillWidth}%` }}
                  />
                </div>
              </div>
            ))}
          </div>
        </article>
      </section>

      <section className="panel">
        <div className="section-heading">
          <h2>{text.trends}</h2>
          <span>{text.trendsCaption}</span>
        </div>
        <div className="metric-trend-grid">
          {chartCards.map((item) => (
            <MetricTrendCard key={item.key} item={item} language={language} />
          ))}
        </div>
      </section>

      <section className="panel">
        <div className="section-heading">
          <h2>{text.matrix}</h2>
          <span>{text.matrixCaption}</span>
        </div>
        <div className="status-device-matrix">
          {sortedDevices.map((item) => (
            <article key={item.id} className={`status-device-tile status-device-tile--${item.status}`}>
              <div className="status-device-tile__meta">
                <small>{translateLocation(item.location)}</small>
                <span className={`status-pill status-pill--${item.status}`}>
                  {text.statusLabels[item.status as StatusKey] ?? text.unknown}
                </span>
              </div>
              <strong>{item.name}</strong>
              <p>{item.deviceType}</p>
            </article>
          ))}
        </div>
      </section>
    </div>
  );
}
