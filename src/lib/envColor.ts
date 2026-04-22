// Copyright 2026 The Butler Authors.
// SPDX-License-Identifier: Apache-2.0

// Deterministic per-env accent palette. Same env name -> same color
// everywhere. Five-color Tol bright family; hex values live in
// index.css under --bc-env-N-* with per-mode light/dark entries.

export interface EnvAccent {
	// Small solid-fill dot (section header pip, dropdown indicator).
	dot: string
	// Thin colored border (cluster card left edge).
	border: string
	// Tinted pill background + text for "selected" treatments.
	pillBg: string
	pillText: string
	// Tinted square for the EnvSwitcher dropdown icon slot.
	iconBg: string
	iconText: string
	// Very subtle header tint for sticky section banners.
	headerTint: string
}

// Class names are listed as string literals so Tailwind JIT can detect them.
const PALETTE: EnvAccent[] = [
	{ dot: 'bg-env-1-500', border: 'border-l-env-1-500', pillBg: 'bg-env-1-500/20', pillText: 'text-env-1-300', iconBg: 'bg-env-1-500/30', iconText: 'text-env-1-300', headerTint: 'bg-env-1-500/5' },
	{ dot: 'bg-env-2-500', border: 'border-l-env-2-500', pillBg: 'bg-env-2-500/20', pillText: 'text-env-2-300', iconBg: 'bg-env-2-500/30', iconText: 'text-env-2-300', headerTint: 'bg-env-2-500/5' },
	{ dot: 'bg-env-3-500', border: 'border-l-env-3-500', pillBg: 'bg-env-3-500/20', pillText: 'text-env-3-300', iconBg: 'bg-env-3-500/30', iconText: 'text-env-3-300', headerTint: 'bg-env-3-500/5' },
	{ dot: 'bg-env-4-500', border: 'border-l-env-4-500', pillBg: 'bg-env-4-500/20', pillText: 'text-env-4-300', iconBg: 'bg-env-4-500/30', iconText: 'text-env-4-300', headerTint: 'bg-env-4-500/5' },
	{ dot: 'bg-env-5-500', border: 'border-l-env-5-500', pillBg: 'bg-env-5-500/20', pillText: 'text-env-5-300', iconBg: 'bg-env-5-500/30', iconText: 'text-env-5-300', headerTint: 'bg-env-5-500/5' },
]

// "No environment" / orphan sections. Uses neutral-* so it participates
// in light/dark but doesn't compete with the five env slots.
export const NEUTRAL_ACCENT: EnvAccent = {
	dot: 'bg-neutral-500',
	border: 'border-l-neutral-700',
	pillBg: 'bg-neutral-700/30',
	pillText: 'text-neutral-300',
	iconBg: 'bg-neutral-700',
	iconText: 'text-neutral-400',
	headerTint: 'bg-neutral-800/30',
}

// Stable hash of env name -> palette slot.
export function envAccent(name: string | null | undefined): EnvAccent {
	if (!name) return NEUTRAL_ACCENT
	let sum = 0
	for (let i = 0; i < name.length; i++) {
		sum = (sum + name.charCodeAt(i)) % 997
	}
	return PALETTE[sum % PALETTE.length]
}
