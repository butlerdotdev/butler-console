// Copyright 2026 The Butler Authors.
// SPDX-License-Identifier: Apache-2.0

import { useState, useRef, useEffect, useMemo } from 'react'
import { useAuth } from '@/hooks/useAuth'
import { useTeamContext } from '@/hooks/useTeamContext'

interface NormalizedTeam {
	name: string
	displayName: string
	role?: string
}

interface RawTeam {
	metadata?: { name?: string }
	spec?: { displayName?: string; role?: string }
	name?: string
	displayName?: string
	role?: string
}

function normalizeTeam(t: RawTeam | null | undefined): NormalizedTeam | null {
	if (!t) return null
	if (t.metadata?.name) {
		return {
			name: t.metadata.name,
			displayName: t.spec?.displayName || t.metadata.name,
			role: t.role || t.spec?.role,
		}
	}
	if (t.name) {
		return {
			name: t.name,
			displayName: t.displayName || t.name,
			role: t.role,
		}
	}
	return null
}

export function TeamSwitcher() {
	const { user } = useAuth()
	const { mode, currentTeam, canAccessAdmin, switchToTeam, switchToAdmin } = useTeamContext()
	const [isOpen, setIsOpen] = useState(false)
	const containerRef = useRef<HTMLDivElement>(null)

	// Close on outside click
	useEffect(() => {
		function handleClickOutside(event: MouseEvent) {
			if (containerRef.current && !containerRef.current.contains(event.target as Node)) {
				setIsOpen(false)
			}
		}
		document.addEventListener('mousedown', handleClickOutside)
		return () => document.removeEventListener('mousedown', handleClickOutside)
	}, [])

	// Normalize teams
	const userTeams = user?.teams
	const teams = useMemo(() => {
		if (!userTeams) return []
		return userTeams.map(normalizeTeam).filter((t): t is NormalizedTeam => t !== null)
	}, [userTeams])

	// Get display label for current context
	const currentLabel = useMemo(() => {
		if (mode === 'admin') return 'Admin View'
		if (mode === 'team' && currentTeam) {
			const team = teams.find((t) => t.name === currentTeam)
			return team?.displayName || currentTeam
		}
		return 'Select Team'
	}, [mode, currentTeam, teams])

	const handleSelect = (teamName: string) => {
		switchToTeam(teamName)
		setIsOpen(false)
	}

	const handleAdminSelect = () => {
		switchToAdmin()
		setIsOpen(false)
	}

	return (
		<div ref={containerRef} className="relative">
			{/* Trigger Button */}
			<button
				onClick={() => setIsOpen(!isOpen)}
				className={`
					flex items-center gap-2 px-3 py-2 rounded-lg font-medium text-sm
					transition-colors duration-150
					${mode === 'admin'
						? 'bg-violet-500/20 text-violet-300 hover:bg-violet-500/30 border border-violet-500/30'
						: 'bg-neutral-800 text-neutral-200 hover:bg-neutral-700 border border-neutral-700'
					}
				`}
			>
				{mode === 'admin' && (
					<svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
						<path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m5.618-4.016A11.955 11.955 0 0112 2.944a11.955 11.955 0 01-8.618 3.04A12.02 12.02 0 003 9c0 5.591 3.824 10.29 9 11.622 5.176-1.332 9-6.03 9-11.622 0-1.042-.133-2.052-.382-3.016z" />
					</svg>
				)}
				{mode === 'team' && (
					<svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
						<path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 21V5a2 2 0 00-2-2H7a2 2 0 00-2 2v16m14 0h2m-2 0h-5m-9 0H3m2 0h5M9 7h1m-1 4h1m4-4h1m-1 4h1m-5 10v-5a1 1 0 011-1h2a1 1 0 011 1v5m-4 0h4" />
					</svg>
				)}
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

			{/* Dropdown */}
			{isOpen && (
				<div className="absolute top-full right-0 mt-2 w-64 bg-neutral-900 border border-neutral-700 rounded-lg shadow-xl z-50 overflow-hidden">
					{/* Admin Option */}
					{canAccessAdmin && (
						<div className="p-2 border-b border-neutral-800">
							<button
								onClick={handleAdminSelect}
								className={`
									w-full flex items-center gap-3 px-3 py-2 rounded-md text-sm
									transition-colors duration-150
									${mode === 'admin'
										? 'bg-violet-500/20 text-violet-300'
										: 'text-neutral-300 hover:bg-neutral-800'
									}
								`}
							>
								<svg className="w-5 h-5 text-violet-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
									<path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m5.618-4.016A11.955 11.955 0 0112 2.944a11.955 11.955 0 01-8.618 3.04A12.02 12.02 0 003 9c0 5.591 3.824 10.29 9 11.622 5.176-1.332 9-6.03 9-11.622 0-1.042-.133-2.052-.382-3.016z" />
								</svg>
								<div className="flex-1 text-left">
									<div className="font-medium">Admin View</div>
									<div className="text-xs text-neutral-500">Manage platform</div>
								</div>
								{mode === 'admin' && (
									<svg className="w-4 h-4 text-violet-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
										<path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
									</svg>
								)}
							</button>
						</div>
					)}

					{/* Teams List */}
					<div className="max-h-64 overflow-y-auto p-2 space-y-1">
						{teams.length === 0 ? (
							<div className="px-4 py-6 text-center text-sm text-neutral-500">
								No teams available
							</div>
						) : (
							teams.map((team) => (
								<button
									key={team.name}
									onClick={() => handleSelect(team.name)}
									className={`
										w-full flex items-center gap-3 px-3 py-2 rounded-md text-sm
										transition-colors duration-150
										${team.name === currentTeam && mode === 'team'
											? 'bg-green-500/20 text-green-300'
											: 'text-neutral-300 hover:bg-neutral-800'
										}
									`}
								>
									{/* Team Icon */}
									<div className={`
										w-8 h-8 rounded-md flex items-center justify-center text-xs font-bold
										${team.name === currentTeam && mode === 'team'
											? 'bg-green-500/30 text-green-300'
											: 'bg-neutral-700 text-neutral-400'
										}
									`}>
										{team.displayName.charAt(0).toUpperCase()}
									</div>

									{/* Team Info */}
									<div className="flex-1 text-left min-w-0">
										<div className="font-medium truncate">{team.displayName}</div>
										<div className="text-xs text-neutral-500 truncate">@{team.name}</div>
									</div>

									{/* Check mark for current */}
									{team.name === currentTeam && mode === 'team' && (
										<svg className="w-4 h-4 text-green-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
											<path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
										</svg>
									)}
								</button>
							))
						)}
					</div>
				</div>
			)}
		</div>
	)
}
