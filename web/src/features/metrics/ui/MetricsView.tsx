import { useMemo, useState } from 'react';

import { LIVE_REFETCH_MS, useGetDevicesQuery, useGetMetricsQuery } from '../../../shared/api/monitoringApi';
import { translateLocation } from '../../../shared/lib/display';
import { uiText } from '../../../shared/lib/i18n';
import type { Language } from '../../../shared/lib/language';
import { formatUnit } from '../../../shared/lib/language';

type MetricKey = 'ping_latency' | 'memory_usage' | 'cpu_usage' | 'packet_loss';
type MetricSortField = 'location' | 'status' | 'ping_latency' | 'memory_usage' | 'cpu_usage' | 'packet_loss';

const metricOrder: MetricKey[] = ['ping_latency', 'memory_usage', 'cpu_usage', 'packet_loss'];
const hiddenOfflineMetrics = new Set<MetricKey>(['ping_latency', 'memory_usage', 'cpu_usage']);

function shouldHideOfflineMetric(deviceStatus: string, metricKey: MetricKey) {
  return deviceStatus === 'offline' && hiddenOfflineMetrics.has(metricKey);
}

function formatOfflineSince(value: string, language: Language) {
  if (!value) {
    return '';
  }

  const date = new Date(value);
  if (Number.isNaN(date.getTime())) {
    return '';
  }

  return date.toLocaleString(language === 'en' ? 'en-GB' : 'ru-RU');
}

export function MetricsView({ language }: { language: Language }) {
  const text = uiText[language].metrics;
  const metricLabels: Record<MetricKey, string> = text.metricLabels;
  const statusLabels: Record<string, string> = text.statusLabels;
  const metricStatusLabels: Record<string, string> = text.metricStatusLabels;
  const [sortField, setSortField] = useState<MetricSortField>('status');
  const [sortDirection, setSortDirection] = useState<'asc' | 'desc'>('asc');
  const [searchQuery, setSearchQuery] = useState('');

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
    const statusOrder: Record<string, number> = {
      offline: 0,
      warning: 1,
      online: 2,
      unknown: 3,
    };
    const normalizedQuery = searchQuery.trim().toLowerCase();

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
          sortValues: {
            location: translateLocation(device.location),
            status: statusOrder[device.status] ?? 9,
            ping_latency: latestMetrics.get('ping_latency')?.value ?? -1,
            memory_usage: latestMetrics.get('memory_usage')?.value ?? -1,
            cpu_usage: latestMetrics.get('cpu_usage')?.value ?? -1,
            packet_loss: latestMetrics.get('packet_loss')?.value ?? -1,
          },
        };
      })
      .filter(({ device }) => (
        !normalizedQuery || device.name.toLowerCase().includes(normalizedQuery)
      ))
      .sort((left, right) => {
        let result = 0;

        if (sortField === 'location') {
          result = left.sortValues.location.localeCompare(right.sortValues.location, language === 'en' ? 'en' : 'ru');
        } else if (sortField === 'status') {
          result = left.sortValues.status - right.sortValues.status;
        } else {
          result = left.sortValues[sortField] - right.sortValues[sortField];
        }

        if (result === 0) {
          result = left.device.name.localeCompare(right.device.name, language === 'en' ? 'en' : 'ru');
        }

        return sortDirection === 'asc' ? result : -result;
      });
  }, [devices, language, metricLabels, metrics, searchQuery, sortDirection, sortField]);

  if (devicesLoading || metricsLoading) {
    return <div className="panel-empty">{text.loading}</div>;
  }

  if (devicesError || metricsError) {
    return <div className="panel-empty">{text.error}</div>;
  }

  return (
    <section className="metrics-page">
      <div className="metrics-toolbar">
        <label className="field metrics-toolbar__search">
          <span>{text.search}</span>
          <input
            value={searchQuery}
            onChange={(event) => setSearchQuery(event.target.value)}
            placeholder={text.searchPlaceholder}
          />
        </label>
        <div className="table-sort">
          <label className="table-sort__label" htmlFor="metrics-sort-field">{text.sorting}</label>
          <select
            id="metrics-sort-field"
            value={sortField}
            onChange={(event) => setSortField(event.target.value as MetricSortField)}
          >
            <option value="location">{text.byLocation}</option>
            <option value="status">{text.byStatus}</option>
            <option value="ping_latency">{text.byLatency}</option>
            <option value="memory_usage">{text.byMemory}</option>
            <option value="cpu_usage">{text.byCpu}</option>
            <option value="packet_loss">{text.byPacketLoss}</option>
          </select>
          <button type="button" className="ghost-button" onClick={() => setSortDirection((prev) => (prev === 'asc' ? 'desc' : 'asc'))}>
            {sortDirection === 'asc' ? text.ascending : text.descending}
          </button>
        </div>
      </div>
      <div className="device-metric-grid">
        {deviceMetricCards.map(({ device, metrics: deviceMetrics }) => {
          const offlineSince = device.status === 'offline' ? formatOfflineSince(device.lastCheckedAt, language) : '';

          return (
            <article key={device.id} className="device-metric-card">
              <div className="device-metric-card__header">
                <small className="device-metric-card__location">{translateLocation(device.location)}</small>
                <span className={`status-pill status-pill--${device.status}`}>{statusLabels[device.status]}</span>
              </div>
              <div className="device-metric-card__identity">
                <h3>{device.name}</h3>
                <p>{device.ipAddress}</p>
                {offlineSince ? (
                  <small className="device-metric-card__offline-time">
                    {text.becameOfflineAt}: {offlineSince}
                  </small>
                ) : null}
              </div>

              <div className="device-metric-card__grid">
                {deviceMetrics.map(({ key, label, metric }) => {
                  const hideMetricValue = shouldHideOfflineMetric(device.status, key);

                  return (
                    <div key={key} className="device-metric-tile">
                      <span className="device-metric-tile__label">{label}</span>
                      {metric ? (
                        <>
                          <strong className="device-metric-tile__value">
                            {hideMetricValue ? '-' : `${metric.value} ${formatUnit(metric.unit, language)}`}
                          </strong>
                          <span className={`status-pill status-pill--${metric.status === 'critical' ? 'offline' : metric.status === 'warning' ? 'warning' : 'online'}`}>
                            {metricStatusLabels[metric.status]}
                          </span>
                          <small>{new Date(metric.collectedAt).toLocaleTimeString(language === 'en' ? 'en-GB' : 'ru-RU')}</small>
                        </>
                      ) : (
                        <>
                          <strong className="device-metric-tile__value">{text.noData}</strong>
                          <small>{text.notArrived}</small>
                        </>
                      )}
                    </div>
                  );
                })}
              </div>
            </article>
          );
        })}
      </div>
    </section>
  );
}
