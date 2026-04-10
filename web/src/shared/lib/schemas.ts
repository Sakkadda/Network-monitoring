import { z } from 'zod';

export const deviceSchema = z.object({
  id: z.number(),
  name: z.string(),
  ipAddress: z.string(),
  deviceType: z.string(),
  vendor: z.string(),
  model: z.string(),
  location: z.string(),
  description: z.string(),
  status: z.enum(['online', 'warning', 'offline', 'unknown']),
  dataSource: z.enum(['manual', 'simulated', 'agent']),
  isActive: z.boolean(),
  lastCheckedAt: z.string().datetime({ offset: true }).optional().or(z.literal('')).or(z.null()).transform((value) => value ?? ''),
  createdAt: z.string().datetime({ offset: true }),
  updatedAt: z.string().datetime({ offset: true }),
});

export const metricSchema = z.object({
  id: z.number(),
  deviceId: z.number(),
  metricType: z.enum(['ping_latency', 'packet_loss', 'cpu_usage', 'memory_usage', 'uptime']),
  value: z.number(),
  unit: z.string(),
  status: z.enum(['normal', 'warning', 'critical']),
  dataSource: z.enum(['manual', 'simulated', 'collected']),
  collectedAt: z.string().datetime({ offset: true }),
  createdAt: z.string().datetime({ offset: true }),
});

export const logSchema = z.object({
  id: z.number(),
  deviceId: z.number().nullable().optional(),
  level: z.enum(['info', 'warning', 'error', 'audit']),
  action: z.string(),
  message: z.string(),
  actorRole: z.enum(['system', 'admin']),
  actorName: z.string(),
  source: z.string(),
  metadata: z.unknown(),
  createdAt: z.string().datetime({ offset: true }),
});

export const dataEnvelope = <T extends z.ZodTypeAny>(schema: T) => z.object({ data: z.array(schema) });
export const singleDataEnvelope = <T extends z.ZodTypeAny>(schema: T) => z.object({ data: schema });

export const createDevicePayloadSchema = z.object({
  name: z.string().min(2),
  ipAddress: z.string().min(7),
  deviceType: z.string().min(2),
  vendor: z.string(),
  model: z.string(),
  location: z.string(),
  description: z.string(),
  dataSource: z.enum(['manual', 'simulated', 'agent']),
  isActive: z.boolean(),
});

export const updateDevicePayloadSchema = z.object({
  name: z.string().min(2),
  ipAddress: z.string().min(7),
  deviceType: z.string().min(2),
  vendor: z.string(),
  model: z.string(),
  location: z.string(),
  description: z.string(),
  status: z.enum(['online', 'warning', 'offline', 'unknown']),
  dataSource: z.enum(['manual', 'simulated', 'agent']),
  isActive: z.boolean(),
});

export type Device = z.infer<typeof deviceSchema>;
export type Metric = z.infer<typeof metricSchema>;
export type LogEntry = z.infer<typeof logSchema>;
export type CreateDevicePayload = z.infer<typeof createDevicePayloadSchema>;
export type UpdateDevicePayload = z.infer<typeof updateDevicePayloadSchema>;
