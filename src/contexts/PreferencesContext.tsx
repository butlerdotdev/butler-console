// Copyright 2026 The Butler Authors.
// SPDX-License-Identifier: Apache-2.0

import { createContext, useContext, useState, useCallback, type ReactNode } from 'react'

export interface Preferences {
	defaultView: 'team' | 'admin' | 'last'
	terminalFontSize: number
	timezone: string
	dateFormat: '12h' | '24h'
}

const STORAGE_KEY = 'butler-preferences'

const defaults: Preferences = {
	defaultView: 'last',
	terminalFontSize: 14,
	timezone: Intl.DateTimeFormat().resolvedOptions().timeZone,
	dateFormat: '12h',
}

function loadPreferences(): Preferences {
	try {
		const stored = localStorage.getItem(STORAGE_KEY)
		if (!stored) return defaults
		return { ...defaults, ...JSON.parse(stored) }
	} catch {
		return defaults
	}
}

interface PreferencesContextValue {
	preferences: Preferences
	updatePreference: <K extends keyof Preferences>(key: K, value: Preferences[K]) => void
	resetPreferences: () => void
}

const PreferencesContext = createContext<PreferencesContextValue | undefined>(undefined)

export function PreferencesProvider({ children }: { children: ReactNode }) {
	const [preferences, setPreferences] = useState<Preferences>(loadPreferences)

	const updatePreference = useCallback(<K extends keyof Preferences>(key: K, value: Preferences[K]) => {
		setPreferences(prev => {
			const next = { ...prev, [key]: value }
			localStorage.setItem(STORAGE_KEY, JSON.stringify(next))
			return next
		})
	}, [])

	const resetPreferences = useCallback(() => {
		setPreferences(defaults)
		localStorage.removeItem(STORAGE_KEY)
	}, [])

	return (
		<PreferencesContext.Provider value={{ preferences, updatePreference, resetPreferences }}>
			{children}
		</PreferencesContext.Provider>
	)
}

export function usePreferences() {
	const context = useContext(PreferencesContext)
	if (!context) {
		throw new Error('usePreferences must be used within a PreferencesProvider')
	}
	return context
}

export function formatTimestamp(date: string | Date, preferences: Preferences): string {
	const d = typeof date === 'string' ? new Date(date) : date
	return d.toLocaleString(undefined, {
		timeZone: preferences.timezone,
		hour12: preferences.dateFormat === '12h',
	})
}
