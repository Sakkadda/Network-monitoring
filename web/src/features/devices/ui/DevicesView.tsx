import { useMemo, useState } from 'react';

import {
  LIVE_REFETCH_MS,
  useCreateDeviceMutation,
  useDeleteDeviceMutation,
  useGetDevicesQuery,
  useUpdateDeviceMutation,
} from '../../../shared/api/monitoringApi';
import { createDevicePayloadSchema, type Device, updateDevicePayloadSchema } from '../../../shared/lib/schemas';
import { translateLocation } from '../../../shared/lib/display';
import { ConfirmDialog } from '../../../shared/ui/ConfirmDialog';

type DevicesViewProps = {
  isAdmin: boolean;
};

type SortField = 'name' | 'deviceType' | 'location' | 'dataSource' | 'status';
type ModalMode = 'create' | 'edit';

type DeviceFormState = {
  name: string;
  ipAddress: string;
  deviceType: string;
  vendor: string;
  model: string;
  location: string;
  description: string;
};

const initialFormState: DeviceFormState = {
  name: '',
  ipAddress: '',
  deviceType: '',
  vendor: '',
  model: '',
  location: '',
  description: '',
};

const statusLabels: Record<string, string> = {
  online: 'В сети',
  warning: 'Предупреждение',
  offline: 'Недоступно',
  unknown: 'Неизвестно',
};

export function DevicesView({ isAdmin }: DevicesViewProps) {
  const { data = [], isLoading, isError } = useGetDevicesQuery(undefined, {
    pollingInterval: LIVE_REFETCH_MS,
    refetchOnFocus: true,
    refetchOnReconnect: true,
  });
  const [createDevice, { isLoading: isCreating }] = useCreateDeviceMutation();
  const [updateDevice, { isLoading: isUpdating }] = useUpdateDeviceMutation();
  const [deleteDevice, { isLoading: isDeleting }] = useDeleteDeviceMutation();
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [modalMode, setModalMode] = useState<ModalMode>('create');
  const [editingDevice, setEditingDevice] = useState<Device | null>(null);
  const [formState, setFormState] = useState<DeviceFormState>(initialFormState);
  const [formError, setFormError] = useState('');
  const [sortField, setSortField] = useState<SortField>('name');
  const [sortDirection, setSortDirection] = useState<'asc' | 'desc'>('asc');
  const [deviceToDelete, setDeviceToDelete] = useState<Device | null>(null);
  const [deleteError, setDeleteError] = useState('');

  const isSubmitting = isCreating || isUpdating;

  const sortedDevices = useMemo(() => {
    const statusOrder: Record<string, number> = {
      offline: 0,
      warning: 1,
      online: 2,
      unknown: 3,
    };

    const items = [...data].sort((left, right) => {
      let result = 0;

      if (sortField === 'status') {
        result = statusOrder[left.status] - statusOrder[right.status];
      } else if (sortField === 'location') {
        result = translateLocation(left.location).localeCompare(translateLocation(right.location), 'ru');
      } else {
        result = left[sortField].localeCompare(right[sortField], 'ru');
      }

      return sortDirection === 'asc' ? result : -result;
    });

    return items;
  }, [data, sortDirection, sortField]);

  if (isLoading) {
    return <div className="panel-empty">Загрузка списка устройств...</div>;
  }

  if (isError) {
    return <div className="panel-empty">Не удалось загрузить устройства.</div>;
  }

  function resetModal() {
    setFormState(initialFormState);
    setFormError('');
    setEditingDevice(null);
    setModalMode('create');
    setIsModalOpen(false);
  }

  function openCreateModal() {
    setModalMode('create');
    setEditingDevice(null);
    setFormState(initialFormState);
    setFormError('');
    setIsModalOpen(true);
  }

  function openEditModal(device: Device) {
    setModalMode('edit');
    setEditingDevice(device);
    setFormState({
      name: device.name,
      ipAddress: device.ipAddress,
      deviceType: device.deviceType,
      vendor: device.vendor,
      model: device.model,
      location: translateLocation(device.location),
      description: device.description,
    });
    setFormError('');
    setIsModalOpen(true);
  }

  async function handleSubmitDevice() {
    if (modalMode === 'edit' && editingDevice) {
      const parsed = updateDevicePayloadSchema.safeParse({
        ...formState,
        status: editingDevice.status,
        dataSource: editingDevice.dataSource,
        isActive: editingDevice.isActive,
      });

      if (!parsed.success) {
        setFormError('Проверьте заполнение формы устройства.');
        return;
      }

      try {
        await updateDevice({ id: editingDevice.id, payload: parsed.data }).unwrap();
        resetModal();
      } catch {
        setFormError('Не удалось обновить устройство.');
      }

      return;
    }

    const parsed = createDevicePayloadSchema.safeParse({
      ...formState,
      dataSource: 'manual' as const,
      isActive: true,
    });

    if (!parsed.success) {
      setFormError('Проверьте заполнение формы устройства.');
      return;
    }

    try {
      await createDevice(parsed.data).unwrap();
      resetModal();
    } catch {
      setFormError('Не удалось добавить устройство.');
    }
  }

  async function handleDeleteDevice(id: number) {
    try {
      await deleteDevice(id).unwrap();
      setDeviceToDelete(null);
    } catch {
      setDeviceToDelete(null);
      setDeleteError('Не удалось удалить устройство.');
    }
  }

  return (
    <>
      <section className="panel">
        <div className="section-heading">
          <div>
            <h2>Устройства сети</h2>
            <span>Список узлов с ручным и симулированным вводом данных</span>
          </div>
          <div className="section-heading__actions">
            <div className="table-sort">
              <label className="table-sort__label" htmlFor="device-sort-field">Сортировка</label>
              <select
                id="device-sort-field"
                value={sortField}
                onChange={(event) => {
                  const nextField = event.target.value as SortField;
                  setSortField(nextField);
                  if (nextField === 'status') {
                    setSortDirection('asc');
                  }
                }}
              >
                <option value="name">По имени</option>
                <option value="deviceType">По типу</option>
                <option value="location">По локации</option>
                <option value="dataSource">По источнику</option>
                <option value="status">По статусу</option>
              </select>
              <button type="button" className="ghost-button" onClick={() => setSortDirection((prev) => (prev === 'asc' ? 'desc' : 'asc'))}>
                {sortDirection === 'asc' ? 'По возрастанию' : 'По убыванию'}
              </button>
            </div>
            {isAdmin ? (
              <button type="button" className="primary-button" onClick={openCreateModal}>
                Добавить устройство
              </button>
            ) : null}
          </div>
        </div>
        <div className="table-wrap">
          <table className="data-table">
            <thead>
              <tr>
                <th>Имя</th>
                <th>IP</th>
                <th>Тип</th>
                <th>Локация</th>
                <th>Источник</th>
                <th>Статус</th>
                {isAdmin ? <th>Действия</th> : null}
              </tr>
            </thead>
            <tbody>
              {sortedDevices.map((item) => (
                <tr key={item.id}>
                  <td>{item.name}</td>
                  <td>{item.ipAddress}</td>
                  <td>{item.deviceType}</td>
                  <td>{translateLocation(item.location)}</td>
                  <td>{item.dataSource}</td>
                  <td><span className={`status-pill status-pill--${item.status}`}>{statusLabels[item.status]}</span></td>
                  {isAdmin ? (
                    <td>
                      <div className="table-actions">
                        <button type="button" className="ghost-button" onClick={() => openEditModal(item)}>
                          Изменить
                        </button>
                        <button type="button" className="danger-button" disabled={isDeleting} onClick={() => setDeviceToDelete(item)}>
                          Удалить
                        </button>
                      </div>
                    </td>
                  ) : null}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>

      {isAdmin && isModalOpen ? (
        <div className="modal-backdrop" role="presentation" onClick={resetModal}>
          <div className="modal-card" role="dialog" aria-modal="true" onClick={(event) => event.stopPropagation()}>
            <button type="button" className="icon-close-button" aria-label="Закрыть окно" onClick={resetModal}>×</button>
            <div className="modal-card__header">
              <div>
                <h3>{modalMode === 'edit' ? 'Изменить устройство' : 'Добавить устройство'}</h3>
                <p>{modalMode === 'edit' ? 'Обновите данные сетевого узла.' : 'Введите основные данные сетевого узла для мониторинга.'}</p>
              </div>
            </div>

            <div className="form-grid">
              <label className="field"><span>Имя устройства</span><input value={formState.name} onChange={(event) => setFormState((prev) => ({ ...prev, name: event.target.value }))} placeholder="Core Router R2" /></label>
              <label className="field"><span>IP-адрес</span><input value={formState.ipAddress} onChange={(event) => setFormState((prev) => ({ ...prev, ipAddress: event.target.value }))} placeholder="192.168.0.50" /></label>
              <label className="field"><span>Тип устройства</span><input value={formState.deviceType} onChange={(event) => setFormState((prev) => ({ ...prev, deviceType: event.target.value }))} placeholder="router" /></label>
              <label className="field"><span>Vendor</span><input value={formState.vendor} onChange={(event) => setFormState((prev) => ({ ...prev, vendor: event.target.value }))} placeholder="Cisco" /></label>
              <label className="field"><span>Model</span><input value={formState.model} onChange={(event) => setFormState((prev) => ({ ...prev, model: event.target.value }))} placeholder="ISR 4431" /></label>
              <label className="field field--wide"><span>Локация</span><input value={formState.location} onChange={(event) => setFormState((prev) => ({ ...prev, location: event.target.value }))} placeholder="Серверная C" /></label>
              <label className="field field--wide"><span>Описание</span><textarea rows={3} value={formState.description} onChange={(event) => setFormState((prev) => ({ ...prev, description: event.target.value }))} placeholder="Резервный маршрутизатор для VLAN-сегмента." /></label>
            </div>

            {formError ? <div className="form-error">{formError}</div> : null}

            <div className="modal-card__actions">
              <button type="button" className="ghost-button" onClick={resetModal}>Отмена</button>
              <button type="button" className="primary-button" disabled={isSubmitting} onClick={handleSubmitDevice}>{isSubmitting ? 'Сохранение...' : modalMode === 'edit' ? 'Сохранить изменения' : 'Сохранить устройство'}</button>
            </div>
          </div>
        </div>
      ) : null}
      {deviceToDelete ? (
        <ConfirmDialog
          title="Удаление устройства"
          message={`Удалить устройство "${deviceToDelete.name}" из системы мониторинга?`}
          confirmLabel="Удалить"
          tone="danger"
          onConfirm={() => handleDeleteDevice(deviceToDelete.id)}
          onCancel={() => setDeviceToDelete(null)}
        />
      ) : null}
      {deleteError ? (
        <ConfirmDialog
          title="Ошибка удаления"
          message={deleteError}
          confirmLabel="Понятно"
          cancelLabel="Закрыть"
          tone="default"
          onConfirm={() => setDeleteError('')}
          onCancel={() => setDeleteError('')}
        />
      ) : null}
    </>
  );
}
