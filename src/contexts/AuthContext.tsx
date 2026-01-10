// Copyright 2025 The Butler Authors.
// SPDX-License-Identifier: Apache-2.0

import { createContext, useContext, useEffect, useState, type ReactNode } from 'react'
import { authApi } from '@/api'
import type { LoginCredentials, AuthState } from '@/types'

interface AuthContextValue extends AuthState {
	login: (credentials: LoginCredentials) => Promise<void>
	logout: () => Promise<void>
}

const AuthContext = createContext<AuthContextValue | null>(null)

export function useAuth() {
	const context = useContext(AuthContext)
	if (!context) {
		throw new Error('useAuth must be used within an AuthProvider')
	}
	return context
}

export function AuthProvider({ children }: { children: ReactNode }) {
	const [state, setState] = useState<AuthState>({
		user: null,
		isAuthenticated: false,
		isLoading: true,
	})

	useEffect(() => {
		checkAuth()
	}, [])

	const checkAuth = async () => {
		try {
			const user = await authApi.me()
			setState({ user, isAuthenticated: true, isLoading: false })
		} catch {
			setState({ user: null, isAuthenticated: false, isLoading: false })
		}
	}

	const login = async (credentials: LoginCredentials) => {
		const response = await authApi.login(credentials)
		setState({ user: response.user, isAuthenticated: true, isLoading: false })
	}

	const logout = async () => {
		try {
			await authApi.logout()
		} finally {
			setState({ user: null, isAuthenticated: false, isLoading: false })
		}
	}

	return (
		<AuthContext.Provider value={{ ...state, login, logout }}>
			{children}
		</AuthContext.Provider>
	)
}
