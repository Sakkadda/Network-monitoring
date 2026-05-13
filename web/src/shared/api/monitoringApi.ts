import { createApi, fetchBaseQuery } from '@reduxjs/toolkit/query/react';

import {
  createUserPayloadSchema,
  createDevicePayloadSchema,
  dataEnvelope,
  deviceSchema,
  loginPayloadSchema,
  loginResponseSchema,
  logSchema,
  metricSchema,
  sessionUserSchema,
  simulatorSettingsSchema,
  singleDataEnvelope,
  updateOwnProfilePayloadSchema,
  updatePasswordPayloadSchema,
  updateUserPayloadSchema,
  type CreateDevicePayload,
  type CreateUserPayload,
  type Device,
  type LoginPayload,
  type LoginResponse,
  type LogEntry,
  type Metric,
  type SessionUser,
  type SimulatorSettings,
  type UpdateOwnProfilePayload,
  type UpdatePasswordPayload,
  type UpdateSimulatorSettingsPayload,
  type UpdateDevicePayload,
  type UpdateUserPayload,
  updateSimulatorSettingsPayloadSchema,
  updateDevicePayloadSchema,
} from '../lib/schemas';

const devicesResponseSchema = dataEnvelope(deviceSchema);
const metricsResponseSchema = dataEnvelope(metricSchema);
const logsResponseSchema = dataEnvelope(logSchema);
const usersResponseSchema = dataEnvelope(sessionUserSchema);
const singleDeviceResponseSchema = singleDataEnvelope(deviceSchema);
const simulatorSettingsResponseSchema = singleDataEnvelope(simulatorSettingsSchema);
const singleUserResponseSchema = singleDataEnvelope(sessionUserSchema);
const loginEnvelopeSchema = singleDataEnvelope(loginResponseSchema);

export const LIVE_REFETCH_MS = 5000;
const authTokenStorageKey = 'network-monitoring-auth-token';

export function getAuthToken() {
  if (typeof window === 'undefined') {
    return '';
  }

  return window.localStorage.getItem(authTokenStorageKey) ?? '';
}

export function setAuthToken(token: string) {
  if (typeof window !== 'undefined') {
    window.localStorage.setItem(authTokenStorageKey, token);
  }
}

export function clearAuthToken() {
  if (typeof window !== 'undefined') {
    window.localStorage.removeItem(authTokenStorageKey);
  }
}

export const monitoringApi = createApi({
  reducerPath: 'monitoringApi',
  baseQuery: fetchBaseQuery({
    baseUrl: '/api/v1',
    prepareHeaders: (headers) => {
      const token = getAuthToken();
      if (token) {
        headers.set('Authorization', `Bearer ${token}`);
      }

      return headers;
    },
  }),
  tagTypes: ['Devices', 'Metrics', 'Logs', 'Users', 'Session'],
  endpoints: (builder) => ({
    login: builder.mutation<LoginResponse, LoginPayload>({
      query: (body) => ({
        url: '/auth/login',
        method: 'POST',
        body: loginPayloadSchema.parse(body),
      }),
      transformResponse: (response: unknown) => loginEnvelopeSchema.parse(response).data,
      invalidatesTags: ['Session'],
    }),
    getMe: builder.query<SessionUser, void>({
      query: () => '/auth/me',
      transformResponse: (response: unknown) => singleUserResponseSchema.parse(response).data,
      providesTags: ['Session'],
    }),
    updateOwnProfile: builder.mutation<SessionUser, UpdateOwnProfilePayload>({
      query: (body) => ({
        url: '/auth/me/profile',
        method: 'PUT',
        body: updateOwnProfilePayloadSchema.parse(body),
      }),
      transformResponse: (response: unknown) => singleUserResponseSchema.parse(response).data,
      invalidatesTags: ['Session', 'Users'],
    }),
    updateOwnPassword: builder.mutation<void, UpdatePasswordPayload>({
      query: (body) => ({
        url: '/auth/me/password',
        method: 'PUT',
        body: updatePasswordPayloadSchema.parse(body),
      }),
    }),
    getUsers: builder.query<SessionUser[], void>({
      query: () => '/users',
      transformResponse: (response: unknown) => usersResponseSchema.parse(response).data,
      providesTags: ['Users'],
    }),
    createUser: builder.mutation<SessionUser, CreateUserPayload>({
      query: (body) => ({
        url: '/users',
        method: 'POST',
        body: createUserPayloadSchema.parse(body),
      }),
      transformResponse: (response: unknown) => singleUserResponseSchema.parse(response).data,
      invalidatesTags: ['Users'],
    }),
    updateUser: builder.mutation<SessionUser, { username: string; payload: UpdateUserPayload }>({
      query: ({ username, payload }) => ({
        url: `/users/${encodeURIComponent(username)}`,
        method: 'PUT',
        body: updateUserPayloadSchema.parse(payload),
      }),
      transformResponse: (response: unknown) => singleUserResponseSchema.parse(response).data,
      invalidatesTags: ['Users', 'Session'],
    }),
    updateUserPassword: builder.mutation<void, { username: string; newPassword: string }>({
      query: ({ username, newPassword }) => ({
        url: `/users/${encodeURIComponent(username)}/password`,
        method: 'PUT',
        body: updatePasswordPayloadSchema.parse({ newPassword }),
      }),
    }),
    deleteUser: builder.mutation<void, string>({
      query: (username) => ({
        url: `/users/${encodeURIComponent(username)}`,
        method: 'DELETE',
      }),
      invalidatesTags: ['Users'],
    }),
    getDevices: builder.query<Device[], void>({
      query: () => '/devices',
      transformResponse: (response: unknown) => devicesResponseSchema.parse(response).data,
      providesTags: ['Devices'],
    }),
    getMetrics: builder.query<Metric[], void>({
      query: () => '/metrics',
      transformResponse: (response: unknown) => metricsResponseSchema.parse(response).data,
      providesTags: ['Metrics'],
    }),
    getLogs: builder.query<LogEntry[], void>({
      query: () => '/logs',
      transformResponse: (response: unknown) => logsResponseSchema.parse(response).data,
      providesTags: ['Logs'],
    }),
    getSimulatorSettings: builder.query<SimulatorSettings, void>({
      query: () => '/simulator/settings',
      transformResponse: (response: unknown) => simulatorSettingsResponseSchema.parse(response).data,
    }),
    createDevice: builder.mutation<Device, CreateDevicePayload>({
      query: (body) => ({ url: '/devices', method: 'POST', body: createDevicePayloadSchema.parse(body) }),
      transformResponse: (response: unknown) => singleDeviceResponseSchema.parse(response).data,
      invalidatesTags: ['Devices'],
    }),
    updateDevice: builder.mutation<Device, { id: number; payload: UpdateDevicePayload }>({
      query: ({ id, payload }) => ({ url: `/devices/${id}`, method: 'PUT', body: updateDevicePayloadSchema.parse(payload) }),
      transformResponse: (response: unknown) => singleDeviceResponseSchema.parse(response).data,
      invalidatesTags: ['Devices'],
    }),
    deleteDevice: builder.mutation<void, number>({
      query: (id) => ({ url: `/devices/${id}`, method: 'DELETE' }),
      invalidatesTags: ['Devices'],
    }),
    updateSimulatorSettings: builder.mutation<SimulatorSettings, UpdateSimulatorSettingsPayload>({
      query: (body) => ({
        url: '/simulator/settings',
        method: 'PUT',
        body: updateSimulatorSettingsPayloadSchema.parse(body),
      }),
      transformResponse: (response: unknown) => simulatorSettingsResponseSchema.parse(response).data,
    }),
    clearLogs: builder.mutation<void, void>({
      query: () => ({ url: '/logs', method: 'DELETE' }),
      invalidatesTags: ['Logs'],
    }),
  }),
});

export const {
  useLoginMutation,
  useGetMeQuery,
  useUpdateOwnProfileMutation,
  useUpdateOwnPasswordMutation,
  useGetUsersQuery,
  useCreateUserMutation,
  useUpdateUserMutation,
  useUpdateUserPasswordMutation,
  useDeleteUserMutation,
  useGetDevicesQuery,
  useGetMetricsQuery,
  useGetLogsQuery,
  useGetSimulatorSettingsQuery,
  useCreateDeviceMutation,
  useUpdateDeviceMutation,
  useDeleteDeviceMutation,
  useUpdateSimulatorSettingsMutation,
  useClearLogsMutation,
} = monitoringApi;
