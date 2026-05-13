import { useEffect, useMemo, useState } from 'react';

import { DashboardView } from '../features/dashboard/ui/DashboardView';
import { DevicesView } from '../features/devices/ui/DevicesView';
import { LogsView, type LogLevelFilter } from '../features/logs/ui/LogsView';
import { MetricsView } from '../features/metrics/ui/MetricsView';
import { SettingsView } from '../features/settings/ui/SettingsView';
import { StatusView } from '../features/status/ui/StatusView';
import {
  LIVE_REFETCH_MS,
  clearAuthToken,
  getAuthToken,
  monitoringApi,
  setAuthToken,
  useCreateUserMutation,
  useDeleteUserMutation,
  useGetDevicesQuery,
  useGetMeQuery,
  useGetUsersQuery,
  useLoginMutation,
  useUpdateOwnPasswordMutation,
  useUpdateOwnProfileMutation,
  useUpdateUserPasswordMutation,
} from '../shared/api/monitoringApi';
import { translateLocation } from '../shared/lib/display';
import { uiText } from '../shared/lib/i18n';
import type { Language } from '../shared/lib/language';
import { ConfirmDialog } from '../shared/ui/ConfirmDialog';
import { store } from './store';

type TabId = 'dashboard' | 'status' | 'devices' | 'metrics' | 'logs' | 'settings';
type UserRole = 'admin' | 'user';
type NavItem = { id: TabId; label: string; caption: string; adminOnly?: boolean };
type ResultMessage = { ok: true; message: string } | { ok: false; message: string };

const logLevelFilterStorageKey = 'network-monitoring-log-level-filter';
const languageStorageKey = 'network-monitoring-language';

function loadStoredLogLevelFilter(): LogLevelFilter {
  if (typeof window === 'undefined') {
    return 'all';
  }

  const raw = window.localStorage.getItem(logLevelFilterStorageKey);
  if (raw === 'info' || raw === 'warning' || raw === 'error' || raw === 'audit') {
    return raw;
  }

  return 'all';
}

function loadStoredLanguage(): Language {
  if (typeof window === 'undefined') {
    return 'ru';
  }

  return window.localStorage.getItem(languageStorageKey) === 'en' ? 'en' : 'ru';
}

function sanitizeStartTab(tab: TabId | undefined, role: UserRole): TabId {
  if (tab === 'logs' && role !== 'admin') {
    return 'dashboard';
  }

  if (tab && ['dashboard', 'status', 'devices', 'metrics', 'logs', 'settings'].includes(tab)) {
    return tab;
  }

  return 'dashboard';
}

function extractApiErrorMessage(error: unknown, fallback: string) {
  if (typeof error === 'object' && error !== null && 'data' in error) {
    const payload = (error as { data?: { error?: string } }).data;
    if (payload?.error) {
      return payload.error;
    }
  }

  return fallback;
}

export function App() {
  const [activeTab, setActiveTab] = useState<TabId>('dashboard');
  const [sessionToken, setSessionToken] = useState(() => getAuthToken());
  const [language, setLanguage] = useState<Language>(() => loadStoredLanguage());
  const [login, setLogin] = useState('');
  const [password, setPassword] = useState('');
  const [authError, setAuthError] = useState('');
  const [isLogoutDialogOpen, setIsLogoutDialogOpen] = useState(false);
  const [isNotificationsOpen, setIsNotificationsOpen] = useState(false);
  const [logLevelFilter, setLogLevelFilter] = useState<LogLevelFilter>(() => loadStoredLogLevelFilter());

  const [loginMutation, { isLoading: isLoginLoading }] = useLoginMutation();
  const [createUserMutation] = useCreateUserMutation();
  const [deleteUserMutation] = useDeleteUserMutation();
  const [updateOwnPasswordMutation] = useUpdateOwnPasswordMutation();
  const [updateUserPasswordMutation] = useUpdateUserPasswordMutation();
  const [updateOwnProfileMutation] = useUpdateOwnProfileMutation();

  const {
    data: currentUser,
    isLoading: isMeLoading,
    isFetching: isMeFetching,
    isError: isMeError,
  } = useGetMeQuery(undefined, {
    skip: !sessionToken,
    refetchOnFocus: true,
    refetchOnReconnect: true,
  });

  const authorizedUser = sessionToken ? currentUser : undefined;

  const isAdmin = authorizedUser?.role === 'admin';
  const { data: devices = [] } = useGetDevicesQuery(undefined, {
    skip: !authorizedUser,
    pollingInterval: LIVE_REFETCH_MS,
    refetchOnFocus: true,
    refetchOnReconnect: true,
  });
  const { data: users = [] } = useGetUsersQuery(undefined, {
    skip: !isAdmin,
    refetchOnFocus: true,
    refetchOnReconnect: true,
  });

  const text = uiText[language].app;
  const mainNav = useMemo<NavItem[]>(() => text.nav.map((item) => ({ ...item })), [text.nav]);

  const visibleNav = useMemo(
    () => mainNav.filter((item) => (item.adminOnly ? isAdmin : true)),
    [isAdmin, mainNav],
  );
  const offlineDevices = useMemo(() => devices.filter((item) => item.status === 'offline'), [devices]);
  const unreadNotifications = useMemo(() => offlineDevices.length, [offlineDevices]);
  const currentDisplayName = authorizedUser?.displayName?.trim() || authorizedUser?.username || '';
  const startTabOptions = useMemo(
    () => visibleNav.map((item) => ({ value: item.id, label: item.label })),
    [visibleNav],
  );
  const accounts = useMemo(
    () => Object.fromEntries(users.map((item) => [item.username, { role: item.role }])),
    [users],
  );

  useEffect(() => {
    if (typeof window !== 'undefined') {
      window.localStorage.setItem(logLevelFilterStorageKey, logLevelFilter);
    }
  }, [logLevelFilter]);

  useEffect(() => {
    if (typeof window !== 'undefined') {
      window.localStorage.setItem(languageStorageKey, language);
    }
  }, [language]);

  useEffect(() => {
    if (authorizedUser?.preferredLanguage && authorizedUser.preferredLanguage !== language) {
      setLanguage(authorizedUser.preferredLanguage);
    }
  }, [authorizedUser?.preferredLanguage]);

  useEffect(() => {
    if (!isMeError) {
      return;
    }

    clearAuthToken();
    setSessionToken('');
    store.dispatch(monitoringApi.util.resetApiState());
  }, [isMeError]);

  async function handleLogin() {
    try {
      const response = await loginMutation({
        username: login.trim(),
        password,
      }).unwrap();

      setAuthToken(response.token);
      setSessionToken(response.token);
      setLanguage(response.user.preferredLanguage);
      setActiveTab(sanitizeStartTab(response.user.startTab, response.user.role));
      setAuthError('');
      setPassword('');
      setIsNotificationsOpen(false);
    } catch (error) {
      setAuthError(extractApiErrorMessage(error, text.invalidLogin));
    }
  }

  function handleLogout() {
    setIsLogoutDialogOpen(false);
    clearAuthToken();
    setSessionToken('');
    setLogin('');
    setPassword('');
    setAuthError('');
    setActiveTab('dashboard');
    setIsNotificationsOpen(false);
    store.dispatch(monitoringApi.util.resetApiState());
  }

  async function handleCreateUser(username: string, newPassword: string, role: UserRole): Promise<ResultMessage> {
    const normalizedUsername = username.trim();

    try {
      await createUserMutation({
        username: normalizedUsername,
        password: newPassword,
        role,
        displayName: normalizedUsername,
        preferredLanguage: 'ru',
        startTab: 'dashboard',
      }).unwrap();

      return { ok: true, message: text.userCreated(normalizedUsername) };
    } catch (error) {
      return { ok: false, message: extractApiErrorMessage(error, text.loginFailed) };
    }
  }

  async function handleDeleteUser(username: string): Promise<ResultMessage> {
    if (authorizedUser?.username === username) {
      return {
        ok: false,
        message: text.cannotDeleteCurrentUser,
      };
    }

    try {
      await deleteUserMutation(username).unwrap();
      return { ok: true, message: text.userDeleted(username) };
    } catch (error) {
      return { ok: false, message: extractApiErrorMessage(error, text.deleteUserFailed) };
    }
  }

  async function handleChangePassword(username: string, nextPassword: string): Promise<ResultMessage> {
    try {
      if (authorizedUser?.username === username) {
        await updateOwnPasswordMutation({ newPassword: nextPassword }).unwrap();
      } else {
        await updateUserPasswordMutation({ username, newPassword: nextPassword }).unwrap();
      }

      return { ok: true, message: text.passwordUpdated(username) };
    } catch (error) {
      return { ok: false, message: extractApiErrorMessage(error, text.updatePasswordFailed) };
    }
  }

  async function handleUpdateOwnProfile(displayName: string, startTab: TabId, preferredLanguage: Language): Promise<ResultMessage> {
    try {
      const updated = await updateOwnProfileMutation({
        displayName,
        preferredLanguage,
        startTab,
      }).unwrap();

      setLanguage(updated.preferredLanguage);

      return { ok: true, message: text.profileUpdated };
    } catch (error) {
      return { ok: false, message: extractApiErrorMessage(error, text.updateProfileFailed) };
    }
  }

  const isCheckingSession = Boolean(sessionToken) && (isMeLoading || isMeFetching);

  if (isCheckingSession) {
    return (
      <div className="auth-shell">
        <div className="panel-empty">{text.restoringSession}</div>
      </div>
    );
  }

  if (!authorizedUser) {
    return (
      <div className="auth-shell">
        <div className="auth-card">
          <div className="auth-card__header">
            <h1>{text.loginTitle}</h1>
          </div>
          <div className="auth-form">
            <label className="field"><span>{text.loginLabel}</span><input value={login} onChange={(event) => setLogin(event.target.value)} placeholder={text.loginPlaceholder} /></label>
            <label className="field"><span>{text.passwordLabel}</span><input type="password" value={password} onChange={(event) => setPassword(event.target.value)} placeholder={text.passwordPlaceholder} /></label>
            {authError ? <div className="form-error">{authError}</div> : null}
            <button type="button" className="primary-button primary-button--wide" onClick={handleLogin} disabled={isLoginLoading}>
              {text.signIn}
            </button>
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
          <strong>{text.settings}</strong>
          <span>{text.settingsCaption}</span>
        </button>
      </aside>

      <main className="workspace">
        <header className="topbar">
          <div className="topbar__title">
            <h2>{visibleNav.find((item) => item.id === activeTab)?.label ?? text.settings}</h2>
          </div>
          <div className="topbar__actions">
            <div className="notifications">
              <button
                type="button"
                className={`chip-button ${isNotificationsOpen ? 'chip-button--active' : ''}`}
                onClick={() => setIsNotificationsOpen((current) => !current)}
              >
                <span className="chip-button__count">{unreadNotifications}</span>
                {text.notifications}
              </button>
              {isNotificationsOpen ? (
                <div className="notifications-panel">
                  <div className="notifications-panel__header">
                    <strong>{text.offlineDevices}</strong>
                    <span>{offlineDevices.length}</span>
                  </div>
                  {offlineDevices.length > 0 ? (
                    <div className="notifications-panel__list">
                      {offlineDevices.map((item) => (
                        <div key={item.id} className="notifications-panel__item notifications-panel__item--danger">
                          <strong>{item.name}</strong>
                          <span>{translateLocation(item.location)}</span>
                        </div>
                      ))}
                    </div>
                  ) : (
                    <div className="notifications-panel__empty">{text.noOfflineDevices}</div>
                  )}
                </div>
              ) : null}
            </div>
            <div className="user-actions">
              <div className="user-badge">{currentDisplayName}</div>
              <button type="button" className="chip-button chip-button--ghost signout-button" onClick={() => setIsLogoutDialogOpen(true)}>{text.signOut}</button>
            </div>
          </div>
        </header>
        <section className="workspace__content workspace-tabs">
          <div className={`workspace-tab ${activeTab === 'dashboard' ? 'workspace-tab--active' : ''}`}>
            <DashboardView canViewLogs={isAdmin} language={language} />
          </div>
          <div className={`workspace-tab ${activeTab === 'status' ? 'workspace-tab--active' : ''}`}>
            <StatusView language={language} />
          </div>
          <div className={`workspace-tab ${activeTab === 'devices' ? 'workspace-tab--active' : ''}`}>
            <DevicesView isAdmin={isAdmin} language={language} />
          </div>
          <div className={`workspace-tab ${activeTab === 'metrics' ? 'workspace-tab--active' : ''}`}>
            <MetricsView language={language} />
          </div>
          {isAdmin ? (
            <div className={`workspace-tab ${activeTab === 'logs' ? 'workspace-tab--active' : ''}`}>
              <LogsView levelFilter={logLevelFilter} onLevelFilterChange={setLogLevelFilter} language={language} />
            </div>
          ) : null}
          <div className={`workspace-tab ${activeTab === 'settings' ? 'workspace-tab--active' : ''}`}>
            <SettingsView
              role={authorizedUser.role}
              currentUsername={authorizedUser.username}
              currentDisplayName={currentDisplayName}
              currentStartTab={sanitizeStartTab(authorizedUser.startTab, authorizedUser.role)}
              startTabOptions={startTabOptions}
              accounts={accounts}
              language={language}
              onCreateUser={handleCreateUser}
              onDeleteUser={handleDeleteUser}
              onChangePassword={handleChangePassword}
              onUpdateOwnProfile={handleUpdateOwnProfile}
              onChangeLanguage={setLanguage}
            />
          </div>
        </section>
      </main>
      {isLogoutDialogOpen ? (
        <ConfirmDialog
          title={text.signOutTitle}
          message={text.signOutMessage}
          confirmLabel={text.signOut}
          onConfirm={handleLogout}
          onCancel={() => setIsLogoutDialogOpen(false)}
        />
      ) : null}
    </div>
  );
}
