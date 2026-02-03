// Copyright 2025 The Butler Authors.
// SPDX-License-Identifier: Apache-2.0

const API_BASE = '/api'

/**
 * Custom error class that includes HTTP status code
 */
export class ApiError extends Error {
	status: number

	constructor(message: string, status: number) {
		super(message)
		this.name = 'ApiError'
		this.status = status
	}
}

class ApiClient {
	private currentTeam: string | null = null

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
			const error = await response.json().catch(() => ({ error: 'Request failed' }))
			// Include status code in error for proper handling
			throw new ApiError(error.error || `HTTP ${response.status}`, response.status)
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
