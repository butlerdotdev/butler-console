// Copyright 2026 The Butler Authors.
// SPDX-License-Identifier: Apache-2.0

import { Routes, Route, Navigate } from 'react-router-dom'
import { Layout } from '@/components/layout'
import { ToastProvider } from '@/contexts/ToastProvider'
import {
	TeamContextProvider,
	RequireAuth,
	RequireTeamAccess,
	RequireAdmin,
} from '@/contexts/TeamProvider'
import { useAuth } from '@/hooks/useAuth'

import { LoginPage } from '@/pages/LoginPage'
import { ClusterDetailPage } from '@/pages/ClusterDetailPage'
import { CreateClusterPage } from '@/pages/CreateClusterPage'
import { ProvidersPage } from '@/pages/ProvidersPage'
import { CreateProviderPage } from '@/pages/CreateProviderPage'
import { ManagementPage } from '@/pages/ManagementPage'
import { SettingsPage } from '@/pages/SettingsPage'
import { TerminalPage } from '@/pages/TerminalPage'

import { DashboardPage } from '@/pages/DashboardPage'
import { ClustersPage } from '@/pages/ClustersPage'
import { UsersPage } from '@/pages/UsersPage'
import { AdminDashboard } from '@/pages/AdminDashboard'
import { AdminClustersPage } from '@/pages/AdminClustersPage'
import { AdminTeamsPage } from '@/pages/AdminTeamsPage'
import { AdminTeamDetailPage } from '@/pages/AdminTeamDetailPage'
import { TeamMembersPage } from '@/pages/TeamMembersPage'
import { TeamSettingsPage } from '@/pages/TeamSettingsPage'
import { OverviewPage } from '@/pages/OverviewPage'
import { SetPasswordPage } from '@/pages/SetPasswordsPage'
import { ProfileSettingsPage } from '@/pages/ProfileSettingsPage'
import { PreferencesPage } from '@/pages/PreferencesPage'
import { IdentityProvidersPage } from '@/pages/IdentityProvidersPage'
import { CreateIdentityProviderPage } from '@/pages/CreateIdentityProviderPage'


interface TeamRef {
	name?: string
	metadata?: { name?: string; role?: string }
	role?: string
}

/**
 * Smart redirect based on user's teams and role
 */
function SmartRedirect() {
	const { user, isLoading } = useAuth()

	if (isLoading) {
		return (
			<div className="flex items-center justify-center min-h-screen bg-neutral-950">
				<div className="animate-spin rounded-full h-8 w-8 border-t-2 border-b-2 border-green-500" />
			</div>
		)
	}

	// Check if user is platform admin (NOT just any team admin)
	// Convention: admin of "platform-team" = platform admin
	// TODO: Add proper spec.platformRole to User CRD
	const isPlatformAdmin = user?.role === 'admin' || user?.isAdmin === true || user?.isPlatformAdmin === true ||
		user?.teams?.some((t: TeamRef) => {
			const teamName = t.name || t.metadata?.name
			const role = t.role || t.metadata?.role
			return teamName === 'platform-team' && role === 'admin'
		})

	// If platform admin, go to admin dashboard
	if (isPlatformAdmin) {
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

export default function App() {
	return (
		<ToastProvider>
			<Routes>
				{/* Public routes */}
				<Route path="/login" element={<LoginPage />} />
				<Route path="/invite/:token" element={<LoginPage />} />
				<Route path="/set-password" element={<SetPasswordPage />} />

				{/* Protected routes */}
				<Route
					element={
						<RequireAuth>
							<TeamContextProvider>
								<Layout />
							</TeamContextProvider>
						</RequireAuth>
					}
				>
					{/* Root redirect */}
					<Route index element={<SmartRedirect />} />

					{/* Overview (multi-team home) */}
					<Route path="overview" element={<OverviewPage />} />

					{/* User Settings (accessible to all authenticated users) */}
					<Route path="settings/profile" element={<ProfileSettingsPage />} />
					<Route path="settings/preferences" element={<PreferencesPage />} />

					{/* Team-scoped routes */}
					<Route path="t/:team" element={<RequireTeamAccess><DashboardPage /></RequireTeamAccess>} />
					<Route path="t/:team/clusters" element={<RequireTeamAccess><ClustersPage /></RequireTeamAccess>} />
					<Route path="t/:team/clusters/new" element={<RequireTeamAccess><CreateClusterPage /></RequireTeamAccess>} />
					<Route path="t/:team/clusters/:namespace/:name" element={<RequireTeamAccess><ClusterDetailPage /></RequireTeamAccess>} />
					<Route path="t/:team/members" element={<RequireTeamAccess><TeamMembersPage /></RequireTeamAccess>} />
					<Route path="t/:team/settings" element={<RequireTeamAccess><TeamSettingsPage /></RequireTeamAccess>} />

					{/* Admin routes */}
					<Route path="admin" element={<RequireAdmin><AdminDashboard /></RequireAdmin>} />
					<Route path="admin/clusters" element={<RequireAdmin><AdminClustersPage /></RequireAdmin>} />
					<Route path="admin/clusters/:namespace/:name" element={<RequireAdmin><ClusterDetailPage /></RequireAdmin>} />
					<Route path="admin/management" element={<RequireAdmin><ManagementPage /></RequireAdmin>} />
					<Route path="admin/teams" element={<RequireAdmin><AdminTeamsPage /></RequireAdmin>} />
					<Route path="admin/teams/:teamName" element={<RequireAdmin><AdminTeamDetailPage /></RequireAdmin>} />
					<Route path="admin/users" element={<RequireAdmin><UsersPage /></RequireAdmin>} />
					<Route path="admin/providers" element={<RequireAdmin><ProvidersPage /></RequireAdmin>} />
					<Route path="admin/providers/create" element={<RequireAdmin><CreateProviderPage /></RequireAdmin>} />
					<Route path="admin/identity-providers" element={<RequireAdmin><IdentityProvidersPage /></RequireAdmin>} />
					<Route path="admin/identity-providers/create" element={<RequireAdmin><CreateIdentityProviderPage /></RequireAdmin>} />
					<Route path="admin/settings" element={<RequireAdmin><SettingsPage /></RequireAdmin>} />

					{/* Legacy routes (backward compatibility) */}
					<Route path="dashboard" element={<Navigate to="/" replace />} />
					<Route path="management" element={<ManagementPage />} />
					<Route path="clusters" element={<ClustersPage />} />
					<Route path="clusters/create" element={<CreateClusterPage />} />
					<Route path="clusters/:namespace/:name" element={<ClusterDetailPage />} />
					<Route path="providers" element={<ProvidersPage />} />
					<Route path="providers/create" element={<CreateProviderPage />} />
					<Route path="settings" element={<SettingsPage />} />
					<Route path="terminal/:type/:namespace/:cluster" element={<TerminalPage />} />
				</Route>

				{/* Catch all */}
				<Route path="*" element={<Navigate to="/" replace />} />
			</Routes>
		</ToastProvider>
	)
}
