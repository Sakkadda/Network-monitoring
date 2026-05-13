import { useEffect, useMemo, useState } from 'react';

import {
  useGetSimulatorSettingsQuery,
  useUpdateSimulatorSettingsMutation,
} from '../../../shared/api/monitoringApi';
import { uiText } from '../../../shared/lib/i18n';
import type { Language } from '../../../shared/lib/language';

type UserRole = 'admin' | 'user';
type UserAccount = { role: UserRole };
type TabId = 'dashboard' | 'status' | 'devices' | 'metrics' | 'logs' | 'settings';

type ResultMessage = { ok: true; message: string } | { ok: false; message: string };

type SettingsViewProps = {
  role: UserRole;
  currentUsername: string;
  currentDisplayName: string;
  currentStartTab: TabId;
  startTabOptions: Array<{ value: TabId; label: string }>;
  accounts: Record<string, UserAccount>;
  language: Language;
  onCreateUser: (username: string, password: string, role: UserRole) => Promise<ResultMessage>;
  onDeleteUser: (username: string) => Promise<ResultMessage>;
  onChangePassword: (username: string, password: string) => Promise<ResultMessage>;
  onUpdateOwnProfile: (displayName: string, startTab: TabId, preferredLanguage: Language) => Promise<ResultMessage>;
  onChangeLanguage: (language: Language) => void;
};

export function SettingsView({
  role,
  currentUsername,
  currentDisplayName,
  currentStartTab,
  startTabOptions,
  accounts,
  language,
  onCreateUser,
  onDeleteUser,
  onChangePassword,
  onUpdateOwnProfile,
  onChangeLanguage,
}: SettingsViewProps) {
  const [profileDisplayName, setProfileDisplayName] = useState(currentDisplayName);
  const [profileStartTab, setProfileStartTab] = useState<TabId>(currentStartTab);
  const [profileLanguage, setProfileLanguage] = useState<Language>(language);
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [newRole, setNewRole] = useState<UserRole>('user');
  const [selectedAccount, setSelectedAccount] = useState('');
  const [nextPassword, setNextPassword] = useState('');
  const [intervalSeconds, setIntervalSeconds] = useState('20');
  const [formMessage, setFormMessage] = useState('');
  const [formMessageTone, setFormMessageTone] = useState<'success' | 'error'>('success');
  const text = uiText[language].settings;

  const { data: simulatorSettings } = useGetSimulatorSettingsQuery(undefined, {
    skip: role !== 'admin',
  });
  const [updateSimulatorSettings, { isLoading: isSavingInterval }] = useUpdateSimulatorSettingsMutation();

  const sortedAccounts = useMemo(
    () => Object.entries(accounts).sort(([left], [right]) => left.localeCompare(right, language === 'en' ? 'en' : 'ru')),
    [accounts, language],
  );

  useEffect(() => {
    if (simulatorSettings?.intervalSeconds) {
      setIntervalSeconds(String(simulatorSettings.intervalSeconds));
    }
  }, [simulatorSettings]);

  useEffect(() => {
    setProfileDisplayName(currentDisplayName);
  }, [currentDisplayName]);

  useEffect(() => {
    setProfileStartTab(currentStartTab);
  }, [currentStartTab]);

  useEffect(() => {
    setProfileLanguage(language);
  }, [language]);

  function showResult(result: ResultMessage) {
    setFormMessageTone(result.ok ? 'success' : 'error');
    setFormMessage(result.message);
  }

  async function handleCreateUser() {
    if (!username.trim() || password.length < 4) {
      setFormMessageTone('error');
      setFormMessage(text.shortCredentials);
      return;
    }

    const result = await onCreateUser(username, password, newRole);
    showResult(result);

    if (result.ok) {
      setUsername('');
      setPassword('');
      setNewRole('user');
    }
  }

  async function handleUpdateOwnSettings() {
    const profileResult = await onUpdateOwnProfile(profileDisplayName, profileStartTab, profileLanguage);
    showResult(profileResult);
  }

  async function handleChangePassword() {
    const targetAccount = role === 'admin' ? selectedAccount : currentUsername;

    if (!targetAccount) {
      setFormMessageTone('error');
      setFormMessage(text.chooseUser);
      return;
    }

    if (nextPassword.length < 4) {
      setFormMessageTone('error');
      setFormMessage(text.passwordTooShort);
      return;
    }

    const result = await onChangePassword(targetAccount, nextPassword);
    showResult(result);

    if (result.ok) {
      setNextPassword('');
    }
  }

  async function handleDeleteUser(usernameToDelete: string) {
    const result = await onDeleteUser(usernameToDelete);
    showResult(result);

    if (result.ok && selectedAccount === usernameToDelete) {
      setSelectedAccount('');
      setNextPassword('');
    }
  }

  async function handleSaveSimulatorInterval() {
    const nextInterval = Number.parseInt(intervalSeconds, 10);
    if (!Number.isFinite(nextInterval) || nextInterval < 5 || nextInterval > 3600) {
      setFormMessageTone('error');
      setFormMessage(text.simulatorError);
      return;
    }

    try {
      const updated = await updateSimulatorSettings({ intervalSeconds: nextInterval }).unwrap();
      setIntervalSeconds(String(updated.intervalSeconds));
      showResult({ ok: true, message: text.simulatorSaved(updated.intervalSeconds) });
    } catch {
      setFormMessageTone('error');
      setFormMessage(text.simulatorSaveFailed);
    }
  }

  return (
    <section className="settings-page">
      <div className={`settings-admin-row ${role === 'admin' ? 'settings-admin-row--top' : 'settings-admin-row--top-user'}`}>
        <article className="setting-card">
          <h3>{text.overviewTitle}</h3>
          <div className="settings-summary">
            <div className="settings-summary__item">
              <strong>{text.roleTitle}</strong>
              <p>{text.roleText(role)}</p>
            </div>
            <div className="settings-summary__item">
              <strong>{text.monitoringTitle}</strong>
              <p>{role === 'admin' && simulatorSettings?.enabled ? text.simulatorEnabled(simulatorSettings.intervalSeconds) : text.monitoringText}</p>
            </div>
            <div className="settings-summary__item">
              <strong>{text.dataSourcesTitle}</strong>
              <p>{text.dataSourcesText}</p>
            </div>
          </div>
        </article>
        <article className="setting-card">
          <h3>{text.languageTitle}</h3>
          <p>{text.languageText}</p>
          <div className="form-grid form-grid--single">
            <label className="field">
              <span>{text.languageTitle}</span>
              <select
                value={profileLanguage}
                onChange={(event) => {
                  const nextLanguage = event.target.value as Language;
                  setProfileLanguage(nextLanguage);
                  onChangeLanguage(nextLanguage);
                }}
              >
                <option value="ru">{text.russian}</option>
                <option value="en">{text.english}</option>
              </select>
            </label>
          </div>
        </article>
        {role === 'admin' ? (
          <article className="setting-card">
            <h3>{text.profileTitle}</h3>
            <div className="form-grid form-grid--single">
              <label className="field">
                <span>{text.displayNameLabel}</span>
                <input
                  value={profileDisplayName}
                  onChange={(event) => setProfileDisplayName(event.target.value)}
                  placeholder={text.displayNamePlaceholder}
                />
              </label>
              <label className="field">
                <span>{text.startTabLabel}</span>
                <select value={profileStartTab} onChange={(event) => setProfileStartTab(event.target.value as TabId)}>
                  {startTabOptions.map((option) => (
                    <option key={option.value} value={option.value}>{option.label}</option>
                  ))}
                </select>
              </label>
            </div>
            <div className="modal-card__actions">
              <button type="button" className="primary-button" onClick={handleUpdateOwnSettings}>{text.saveProfile}</button>
            </div>
          </article>
        ) : null}

        {role === 'admin' ? (
          <article className="setting-card">
            <h3>{text.simulatorTitle}</h3>
            <div className="form-grid form-grid--single">
              <label className="field">
                <span>{text.simulatorField}</span>
                <input
                  value={intervalSeconds}
                  onChange={(event) => setIntervalSeconds(event.target.value)}
                  inputMode="numeric"
                  placeholder={text.simulatorPlaceholder}
                />
              </label>
            </div>
            <p className="setting-card__hint">{text.simulatorHint}</p>
            <div className="modal-card__actions">
              <button type="button" className="primary-button" onClick={handleSaveSimulatorInterval} disabled={isSavingInterval}>
                {isSavingInterval ? text.simulatorSaving : text.simulatorSave}
              </button>
            </div>
          </article>
        ) : null}
      </div>

      {role === 'admin' ? (
        <div className="settings-admin-row settings-admin-row--bottom">
          <div className="settings-admin-row__label">{text.adminPanelLabel}</div>
          <article className="setting-card">
            <h3>{text.changePasswordTitle}</h3>
            <div className="form-grid form-grid--single">
              <label className="field">
                <span>{text.userLabel}</span>
                <select value={selectedAccount} onChange={(event) => setSelectedAccount(event.target.value)}>
                  <option value="">{text.userSelect}</option>
                  {sortedAccounts.map(([accountLogin]) => (
                    <option key={accountLogin} value={accountLogin}>{accountLogin}</option>
                  ))}
                </select>
              </label>
              <label className="field">
                <span>{text.newPasswordLabel}</span>
                <input type="password" value={nextPassword} onChange={(event) => setNextPassword(event.target.value)} placeholder={text.newPasswordPlaceholder} />
              </label>
            </div>
            <div className="modal-card__actions">
              <button type="button" className="primary-button" onClick={handleChangePassword}>{text.changePassword}</button>
            </div>
          </article>

          <article className="setting-card">
            <h3>{text.newUserTitle}</h3>
            <div className="form-grid form-grid--single">
              <label className="field">
                <span>{text.loginLabel}</span>
                <input value={username} onChange={(event) => setUsername(event.target.value)} placeholder={text.loginPlaceholder} />
              </label>
              <label className="field">
                <span>{text.passwordLabel}</span>
                <input type="password" value={password} onChange={(event) => setPassword(event.target.value)} placeholder={text.passwordPlaceholder} />
              </label>
              <label className="field">
                <span>{text.roleLabel}</span>
                <select value={newRole} onChange={(event) => setNewRole(event.target.value as UserRole)}>
                  <option value="user">user</option>
                  <option value="admin">admin</option>
                </select>
              </label>
            </div>
            <div className="modal-card__actions">
              <button type="button" className="primary-button" onClick={handleCreateUser}>{text.createUser}</button>
            </div>
          </article>

          <article className="setting-card">
            <h3>{text.accountsTitle}</h3>
            <div className="settings-accounts-list">
              {sortedAccounts.map(([accountLogin, account]) => {
                const isDefault = ['admin', 'skd', 'user'].includes(accountLogin);
                const isCurrent = currentUsername === accountLogin;

                return (
                  <div key={accountLogin} className="settings-accounts-list__item">
                    <div className="settings-accounts-list__head">
                      <strong>{accountLogin}</strong>
                      {isDefault ? <span className="status-pill status-pill--online">{text.builtIn}</span> : null}
                    </div>
                    <span>{text.rolePrefix}: {account.role}</span>
                    {isCurrent ? <small>{text.currentUser}</small> : null}
                    {!isDefault ? (
                      <div className="settings-accounts-list__actions">
                        <button type="button" className="danger-button" onClick={() => handleDeleteUser(accountLogin)}>
                          {text.deleteUser}
                        </button>
                      </div>
                    ) : null}
                  </div>
                );
              })}
            </div>
          </article>
        </div>
      ) : (
        <div className="settings-admin-row settings-admin-row--bottom-user">
          <article className="setting-card">
            <h3>{text.profileTitle}</h3>
            <div className="form-grid form-grid--single">
              <label className="field">
                <span>{text.displayNameLabel}</span>
                <input
                  value={profileDisplayName}
                  onChange={(event) => setProfileDisplayName(event.target.value)}
                  placeholder={text.displayNamePlaceholder}
                />
              </label>
              <label className="field">
                <span>{text.startTabLabel}</span>
                <select value={profileStartTab} onChange={(event) => setProfileStartTab(event.target.value as TabId)}>
                  {startTabOptions.map((option) => (
                    <option key={option.value} value={option.value}>{option.label}</option>
                  ))}
                </select>
              </label>
            </div>
            <div className="modal-card__actions">
              <button type="button" className="primary-button" onClick={handleUpdateOwnSettings}>{text.saveProfile}</button>
            </div>
          </article>
          <article className="setting-card">
            <h3>{text.changePasswordTitle}</h3>
            <div className="form-grid form-grid--single">
              <label className="field">
                <span>{text.newPasswordLabel}</span>
                <input type="password" value={nextPassword} onChange={(event) => setNextPassword(event.target.value)} placeholder={text.newPasswordPlaceholder} />
              </label>
            </div>
            <div className="modal-card__actions">
              <button type="button" className="primary-button" onClick={handleChangePassword}>{text.changePassword}</button>
            </div>
          </article>
        </div>
      )}

      {formMessage ? (
        <div className={formMessageTone === 'success' ? 'form-success' : 'form-error'}>{formMessage}</div>
      ) : null}
    </section>
  );
}
