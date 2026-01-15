// Copyright 2026 The Butler Authors.
// SPDX-License-Identifier: Apache-2.0

import { useMemo, useCallback, type ReactNode } from 'react'
import { useNavigate, useParams, useLocation, Navigate } from 'react-router-dom'
import { useAuth } from '@/hooks/useAuth'
import { TeamContext, type TeamInfo } from './TeamContext'

// ----------------------------------------------------------------------------
// Helper to normalize team data from various API shapes
// ----------------------------------------------------------------------------

interface RawTeam {
	metadata?: { name?: string }
	spec?: { displayName?: string; role?: string }
	status?: { namespace?: string }
	name?: string
	displayName?: string
	namespace?: string
	role?: string
}

function normalizeTeam(t: RawTeam | null | undefined): TeamInfo | null {
	if (!t) return null

	// Handle K8s-style structure: { metadata: { name }, spec: { displayName }, status: { namespace } }
	if (t.metadata?.name) {
		return {
			name: t.metadata.name,
			displayName: t.spec?.displayName || t.metadata.name,
			namespace: t.status?.namespace || t.metadata.name,
			role: t.role || t.spec?.role,
		}
	}

	// Handle flat structure: { name, displayName, namespace, role }
	if (t.name) {
		return {
			name: t.name,
			displayName: t.displayName || t.name,
			namespace: t.namespace || t.name,
			role: t.role,
		}
	}

	return null
}

function normalizeTeams(teams: RawTeam[]): TeamInfo[] {
	if (!Array.isArray(teams)) return []
	return teams.map(normalizeTeam).filter((t): t is TeamInfo => t !== null)
}

// ----------------------------------------------------------------------------
// Provider
// ----------------------------------------------------------------------------

interface TeamContextProviderProps {
	children: ReactNode
}

export function TeamContextProvider({ children }: TeamContextProviderProps) {
	const { user } = useAuth()
	const navigate = useNavigate()
	const location = useLocation()
	const params = useParams<{ team?: string }>()

	// Normalize user teams
	const normalizedTeams = useMemo(() => {
		return normalizeTeams(user?.teams || [])
	}, [user?.teams])

	// Determine current mode from URL path
	const mode = useMemo(() => {
		if (location.pathname.startsWith('/admin')) {
			return 'admin' as const
		}
		if (location.pathname.startsWith('/t/')) {
			return 'team' as const
		}
		return 'overview' as const
	}, [location.pathname])

	// Current team from URL params (only valid in team mode)
	const currentTeam = mode === 'team' ? (params.team ?? null) : null

	// Get current team info
	const currentTeamInfo = useMemo(() => {
		if (!currentTeam) return null
		return normalizedTeams.find((t) => t.name === currentTeam) || null
	}, [currentTeam, normalizedTeams])

	// Get display name for current team
	const currentTeamDisplayName = currentTeamInfo?.displayName || currentTeam

	// Get namespace for current team (where clusters live)
	// Falls back to team name if not specified
	const currentTeamNamespace = currentTeamInfo?.namespace || currentTeam

	// Check if user can access admin mode (platform admin only, not team admin)
	const canAccessAdmin = useMemo(() => {
		// Check explicit flags first
		if (user?.role === 'admin' || user?.isAdmin === true || user?.isPlatformAdmin === true) {
			return true
		}
		// Convention: admin of "platform-team" = platform admin
		return normalizedTeams.some((t) => t.name === 'platform-team' && t.role === 'admin')
	}, [user?.role, user?.isAdmin, user?.isPlatformAdmin, normalizedTeams])

	// Check if user is an admin of the current team (team-level admin)
	const isTeamAdmin = useMemo(() => {
		if (!currentTeam || !currentTeamInfo) return false
		return currentTeamInfo.role === 'admin'
	}, [currentTeam, currentTeamInfo])

	// Navigation functions
	const switchToTeam = useCallback(
		(teamName: string) => {
			// Preserve the current sub-path when switching teams if possible
			const currentSubPath = location.pathname.match(/^\/t\/[^/]+(.*)$/)?.[1] || ''
			const adminSubPath = location.pathname.match(/^\/admin(.*)$/)?.[1] || ''
			const subPath = currentSubPath || adminSubPath || ''

			// Only preserve sub-paths that make sense across teams
			const preservablePaths = ['/clusters', '/members', '/settings']
			const shouldPreserve = preservablePaths.some((p) => subPath.startsWith(p))

			if (shouldPreserve) {
				navigate(`/t/${teamName}${subPath}`)
			} else {
				navigate(`/t/${teamName}`)
			}
		},
		[navigate, location.pathname]
	)

	const switchToAdmin = useCallback(() => {
		navigate('/admin')
	}, [navigate])

	const switchToOverview = useCallback(() => {
		navigate('/overview')
	}, [navigate])

	// Build paths relative to current context
	const basePath = useMemo(() => {
		if (mode === 'admin') return '/admin'
		if (mode === 'team' && currentTeam) return `/t/${currentTeam}`
		return '/overview'
	}, [mode, currentTeam])

	const buildPath = useCallback(
		(subPath: string) => {
			// Ensure subPath starts with /
			const normalizedSubPath = subPath.startsWith('/') ? subPath : `/${subPath}`
			// Handle empty subPath (just return base)
			if (subPath === '' || subPath === '/') return basePath
			return `${basePath}${normalizedSubPath}`
		},
		[basePath]
	)

	const value = useMemo(
		() => ({
			mode,
			currentTeam,
			currentTeamDisplayName,
			currentTeamNamespace,
			isAdminMode: mode === 'admin',
			canAccessAdmin,
			isTeamAdmin,
			switchToTeam,
			switchToAdmin,
			switchToOverview,
			basePath,
			buildPath,
		}),
		[
			mode,
			currentTeam,
			currentTeamDisplayName,
			currentTeamNamespace,
			canAccessAdmin,
			isTeamAdmin,
			switchToTeam,
			switchToAdmin,
			switchToOverview,
			basePath,
			buildPath,
		]
	)

	return <TeamContext.Provider value={value}>{children}</TeamContext.Provider>
}

// ----------------------------------------------------------------------------
// Route Guards
// ----------------------------------------------------------------------------

interface RouteGuardProps {
	children: ReactNode
}

/**
 * Requires user to be authenticated.
 * Redirects to /login if not.
 */
export function RequireAuth({ children }: RouteGuardProps) {
	const { isAuthenticated, isLoading } = useAuth()
	const location = useLocation()

	if (isLoading) {
		return (
			<div className="flex items-center justify-center min-h-screen bg-neutral-950">
				<div className="flex flex-col items-center gap-4">
					<div className="animate-spin rounded-full h-8 w-8 border-t-2 border-b-2 border-green-500" />
					<span className="text-neutral-400 text-sm">Loading...</span>
				</div>
			</div>
		)
	}

	if (!isAuthenticated) {
		return <Navigate to="/login" state={{ from: location }} replace />
	}

	return <>{children}</>
}

/**
 * Requires user to have access to the specified team.
 * Must be used within a route that has :team param.
 * 
 * NOTE: This is permissive - if we can't verify access, we allow through
 * and let the backend enforce permissions.
 */
export function RequireTeamAccess({ children }: RouteGuardProps) {
	const { user, isLoading } = useAuth()
	const { team } = useParams<{ team: string }>()

	// If still loading, show spinner
	if (isLoading) {
		return (
			<div className="flex items-center justify-center min-h-screen bg-neutral-950">
				<div className="animate-spin rounded-full h-8 w-8 border-t-2 border-b-2 border-green-500" />
			</div>
		)
	}

	// No team in URL - redirect to overview
	if (!team) {
		return <Navigate to="/overview" replace />
	}

	// Normalize teams for checking
	const normalizedTeams = normalizeTeams(user?.teams || [])

	// Platform admins can access any team
	const isPlatformAdmin =
		user?.role === 'admin' ||
		user?.isAdmin === true ||
		user?.isPlatformAdmin === true ||
		normalizedTeams.some((t) => t.name === 'platform-team' && t.role === 'admin')

	if (isPlatformAdmin) {
		return <>{children}</>
	}

	// Check if user has access to this team
	const hasAccess = normalizedTeams.some((t) => t.name === team)

	// If user has no teams or doesn't have access, try to redirect
	if (normalizedTeams.length > 0 && !hasAccess) {
		// User has teams but not this one - redirect to first team
		return <Navigate to={`/t/${normalizedTeams[0].name}`} replace />
	}

	// If user has no teams at all, go to overview
	if (normalizedTeams.length === 0) {
		return <Navigate to="/overview" replace />
	}

	// Allow through - either has access or we're being permissive
	return <>{children}</>
}

/**
 * Requires user to have platform admin privileges.
 * Team admins are NOT platform admins (except platform-team admin).
 * Redirects to team view if not platform admin.
 */
export function RequireAdmin({ children }: RouteGuardProps) {
	const { user, isLoading } = useAuth()

	if (isLoading) {
		return (
			<div className="flex items-center justify-center min-h-screen bg-neutral-950">
				<div className="animate-spin rounded-full h-8 w-8 border-t-2 border-b-2 border-violet-500" />
			</div>
		)
	}

	// Normalize teams to check platform-team admin
	const normalizedTeams = normalizeTeams(user?.teams || [])

	// Platform admin is determined by:
	// 1. user.role === 'admin' (explicit platform role)
	// 2. user.isAdmin === true (explicit flag)
	// 3. user.isPlatformAdmin === true (explicit flag)
	// 4. Admin of "platform-team" team (convention)
	const isPlatformAdmin =
		user?.role === 'admin' ||
		user?.isAdmin === true ||
		user?.isPlatformAdmin === true ||
		normalizedTeams.some((t) => t.name === 'platform-team' && t.role === 'admin')

	if (!isPlatformAdmin) {
		// Not platform admin - redirect to first team or overview
		if (normalizedTeams.length > 0) {
			return <Navigate to={`/t/${normalizedTeams[0].name}`} replace />
		}
		return <Navigate to="/overview" replace />
	}

	return <>{children}</>
}
