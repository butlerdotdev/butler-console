// Copyright 2026 The Butler Authors.
// SPDX-License-Identifier: Apache-2.0

import { apiClient } from './client'
import type { User, TeamMembership, IdentityProvider } from '@/contexts/AuthContext'

export type { User, TeamMembership, IdentityProvider }

interface LoginResponse {
	user: User
}

interface ProvidersResponse {
	providers: IdentityProvider[]
}

interface LegacyLoginCredentials {
	username: string
	password: string
}

export const authApi = {
	/**
	 * Get available identity providers
	 */
	async getProviders(): Promise<ProvidersResponse> {
		return apiClient.get<ProvidersResponse>('/auth/providers')
	},

	/**
	 * Legacy login for development (when OIDC not configured)
	 */
	async legacyLogin(credentials: LegacyLoginCredentials): Promise<LoginResponse> {
		return apiClient.post<LoginResponse>('/auth/login/legacy', credentials)
	},

	/**
	 * Logout the current user
	 */
	async logout(): Promise<void> {
		return apiClient.post('/auth/logout')
	},

	/**
	 * Get the current user's information
	 */
	async me(): Promise<User> {
		return apiClient.get<User>('/auth/me')
	},

	/**
	 * Refresh the session token
	 */
	async refresh(): Promise<LoginResponse> {
		return apiClient.post<LoginResponse>('/auth/refresh')
	},

	/**
	 * Get the current user's teams with details
	 */
	async getTeams(): Promise<{ teams: TeamInfo[] }> {
		return apiClient.get<{ teams: TeamInfo[] }>('/auth/teams')
	},
}

// Extended team info from API
export interface TeamInfo {
	name: string
	displayName: string
	role: string
	clusterCount: number
}
