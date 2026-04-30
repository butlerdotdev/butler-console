// Copyright 2026 The Butler Authors.
// SPDX-License-Identifier: Apache-2.0

import { Outlet } from 'react-router-dom'
import { useTeamContext } from '@/hooks/useTeamContext'
import { Sidebar } from './Sidebar'
import { Header } from './Header'
import { RoleBanner } from './RoleBanner'
import type { BannerVariant } from './RoleBanner'

function useBannerVariant(): { variant: BannerVariant; teamName?: string } | null {
	const { isAdminMode, isPlatformViewer, isTeamAdmin, currentTeamRole, currentTeamDisplayName } = useTeamContext()

	// Platform-scope banners (admin routes)
	if (isAdminMode) {
		return isPlatformViewer
			? { variant: 'shadow' }
			: { variant: 'platform-admin' }
	}

	// Team-scope banners
	if (currentTeamRole === 'admin') {
		return { variant: 'team-admin', teamName: currentTeamDisplayName || undefined }
	}
	if (currentTeamRole === 'operator') {
		return { variant: 'team-operator', teamName: currentTeamDisplayName || undefined }
	}
	if (currentTeamRole === 'viewer') {
		return { variant: 'team-viewer', teamName: currentTeamDisplayName || undefined }
	}

	// Team admin check for backwards compat (some paths set isTeamAdmin without currentTeamRole)
	if (isTeamAdmin) {
		return { variant: 'team-admin', teamName: currentTeamDisplayName || undefined }
	}

	return null
}

export function Layout() {
	const banner = useBannerVariant()

	return (
		<div className="flex h-screen bg-neutral-950 text-neutral-50">
			{/* Sidebar */}
			<Sidebar />

			{/* Main Content Area */}
			<div className="flex-1 flex flex-col overflow-hidden">
				{banner && <RoleBanner variant={banner.variant} teamName={banner.teamName} />}

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
