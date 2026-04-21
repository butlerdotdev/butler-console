// Copyright 2026 The Butler Authors.
// SPDX-License-Identifier: Apache-2.0

// Deterministic per-env accent palette. The same env name always maps
// to the same color across every surface that uses it (section
// headers, cluster-card left borders, EnvSwitcher dropdown dots) so
// operators pick up the association without thinking. The palette is
// intentionally narrow — five colors cycle via a simple character-sum
// hash — because more than ~5 simultaneous color accents on one page
// becomes noise rather than signal.
//
// Tailwind classes are emitted as literal strings (not built from
// template literals) so Tailwind's content scan picks them up at
// build time.

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

const PALETTE: EnvAccent[] = [
	{
		dot: 'bg-blue-500',
		border: 'border-l-blue-500',
		pillBg: 'bg-blue-500/20',
		pillText: 'text-blue-300',
		iconBg: 'bg-blue-500/30',
		iconText: 'text-blue-300',
		headerTint: 'bg-blue-500/5',
	},
	{
		dot: 'bg-emerald-500',
		border: 'border-l-emerald-500',
		pillBg: 'bg-emerald-500/20',
		pillText: 'text-emerald-300',
		iconBg: 'bg-emerald-500/30',
		iconText: 'text-emerald-300',
		headerTint: 'bg-emerald-500/5',
	},
	{
		dot: 'bg-violet-500',
		border: 'border-l-violet-500',
		pillBg: 'bg-violet-500/20',
		pillText: 'text-violet-300',
		iconBg: 'bg-violet-500/30',
		iconText: 'text-violet-300',
		headerTint: 'bg-violet-500/5',
	},
	{
		dot: 'bg-amber-500',
		border: 'border-l-amber-500',
		pillBg: 'bg-amber-500/20',
		pillText: 'text-amber-300',
		iconBg: 'bg-amber-500/30',
		iconText: 'text-amber-300',
		headerTint: 'bg-amber-500/5',
	},
	{
		dot: 'bg-rose-500',
		border: 'border-l-rose-500',
		pillBg: 'bg-rose-500/20',
		pillText: 'text-rose-300',
		iconBg: 'bg-rose-500/30',
		iconText: 'text-rose-300',
		headerTint: 'bg-rose-500/5',
	},
]

// Neutral accent for "No environment" / orphan sections so the group
// is visually distinct from real envs without pulling a palette slot.
export const NEUTRAL_ACCENT: EnvAccent = {
	dot: 'bg-neutral-500',
	border: 'border-l-neutral-700',
	pillBg: 'bg-neutral-700/30',
	pillText: 'text-neutral-300',
	iconBg: 'bg-neutral-700',
	iconText: 'text-neutral-400',
	headerTint: 'bg-neutral-800/30',
}

// envAccent returns the palette entry for a given env name via a
// stable hash. The same name -> same color, on this page and every
// other surface that calls this helper.
export function envAccent(name: string | null | undefined): EnvAccent {
	if (!name) return NEUTRAL_ACCENT
	let sum = 0
	for (let i = 0; i < name.length; i++) {
		sum = (sum + name.charCodeAt(i)) % 997
	}
	return PALETTE[sum % PALETTE.length]
}
