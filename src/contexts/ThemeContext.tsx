// Copyright 2026 The Butler Authors.
// SPDX-License-Identifier: Apache-2.0

import { createContext, useContext, useEffect, useState, type ReactNode } from 'react'

export type ThemeMode = 'light' | 'dark'
export type ColorMode = 'default' | 'deuteranopia' | 'protanopia' | 'tritanopia'

interface ThemeContextValue {
	theme: ThemeMode
	colorMode: ColorMode
	setTheme: (theme: ThemeMode) => void
	setColorMode: (mode: ColorMode) => void
}

const ThemeContext = createContext<ThemeContextValue | undefined>(undefined)

const THEME_KEY = 'butler-theme'
const COLOR_MODE_KEY = 'butler-color-mode'

export function ThemeProvider({ children }: { children: ReactNode }) {
	const [theme, setThemeState] = useState<ThemeMode>(() => {
		if (typeof window === 'undefined') return 'dark'
		const stored = localStorage.getItem(THEME_KEY)
		if (stored === 'light' || stored === 'dark') return stored
		return 'dark'
	})

	const [colorMode, setColorModeState] = useState<ColorMode>(() => {
		if (typeof window === 'undefined') return 'default'
		const stored = localStorage.getItem(COLOR_MODE_KEY)
		if (stored === 'deuteranopia' || stored === 'protanopia' || stored === 'tritanopia') {
			return stored
		}
		return 'default'
	})

	const setTheme = (newTheme: ThemeMode) => {
		setThemeState(newTheme)
		localStorage.setItem(THEME_KEY, newTheme)
	}

	const setColorMode = (mode: ColorMode) => {
		setColorModeState(mode)
		localStorage.setItem(COLOR_MODE_KEY, mode)
	}

	// No cleanup needed — classList add/remove are idempotent.
	useEffect(() => {
		const root = document.documentElement

		// Apply theme class
		root.classList.remove('light', 'dark')
		root.classList.add(theme)

		// Apply color mode class
		root.classList.remove('colorblind-deuteranopia', 'colorblind-protanopia', 'colorblind-tritanopia')
		if (colorMode !== 'default') {
			root.classList.add(`colorblind-${colorMode}`)
		}
	}, [theme, colorMode])

	return (
		<ThemeContext.Provider value={{ theme, colorMode, setTheme, setColorMode }}>
			{children}
		</ThemeContext.Provider>
	)
}

export function useTheme() {
	const context = useContext(ThemeContext)
	if (!context) {
		throw new Error('useTheme must be used within a ThemeProvider')
	}
	return context
}
