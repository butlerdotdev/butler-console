// Copyright 2026 The Butler Authors.
// SPDX-License-Identifier: Apache-2.0

export function getAddonStatusColor(status: string): string {
	switch (status) {
		case 'Installed':
		case 'Healthy':
			return 'text-green-400'
		case 'Installing':
		case 'Upgrading':
		case 'Pending':
			return 'text-yellow-400'
		case 'Failed':
		case 'Degraded':
			return 'text-red-400'
		case 'Deleting':
			return 'text-orange-400'
		default:
			return 'text-neutral-400'
	}
}

export function getAddonStatusBgColor(status: string): string {
	switch (status) {
		case 'Installed':
		case 'Healthy':
			return 'bg-green-500/10 border border-green-500/30'
		case 'Installing':
		case 'Upgrading':
		case 'Pending':
			return 'bg-yellow-500/10 border border-yellow-500/30'
		case 'Failed':
		case 'Degraded':
			return 'bg-red-500/10 border border-red-500/30'
		case 'Deleting':
			return 'bg-orange-500/10 border border-orange-500/30'
		default:
			return 'bg-neutral-500/10 border border-neutral-500/30'
	}
}

interface AddonStatusBadgeProps {
	status: string
}

export function AddonStatusBadge({ status }: AddonStatusBadgeProps) {
	return (
		<span className={`px-2 py-1 text-xs rounded-full ${getAddonStatusBgColor(status)} ${getAddonStatusColor(status)}`}>
			{status}
		</span>
	)
}
