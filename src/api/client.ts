// Copyright 2026 The Butler Authors.
// SPDX-License-Identifier: Apache-2.0

const API_BASE = '/api'

/**
 * Custom error class that includes HTTP status code
 */
export class ApiError extends Error {
	status: number
	body: Record<string, unknown> | null

	constructor(message: string, status: number, body?: Record<string, unknown>) {
		super(message)
		this.name = 'ApiError'
		this.status = status
		this.body = body ?? null
	}
}

class ApiClient {
	private currentTeam: string | null = null
	private currentEnvironment: string | null = null

	/**
	 * Set the current team context for authorization.
	 * When set, all requests will include X-Butler-Team header.
	 * This allows the backend to enforce team-scoped permissions.
	 */
	setTeam(team: string | null) {
		this.currentTeam = team
	}

	/**
	 * Get the current team context.
	 */
	getTeam(): string | null {
		return this.currentTeam
	}

	/**
	 * Set the current environment context for team-env scoping.
	 * When set, all requests will include X-Butler-Environment header.
	 * The server reads this header and (per ADR-009/ADR-010) stamps the
	 * env label on created TenantClusters and scopes list responses to
	 * matching env-labeled resources.
	 */
	setEnvironment(env: string | null) {
		this.currentEnvironment = env && env.length > 0 ? env : null
	}

	/**
	 * Get the current environment context. Returns null when no env is
	 * selected ("All environments" state).
	 */
	getEnvironment(): string | null {
		return this.currentEnvironment
	}

	private async request<T>(
		method: string,
		path: string,
		body?: unknown
	): Promise<T> {
		const url = `${API_BASE}${path}`
		const headers: Record<string, string> = {
			'Content-Type': 'application/json',
		}

		// Include team context header when a team is selected
		if (this.currentTeam) {
			headers['X-Butler-Team'] = this.currentTeam
		}

		// Include environment context header when an env is selected.
		// The server only reads this header when a team scope is also
		// present; sending it on team-less requests is a no-op.
		if (this.currentEnvironment) {
			headers['X-Butler-Environment'] = this.currentEnvironment
		}

		const options: RequestInit = {
			method,
			headers,
			credentials: 'include',
		}

		if (body) {
			options.body = JSON.stringify(body)
		}

		const response = await fetch(url, options)

		if (!response.ok) {
			const body = await response.json().catch(() => ({ error: 'Request failed' }))
			throw new ApiError(body.error || `HTTP ${response.status}`, response.status, body)
		}

		return response.json()
	}

	async get<T>(path: string): Promise<T> {
		return this.request<T>('GET', path)
	}

	async post<T>(path: string, body?: unknown): Promise<T> {
		return this.request<T>('POST', path, body)
	}

	async put<T>(path: string, body?: unknown): Promise<T> {
		return this.request<T>('PUT', path, body)
	}

	async patch<T>(path: string, body?: unknown): Promise<T> {
		return this.request<T>('PATCH', path, body)
	}

	async delete<T>(path: string): Promise<T> {
		return this.request<T>('DELETE', path)
	}
}

export const apiClient = new ApiClient()
