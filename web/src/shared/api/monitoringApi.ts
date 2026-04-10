import { createApi, fetchBaseQuery } from '@reduxjs/toolkit/query/react';

import {
  createDevicePayloadSchema,
  dataEnvelope,
  deviceSchema,
  logSchema,
  metricSchema,
  singleDataEnvelope,
  type CreateDevicePayload,
  type Device,
  type LogEntry,
  type Metric,
  type UpdateDevicePayload,
  updateDevicePayloadSchema,
} from '../lib/schemas';

const devicesResponseSchema = dataEnvelope(deviceSchema);
const metricsResponseSchema = dataEnvelope(metricSchema);
const logsResponseSchema = dataEnvelope(logSchema);
const singleDeviceResponseSchema = singleDataEnvelope(deviceSchema);

export const LIVE_REFETCH_MS = 5000;

export const monitoringApi = createApi({
  reducerPath: 'monitoringApi',
  baseQuery: fetchBaseQuery({ baseUrl: '/api/v1' }),
  tagTypes: ['Devices', 'Metrics', 'Logs'],
  endpoints: (builder) => ({
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
  }),
});

export const {
  useGetDevicesQuery,
  useGetMetricsQuery,
  useGetLogsQuery,
  useCreateDeviceMutation,
  useUpdateDeviceMutation,
  useDeleteDeviceMutation,
} = monitoringApi;
