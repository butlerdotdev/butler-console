// Copyright 2026 The Butler Authors.
// SPDX-License-Identifier: Apache-2.0

import { useEffect, useRef, useState } from 'react'
import { useEnvContext } from '@/hooks/useEnvContext'
import { useTeamContext } from '@/hooks/useTeamContext'

// EnvSwitcher renders alongside TeamSwitcher. It only appears when the
// user is in team mode AND the current team defines at least one
// environment. The null state ("All environments") sits at the top of
// the dropdown; other entries are sorted alphabetically by EnvProvider.
export function EnvSwitcher() {
	const { mode } = useTeamContext()
	const { currentEnv, availableEnvs, setCurrentEnv } = useEnvContext()
	const [isOpen, setIsOpen] = useState(false)
	const containerRef = useRef<HTMLDivElement>(null)

	useEffect(() => {
		function handleClickOutside(event: MouseEvent) {
			if (containerRef.current && !containerRef.current.contains(event.target as Node)) {
				setIsOpen(false)
			}
		}
		document.addEventListener('mousedown', handleClickOutside)
		return () => document.removeEventListener('mousedown', handleClickOutside)
	}, [])

	// Hide entirely outside of team mode or when the team has no envs.
	if (mode !== 'team' || availableEnvs.length === 0) {
		return null
	}

	const currentLabel = currentEnv ?? 'All environments'

	const handleSelect = (env: string | null) => {
		setCurrentEnv(env)
		setIsOpen(false)
	}

	return (
		<div ref={containerRef} className="relative">
			<button
				onClick={() => setIsOpen(!isOpen)}
				className="flex items-center gap-2 px-3 py-2 rounded-lg font-medium text-sm transition-colors duration-150 bg-neutral-800 text-neutral-200 hover:bg-neutral-700 border border-neutral-700"
			>
				<svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
					<path
						strokeLinecap="round"
						strokeLinejoin="round"
						strokeWidth={2}
						d="M9 17v-2a4 4 0 014-4h4m0 0l-3-3m3 3l-3 3M5 21V5a2 2 0 012-2h10a2 2 0 012 2v10"
					/>
				</svg>
				<span className="max-w-[160px] truncate">{currentLabel}</span>
				<svg
					className={`w-4 h-4 transition-transform duration-150 ${isOpen ? 'rotate-180' : ''}`}
					fill="none"
					viewBox="0 0 24 24"
					stroke="currentColor"
				>
					<path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
				</svg>
			</button>

			{isOpen && (
				<div className="absolute top-full right-0 mt-2 w-64 bg-neutral-900 border border-neutral-700 rounded-lg shadow-xl z-50 overflow-hidden">
					<div className="p-2 border-b border-neutral-800">
						<button
							onClick={() => handleSelect(null)}
							className={`w-full flex items-center gap-3 px-3 py-2 rounded-md text-sm transition-colors duration-150 ${
								currentEnv === null
									? 'bg-green-500/20 text-green-300'
									: 'text-neutral-300 hover:bg-neutral-800'
							}`}
						>
							<div
								className={`w-8 h-8 rounded-md flex items-center justify-center text-xs font-bold ${
									currentEnv === null
										? 'bg-green-500/30 text-green-300'
										: 'bg-neutral-700 text-neutral-400'
								}`}
							>
								<svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
									<path
										strokeLinecap="round"
										strokeLinejoin="round"
										strokeWidth={2}
										d="M4 6h16M4 10h16M4 14h16M4 18h16"
									/>
								</svg>
							</div>
							<div className="flex-1 text-left min-w-0">
								<div className="font-medium truncate">All environments</div>
								<div className="text-xs text-neutral-500 truncate">No env filter applied</div>
							</div>
							{currentEnv === null && (
								<svg
									className="w-4 h-4 text-green-400"
									fill="none"
									viewBox="0 0 24 24"
									stroke="currentColor"
								>
									<path
										strokeLinecap="round"
										strokeLinejoin="round"
										strokeWidth={2}
										d="M5 13l4 4L19 7"
									/>
								</svg>
							)}
						</button>
					</div>

					<div className="max-h-64 overflow-y-auto p-2 space-y-1">
						{availableEnvs.map((env) => {
							const selected = env.name === currentEnv
							return (
								<button
									key={env.name}
									onClick={() => handleSelect(env.name)}
									className={`w-full flex items-center gap-3 px-3 py-2 rounded-md text-sm transition-colors duration-150 ${
										selected
											? 'bg-green-500/20 text-green-300'
											: 'text-neutral-300 hover:bg-neutral-800'
									}`}
								>
									<div
										className={`w-8 h-8 rounded-md flex items-center justify-center text-xs font-bold ${
											selected
												? 'bg-green-500/30 text-green-300'
												: 'bg-neutral-700 text-neutral-400'
										}`}
									>
										{env.name.charAt(0).toUpperCase()}
									</div>
									<div className="flex-1 text-left min-w-0">
										<div className="font-medium truncate">{env.name}</div>
										<div className="text-xs text-neutral-500 truncate">
											{formatLimits(env.limits)}
										</div>
									</div>
									{selected && (
										<svg
											className="w-4 h-4 text-green-400"
											fill="none"
											viewBox="0 0 24 24"
											stroke="currentColor"
										>
											<path
												strokeLinecap="round"
												strokeLinejoin="round"
												strokeWidth={2}
												d="M5 13l4 4L19 7"
											/>
										</svg>
									)}
								</button>
							)
						})}
					</div>
				</div>
			)}
		</div>
	)
}

function formatLimits(limits?: { maxClusters?: number; maxClustersPerMember?: number }): string {
	if (!limits) return 'No quota'
	const parts: string[] = []
	if (limits.maxClusters != null) parts.push(`max ${limits.maxClusters}`)
	if (limits.maxClustersPerMember != null) parts.push(`${limits.maxClustersPerMember}/member`)
	return parts.length > 0 ? parts.join(', ') : 'No quota'
}
