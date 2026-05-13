import { useEffect, useMemo, useState } from 'react';

import { LIVE_REFETCH_MS, useGetDevicesQuery, useGetLogsQuery } from '../../../shared/api/monitoringApi';
import { uiText } from '../../../shared/lib/i18n';
import type { Device, LogEntry } from '../../../shared/lib/schemas';
import type { Language } from '../../../shared/lib/language';

export type LogLevelFilter = 'all' | 'info' | 'warning' | 'error' | 'audit';
const LOGS_PAGE_SIZE = 100;

type LogsViewProps = {
  levelFilter: LogLevelFilter;
  onLevelFilterChange: (value: LogLevelFilter) => void;
  language: Language;
};

type GroupedLogs = {
  dateLabel: string;
  items: LogEntry[];
};

function translateLogMessage(message: string, language: Language) {
  if (language !== 'ru') {
    return message;
  }

  const translations: Record<string, string> = {
    'Simulator updated device state after the latest monitoring cycle.': 'Симулятор обновил состояние устройства после последнего цикла мониторинга.',
    'Simulator completed the monitoring cycle and refreshed device states.': 'Симулятор завершил цикл мониторинга и обновил состояния устройств.',
  };

  return translations[message] ?? message;
}

function parseMetadata(metadata: unknown) {
  if (metadata === null || metadata === undefined) {
    return null;
  }

  if (typeof metadata === 'string') {
    try {
      return JSON.parse(metadata);
    } catch {
      return metadata;
    }
  }

  return metadata;
}

export function LogsView({ levelFilter, onLevelFilterChange, language }: LogsViewProps) {
  const [deviceFilter, setDeviceFilter] = useState<'all' | string>('all');
  const [expandedItems, setExpandedItems] = useState<number[]>([]);
  const [visibleCount, setVisibleCount] = useState(LOGS_PAGE_SIZE);
  const text = uiText[language].logs;
  const logLevelLabels: Record<string, string> = text.logLevelLabels;

  const { data: logs = [], isLoading, isError } = useGetLogsQuery(undefined, {
    pollingInterval: LIVE_REFETCH_MS,
    refetchOnFocus: true,
    refetchOnReconnect: true,
  });
  const { data: devices = [] } = useGetDevicesQuery(undefined, {
    pollingInterval: LIVE_REFETCH_MS,
    refetchOnFocus: true,
    refetchOnReconnect: true,
  });

  const deviceMap = useMemo(() => {
    return new Map<number, Device>(devices.map((item) => [item.id, item]));
  }, [devices]);

  const filteredLogs = useMemo(() => {
    return logs.filter((item) => {
      if (levelFilter !== 'all' && item.level !== levelFilter) {
        return false;
      }

      if (deviceFilter !== 'all' && String(item.deviceId ?? '') !== deviceFilter) {
        return false;
      }

      return true;
    });
  }, [deviceFilter, levelFilter, logs]);

  useEffect(() => {
    setVisibleCount(LOGS_PAGE_SIZE);
  }, [deviceFilter, levelFilter]);

  useEffect(() => {
    if (visibleCount > filteredLogs.length) {
      setVisibleCount(Math.max(LOGS_PAGE_SIZE, filteredLogs.length));
    }
  }, [filteredLogs.length, visibleCount]);

  const visibleLogs = useMemo(() => {
    return filteredLogs.slice(0, visibleCount);
  }, [filteredLogs, visibleCount]);

  const groupedLogs = useMemo<GroupedLogs[]>(() => {
    const groups = new Map<string, LogEntry[]>();

    for (const item of visibleLogs) {
      const dateLabel = new Date(item.createdAt).toLocaleDateString(language === 'en' ? 'en-GB' : 'ru-RU', {
        year: 'numeric',
        month: 'long',
        day: 'numeric',
      });

      if (!groups.has(dateLabel)) {
        groups.set(dateLabel, []);
      }

      groups.get(dateLabel)?.push(item);
    }

    return [...groups.entries()].map(([dateLabel, items]) => ({
      dateLabel,
      items,
    }));
  }, [language, visibleLogs]);

  function toggleExpanded(itemID: number) {
    setExpandedItems((current) => (
      current.includes(itemID)
        ? current.filter((id) => id !== itemID)
        : [...current, itemID]
    ));
  }

  if (isLoading) {
    return <div className="panel-empty">{text.loading}</div>;
  }

  if (isError) {
    return <div className="panel-empty">{text.error}</div>;
  }

  return (
    <section className="panel">
      <div className="section-heading">
        <div>
          <h2>{text.title}</h2>
        </div>
      </div>

      <div className="logs-toolbar">
        <strong className="logs-toolbar__title">{text.filtersTitle}</strong>
        <div className="logs-toolbar__grid">
          <label className="field">
            <span>{text.level}</span>
            <select value={levelFilter} onChange={(event) => onLevelFilterChange(event.target.value as LogLevelFilter)}>
              {(['all', 'info', 'warning', 'error', 'audit'] as const).map((option) => (
                <option key={option} value={option}>{logLevelLabels[option]}</option>
              ))}
            </select>
          </label>
          <label className="field">
            <span>{text.device}</span>
            <select value={deviceFilter} onChange={(event) => setDeviceFilter(event.target.value)}>
              <option value="all">{text.allDevices}</option>
              {devices.map((device) => (
                <option key={device.id} value={String(device.id)}>{device.name}</option>
              ))}
            </select>
          </label>
        </div>
      </div>

      <div className="log-list log-list--compact">
        {groupedLogs.length === 0 ? (
          <div className="panel-empty panel-empty--compact">{text.empty}</div>
        ) : null}

        {groupedLogs.map((group) => (
          <section key={group.dateLabel} className="log-group">
            <div className="log-group__header">
              <h3>{group.dateLabel}</h3>
            </div>

            <div className="log-group__items">
              {group.items.map((item) => {
                const isExpanded = expandedItems.includes(item.id);
                const linkedDevice = item.deviceId ? deviceMap.get(item.deviceId) : null;
                const parsedMetadata = parseMetadata(item.metadata);
                const hasLinkedDevice = Boolean(linkedDevice);
                const deviceLabel = hasLinkedDevice
                  ? linkedDevice?.name
                  : item.deviceId
                    ? text.unknownDevice
                    : text.systemDevice;
                const localizedMessage = translateLogMessage(item.message, language);
                const timestamp = new Date(item.createdAt).toLocaleString(language === 'en' ? 'en-GB' : 'ru-RU');

                return (
                  <article key={item.id} className="log-item log-item--compact log-item--rich">
                    <div className="log-item__meta-row">
                      <div className="log-item__meta log-item__meta--compact">
                        <span className={`timeline__level timeline__level--${item.level}`}>{logLevelLabels[item.level] ?? item.level}</span>
                        <strong>{item.action}</strong>
                        <span>{deviceLabel}</span>
                        <span>{item.actorName || text.actorFallback}</span>
                      </div>
                      <small className="log-item__timestamp">
                        <strong>{timestamp}</strong>
                      </small>
                    </div>

                    <p>{localizedMessage}</p>

                    <div className="log-item__footer">
                      <div className="log-item__footer-main">
                        <span className="log-item__source">{item.source}</span>
                      </div>
                      <button type="button" className="ghost-button ghost-button--compact" onClick={() => toggleExpanded(item.id)}>
                        {isExpanded ? text.hideMetadata : text.showMetadata}
                      </button>
                    </div>

                    {isExpanded ? (
                      <div className="log-metadata">
                        <strong>{text.metadata}</strong>
                        <pre>{parsedMetadata ? JSON.stringify(parsedMetadata, null, 2) : text.noMetadata}</pre>
                      </div>
                    ) : null}
                  </article>
                );
              })}
            </div>
          </section>
        ))}

        {filteredLogs.length > visibleCount ? (
          <div className="logs-load-more">
            <button
              type="button"
              className="ghost-button"
              onClick={() => setVisibleCount((current) => current + LOGS_PAGE_SIZE)}
            >
              {text.showMore}
            </button>
          </div>
        ) : null}
      </div>
    </section>
  );
}
