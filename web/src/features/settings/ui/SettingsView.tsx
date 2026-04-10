type SettingsViewProps = {
  role: 'admin' | 'user';
};

export function SettingsView({ role }: SettingsViewProps) {
  return (
    <section className="panel">
      <div className="section-heading">
        <h2>Настройки системы</h2>
        <span>Раздел под конфигурацию порогов, частоты проверок и учетных записей</span>
      </div>
      <div className="settings-grid">
        <article className="setting-card">
          <h3>Текущая роль</h3>
          <p>Сейчас вы вошли как <strong>{role}</strong>. Для admin доступны логи и управление устройствами.</p>
        </article>
        <article className="setting-card">
          <h3>Порог задержки</h3>
          <p>Предупреждение при ping выше 50 мс, критическое состояние выше 120 мс.</p>
        </article>
        <article className="setting-card">
          <h3>Источники данных</h3>
          <p>Используются ручные и частично симулированные данные для демонстрации прототипа.</p>
        </article>
      </div>
    </section>
  );
}
