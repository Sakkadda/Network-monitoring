import { LIVE_REFETCH_MS, useGetLogsQuery } from '../../../shared/api/monitoringApi';

const logLevelLabels: Record<string, string> = {
  info: 'Инфо',
  warning: 'Предупреждение',
  error: 'Ошибка',
  audit: 'Аудит',
};

export function LogsView() {
  const { data = [], isLoading, isError } = useGetLogsQuery(undefined, {
    pollingInterval: LIVE_REFETCH_MS,
    refetchOnFocus: true,
    refetchOnReconnect: true,
  });

  if (isLoading) {
    return <div className="panel-empty">Загрузка журнала admin и system...</div>;
  }

  if (isError) {
    return <div className="panel-empty">Не удалось загрузить логи.</div>;
  }

  return (
    <section className="panel">
      <div className="section-heading">
        <h2>Журнал событий</h2>
        <span>Вкладка для admin: действия пользователей, ошибки и системные события</span>
      </div>
      <div className="log-list log-list--compact">
        {data.map((item) => (
          <article key={item.id} className="log-item log-item--compact">
            <div className="log-item__meta log-item__meta--compact">
              <span className={`timeline__level timeline__level--${item.level}`}>{logLevelLabels[item.level] ?? item.level}</span>
              <strong>{item.action}</strong>
              <span>{item.actorName || item.actorRole}</span>
              <small>{new Date(item.createdAt).toLocaleString('ru-RU')}</small>
            </div>
            <p>{item.message}</p>
          </article>
        ))}
      </div>
    </section>
  );
}
