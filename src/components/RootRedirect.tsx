// Copyright 2026 The Butler Authors.
// SPDX-License-Identifier: Apache-2.0

import { Navigate } from 'react-router-dom'
import { useAuth } from '@/hooks/useAuth'
import type { TeamMembership } from '@/contexts/AuthContext'

/**
 * Smart redirect based on user's teams and role
 */
export function RootRedirect() {
	const { user, isLoading } = useAuth()

	if (isLoading) {
		return (
			<div className="flex items-center justify-center min-h-screen bg-neutral-950">
				<div className="animate-spin rounded-full h-8 w-8 border-t-2 border-b-2 border-green-500" />
			</div>
		)
	}

	// Check if user is platform admin
	const isAdmin = user?.teams?.some((t: TeamMembership) => t.role === 'admin') ?? false

	// If admin, go to admin dashboard
	if (isAdmin || user?.isAdmin || user?.isPlatformAdmin) {
		return <Navigate to="/admin" replace />
	}

	// Get first team
	const firstTeam = user?.teams?.[0]
	const teamName = firstTeam?.name || firstTeam?.metadata?.name

	if (teamName) {
		return <Navigate to={`/t/${teamName}`} replace />
	}

	// No teams - go to overview
	return <Navigate to="/overview" replace />
}
