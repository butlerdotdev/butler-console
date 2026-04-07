// Copyright 2026 The Butler Authors.
// SPDX-License-Identifier: Apache-2.0

import { apiClient } from './client'

export interface AuditEntry {
	timestamp: string
	user: string
	action: string
	resourceType?: string
	resourceName?: string
	resourceNamespace?: string
	teamRef?: string
	httpMethod?: string
	path?: string
	statusCode?: number
	success: boolean
	requestSummary?: string
	errorMessage?: string
	sourceIP?: string
	provider?: string
}

export interface AuditListResponse {
	entries: AuditEntry[]
	total: number
	offset: number
	limit: number
}

export interface AuditFilters {
	user?: string
	action?: string
	resourceType?: string
	success?: string
	from?: string
	to?: string
	limit?: number
	offset?: number
}

function buildQueryString(filters: AuditFilters): string {
	const params = new URLSearchParams()
	if (filters.user) params.set('user', filters.user)
	if (filters.action) params.set('action', filters.action)
	if (filters.resourceType) params.set('resourceType', filters.resourceType)
	if (filters.success) params.set('success', filters.success)
	if (filters.from) params.set('from', filters.from)
	if (filters.to) params.set('to', filters.to)
	if (filters.limit !== undefined) params.set('limit', String(filters.limit))
	if (filters.offset !== undefined) params.set('offset', String(filters.offset))
	const qs = params.toString()
	return qs ? `?${qs}` : ''
}

export const auditApi = {
	async listAll(filters: AuditFilters = {}): Promise<AuditListResponse> {
		return apiClient.get<AuditListResponse>(
			`/admin/audit${buildQueryString(filters)}`
		)
	},

	async listTeam(teamName: string, filters: AuditFilters = {}): Promise<AuditListResponse> {
		return apiClient.get<AuditListResponse>(
			`/teams/${teamName}/audit${buildQueryString(filters)}`
		)
	},
}
