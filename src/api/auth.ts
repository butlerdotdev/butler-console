// Copyright 2025 The Butler Authors.
// SPDX-License-Identifier: Apache-2.0

import { apiClient } from './client'
import type { User, LoginCredentials } from '@/types'

interface LoginResponse {
	token: string
	user: User
}

export const authApi = {
	async login(credentials: LoginCredentials): Promise<LoginResponse> {
		return apiClient.post<LoginResponse>('/auth/login', credentials)
	},

	async logout(): Promise<void> {
		return apiClient.post('/auth/logout')
	},

	async me(): Promise<User> {
		return apiClient.get<User>('/auth/me')
	},

	async refresh(): Promise<LoginResponse> {
		return apiClient.post<LoginResponse>('/auth/refresh')
	},
}
