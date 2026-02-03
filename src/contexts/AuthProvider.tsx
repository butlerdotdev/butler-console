// Copyright 2026 The Butler Authors.
// SPDX-License-Identifier: Apache-2.0

import { useEffect, useState, useCallback, type ReactNode } from 'react'
import { AuthContext, type User, type Provider } from './AuthContext'

interface AuthState {
	user: User | null
	isAuthenticated: boolean
	isLoading: boolean
	providers: Provider[]
}

export function AuthProvider({ children }: { children: ReactNode }) {
	const [state, setState] = useState<AuthState>({
		user: null,
		isAuthenticated: false,
		isLoading: true,
		providers: [],
	})

	// Fetch current user
	const checkAuth = useCallback(async () => {
		try {
			const response = await fetch('/api/auth/me', {
				credentials: 'include',
			})

			if (response.ok) {
				const user = await response.json()
				setState(prev => ({
					...prev,
					user,
					isAuthenticated: true,
					isLoading: false,
				}))
			} else {
				setState(prev => ({
					...prev,
					user: null,
					isAuthenticated: false,
					isLoading: false,
				}))
			}
		} catch {
			setState(prev => ({
				...prev,
				user: null,
				isAuthenticated: false,
				isLoading: false,
			}))
		}
	}, [])

	// Fetch available providers
	const fetchProviders = useCallback(async () => {
		try {
			const response = await fetch('/api/auth/providers', {
				credentials: 'include',
			})

			if (response.ok) {
				const data = await response.json()
				setState(prev => ({
					...prev,
					providers: data.providers || [],
				}))
			}
		} catch {
			// Silently fail - providers will remain empty
		}
	}, [])

	useEffect(() => {
		checkAuth()
		fetchProviders()
	}, [checkAuth, fetchProviders])

	// SSO login - redirect to provider
	const login = useCallback((providerLoginUrl?: string) => {
		if (providerLoginUrl) {
			window.location.href = providerLoginUrl
		} else if (state.providers.length > 0) {
			window.location.href = state.providers[0].loginUrl
		}
	}, [state.providers])

	// Legacy/internal login - username/password
	const legacyLogin = useCallback(async (username: string, password: string) => {
		const response = await fetch('/api/auth/login', {
			method: 'POST',
			headers: {
				'Content-Type': 'application/json',
			},
			credentials: 'include',
			body: JSON.stringify({ username, password }),
		})

		if (!response.ok) {
			const data = await response.json()
			throw new Error(data.error || 'Login failed')
		}

		const data = await response.json()
		setState(prev => ({
			...prev,
			user: data.user,
			isAuthenticated: true,
		}))
	}, [])

	// Logout
	const logout = useCallback(async () => {
		try {
			await fetch('/api/auth/logout', {
				method: 'POST',
				credentials: 'include',
			})
		} finally {
			setState(prev => ({
				...prev,
				user: null,
				isAuthenticated: false,
			}))
		}
	}, [])

	// Refresh user data (just re-fetches current session state)
	const refreshUser = useCallback(async () => {
		await checkAuth()
	}, [checkAuth])

	// Refresh permissions - re-resolves team memberships on the server and updates session
	const refreshPermissions = useCallback(async (): Promise<{ success: boolean; message?: string }> => {
		try {
			const response = await fetch('/api/auth/refresh-permissions', {
				method: 'POST',
				credentials: 'include',
			})

			if (!response.ok) {
				const data = await response.json()
				return { success: false, message: data.error || 'Failed to refresh permissions' }
			}

			// Re-fetch user data to update local state with new permissions
			await checkAuth()

			return { success: true, message: 'Permissions refreshed successfully' }
		} catch {
			return { success: false, message: 'Failed to refresh permissions' }
		}
	}, [checkAuth])

	return (
		<AuthContext.Provider
			value={{
				...state,
				login,
				legacyLogin,
				logout,
				refreshUser,
				refreshPermissions,
			}}
		>
			{children}
		</AuthContext.Provider>
	)
}
