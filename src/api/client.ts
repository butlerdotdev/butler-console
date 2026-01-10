// Copyright 2025 The Butler Authors.
// SPDX-License-Identifier: Apache-2.0

const API_BASE = '/api'

class ApiClient {
	private async request<T>(
		method: string,
		path: string,
		body?: unknown
	): Promise<T> {
		const url = `${API_BASE}${path}`
		const options: RequestInit = {
			method,
			headers: {
				'Content-Type': 'application/json',
			},
			credentials: 'include',
		}

		if (body) {
			options.body = JSON.stringify(body)
		}

		const response = await fetch(url, options)

		if (!response.ok) {
			const error = await response.json().catch(() => ({ error: 'Request failed' }))
			throw new Error(error.error || `HTTP ${response.status}`)
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
