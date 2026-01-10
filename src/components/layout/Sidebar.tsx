// Copyright 2025 The Butler Authors.
// SPDX-License-Identifier: Apache-2.0

import { NavLink } from 'react-router-dom'
import { cn } from '@/lib/utils'

const navItems = [
	{ to: '/dashboard', label: 'Dashboard', icon: DashboardIcon },
	{ to: '/management', label: 'Management', icon: ManagementIcon },
	{ to: '/clusters', label: 'Clusters', icon: ClustersIcon },
	{ to: '/providers', label: 'Providers', icon: ProvidersIcon },
	{ to: '/settings', label: 'Settings', icon: SettingsIcon },
]

export function Sidebar() {
	return (
		<aside className="w-64 bg-neutral-900 border-r border-neutral-800 flex flex-col">
			<div className="p-4 border-b border-neutral-800">
				<div className="flex items-center gap-2">
					<img
						src="/butlerlabs.svg"
						alt="Butler"
						className="w-8 h-8 rounded-full object-cover"
					/>
					<span className="text-lg font-semibold text-neutral-100">Butler</span>
				</div>
			</div>

			<nav className="flex-1 p-4 space-y-1">
				{navItems.map((item) => (
					<NavLink
						key={item.to}
						to={item.to}
						className={({ isActive }) =>
							cn(
								'flex items-center gap-3 px-3 py-2 rounded-lg text-sm font-medium transition-colors',
								isActive
									? 'bg-green-600/10 text-green-500'
									: 'text-neutral-400 hover:text-neutral-100 hover:bg-neutral-800'
							)
						}
					>
						<item.icon className="w-5 h-5" />
						{item.label}
					</NavLink>
				))}
			</nav>

			{/* Footer links */}
			<div className="p-4 border-t border-neutral-800 space-y-2">
				<a
					href="https://github.com/butlerdotdev/"
					target="_blank"
					rel="noopener noreferrer"
					className="flex items-center gap-3 px-3 py-2 rounded-lg text-sm text-neutral-400 hover:text-neutral-100 hover:bg-neutral-800 transition-colors"
				>
					<GitHubIcon className="w-5 h-5" />
					GitHub
				</a>
				<a
					href="https://butlerlabs.dev"
					target="_blank"
					rel="noopener noreferrer"
					className="flex items-center gap-3 px-3 py-2 rounded-lg text-sm text-neutral-400 hover:text-neutral-100 hover:bg-neutral-800 transition-colors"
				>
					<GlobeIcon className="w-5 h-5" />
					Butler Labs
				</a>
			</div>
		</aside>
	)
}

function DashboardIcon({ className }: { className?: string }) {
	return (
		<svg className={className} fill="none" stroke="currentColor" viewBox="0 0 24 24">
			<path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2H6a2 2 0 01-2-2V6zM14 6a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2h-2a2 2 0 01-2-2V6zM4 16a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2H6a2 2 0 01-2-2v-2zM14 16a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2h-2a2 2 0 01-2-2v-2z" />
		</svg>
	)
}

function ManagementIcon({ className }: { className?: string }) {
	return (
		<svg className={className} fill="none" stroke="currentColor" viewBox="0 0 24 24">
			<path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 3v2m6-2v2M9 19v2m6-2v2M5 9H3m2 6H3m18-6h-2m2 6h-2M7 19h10a2 2 0 002-2V7a2 2 0 00-2-2H7a2 2 0 00-2 2v10a2 2 0 002 2zM9 9h6v6H9V9z" />
		</svg>
	)
}

function ClustersIcon({ className }: { className?: string }) {
	return (
		<svg className={className} fill="none" stroke="currentColor" viewBox="0 0 24 24">
			<path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 12h14M5 12a2 2 0 01-2-2V6a2 2 0 012-2h14a2 2 0 012 2v4a2 2 0 01-2 2M5 12a2 2 0 00-2 2v4a2 2 0 002 2h14a2 2 0 002-2v-4a2 2 0 00-2-2m-2-4h.01M17 16h.01" />
		</svg>
	)
}

function ProvidersIcon({ className }: { className?: string }) {
	return (
		<svg className={className} fill="none" stroke="currentColor" viewBox="0 0 24 24">
			<path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 11H5m14 0a2 2 0 012 2v6a2 2 0 01-2 2H5a2 2 0 01-2-2v-6a2 2 0 012-2m14 0V9a2 2 0 00-2-2M5 11V9a2 2 0 012-2m0 0V5a2 2 0 012-2h6a2 2 0 012 2v2M7 7h10" />
		</svg>
	)
}

function SettingsIcon({ className }: { className?: string }) {
	return (
		<svg className={className} fill="none" stroke="currentColor" viewBox="0 0 24 24">
			<path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z" />
			<path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
		</svg>
	)
}

function GitHubIcon({ className }: { className?: string }) {
	return (
		<svg className={className} fill="currentColor" viewBox="0 0 24 24">
			<path fillRule="evenodd" clipRule="evenodd" d="M12 2C6.477 2 2 6.484 2 12.017c0 4.425 2.865 8.18 6.839 9.504.5.092.682-.217.682-.483 0-.237-.008-.868-.013-1.703-2.782.605-3.369-1.343-3.369-1.343-.454-1.158-1.11-1.466-1.11-1.466-.908-.62.069-.608.069-.608 1.003.07 1.531 1.032 1.531 1.032.892 1.53 2.341 1.088 2.91.832.092-.647.35-1.088.636-1.338-2.22-.253-4.555-1.113-4.555-4.951 0-1.093.39-1.988 1.029-2.688-.103-.253-.446-1.272.098-2.65 0 0 .84-.27 2.75 1.026A9.564 9.564 0 0112 6.844c.85.004 1.705.115 2.504.337 1.909-1.296 2.747-1.027 2.747-1.027.546 1.379.202 2.398.1 2.651.64.7 1.028 1.595 1.028 2.688 0 3.848-2.339 4.695-4.566 4.943.359.309.678.92.678 1.855 0 1.338-.012 2.419-.012 2.747 0 .268.18.58.688.482A10.019 10.019 0 0022 12.017C22 6.484 17.522 2 12 2z" />
		</svg>
	)
}

function GlobeIcon({ className }: { className?: string }) {
	return (
		<svg className={className} fill="none" stroke="currentColor" viewBox="0 0 24 24">
			<path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 12a9 9 0 01-9 9m9-9a9 9 0 00-9-9m9 9H3m9 9a9 9 0 01-9-9m9 9c1.657 0 3-4.03 3-9s-1.343-9-3-9m0 18c-1.657 0-3-4.03-3-9s1.343-9 3-9m-9 9a9 9 0 019-9" />
		</svg>
	)
}
