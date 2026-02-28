// Copyright 2026 The Butler Authors.
// SPDX-License-Identifier: Apache-2.0

import { apiClient } from './client'
import type {
  ObservabilityConfig,
  ObservabilityStatus,
  UpdateObservabilityConfigRequest,
  SetupPipelineRequest,
} from '@/types/observability'

export const observabilityApi = {
  async getConfig(): Promise<ObservabilityConfig> {
    return apiClient.get<ObservabilityConfig>('/observability/config')
  },

  async updateConfig(data: UpdateObservabilityConfigRequest): Promise<ObservabilityConfig> {
    return apiClient.put<ObservabilityConfig>('/admin/observability/config', data)
  },

  async getStatus(): Promise<ObservabilityStatus> {
    return apiClient.get<ObservabilityStatus>('/admin/observability/status')
  },

  async setupPipeline(data: SetupPipelineRequest): Promise<ObservabilityConfig> {
    return apiClient.post<ObservabilityConfig>('/admin/observability/pipeline/setup', data)
  },

  async deregisterPipeline(): Promise<ObservabilityConfig> {
    return apiClient.delete<ObservabilityConfig>('/admin/observability/pipeline')
  },
}
