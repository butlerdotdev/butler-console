// Copyright 2026 The Butler Authors.
// SPDX-License-Identifier: Apache-2.0

import { apiClient } from './client'
import type {
	ImageSync,
	ImageSyncListResponse,
	CreateImageSyncRequest,
	FactoryCatalogEntry,
	FactoryCatalogResponse,
} from '@/types/imagesync'

export const imagesApi = {
	async list(params?: {
		provider?: string
		status?: string
		schematic?: string
	}): Promise<ImageSyncListResponse> {
		const searchParams = new URLSearchParams()
		if (params?.provider) searchParams.set('provider', params.provider)
		if (params?.status) searchParams.set('status', params.status)
		if (params?.schematic) searchParams.set('schematic', params.schematic)
		const queryString = searchParams.toString()
		return apiClient.get<ImageSyncListResponse>(
			`/admin/images${queryString ? `?${queryString}` : ''}`
		)
	},

	async get(namespace: string, name: string): Promise<ImageSync> {
		return apiClient.get<ImageSync>(`/admin/images/${namespace}/${name}`)
	},

	async create(data: CreateImageSyncRequest): Promise<ImageSync> {
		return apiClient.post<ImageSync>('/admin/images', data)
	},

	async delete(namespace: string, name: string): Promise<void> {
		return apiClient.delete(`/admin/images/${namespace}/${name}`)
	},

	async getFactoryCatalog(): Promise<FactoryCatalogEntry[]> {
		const response = await apiClient.get<FactoryCatalogResponse>('/admin/images/catalog')
		return response.entries || []
	},

	async getFactorySchematic(id: string): Promise<Record<string, unknown>> {
		return apiClient.get<Record<string, unknown>>(`/admin/images/schematics/${id}`)
	},
}
