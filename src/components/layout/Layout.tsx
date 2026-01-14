// Copyright 2026 The Butler Authors.
// SPDX-License-Identifier: Apache-2.0

import { Outlet } from 'react-router-dom'
import { useTeamContext } from '@/hooks/useTeamContext'
import { Sidebar } from './Sidebar'
import { Header } from './Header'

export function Layout() {
	const { isAdminMode, isTeamAdmin, currentTeamDisplayName } = useTeamContext()

	return (
		<div className="flex h-screen bg-neutral-950 text-neutral-50">
			{/* Sidebar */}
			<Sidebar />

			{/* Main Content Area */}
			<div className="flex-1 flex flex-col overflow-hidden">
				{/* Platform Admin Mode Banner - Purple */}
				{isAdminMode && (
					<div className="bg-violet-600/20 border-b border-violet-500/30 px-4 py-2 flex-shrink-0">
						<div className="flex items-center justify-center gap-2 text-sm">
							<svg
								className="w-4 h-4 text-violet-400"
								fill="none"
								viewBox="0 0 24 24"
								stroke="currentColor"
							>
								<path
									strokeLinecap="round"
									strokeLinejoin="round"
									strokeWidth={2}
									d="M9 12l2 2 4-4m5.618-4.016A11.955 11.955 0 0112 2.944a11.955 11.955 0 01-8.618 3.04A12.02 12.02 0 003 9c0 5.591 3.824 10.29 9 11.622 5.176-1.332 9-6.03 9-11.622 0-1.042-.133-2.052-.382-3.016z"
								/>
							</svg>
							<span className="font-medium text-violet-300">Admin Mode</span>
							<span className="text-violet-400/60">—</span>
							<span className="text-violet-300/80">
								Actions affect the entire platform
							</span>
						</div>
					</div>
				)}

				{/* Team Admin Mode Banner - Teal (only when not in platform admin mode) */}
				{!isAdminMode && isTeamAdmin && (
					<div className="bg-teal-600/20 border-b border-teal-500/30 px-4 py-2 flex-shrink-0">
						<div className="flex items-center justify-center gap-2 text-sm">
							<svg
								className="w-4 h-4 text-teal-400"
								fill="none"
								viewBox="0 0 24 24"
								stroke="currentColor"
							>
								<path
									strokeLinecap="round"
									strokeLinejoin="round"
									strokeWidth={2}
									d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0zm6 3a2 2 0 11-4 0 2 2 0 014 0zM7 10a2 2 0 11-4 0 2 2 0 014 0z"
								/>
							</svg>
							<span className="font-medium text-teal-300">Team Admin</span>
							<span className="text-teal-400/60">—</span>
							<span className="text-teal-300/80">
								Actions affect {currentTeamDisplayName || 'this team'}
							</span>
						</div>
					</div>
				)}

				{/* Header */}
				<Header />

				{/* Main Content - scrollable with padding */}
				<main className="flex-1 overflow-auto p-6 relative">
					{/* Background watermark */}
					<div
						className="fixed inset-0 pointer-events-none z-0"
						style={{
							backgroundImage: 'url(/butlergopher.png)',
							backgroundRepeat: 'no-repeat',
							backgroundPosition: 'center center',
							backgroundSize: '50%',
							opacity: 0.03,
						}}
					/>
					<div className="relative z-10">
						<Outlet />
					</div>
				</main>
			</div>
		</div>
	)
}
