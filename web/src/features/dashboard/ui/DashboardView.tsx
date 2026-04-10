import { useMemo } from 'react';

import { LIVE_REFETCH_MS, useGetDevicesQuery, useGetLogsQuery, useGetMetricsQuery } from '../../../shared/api/monitoringApi';

type DashboardViewProps = {
  canViewLogs: boolean;
};

const statusLabels: Record<string, string> = {
  online: 'В сети',
  warning: 'Предупреждение',
  offline: 'Недоступно',
  unknown: 'Неизвестно',
};

const metricLabels: Record<string, string> = {
  ping_latency: 'Задержка',
  memory_usage: 'Память',
  cpu_usage: 'Процессор',
  packet_loss: 'Потери пакетов',
  uptime: 'Доступность',
};

const logLevelLabels: Record<string, string> = {
  info: 'Инфо',
  warning: 'Предупреждение',
  error: 'Ошибка',
  audit: 'Аудит',
};

function formatUnit(unit: string) {
  return unit === 'ms' ? 'мс' : unit;
}

export function DashboardView({ canViewLogs }: DashboardViewProps) {
  const { data: devices = [], isLoading: devicesLoading, isError: devicesError } = useGetDevicesQuery(undefined, {
    pollingInterval: LIVE_REFETCH_MS,
    refetchOnFocus: true,
    refetchOnReconnect: true,
  });
  const { data: metrics = [], isLoading: metricsLoading } = useGetMetricsQuery(undefined, {
    pollingInterval: LIVE_REFETCH_MS,
    refetchOnFocus: true,
    refetchOnReconnect: true,
  });
  const { data: logs = [], isLoading: logsLoading } = useGetLogsQuery(undefined, {
    skip: !canViewLogs,
    pollingInterval: LIVE_REFETCH_MS,
    refetchOnFocus: true,
    refetchOnReconnect: true,
  });

  const stats = useMemo(() => {
    const online = devices.filter((item) => item.status === 'online').length;
    const warning = devices.filter((item) => item.status === 'warning').length;
    const offline = devices.filter((item) => item.status === 'offline').length;

    return [
      { label: 'Всего устройств', value: devices.length.toString(), tone: 'neutral' },
      { label: 'В сети', value: online.toString(), tone: 'success' },
      { label: 'С предупреждениями', value: warning.toString(), tone: 'warning' },
      { label: 'Недоступны', value: offline.toString(), tone: 'danger' },
    ];
  }, [devices]);

  const latestMetrics = useMemo(() => {
    return [...metrics]
      .sort((left, right) => new Date(right.collectedAt).getTime() - new Date(left.collectedAt).getTime())
      .slice(0, 5);
  }, [metrics]);

  if (devicesLoading || metricsLoading || (canViewLogs && logsLoading)) {
    return <div className="panel-empty">Загрузка сводки мониторинга...</div>;
  }

  if (devicesError) {
    return <div className="panel-empty">Не удалось загрузить данные с backend API.</div>;
  }

  return (
    <div className="page-grid">
      <section className="stats-grid">
        {stats.map((card) => (
          <article key={card.label} className={`stat-card stat-card--${card.tone}`}>
            <span className="stat-card__label">{card.label}</span>
            <strong className="stat-card__value">{card.value}</strong>
          </article>
        ))}
      </section>

      <section className="panel">
        <div className="section-heading">
          <h2>Состояние узлов</h2>
          <span>Актуальный обзор по инфраструктуре</span>
        </div>
        <div className="device-list">
          {devices.map((item) => (
            <article key={item.id} className="device-item">
              <div>
                <h3>{item.name}</h3>
                <p>{item.deviceType} • {item.ipAddress}</p>
              </div>
              <span className={`status-pill status-pill--${item.status}`}>{statusLabels[item.status]}</span>
            </article>
          ))}
        </div>
      </section>

      <section className="panel panel--split">
        <div className="section-heading">
          <h2>Последние метрики</h2>
          <span>Ручные и симулированные значения</span>
        </div>
        <div className="compact-list">
          {latestMetrics.map((item) => (
            <div key={item.id} className="compact-list__row">
              <span>{metricLabels[item.metricType] ?? item.metricType}</span>
              <strong>{item.value} {formatUnit(item.unit)}</strong>
            </div>
          ))}
        </div>
      </section>

      {canViewLogs ? (
        <section className="panel panel--split">
          <div className="section-heading">
            <h2>Активность системы</h2>
            <span>Последние события и действия</span>
          </div>
          <div className="timeline">
            {logs.slice(0, 5).map((item) => (
              <div key={item.id} className="timeline__item">
                <span className={`timeline__level timeline__level--${item.level}`}>{logLevelLabels[item.level] ?? item.level}</span>
                <div>
                  <strong>{item.action}</strong>
                  <p>{item.message}</p>
                </div>
              </div>
            ))}
          </div>
        </section>
      ) : null}
    </div>
  );
}
