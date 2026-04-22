// Copyright 2025 The Butler Authors.
// SPDX-License-Identifier: Apache-2.0

import type { Config } from 'tailwindcss'

// Uses --bc- prefix (butler-console) to avoid collision with Tailwind's internal --tw-* vars.
// IMPORTANT: Only shades listed here are theme-aware. If you use a new shade (e.g., red-100)
// in a component, add it here AND define it in src/index.css (:root, .light, colorblind blocks).
// Un-overridden shades fall through to Tailwind's hardcoded defaults and won't flip with theme.
function v(name: string) {
	return `rgb(var(--bc-${name}) / <alpha-value>)`
}

export default {
	content: ['./index.html', './src/**/*.{js,ts,jsx,tsx}'],
	theme: {
		extend: {
			colors: {
				neutral: {
					50: v('neutral-50'),
					100: v('neutral-100'),
					200: v('neutral-200'),
					300: v('neutral-300'),
					400: v('neutral-400'),
					500: v('neutral-500'),
					600: v('neutral-600'),
					700: v('neutral-700'),
					800: v('neutral-800'),
					900: v('neutral-900'),
					950: v('neutral-950'),
				},
				green: {
					200: v('green-200'),
					300: v('green-300'),
					400: v('green-400'),
					500: v('green-500'),
					600: v('green-600'),
					700: v('green-700'),
					900: v('green-900'),
				},
				red: {
					200: v('red-200'),
					300: v('red-300'),
					400: v('red-400'),
					500: v('red-500'),
					600: v('red-600'),
					700: v('red-700'),
					900: v('red-900'),
				},
				blue: {
					200: v('blue-200'),
					300: v('blue-300'),
					400: v('blue-400'),
					500: v('blue-500'),
					600: v('blue-600'),
					800: v('blue-800'),
					900: v('blue-900'),
				},
				yellow: {
					50: v('yellow-50'),
					200: v('yellow-200'),
					300: v('yellow-300'),
					400: v('yellow-400'),
					500: v('yellow-500'),
					600: v('yellow-600'),
					800: v('yellow-800'),
					900: v('yellow-900'),
				},
				amber: {
					200: v('amber-200'),
					300: v('amber-300'),
					400: v('amber-400'),
					500: v('amber-500'),
					700: v('amber-700'),
					900: v('amber-900'),
				},
				violet: {
					300: v('violet-300'),
					400: v('violet-400'),
					500: v('violet-500'),
					600: v('violet-600'),
					900: v('violet-900'),
				},
				teal: {
					300: v('teal-300'),
					400: v('teal-400'),
					500: v('teal-500'),
					600: v('teal-600'),
				},
				emerald: {
					400: v('emerald-400'),
					500: v('emerald-500'),
					600: v('emerald-600'),
					700: v('emerald-700'),
					900: v('emerald-900'),
				},
				orange: {
					400: v('orange-400'),
					500: v('orange-500'),
				},
				// Env accents. Per-mode values in index.css under --bc-env-N-*.
				// Tol bright (dark mode) and darker Tol-family (light mode).
				'env-1': { 300: v('env-1-300'), 500: v('env-1-500') },
				'env-2': { 300: v('env-2-300'), 500: v('env-2-500') },
				'env-3': { 300: v('env-3-300'), 500: v('env-3-500') },
				'env-4': { 300: v('env-4-300'), 500: v('env-4-500') },
				'env-5': { 300: v('env-5-300'), 500: v('env-5-500') },
			},
			gridTemplateColumns: {
				'16': 'repeat(16, minmax(0, 1fr))',
			},
			fontFamily: {
				sans: ['Inter', 'system-ui', 'sans-serif'],
				mono: ['JetBrains Mono', 'monospace'],
			},
		},
	},
	plugins: [],
} satisfies Config
