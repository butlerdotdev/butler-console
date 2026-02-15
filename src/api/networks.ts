// Copyright 2026 The Butler Authors.
// SPDX-License-Identifier: Apache-2.0

import { apiClient } from './client'
import type {
	NetworkPool,
	NetworkPoolListResponse,
	IPAllocationListResponse,
	CreateNetworkPoolRequest,
} from '@/types/networks'

export const networksApi = {
	async listPools(): Promise<NetworkPoolListResponse> {
		return apiClient.get<NetworkPoolListResponse>('/admin/networks')
	},

	async getPool(namespace: string, name: string): Promise<NetworkPool> {
		return apiClient.get<NetworkPool>(`/admin/networks/${namespace}/${name}`)
	},

	async createPool(data: CreateNetworkPoolRequest): Promise<NetworkPool> {
		return apiClient.post<NetworkPool>('/admin/networks', data)
	},

	async deletePool(namespace: string, name: string): Promise<void> {
		return apiClient.delete(`/admin/networks/${namespace}/${name}`)
	},

	async listAllocations(namespace: string, name: string): Promise<IPAllocationListResponse> {
		return apiClient.get<IPAllocationListResponse>(`/admin/networks/${namespace}/${name}/allocations`)
	},

	async listAllAllocations(): Promise<IPAllocationListResponse> {
		return apiClient.get<IPAllocationListResponse>('/admin/ipallocations')
	},

	async releaseAllocation(namespace: string, name: string): Promise<void> {
		return apiClient.delete(`/admin/ipallocations/${namespace}/${name}`)
	},
}
