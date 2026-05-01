// Copyright 2026 The Butler Authors.
// SPDX-License-Identifier: Apache-2.0

interface TierPillProps {
	tier?: string
}

export function TierPill({ tier }: TierPillProps) {
	if (tier !== 'infrastructure') return null

	return (
		<span
			className="px-2 py-0.5 text-xs font-medium bg-indigo-500/10 text-indigo-400 border border-indigo-500/20 rounded"
			title="Infrastructure tier"
		>
			Infra
		</span>
	)
}
