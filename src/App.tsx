// Copyright 2025 The Butler Authors.
// SPDX-License-Identifier: Apache-2.0

import { Routes, Route, Navigate, useLocation } from 'react-router-dom'
import { Layout } from '@/components/layout'
import { ToastProvider } from '@/contexts/ToastContext'
import {
	LoginPage,
	DashboardPage,
	ManagementPage,
	ClustersPage,
	ClusterDetailPage,
	CreateClusterPage,
	CreateProviderPage,
	ProvidersPage,
	SettingsPage,
	TerminalPage,
} from '@/pages'
import { useAuth } from '@/contexts'

function ProtectedRoute({ children }: { children: React.ReactNode }) {
	const { isAuthenticated, isLoading } = useAuth()
	const location = useLocation()

	if (isLoading) {
		return (
			<div className="flex items-center justify-center min-h-screen">
				<div className="animate-spin rounded-full h-8 w-8 border-t-2 border-b-2 border-green-500"></div>
			</div>
		)
	}

	if (!isAuthenticated) {
		return <Navigate to="/login" state={{ from: location }} replace />
	}

	return <>{children}</>
}

export default function App() {
	return (
		<ToastProvider>
			<Routes>
				<Route path="/login" element={<LoginPage />} />
				<Route
					path="/"
					element={
						<ProtectedRoute>
							<Layout />
						</ProtectedRoute>
					}
				>
					<Route index element={<Navigate to="/dashboard" replace />} />
					<Route path="dashboard" element={<DashboardPage />} />
					<Route path="management" element={<ManagementPage />} />
					<Route path="clusters" element={<ClustersPage />} />
					<Route path="clusters/create" element={<CreateClusterPage />} />
					<Route path="clusters/:namespace/:name" element={<ClusterDetailPage />} />
					<Route path="providers" element={<ProvidersPage />} />
					<Route path="providers/create" element={<CreateProviderPage />} />
					<Route path="terminal/:type/:namespace/:cluster" element={<TerminalPage />} />
					<Route path="settings" element={<SettingsPage />} />
				</Route>
				<Route path="*" element={<Navigate to="/dashboard" replace />} />
			</Routes>
		</ToastProvider>
	)
}
