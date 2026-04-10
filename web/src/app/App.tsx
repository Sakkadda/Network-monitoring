import { useMemo, useState } from 'react';

import { DashboardView } from '../features/dashboard/ui/DashboardView';
import { DevicesView } from '../features/devices/ui/DevicesView';
import { LogsView } from '../features/logs/ui/LogsView';
import { MetricsView } from '../features/metrics/ui/MetricsView';
import { SettingsView } from '../features/settings/ui/SettingsView';
import { LIVE_REFETCH_MS, useGetLogsQuery } from '../shared/api/monitoringApi';
import { ConfirmDialog } from '../shared/ui/ConfirmDialog';

type TabId = 'dashboard' | 'devices' | 'metrics' | 'logs' | 'settings';
type UserRole = 'admin' | 'user';
type AuthState = { username: string; role: UserRole };
type NavItem = { id: TabId; label: string; caption: string; adminOnly?: boolean };

const credentials: Record<string, { password: string; role: UserRole }> = {
  admin: { password: 'admin123', role: 'admin' },
  skd: { password: '1234', role: 'admin' },
  user: { password: 'user123', role: 'user' },
};

const mainNav: NavItem[] = [
  { id: 'dashboard', label: 'Дашборд', caption: 'Общий обзор инфраструктуры' },
  { id: 'devices', label: 'Устройства', caption: 'Список сетевых узлов' },
  { id: 'metrics', label: 'Метрики', caption: 'Показатели доступности' },
  { id: 'logs', label: 'Логи', caption: 'События и журнал действий', adminOnly: true },
];

export function App() {
  const [activeTab, setActiveTab] = useState<TabId>('dashboard');
  const [authState, setAuthState] = useState<AuthState | null>(null);
  const [login, setLogin] = useState('');
  const [password, setPassword] = useState('');
  const [authError, setAuthError] = useState('');
  const [isLogoutDialogOpen, setIsLogoutDialogOpen] = useState(false);

  const isAdmin = authState?.role === 'admin';
  const { data: logs = [] } = useGetLogsQuery(undefined, {
    skip: !isAdmin,
    pollingInterval: LIVE_REFETCH_MS,
    refetchOnFocus: true,
    refetchOnReconnect: true,
  });

  const unreadNotifications = useMemo(() => (isAdmin ? logs.filter((item) => item.level === 'warning' || item.level === 'error').length : 0), [isAdmin, logs]);
  const visibleNav = useMemo(() => mainNav.filter((item) => (item.adminOnly ? isAdmin : true)), [isAdmin]);

  const content = (() => {
    switch (activeTab) {
      case 'devices':
        return <DevicesView isAdmin={isAdmin} />;
      case 'metrics':
        return <MetricsView />;
      case 'logs':
        return isAdmin ? <LogsView /> : <DashboardView canViewLogs={false} />;
      case 'settings':
        return <SettingsView role={authState?.role ?? 'user'} />;
      case 'dashboard':
      default:
        return <DashboardView canViewLogs={isAdmin} />;
    }
  })();

  function handleLogin() {
    const account = credentials[login.trim()];
    if (!account || account.password !== password) {
      setAuthError('Неверный логин или пароль.');
      return;
    }

    setAuthState({ username: login.trim(), role: account.role });
    setActiveTab('dashboard');
    setAuthError('');
    setPassword('');
  }

  function handleLogout() {
    setIsLogoutDialogOpen(false);
    setAuthState(null);
    setLogin('');
    setPassword('');
    setAuthError('');
    setActiveTab('dashboard');
  }

  if (!authState) {
    return (
      <div className="auth-shell">
        <div className="auth-card">
          <div className="auth-card__header">
            <h1>Авторизация</h1>
            <p>Введите логин и пароль для доступа к системе.</p>
          </div>
          <div className="auth-note">
            <strong>Тестовые аккаунты:</strong>
            <span>admin / admin123</span>
            <span>skd / 1234</span>
            <span>user / user123</span>
          </div>
          <div className="auth-form">
            <label className="field"><span>Логин</span><input value={login} onChange={(event) => setLogin(event.target.value)} placeholder="Введите логин" /></label>
            <label className="field"><span>Пароль</span><input type="password" value={password} onChange={(event) => setPassword(event.target.value)} placeholder="Введите пароль" /></label>
            {authError ? <div className="form-error">{authError}</div> : null}
            <button type="button" className="primary-button primary-button--wide" onClick={handleLogin}>Войти</button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="app-shell">
      <aside className="sidebar">
        <nav className="sidebar-nav">
          {visibleNav.map((item) => (
            <button key={item.id} type="button" className={`nav-button ${activeTab === item.id ? 'nav-button--active' : ''}`} onClick={() => setActiveTab(item.id)}>
              <strong>{item.label}</strong>
              <span>{item.caption}</span>
            </button>
          ))}
        </nav>

        <button type="button" className={`settings-button ${activeTab === 'settings' ? 'settings-button--active' : ''}`} onClick={() => setActiveTab('settings')}>
          <strong>Настройки</strong>
          <span>Параметры системы и доступа</span>
        </button>
      </aside>

      <main className="workspace">
        <header className="topbar">
          <div className="topbar__title">
            <h2>{visibleNav.find((item) => item.id === activeTab)?.label ?? 'Настройки'}</h2>
          </div>
          <div className="topbar__actions">
            <button type="button" className="chip-button"><span className="chip-button__count">{unreadNotifications}</span>Уведомления</button>
            <div className="user-actions">
              <div className="user-badge">{authState.username}</div>
              <button type="button" className="chip-button chip-button--ghost" onClick={() => setIsLogoutDialogOpen(true)}>Выйти</button>
            </div>
          </div>
        </header>
        <section className="workspace__content">{content}</section>
      </main>
      {isLogoutDialogOpen ? (
        <ConfirmDialog
          title="Выход из системы"
          message="Вы действительно хотите выйти из аккаунта?"
          confirmLabel="Выйти"
          onConfirm={handleLogout}
          onCancel={() => setIsLogoutDialogOpen(false)}
        />
      ) : null}
    </div>
  );
}
