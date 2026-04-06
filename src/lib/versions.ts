// Copyright 2026 The Butler Authors.
// SPDX-License-Identifier: Apache-2.0

export const SUPPORTED_K8S_VERSIONS = [
	'v1.35.0', 'v1.34.2', 'v1.34.1', 'v1.34.0',
	'v1.33.2', 'v1.33.1', 'v1.33.0',
	'v1.32.2', 'v1.32.1', 'v1.32.0',
	'v1.31.2', 'v1.31.1', 'v1.31.0',
	'v1.30.2', 'v1.30.1', 'v1.30.0',
]

export function parseVersion(v: string): [number, number, number] | null {
	const match = v.replace(/^v/, '').match(/^(\d+)\.(\d+)\.(\d+)$/)
	if (!match) return null
	return [parseInt(match[1]), parseInt(match[2]), parseInt(match[3])]
}

export function isDowngrade(current: string, target: string): boolean {
	const c = parseVersion(current)
	const t = parseVersion(target)
	if (!c || !t) return false
	if (t[0] < c[0]) return true
	if (t[0] === c[0] && t[1] < c[1]) return true
	if (t[0] === c[0] && t[1] === c[1] && t[2] < c[2]) return true
	return false
}
