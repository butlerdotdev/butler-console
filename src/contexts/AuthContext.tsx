// Copyright 2026 The Butler Authors.
// SPDX-License-Identifier: Apache-2.0

import { createContext } from 'react'

export interface User {
	email: string
	name: string
	picture?: string
	teams: TeamMembership[]
	role?: string
	isAdmin?: boolean
	isPlatformAdmin?: boolean
	provider?: string
}

export interface TeamMembership {
	name: string
	displayName?: string
	role: string
	metadata?: { name?: string }
	spec?: { displayName?: string }
}

export interface Provider {
	name: string
	type: string
	loginUrl: string
	buttonLabel?: string
}

export type IdentityProvider = Provider

interface AuthState {
	user: User | null
	isAuthenticated: boolean
	isLoading: boolean
	providers: Provider[]
}

export interface AuthContextValue extends AuthState {
	login: (providerLoginUrl?: string) => void
	legacyLogin: (username: string, password: string) => Promise<void>
	logout: () => Promise<void>
	refreshUser: () => Promise<void>
	refreshPermissions: () => Promise<{ success: boolean; message?: string }>
}

export const AuthContext = createContext<AuthContextValue | null>(null)
