import { useMemo } from 'react';

import { LIVE_REFETCH_MS, useGetDevicesQuery } from '../../../shared/api/monitoringApi';
import { translateLocation } from '../../../shared/lib/display';
import { uiText } from '../../../shared/lib/i18n';
import type { Language } from '../../../shared/lib/language';

type DashboardViewProps = {
  canViewLogs: boolean;
  language: Language;
};

export function DashboardView({ canViewLogs, language }: DashboardViewProps) {
  const text = uiText[language].dashboard;
  const statusLabels: Record<string, string> = text.statusLabels;

  const { data: devices = [], isLoading: devicesLoading, isError: devicesError } = useGetDevicesQuery(undefined, {
    pollingInterval: LIVE_REFETCH_MS,
    refetchOnFocus: true,
    refetchOnReconnect: true,
  });

  const stats = useMemo(() => {
    const online = devices.filter((item) => item.status === 'online').length;
    const warning = devices.filter((item) => item.status === 'warning').length;
    const offline = devices.filter((item) => item.status === 'offline').length;

    return [
      { label: text.totalDevices, value: devices.length.toString(), tone: 'neutral' },
      { label: text.online, value: online.toString(), tone: 'success' },
      { label: text.warnings, value: warning.toString(), tone: 'warning' },
      { label: text.offline, value: offline.toString(), tone: 'danger' },
    ];
  }, [devices, text.offline, text.online, text.totalDevices, text.warnings]);

  if (devicesLoading) {
    return <div className="panel-empty">{text.loading}</div>;
  }

  if (devicesError) {
    return <div className="panel-empty">{text.error}</div>;
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
          <h2>{text.nodeState}</h2>
          <span>{text.nodeStateCaption}</span>
        </div>
        <div className="device-list">
          {devices.map((item) => (
            <article key={item.id} className="device-item">
              <div className="device-item__summary">
                <h3>{item.name}</h3>
                <p>{item.deviceType} • {item.ipAddress} • {translateLocation(item.location)}</p>
              </div>
              <span className={`status-pill status-pill--${item.status}`}>{statusLabels[item.status]}</span>
            </article>
          ))}
        </div>
      </section>
    </div>
  );
}
