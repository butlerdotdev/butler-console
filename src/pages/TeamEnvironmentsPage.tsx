// Copyright 2026 The Butler Authors.
// SPDX-License-Identifier: Apache-2.0

import { useCallback, useEffect, useMemo, useState } from 'react'
import { useTeamContext } from '@/hooks/useTeamContext'
import { useEnvContext } from '@/hooks/useEnvContext'
import { useDocumentTitle } from '@/hooks'
import { Card, FadeIn, Spinner, Button } from '@/components/ui'
import { EnvironmentList } from '@/components/teams/EnvironmentList'
import { EnvironmentFormModal } from '@/components/teams/EnvironmentFormModal'
import { DeleteEnvironmentModal } from '@/components/teams/DeleteEnvironmentModal'
import { MigrateEnvironmentModal } from '@/components/teams/MigrateEnvironmentModal'
import type { TeamEnvironment } from '@/types/environments'
import { ENVIRONMENT_LABEL } from '@/types/environments'

// Minimal shape for the /api/teams/{name}/clusters response; we only
// need the env label to tally counts for the list view.
interface ClusterListItem {
	metadata?: {
		labels?: Record<string, string>
	}
}

interface ClusterListResponse {
	clusters?: ClusterListItem[]
}

export function TeamEnvironmentsPage() {
	const { currentTeam, currentTeamNamespace, currentTeamDisplayName, isTeamAdmin, canAccessAdmin } = useTeamContext()
	const { availableEnvs, envsLoading, refreshEnvs } = useEnvContext()
	useDocumentTitle(
		currentTeamDisplayName ? `${currentTeamDisplayName} Environments` : 'Environments',
	)

	const canEdit = isTeamAdmin || canAccessAdmin

	const [clusterCounts, setClusterCounts] = useState<Record<string, number>>({})
	const [loadingCounts, setLoadingCounts] = useState(false)
	const [showCreate, setShowCreate] = useState(false)
	const [editing, setEditing] = useState<TeamEnvironment | null>(null)
	const [deleting, setDeleting] = useState<TeamEnvironment | null>(null)
	const [showMigrate, setShowMigrate] = useState(false)

	const fetchClusterCounts = useCallback(async () => {
		if (!currentTeam) return
		setLoadingCounts(true)
		try {
			const res = await fetch(`/api/teams/${encodeURIComponent(currentTeam)}/clusters`, {
				credentials: 'include',
			})
			if (!res.ok) {
				setClusterCounts({})
				return
			}
			const data: ClusterListResponse = await res.json()
			const counts: Record<string, number> = {}
			for (const cluster of data.clusters ?? []) {
				const label = cluster.metadata?.labels?.[ENVIRONMENT_LABEL]
				if (!label) continue
				counts[label] = (counts[label] ?? 0) + 1
			}
			setClusterCounts(counts)
		} catch {
			setClusterCounts({})
		} finally {
			setLoadingCounts(false)
		}
	}, [currentTeam])

	useEffect(() => {
		void fetchClusterCounts()
	}, [fetchClusterCounts])

	const handleSaved = useCallback(async () => {
		setShowCreate(false)
		setEditing(null)
		await refreshEnvs()
		await fetchClusterCounts()
	}, [refreshEnvs, fetchClusterCounts])

	const handleDeleted = useCallback(async () => {
		setDeleting(null)
		await refreshEnvs()
		await fetchClusterCounts()
	}, [refreshEnvs, fetchClusterCounts])

	const deletingCount = useMemo(() => {
		if (!deleting) return 0
		return clusterCounts[deleting.name] ?? 0
	}, [deleting, clusterCounts])

	if (!canEdit) {
		// Page is linked from the sidebar only for team admins / platform
		// admins, but route guards in App.tsx use RequireTeamAccess (not
		// RequireTeamAdmin); render an access-denied card inline rather
		// than redirecting.
		return (
			<FadeIn>
				<div className="space-y-6">
					<div>
						<h1 className="text-2xl font-semibold text-neutral-50">Environments</h1>
						<p className="text-neutral-400 mt-1">Manage team environments</p>
					</div>
					<Card className="p-8 text-center border-amber-500/20 bg-amber-500/5">
						<p className="text-amber-300 font-medium">Access denied</p>
						<p className="text-sm text-amber-200/70 mt-2">
							Managing environments requires team-admin or platform-admin privileges.
							Contact a team admin to adjust envs on your behalf.
						</p>
					</Card>
				</div>
			</FadeIn>
		)
	}

	const loading = envsLoading || loadingCounts

	return (
		<FadeIn>
			<div className="space-y-6">
				<div className="flex items-center justify-between">
					<div>
						<h1 className="text-2xl font-semibold text-neutral-50">Environments</h1>
						<p className="text-neutral-400 mt-1">
							Define and quota envs within {currentTeamDisplayName || currentTeam}.
						</p>
					</div>
					<div className="flex items-center gap-2">
						{availableEnvs.length > 0 && (
							<Button variant="secondary" onClick={() => setShowMigrate(true)}>
								Migrate clusters...
							</Button>
						)}
						<Button onClick={() => setShowCreate(true)}>
							<svg
								className="w-4 h-4 mr-2"
								fill="none"
								stroke="currentColor"
								viewBox="0 0 24 24"
							>
								<path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
							</svg>
							Create environment
						</Button>
					</div>
				</div>

				<Card className="p-4 border-blue-500/20 bg-blue-500/5">
					<div className="flex items-start gap-3">
						<svg
							className="w-5 h-5 text-blue-400 flex-shrink-0 mt-0.5"
							fill="none"
							viewBox="0 0 24 24"
							stroke="currentColor"
						>
							<path
								strokeLinecap="round"
								strokeLinejoin="round"
								strokeWidth={2}
								d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z"
							/>
						</svg>
						<div className="text-sm text-blue-200/80 space-y-1">
							<p>
								Environments gate cluster creation against team-admin-editable
								per-env quotas. Clusters created before an env existed remain
								unlabeled and count against the team total only.
							</p>
							<p>
								Name changes are not supported. To rename, delete and recreate (clusters
								labeled with the old name stay orphaned against env accounting).
							</p>
						</div>
					</div>
				</Card>

				{loading ? (
					<div className="flex items-center justify-center h-32">
						<Spinner size="lg" />
					</div>
				) : (
					<EnvironmentList
						envs={availableEnvs}
						clusterCountsByEnv={clusterCounts}
						canEdit={canEdit}
						onEdit={(env) => setEditing(env)}
						onDelete={(env) => setDeleting(env)}
					/>
				)}

				{currentTeam && (
					<>
						<EnvironmentFormModal
							isOpen={showCreate}
							team={currentTeam}
							mode="create"
							onClose={() => setShowCreate(false)}
							onSaved={handleSaved}
						/>
						<EnvironmentFormModal
							isOpen={!!editing}
							team={currentTeam}
							mode="edit"
							initial={editing ?? undefined}
							onClose={() => setEditing(null)}
							onSaved={handleSaved}
						/>
						<DeleteEnvironmentModal
							isOpen={!!deleting}
							team={currentTeam}
							envName={deleting?.name ?? ''}
							clusterCount={deletingCount}
							onClose={() => setDeleting(null)}
							onDeleted={handleDeleted}
						/>
						<MigrateEnvironmentModal
							isOpen={showMigrate}
							team={currentTeam}
							teamNamespace={currentTeamNamespace}
							envs={availableEnvs}
							onClose={() => setShowMigrate(false)}
							onDone={fetchClusterCounts}
						/>
					</>
				)}
			</div>
		</FadeIn>
	)
}
