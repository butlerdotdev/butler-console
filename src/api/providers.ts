// Copyright 2025 The Butler Authors.
// SPDX-License-Identifier: Apache-2.0

import { apiClient } from './client'

export interface Provider {
	metadata: {
		name: string
		namespace: string
		uid?: string
		creationTimestamp?: string
	}
	spec: {
		provider: string
		credentialsRef?: {
			name: string
			namespace?: string
			key?: string
		}
		nutanix?: {
			endpoint?: string
			port?: number
			insecure?: boolean
		}
		proxmox?: {
			endpoint?: string
			insecure?: boolean
			nodes?: string[]
		}
	}
	status?: {
		validated?: boolean
		lastValidationTime?: string
		conditions?: Array<{
			type: string
			status: string
			reason: string
			message: string
		}>
	}
}

export interface ProviderListResponse {
	providers: Provider[]
}

export interface ValidateResponse {
	valid: boolean
	message: string
}

export interface CreateProviderRequest {
	name: string
	namespace?: string
	provider: 'harvester' | 'nutanix' | 'proxmox'
	// Harvester
	harvesterKubeconfig?: string
	// Nutanix
	nutanixEndpoint?: string
	nutanixPort?: number
	nutanixUsername?: string
	nutanixPassword?: string
	nutanixInsecure?: boolean
	// Proxmox
	proxmoxEndpoint?: string
	proxmoxUsername?: string
	proxmoxPassword?: string
	proxmoxTokenId?: string
	proxmoxTokenSecret?: string
	proxmoxInsecure?: boolean
}

export interface ImageInfo {
	name: string
	id: string
	description?: string
	os?: string
}

export interface ImageListResponse {
	images: ImageInfo[]
}

export interface NetworkInfo {
	name: string
	id: string
	vlan?: number
	description?: string
}

export interface NetworkListResponse {
	networks: NetworkInfo[]
}

export const providersApi = {
	async list(): Promise<ProviderListResponse> {
		return apiClient.get<ProviderListResponse>('/providers')
	},

	async get(namespace: string, name: string): Promise<Provider> {
		return apiClient.get<Provider>(`/providers/${namespace}/${name}`)
	},

	async create(data: CreateProviderRequest): Promise<Provider> {
		return apiClient.post<Provider>('/providers', data)
	},

	async delete(namespace: string, name: string): Promise<void> {
		return apiClient.delete(`/providers/${namespace}/${name}`)
	},

	async validate(namespace: string, name: string): Promise<ValidateResponse> {
		return apiClient.post<ValidateResponse>(`/providers/${namespace}/${name}/validate`, {})
	},

	async testConnection(data: CreateProviderRequest): Promise<ValidateResponse> {
		return apiClient.post<ValidateResponse>('/providers/test', data)
	},

	async listImages(namespace: string, name: string): Promise<ImageListResponse> {
		return apiClient.get<ImageListResponse>(`/providers/${namespace}/${name}/images`)
	},

	async listNetworks(namespace: string, name: string): Promise<NetworkListResponse> {
		return apiClient.get<NetworkListResponse>(`/providers/${namespace}/${name}/networks`)
	},
}
