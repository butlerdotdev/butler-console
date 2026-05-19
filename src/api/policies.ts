// Copyright 2026 The Butler Authors.
// SPDX-License-Identifier: Apache-2.0

// ClusterCreationPolicy admin API client (ADR-018).
// Endpoints live under /admin/policies on butler-server.

import { apiClient } from './client'

export type PolicyOptionType = 'image' | 'network' | 'cluster' | 'storageContainer'
export type PolicyOptionMode = 'pin' | 'allowList' | 'default' | 'recommended'

export interface PolicyOptionRule {
	mode: PolicyOptionMode
	values?: string[]
	default?: string
	recommendedReason?: string
}

export interface PolicyScope {
	platformWide?: Record<string, never>
	team?: { teamRef: { name: string } }
	teamAndEnvironment?: { teamRef: { name: string }; environmentName: string }
}

export interface ClusterCreationPolicy {
	apiVersion?: string
	kind?: string
	metadata: {
		name: string
		uid?: string
		resourceVersion?: string
		creationTimestamp?: string
	}
	spec: {
		scope: PolicyScope
		targetProviders?: string[]
		options?: Partial<Record<PolicyOptionType, PolicyOptionRule>>
	}
	status?: {
		conditions?: Array<{ type: string; status: string; reason?: string; message?: string }>
		staleReferences?: string[]
	}
}

export interface PolicyListResponse {
	policies: ClusterCreationPolicy[]
	count: number
}

// WebhookError is the structured 403 the server emits when the admission
// webhook denies the request. butler-server's writeWebhookError populates
// this shape; the admin pages render the message inline against the named
// field.
export interface WebhookError {
	error: string
	reason: 'webhook-denied'
	message: string
	field?: string
}

export const policiesApi = {
	async list(): Promise<PolicyListResponse> {
		return apiClient.get<PolicyListResponse>('/admin/policies')
	},

	async get(name: string): Promise<ClusterCreationPolicy> {
		return apiClient.get<ClusterCreationPolicy>(`/admin/policies/${encodeURIComponent(name)}`)
	},

	async create(policy: ClusterCreationPolicy): Promise<ClusterCreationPolicy> {
		return apiClient.post<ClusterCreationPolicy>('/admin/policies', policy)
	},

	async update(name: string, policy: ClusterCreationPolicy): Promise<ClusterCreationPolicy> {
		return apiClient.put<ClusterCreationPolicy>(`/admin/policies/${encodeURIComponent(name)}`, policy)
	},

	async delete(name: string): Promise<void> {
		return apiClient.delete(`/admin/policies/${encodeURIComponent(name)}`)
	},
}
