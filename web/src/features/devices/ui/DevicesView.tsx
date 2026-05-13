import { useMemo, useState } from 'react';

import {
  LIVE_REFETCH_MS,
  useCreateDeviceMutation,
  useDeleteDeviceMutation,
  useGetDevicesQuery,
  useUpdateDeviceMutation,
} from '../../../shared/api/monitoringApi';
import { uiText } from '../../../shared/lib/i18n';
import { createDevicePayloadSchema, type Device, updateDevicePayloadSchema } from '../../../shared/lib/schemas';
import { normalizeLocationInput, translateLocation } from '../../../shared/lib/display';
import type { Language } from '../../../shared/lib/language';
import { ConfirmDialog } from '../../../shared/ui/ConfirmDialog';

type DevicesViewProps = {
  isAdmin: boolean;
  language: Language;
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

export function DevicesView({ isAdmin, language }: DevicesViewProps) {
  const text = uiText[language].devices;
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

  function extractMutationErrorMessage(fallbackMessage: string, error: unknown) {
    if (error && typeof error === 'object' && 'data' in error) {
      const responseData = (error as { data?: unknown }).data;
      if (responseData && typeof responseData === 'object' && 'error' in responseData) {
        const message = (responseData as { error?: unknown }).error;
        if (typeof message === 'string' && message.trim()) {
          return message;
        }
      }
    }

    return fallbackMessage;
  }

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
    return <div className="panel-empty">{text.loading}</div>;
  }

  if (isError) {
    return <div className="panel-empty">{text.error}</div>;
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
    const normalizedFormState = {
      ...formState,
      name: formState.name.trim(),
      ipAddress: formState.ipAddress.trim(),
      deviceType: formState.deviceType.trim(),
      vendor: formState.vendor.trim(),
      model: formState.model.trim(),
      location: normalizeLocationInput(formState.location.trim()),
      description: formState.description.trim(),
    };

    if (modalMode === 'edit' && editingDevice) {
      const parsed = updateDevicePayloadSchema.safeParse({
        ...normalizedFormState,
        status: editingDevice.status,
        dataSource: editingDevice.dataSource,
        isActive: editingDevice.isActive,
      });

      if (!parsed.success) {
        setFormError(text.invalidForm);
        return;
      }

      try {
        await updateDevice({ id: editingDevice.id, payload: parsed.data }).unwrap();
        resetModal();
      } catch (error) {
        setFormError(extractMutationErrorMessage(text.updateFailed, error));
      }

      return;
    }

    const parsed = createDevicePayloadSchema.safeParse({
      ...normalizedFormState,
      dataSource: 'manual' as const,
      isActive: true,
    });

    if (!parsed.success) {
      setFormError(text.invalidForm);
      return;
    }

    try {
      await createDevice(parsed.data).unwrap();
      resetModal();
    } catch (error) {
      setFormError(extractMutationErrorMessage(text.createFailed, error));
    }
  }

  async function handleDeleteDevice(id: number) {
    try {
      await deleteDevice(id).unwrap();
      setDeviceToDelete(null);
    } catch (error) {
      setDeviceToDelete(null);
      setDeleteError(extractMutationErrorMessage(text.deleteFailed, error));
    }
  }

  return (
    <>
      <section className="panel">
        <div className="section-heading">
          <div>
            <h2>{text.title}</h2>
            <span>{text.subtitle}</span>
          </div>
          <div className="section-heading__actions">
            <div className="table-sort">
              <label className="table-sort__label" htmlFor="device-sort-field">{text.sorting}</label>
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
                <option value="name">{text.byName}</option>
                <option value="deviceType">{text.byType}</option>
                <option value="location">{text.byLocation}</option>
                <option value="dataSource">{text.bySource}</option>
                <option value="status">{text.byStatus}</option>
              </select>
              <button type="button" className="ghost-button" onClick={() => setSortDirection((prev) => (prev === 'asc' ? 'desc' : 'asc'))}>
                {sortDirection === 'asc' ? text.ascending : text.descending}
              </button>
            </div>
            {isAdmin ? (
              <button type="button" className="primary-button" onClick={openCreateModal}>
                {text.addDevice}
              </button>
            ) : null}
          </div>
        </div>
        <div className="table-wrap">
          <table className={`data-table ${isAdmin ? '' : 'data-table--readonly'}`.trim()}>
            <thead>
              <tr>
                <th>{text.name}</th>
                <th>IP</th>
                <th>{text.type}</th>
                <th>{text.location}</th>
                <th>{text.source}</th>
                <th>{text.status}</th>
                {isAdmin ? <th className="data-table__actions-column">{text.actions}</th> : null}
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
                  <td><span className={`status-pill status-pill--${item.status}`}>{text.statusLabels[item.status]}</span></td>
                  {isAdmin ? (
                    <td className="data-table__actions-column">
                      <div className="table-actions">
                        <button type="button" className="ghost-button" onClick={() => openEditModal(item)}>
                          {text.edit}
                        </button>
                        <button type="button" className="danger-button" disabled={isDeleting} onClick={() => setDeviceToDelete(item)}>
                          {text.delete}
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
            <button type="button" className="icon-close-button" aria-label={text.closeDialog} onClick={resetModal}>×</button>
            <div className="modal-card__header">
              <div>
                <h3>{modalMode === 'edit' ? text.editTitle : text.createTitle}</h3>
                <p>{modalMode === 'edit' ? text.editSubtitle : text.createSubtitle}</p>
              </div>
            </div>

            <div className="form-grid">
              <label className="field"><span>{text.deviceName}</span><input value={formState.name} onChange={(event) => setFormState((prev) => ({ ...prev, name: event.target.value }))} placeholder={text.namePlaceholder} /></label>
              <label className="field"><span>{text.ipAddress}</span><input value={formState.ipAddress} onChange={(event) => setFormState((prev) => ({ ...prev, ipAddress: event.target.value }))} placeholder={text.ipPlaceholder} /></label>
              <label className="field"><span>{text.deviceType}</span><input value={formState.deviceType} onChange={(event) => setFormState((prev) => ({ ...prev, deviceType: event.target.value }))} placeholder={text.typePlaceholder} /></label>
              <label className="field"><span>{text.vendor}</span><input value={formState.vendor} onChange={(event) => setFormState((prev) => ({ ...prev, vendor: event.target.value }))} placeholder={text.vendorPlaceholder} /></label>
              <label className="field"><span>{text.model}</span><input value={formState.model} onChange={(event) => setFormState((prev) => ({ ...prev, model: event.target.value }))} placeholder={text.modelPlaceholder} /></label>
              <label className="field field--wide"><span>{text.siteLocation}</span><input value={formState.location} onChange={(event) => setFormState((prev) => ({ ...prev, location: event.target.value }))} placeholder={text.locationPlaceholder} /></label>
              <label className="field field--wide"><span>{text.description}</span><textarea rows={3} value={formState.description} onChange={(event) => setFormState((prev) => ({ ...prev, description: event.target.value }))} placeholder={text.descriptionPlaceholder} /></label>
            </div>

            {formError ? <div className="form-error">{formError}</div> : null}

            <div className="modal-card__actions">
              <button type="button" className="ghost-button" onClick={resetModal}>{text.cancel}</button>
              <button type="button" className="primary-button" disabled={isSubmitting} onClick={handleSubmitDevice}>{isSubmitting ? text.saving : modalMode === 'edit' ? text.saveChanges : text.saveDevice}</button>
            </div>
          </div>
        </div>
      ) : null}
      {deviceToDelete ? (
        <ConfirmDialog
          title={text.deleteTitle}
          message={text.deleteMessage(deviceToDelete.name)}
          confirmLabel={text.deleteConfirm}
          tone="danger"
          onConfirm={() => handleDeleteDevice(deviceToDelete.id)}
          onCancel={() => setDeviceToDelete(null)}
        />
      ) : null}
      {deleteError ? (
        <ConfirmDialog
          title={text.deleteErrorTitle}
          message={deleteError}
          confirmLabel={text.understood}
          cancelLabel={text.close}
          tone="default"
          onConfirm={() => setDeleteError('')}
          onCancel={() => setDeleteError('')}
        />
      ) : null}
    </>
  );
}
