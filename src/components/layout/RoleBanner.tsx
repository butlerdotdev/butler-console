// Copyright 2026 The Butler Authors.
// SPDX-License-Identifier: Apache-2.0

export type BannerVariant = 'platform-admin' | 'shadow' | 'team-admin' | 'team-operator' | 'team-viewer'

interface RoleBannerProps {
	variant: BannerVariant
	teamName?: string
}

const config: Record<BannerVariant, {
	title: string
	subtitle: string | ((teamName?: string) => string)
	container: string
	titleClass: string
	separatorClass: string
	subtitleClass: string
	icon: 'shield-check' | 'eye' | 'shield' | 'wrench'
	iconClass: string
}> = {
	'platform-admin': {
		title: 'Admin Mode',
		subtitle: 'Actions affect the entire platform',
		container: 'bg-violet-600/20 border-b border-violet-500/30',
		titleClass: 'text-violet-300',
		separatorClass: 'text-violet-400/60',
		subtitleClass: 'text-violet-300/80',
		icon: 'shield-check',
		iconClass: 'text-violet-400',
	},
	'shadow': {
		title: 'Shadow Mode',
		subtitle: 'Read-only view of the entire platform',
		container: 'bg-transparent border border-violet-500/40',
		titleClass: 'text-violet-400',
		separatorClass: 'text-violet-400/40',
		subtitleClass: 'text-violet-400/70',
		icon: 'eye',
		iconClass: 'text-violet-400',
	},
	'team-admin': {
		title: 'Team Admin',
		subtitle: (teamName) => `Actions affect ${teamName || 'this team'}`,
		container: 'bg-teal-600/20 border-b border-teal-500/30',
		titleClass: 'text-teal-300',
		separatorClass: 'text-teal-400/60',
		subtitleClass: 'text-teal-300/80',
		icon: 'shield',
		iconClass: 'text-teal-400',
	},
	'team-operator': {
		title: 'Team Operator',
		subtitle: (teamName) => `Operational access to ${teamName || 'this team'}`,
		container: 'bg-orange-600/20 border-b border-orange-500/30',
		titleClass: 'text-orange-300',
		separatorClass: 'text-orange-400/60',
		subtitleClass: 'text-orange-300/80',
		icon: 'wrench',
		iconClass: 'text-orange-400',
	},
	'team-viewer': {
		title: 'Team Viewer',
		subtitle: (teamName) => `Read-only view of ${teamName || 'this team'}`,
		container: 'bg-transparent border border-teal-500/40',
		titleClass: 'text-teal-400',
		separatorClass: 'text-teal-400/40',
		subtitleClass: 'text-teal-400/70',
		icon: 'eye',
		iconClass: 'text-teal-400',
	},
}

function ShieldCheckIcon({ className }: { className?: string }) {
	return (
		<svg className={className} fill="none" viewBox="0 0 24 24" stroke="currentColor">
			<path
				strokeLinecap="round"
				strokeLinejoin="round"
				strokeWidth={2}
				d="M9 12l2 2 4-4m5.618-4.016A11.955 11.955 0 0112 2.944a11.955 11.955 0 01-8.618 3.04A12.02 12.02 0 003 9c0 5.591 3.824 10.29 9 11.622 5.176-1.332 9-6.03 9-11.622 0-1.042-.133-2.052-.382-3.016z"
			/>
		</svg>
	)
}

function ShieldIcon({ className }: { className?: string }) {
	return (
		<svg className={className} fill="none" viewBox="0 0 24 24" stroke="currentColor">
			<path
				strokeLinecap="round"
				strokeLinejoin="round"
				strokeWidth={2}
				d="M20.618 5.984A11.955 11.955 0 0112 2.944a11.955 11.955 0 01-8.618 3.04A12.02 12.02 0 003 9c0 5.591 3.824 10.29 9 11.622 5.176-1.332 9-6.03 9-11.622 0-1.042-.133-2.052-.382-3.016z"
			/>
		</svg>
	)
}

function EyeIcon({ className }: { className?: string }) {
	return (
		<svg className={className} fill="none" viewBox="0 0 24 24" stroke="currentColor">
			<path
				strokeLinecap="round"
				strokeLinejoin="round"
				strokeWidth={2}
				d="M15 12a3 3 0 11-6 0 3 3 0 016 0z"
			/>
			<path
				strokeLinecap="round"
				strokeLinejoin="round"
				strokeWidth={2}
				d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z"
			/>
		</svg>
	)
}

function WrenchIcon({ className }: { className?: string }) {
	return (
		<svg className={className} fill="none" viewBox="0 0 24 24" stroke="currentColor">
			<path
				strokeLinecap="round"
				strokeLinejoin="round"
				strokeWidth={2}
				d="M14.7 6.3a1 1 0 000 1.4l1.6 1.6a1 1 0 001.4 0l3.77-3.77a6 6 0 01-7.94 7.94l-6.91 6.91a2.12 2.12 0 01-3-3l6.91-6.91a6 6 0 017.94-7.94l-3.76 3.76z"
			/>
		</svg>
	)
}

const icons = {
	'shield-check': ShieldCheckIcon,
	'eye': EyeIcon,
	'shield': ShieldIcon,
	'wrench': WrenchIcon,
}

export function RoleBanner({ variant, teamName }: RoleBannerProps) {
	const cfg = config[variant]
	const Icon = icons[cfg.icon]
	const subtitle = typeof cfg.subtitle === 'function' ? cfg.subtitle(teamName) : cfg.subtitle

	return (
		<div className={`${cfg.container} px-4 py-2 flex-shrink-0`}>
			<div className="flex items-center justify-center gap-2 text-sm">
				<Icon className={`w-4 h-4 ${cfg.iconClass}`} />
				<span className={`font-medium ${cfg.titleClass}`}>{cfg.title}</span>
				<span className={cfg.separatorClass}>&mdash;</span>
				<span className={cfg.subtitleClass}>{subtitle}</span>
			</div>
		</div>
	)
}
