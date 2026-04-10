import { useMemo } from 'react';

import { LIVE_REFETCH_MS, useGetDevicesQuery, useGetMetricsQuery } from '../../../shared/api/monitoringApi';
import { translateLocation } from '../../../shared/lib/display';

type MetricKey = 'ping_latency' | 'memory_usage' | 'cpu_usage' | 'packet_loss';

const metricLabels: Record<MetricKey, string> = {
  ping_latency: 'Задержка',
  memory_usage: 'Память',
  cpu_usage: 'Процессор',
  packet_loss: 'Потери пакетов',
};

const statusLabels: Record<string, string> = {
  online: 'В сети',
  warning: 'Предупреждение',
  offline: 'Недоступно',
  unknown: 'Неизвестно',
};

const metricStatusLabels: Record<string, string> = {
  normal: 'Норма',
  warning: 'Внимание',
  critical: 'Критично',
};

const metricOrder: MetricKey[] = ['ping_latency', 'memory_usage', 'cpu_usage', 'packet_loss'];

function formatUnit(unit: string) {
  return unit === 'ms' ? 'мс' : unit;
}

export function MetricsView() {
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

  const deviceMetricCards = useMemo(() => {
    return devices
      .map((device) => {
        const latestMetrics = new Map<MetricKey, (typeof metrics)[number]>();

        metrics
          .filter((item) => item.deviceId === device.id && metricOrder.includes(item.metricType as MetricKey))
          .sort((left, right) => new Date(right.collectedAt).getTime() - new Date(left.collectedAt).getTime())
          .forEach((item) => {
            const metricType = item.metricType as MetricKey;
            if (!latestMetrics.has(metricType)) {
              latestMetrics.set(metricType, item);
            }
          });

        return {
          device,
          metrics: metricOrder.map((key) => ({
            key,
            label: metricLabels[key],
            metric: latestMetrics.get(key) ?? null,
          })),
        };
      })
      .sort((left, right) => left.device.name.localeCompare(right.device.name, 'ru'));
  }, [devices, metrics]);

  if (devicesLoading || metricsLoading) {
    return <div className="panel-empty">Загрузка метрик...</div>;
  }

  if (devicesError || metricsError) {
    return <div className="panel-empty">Не удалось загрузить метрики.</div>;
  }

  return (
    <section className="panel">
      <div className="section-heading">
        <h2>Метрики мониторинга</h2>
        <span>Последние значения доступности и производительности по каждому устройству</span>
      </div>
      <div className="device-metric-grid">
        {deviceMetricCards.map(({ device, metrics: deviceMetrics }) => (
          <article key={device.id} className="device-metric-card">
            <div className="device-metric-card__header">
              <small className="device-metric-card__location">{translateLocation(device.location)}</small>
              <span className={`status-pill status-pill--${device.status}`}>{statusLabels[device.status]}</span>
            </div>
            <div className="device-metric-card__identity">
              <h3>{device.name}</h3>
              <p>{device.ipAddress}</p>
            </div>

            <div className="device-metric-card__grid">
              {deviceMetrics.map(({ key, label, metric }) => (
                <div key={key} className="device-metric-tile">
                  <span className="device-metric-tile__label">{label}</span>
                  {metric ? (
                    <>
                      <strong className="device-metric-tile__value">{metric.value} {formatUnit(metric.unit)}</strong>
                      <span className={`status-pill status-pill--${metric.status === 'critical' ? 'offline' : metric.status === 'warning' ? 'warning' : 'online'}`}>
                        {metricStatusLabels[metric.status]}
                      </span>
                      <small>{new Date(metric.collectedAt).toLocaleTimeString('ru-RU')}</small>
                    </>
                  ) : (
                    <>
                      <strong className="device-metric-tile__value">Нет данных</strong>
                      <small>Метрика еще не поступала</small>
                    </>
                  )}
                </div>
              ))}
            </div>
          </article>
        ))}
      </div>
    </section>
  );
}
