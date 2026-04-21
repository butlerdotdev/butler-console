// Copyright 2026 The Butler Authors.
// SPDX-License-Identifier: Apache-2.0

// Deterministic per-env accent palette. The same env name always maps
// to the same color across every surface that uses it (section
// headers, cluster-card left borders, EnvSwitcher dropdown dots) so
// operators pick up the association without thinking.
//
// Palette is Paul Tol's "bright" qualitative scheme — canonical
// reference: https://personal.sron.nl/~pault/ . Tol's bright was
// designed for three properties simultaneously: distinguishable
// under normal vision, CVD-safe (deuteranopia / protanopia /
// tritanopia), AND approximately luminance-balanced so the colors
// read as equally weighted on a page.
//
// Five of Tol's six bright colors are live; the sixth (purple
// #AA3377) is reserved and documented in tailwind.config.ts as
// available-if-needed with a note on its lower luminance. An
// earlier iteration used the Okabe-Ito palette; swapped to Tol
// bright when deuteranopia review surfaced Okabe-Ito's intentional
// luminance variation as perceived unevenness. Both palettes are
// CVD-safe; Tol trades a marginally narrower gamut for the
// luminance-balance property.
//
// Because the set is colorblind-safe by construction, these
// accents sit outside the --bc-* theme-variable system and are NOT
// remapped per colorblind mode — adding mode-specific remaps would
// break the distinguishability property the palette was engineered
// for.
//
// The palette is deliberately narrow — five colors cycle via a
// simple character-sum hash — because more than ~5 simultaneous
// color accents on one page becomes noise rather than signal.

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
	// Tol bright: blue
	{
		dot: 'bg-env-1-500',
		border: 'border-l-env-1-500',
		pillBg: 'bg-env-1-500/20',
		pillText: 'text-env-1-300',
		iconBg: 'bg-env-1-500/30',
		iconText: 'text-env-1-300',
		headerTint: 'bg-env-1-500/5',
	},
	// Tol bright: cyan
	{
		dot: 'bg-env-2-500',
		border: 'border-l-env-2-500',
		pillBg: 'bg-env-2-500/20',
		pillText: 'text-env-2-300',
		iconBg: 'bg-env-2-500/30',
		iconText: 'text-env-2-300',
		headerTint: 'bg-env-2-500/5',
	},
	// Tol bright: green
	{
		dot: 'bg-env-3-500',
		border: 'border-l-env-3-500',
		pillBg: 'bg-env-3-500/20',
		pillText: 'text-env-3-300',
		iconBg: 'bg-env-3-500/30',
		iconText: 'text-env-3-300',
		headerTint: 'bg-env-3-500/5',
	},
	// Tol bright: yellow
	{
		dot: 'bg-env-4-500',
		border: 'border-l-env-4-500',
		pillBg: 'bg-env-4-500/20',
		pillText: 'text-env-4-300',
		iconBg: 'bg-env-4-500/30',
		iconText: 'text-env-4-300',
		headerTint: 'bg-env-4-500/5',
	},
	// Tol bright: red/pink
	{
		dot: 'bg-env-5-500',
		border: 'border-l-env-5-500',
		pillBg: 'bg-env-5-500/20',
		pillText: 'text-env-5-300',
		iconBg: 'bg-env-5-500/30',
		iconText: 'text-env-5-300',
		headerTint: 'bg-env-5-500/5',
	},
]

// Neutral accent for "No environment" / orphan sections so the group
// is visually distinct from real envs without pulling a palette slot.
// Uses the theme-variable neutral-* scale so it participates in
// light / dark mode but does not need colorblind remaps (gray is
// safe in all modes).
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
