// Copyright 2026 The Butler Authors.
// SPDX-License-Identifier: Apache-2.0

import { useState, useEffect, useCallback } from 'react'
import { useParams, Link, useNavigate } from 'react-router-dom'
import { useDocumentTitle } from '@/hooks'
import { useAuth } from '@/hooks/useAuth'
import { useToast } from '@/hooks/useToast'
import { usePermissionWarning } from '@/hooks/usePermissionWarning'
import { clustersApi, type Cluster } from '@/api'
import {
	Button,
	Input,
	Card,
	Spinner,
	StatusBadge,
	FadeIn,
	Modal,
	ModalHeader,
	ModalBody,
	ModalFooter,
	ResourceUsageBar,
} from '@/components/ui'

interface TeamMember {
	email: string
	name?: string
	role: 'admin' | 'operator' | 'viewer'
	source: 'direct' | 'group' | 'elevated'
	groupName?: string
	groupRole?: string
	directRole?: string
	canRemove?: boolean
	removeNote?: string
}

interface GroupSync {
	name: string
	role: 'admin' | 'operator' | 'viewer'
	identityProvider?: string
}

interface IdentityProviderSummary {
	name: string
	displayName?: string
}

interface TeamResourceLimits {
	maxClusters?: number
	maxTotalNodes?: number
	maxNodesPerCluster?: number
	maxCPUCores?: string
	maxMemory?: string
	maxStorage?: string
}

interface TeamResourceUsage {
	clusters: number
	totalNodes: number
	totalCPU?: string
	totalMemory?: string
	totalStorage?: string
	clusterUtilization?: number
	nodeUtilization?: number
	cpuUtilization?: number
	memoryUtilization?: number
}

interface ClusterDefaults {
	kubernetesVersion?: string
	workerCount?: number
	workerCPU?: number
	workerMemoryGi?: number
	workerDiskGi?: number
	defaultAddons?: string[]
}

interface TeamDetails {
	name: string
	displayName: string
	description?: string
	phase: string
	namespace?: string
	clusterCount: number
	memberCount: number
	resourceLimits?: TeamResourceLimits
	resourceUsage?: TeamResourceUsage
	clusterDefaults?: ClusterDefaults
}

export function AdminTeamDetailPage() {
	const { teamName } = useParams<{ teamName: string }>()
	const navigate = useNavigate()
	useDocumentTitle(teamName ? `${teamName} - Team` : 'Team')

	const toast = useToast()
	const { user } = useAuth()
	const { checkAndWarn } = usePermissionWarning()
	const [team, setTeam] = useState<TeamDetails | null>(null)
	const [members, setMembers] = useState<TeamMember[]>([])
	const [clusters, setClusters] = useState<Cluster[]>([])
	const [loading, setLoading] = useState(true)
	const [error, setError] = useState<string | null>(null)

	// Group sync state
	const [groupSyncs, setGroupSyncs] = useState<GroupSync[]>([])
	const [identityProviders, setIdentityProviders] = useState<IdentityProviderSummary[]>([])

	// Add member modal
	const [showAddMemberModal, setShowAddMemberModal] = useState(false)
	const [newMemberEmail, setNewMemberEmail] = useState('')
	const [newMemberRole, setNewMemberRole] = useState<'admin' | 'operator' | 'viewer'>('viewer')
	const [addingMember, setAddingMember] = useState(false)

	// Add group sync modal
	const [showAddGroupSyncModal, setShowAddGroupSyncModal] = useState(false)
	const [newGroupName, setNewGroupName] = useState('')
	const [newGroupRole, setNewGroupRole] = useState<'admin' | 'operator' | 'viewer'>('viewer')
	const [newGroupIdP, setNewGroupIdP] = useState('')
	const [addingGroupSync, setAddingGroupSync] = useState(false)

	// Delete confirmation
	const [memberToRemove, setMemberToRemove] = useState<TeamMember | null>(null)
	const [removing, setRemoving] = useState(false)

	// Group sync to remove
	const [groupSyncToRemove, setGroupSyncToRemove] = useState<GroupSync | null>(null)
	const [removingGroupSync, setRemovingGroupSync] = useState(false)

	// Edit resource limits modal
	const [showEditLimitsModal, setShowEditLimitsModal] = useState(false)
	const [savingLimits, setSavingLimits] = useState(false)

	// Edit cluster defaults modal
	const [showEditDefaultsModal, setShowEditDefaultsModal] = useState(false)
	const [savingDefaults, setSavingDefaults] = useState(false)

	// Delete team
	const [showDeleteTeamModal, setShowDeleteTeamModal] = useState(false)
	const [deletingTeam, setDeletingTeam] = useState(false)
	const [deleteConfirmName, setDeleteConfirmName] = useState('')

	const fetchTeam = useCallback(async () => {
		if (!teamName) return

		try {
			setLoading(true)
			setError(null)

			// Fetch team details
			const teamResponse = await fetch(`/api/teams/${teamName}`, {
				credentials: 'include',
			})

			if (!teamResponse.ok) {
				throw new Error('Failed to fetch team')
			}

			const teamData = await teamResponse.json()
			setTeam(teamData)

			// Fetch members
			const membersResponse = await fetch(`/api/teams/${teamName}/members`, {
				credentials: 'include',
			})

			if (membersResponse.ok) {
				const membersData = await membersResponse.json()
				setMembers(membersData.members || [])
			}

			// Fetch group syncs
			const groupsResponse = await fetch(`/api/teams/${teamName}/groups`, {
				credentials: 'include',
			})

			if (groupsResponse.ok) {
				const groupsData = await groupsResponse.json()
				setGroupSyncs(groupsData.groups || [])
			}

			// Fetch identity providers for the dropdown
			const idpsResponse = await fetch('/api/admin/identity-providers', {
				credentials: 'include',
			})

			if (idpsResponse.ok) {
				const idpsData = await idpsResponse.json()
				const idpList = (idpsData.identityProviders || []).map((idp: { metadata: { name: string }; spec?: { displayName?: string } }) => ({
					name: idp.metadata.name,
					displayName: idp.spec?.displayName || idp.metadata.name,
				}))
				setIdentityProviders(idpList)
			}

			// Fetch clusters for this team
			const clustersResponse = await clustersApi.list({ team: teamName })
			setClusters(clustersResponse.clusters || [])
		} catch (err) {
			setError(err instanceof Error ? err.message : 'Failed to load team')
		} finally {
			setLoading(false)
		}
	}, [teamName])

	useEffect(() => {
		fetchTeam()
	}, [fetchTeam])

	const handleAddMember = async (e: React.FormEvent) => {
		e.preventDefault()
		if (!teamName) return

		setAddingMember(true)

		try {
			const response = await fetch(`/api/admin/teams/${teamName}/members`, {
				method: 'POST',
				headers: { 'Content-Type': 'application/json' },
				credentials: 'include',
				body: JSON.stringify({
					email: newMemberEmail,
					role: newMemberRole,
				}),
			})

			const data = await response.json()

			if (!response.ok) {
				toast.error('Failed to add member', data.error || 'Unknown error')
				return
			}

			if (data.elevated) {
				toast.success('Member Elevated', `${newMemberEmail} elevated from ${data.groupRole} to ${data.role}`)
			} else {
				toast.success('Member Added', `${newMemberEmail} has been added to ${team?.displayName || teamName}`)
			}
			// Check if we modified our own permissions
			checkAndWarn(newMemberEmail)
			setShowAddMemberModal(false)
			setNewMemberEmail('')
			setNewMemberRole('viewer')
			fetchTeam()
		} catch {
			toast.error('Error', 'An error occurred while adding the member')
		} finally {
			setAddingMember(false)
		}
	}

	const handleRemoveMember = async () => {
		if (!teamName || !memberToRemove) return

		setRemoving(true)

		try {
			const response = await fetch(
				`/api/admin/teams/${teamName}/members/${encodeURIComponent(memberToRemove.email)}`,
				{
					method: 'DELETE',
					credentials: 'include',
				}
			)

			const data = await response.json()

			if (!response.ok) {
				toast.error('Failed to remove member', data.error || 'Unknown error')
				return
			}

			if (data.retainsAccess) {
				toast.success('Elevation Removed', `${memberToRemove.email} now has ${data.groupRole} access via ${data.groupName}`)
			} else {
				toast.success('Member Removed', `${memberToRemove.email} has been removed from the team`)
			}
			// Check if we modified our own permissions
			checkAndWarn(memberToRemove.email)
			setMemberToRemove(null)
			fetchTeam()
		} catch {
			toast.error('Error', 'An error occurred while removing the member')
		} finally {
			setRemoving(false)
		}
	}

	const handleChangeRole = async (member: TeamMember, newRole: string) => {
		if (!teamName) return

		// Only direct and elevated members can have their role changed
		if (member.source === 'group') {
			toast.error('Cannot change role', 'This user\'s role is determined by their group membership')
			return
		}

		try {
			const response = await fetch(
				`/api/admin/teams/${teamName}/members/${encodeURIComponent(member.email)}`,
				{
					method: 'PATCH',
					headers: { 'Content-Type': 'application/json' },
					credentials: 'include',
					body: JSON.stringify({ role: newRole }),
				}
			)

			if (!response.ok) {
				const data = await response.json()
				toast.error('Failed to change role', data.error || 'Unknown error')
				return
			}

			toast.success('Role Updated', `${member.email} is now ${newRole}`)
			// Check if we modified our own permissions
			checkAndWarn(member.email)
			fetchTeam()
		} catch {
			toast.error('Error', 'An error occurred while changing the role')
		}
	}

	// Group sync handlers
	const handleAddGroupSync = async (e: React.FormEvent) => {
		e.preventDefault()
		if (!teamName) return

		setAddingGroupSync(true)

		try {
			const response = await fetch(`/api/admin/teams/${teamName}/groups`, {
				method: 'POST',
				headers: { 'Content-Type': 'application/json' },
				credentials: 'include',
				body: JSON.stringify({
					name: newGroupName,
					role: newGroupRole,
					identityProvider: newGroupIdP || undefined,
				}),
			})

			if (!response.ok) {
				const data = await response.json()
				toast.error('Failed to add group sync', data.error || 'Unknown error')
				return
			}

			toast.success('Group Sync Added', `Members of "${newGroupName}" will now have ${newGroupRole} access`)
			// Warn current user since they might be in this group
			if (user?.email) {
				checkAndWarn(user.email)
			}
			setShowAddGroupSyncModal(false)
			setNewGroupName('')
			setNewGroupRole('viewer')
			setNewGroupIdP('')
			fetchTeam()
		} catch {
			toast.error('Error', 'An error occurred while adding the group sync')
		} finally {
			setAddingGroupSync(false)
		}
	}

	const handleRemoveGroupSync = async () => {
		if (!teamName || !groupSyncToRemove) return

		setRemovingGroupSync(true)

		try {
			const params = new URLSearchParams()
			if (groupSyncToRemove.identityProvider) {
				params.set('idp', groupSyncToRemove.identityProvider)
			}
			const url = `/api/admin/teams/${teamName}/groups/${encodeURIComponent(groupSyncToRemove.name)}${params.toString() ? '?' + params.toString() : ''}`

			const response = await fetch(url, {
				method: 'DELETE',
				credentials: 'include',
			})

			if (!response.ok) {
				const data = await response.json()
				toast.error('Failed to remove group sync', data.error || 'Unknown error')
				return
			}

			toast.success('Group Sync Removed', `"${groupSyncToRemove.name}" has been removed`)
			// Warn current user since they might be in this group
			if (user?.email) {
				checkAndWarn(user.email)
			}
			setGroupSyncToRemove(null)
			fetchTeam()
		} catch {
			toast.error('Error', 'An error occurred while removing the group sync')
		} finally {
			setRemovingGroupSync(false)
		}
	}

	const handleChangeGroupRole = async (group: GroupSync, newRole: string) => {
		if (!teamName) return

		try {
			const params = new URLSearchParams()
			if (group.identityProvider) {
				params.set('idp', group.identityProvider)
			}
			const url = `/api/admin/teams/${teamName}/groups/${encodeURIComponent(group.name)}${params.toString() ? '?' + params.toString() : ''}`

			const response = await fetch(url, {
				method: 'PATCH',
				headers: { 'Content-Type': 'application/json' },
				credentials: 'include',
				body: JSON.stringify({ role: newRole }),
			})

			if (!response.ok) {
				const data = await response.json()
				toast.error('Failed to change role', data.error || 'Unknown error')
				return
			}

			toast.success('Role Updated', `Group "${group.name}" role changed to ${newRole}`)
			// Warn current user since they might be in this group
			if (user?.email) {
				checkAndWarn(user.email)
			}
			fetchTeam()
		} catch {
			toast.error('Error', 'An error occurred while changing the role')
		}
	}

	const handleSaveLimits = async (limits: TeamResourceLimits) => {
		if (!teamName) return

		setSavingLimits(true)
		try {
			const body: Record<string, unknown> = {}
			const limitsPayload: Record<string, unknown> = {}

			if (limits.maxClusters != null) limitsPayload.maxClusters = limits.maxClusters
			if (limits.maxTotalNodes != null) limitsPayload.maxTotalNodes = limits.maxTotalNodes
			if (limits.maxNodesPerCluster != null) limitsPayload.maxNodesPerCluster = limits.maxNodesPerCluster
			if (limits.maxCPUCores) limitsPayload.maxCPUCores = limits.maxCPUCores
			if (limits.maxMemory) limitsPayload.maxMemory = limits.maxMemory
			if (limits.maxStorage) limitsPayload.maxStorage = limits.maxStorage

			body.resourceLimits = limitsPayload

			const response = await fetch(`/api/teams/${teamName}`, {
				method: 'PUT',
				headers: { 'Content-Type': 'application/json' },
				credentials: 'include',
				body: JSON.stringify(body),
			})

			if (!response.ok) {
				const data = await response.json()
				toast.error('Failed to update limits', data.error || 'Unknown error')
				return
			}

			toast.success('Limits Updated', 'Resource limits have been updated')
			setShowEditLimitsModal(false)
			fetchTeam()
		} catch {
			toast.error('Error', 'An error occurred while updating resource limits')
		} finally {
			setSavingLimits(false)
		}
	}

	const handleSaveDefaults = async (defaults: ClusterDefaults) => {
		if (!teamName) return

		setSavingDefaults(true)
		try {
			const body: Record<string, unknown> = {}
			const defaultsPayload: Record<string, unknown> = {}

			if (defaults.kubernetesVersion) defaultsPayload.kubernetesVersion = defaults.kubernetesVersion
			if (defaults.workerCount != null) defaultsPayload.workerCount = defaults.workerCount
			if (defaults.workerCPU != null) defaultsPayload.workerCPU = defaults.workerCPU
			if (defaults.workerMemoryGi != null) defaultsPayload.workerMemoryGi = defaults.workerMemoryGi
			if (defaults.workerDiskGi != null) defaultsPayload.workerDiskGi = defaults.workerDiskGi

			body.clusterDefaults = defaultsPayload

			const response = await fetch(`/api/teams/${teamName}`, {
				method: 'PUT',
				headers: { 'Content-Type': 'application/json' },
				credentials: 'include',
				body: JSON.stringify(body),
			})

			if (!response.ok) {
				const data = await response.json()
				toast.error('Failed to update defaults', data.error || 'Unknown error')
				return
			}

			toast.success('Defaults Updated', 'Cluster defaults have been updated')
			setShowEditDefaultsModal(false)
			fetchTeam()
		} catch {
			toast.error('Error', 'An error occurred while updating cluster defaults')
		} finally {
			setSavingDefaults(false)
		}
	}

	const handleDeleteTeam = async () => {
		if (!teamName || deleteConfirmName !== teamName) return

		setDeletingTeam(true)
		try {
			const response = await fetch(`/api/teams/${teamName}`, {
				method: 'DELETE',
				credentials: 'include',
			})

			if (!response.ok) {
				const data = await response.json()
				toast.error('Failed to delete team', data.error || 'Unknown error')
				return
			}

			toast.success('Team Deleted', `${team?.displayName || teamName} has been deleted`)
			navigate('/admin/teams')
		} catch {
			toast.error('Error', 'An error occurred while deleting the team')
		} finally {
			setDeletingTeam(false)
		}
	}

	if (loading) {
		return (
			<div className="flex items-center justify-center h-64">
				<Spinner size="lg" />
			</div>
		)
	}

	if (error || !team) {
		return (
			<Card className="p-6">
				<p className="text-red-400">{error || 'Team not found'}</p>
				<button
					onClick={() => navigate(-1)}
					className="mt-2 text-sm text-violet-400 hover:text-violet-300"
				>
					← Go back
				</button>
			</Card>
		)
	}

	return (
		<FadeIn>
			<div className="space-y-6">
				{/* Header */}
				<div className="flex items-center justify-between">
					<div className="flex items-center gap-4">
						<button
							onClick={() => navigate(-1)}
							className="p-2 hover:bg-neutral-800 rounded-lg transition-colors"
						>
							<svg
								className="w-5 h-5 text-neutral-400"
								fill="none"
								stroke="currentColor"
								viewBox="0 0 24 24"
							>
								<path
									strokeLinecap="round"
									strokeLinejoin="round"
									strokeWidth={2}
									d="M15 19l-7-7 7-7"
								/>
							</svg>
						</button>
						<div>
							<div className="flex items-center gap-3">
								<h1 className="text-2xl font-semibold text-neutral-50">
									{team.displayName || team.name}
								</h1>
								<StatusBadge status={team.phase || 'Ready'} />
							</div>
							<p className="text-neutral-400 mt-1">@{team.name}</p>
						</div>
					</div>
					<Button
						variant="danger"
						size="sm"
						onClick={() => setShowDeleteTeamModal(true)}
						disabled={clusters.length > 0}
						title={clusters.length > 0 ? 'Delete all clusters before removing this team' : undefined}
					>
						<svg className="w-4 h-4 mr-1" fill="none" viewBox="0 0 24 24" stroke="currentColor">
							<path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
						</svg>
						Delete Team
					</Button>
				</div>

				{/* Team Info */}
				<div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
					{/* Details Card */}
					<Card className="p-5">
						<h3 className="text-sm font-medium text-neutral-400 uppercase tracking-wide mb-4">
							Team Details
						</h3>
						<dl className="space-y-3">
							<div className="flex justify-between">
								<dt className="text-neutral-400">Namespace</dt>
								<dd className="text-neutral-50 font-mono text-sm">
									{team.namespace || team.name}
								</dd>
							</div>
							<div className="flex justify-between">
								<dt className="text-neutral-400">Members</dt>
								<dd className="text-neutral-50">{members.length}</dd>
							</div>
							<div className="flex justify-between">
								<dt className="text-neutral-400">Clusters</dt>
								<dd className="text-neutral-50">{clusters.length}</dd>
							</div>
						</dl>
						{team.description && (
							<p className="text-sm text-neutral-400 mt-4 pt-4 border-t border-neutral-800">
								{team.description}
							</p>
						)}
					</Card>

					{/* Quick Stats */}
					<Card className="p-5">
						<h3 className="text-sm font-medium text-neutral-400 uppercase tracking-wide mb-4">
							Cluster Status
						</h3>
						<div className="grid grid-cols-2 gap-4">
							<div>
								<p className="text-2xl font-bold text-green-400">
									{clusters.filter((c) => c.status?.phase === 'Ready').length}
								</p>
								<p className="text-sm text-neutral-500">Ready</p>
							</div>
							<div>
								<p className="text-2xl font-bold text-yellow-400">
									{clusters.filter((c) =>
										['Provisioning', 'Pending', 'Scaling'].includes(c.status?.phase || '')
									).length}
								</p>
								<p className="text-sm text-neutral-500">Provisioning</p>
							</div>
							<div>
								<p className="text-2xl font-bold text-red-400">
									{clusters.filter((c) => c.status?.phase === 'Failed').length}
								</p>
								<p className="text-sm text-neutral-500">Failed</p>
							</div>
							<div>
								<p className="text-2xl font-bold text-neutral-400">
									{clusters.length}
								</p>
								<p className="text-sm text-neutral-500">Total</p>
							</div>
						</div>
					</Card>

					{/* Quick Actions */}
					<Card className="p-5">
						<h3 className="text-sm font-medium text-neutral-400 uppercase tracking-wide mb-4">
							Quick Actions
						</h3>
						<div className="space-y-2">
							<Button
								className="w-full justify-start"
								variant="secondary"
								onClick={() => setShowAddMemberModal(true)}
							>
								<svg
									className="w-4 h-4 mr-2"
									fill="none"
									viewBox="0 0 24 24"
									stroke="currentColor"
								>
									<path
										strokeLinecap="round"
										strokeLinejoin="round"
										strokeWidth={2}
										d="M18 9v3m0 0v3m0-3h3m-3 0h-3m-2-5a4 4 0 11-8 0 4 4 0 018 0zM3 20a6 6 0 0112 0v1H3v-1z"
									/>
								</svg>
								Add Member
							</Button>
							<Link to={`/t/${team.name}`} className="block">
								<Button className="w-full justify-start" variant="secondary">
									<svg
										className="w-4 h-4 mr-2"
										fill="none"
										viewBox="0 0 24 24"
										stroke="currentColor"
									>
										<path
											strokeLinecap="round"
											strokeLinejoin="round"
											strokeWidth={2}
											d="M15 12a3 3 0 11-6 0 3 3 0 016 0z"
										/>
										<path
											strokeLinecap="round"
											strokeLinejoin="round"
											strokeWidth={2}
											d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z"
										/>
									</svg>
									View as Team
								</Button>
							</Link>
						</div>
					</Card>
				</div>

				{/* Resource Usage Section */}
				<Card className="p-5">
					<div className="flex items-center justify-between mb-4">
						<h3 className="text-sm font-medium text-neutral-400 uppercase tracking-wide">
							Resource Usage
						</h3>
						<Button size="sm" variant="secondary" onClick={() => setShowEditLimitsModal(true)}>
							Edit Limits
						</Button>
					</div>
					{team.resourceUsage ? (
						<div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-x-8 gap-y-4">
							<ResourceUsageBar
								label="Clusters"
								used={team.resourceUsage.clusters}
								limit={team.resourceLimits?.maxClusters}
							/>
							<ResourceUsageBar
								label="Total Nodes"
								used={team.resourceUsage.totalNodes}
								limit={team.resourceLimits?.maxTotalNodes}
							/>
							<ResourceUsageBar
								label="CPU Cores"
								used={team.resourceUsage.totalCPU || '0'}
								limit={team.resourceLimits?.maxCPUCores}
								unit="cores"
							/>
							<ResourceUsageBar
								label="Memory"
								used={team.resourceUsage.totalMemory || '0'}
								limit={team.resourceLimits?.maxMemory}
							/>
							<ResourceUsageBar
								label="Storage"
								used={team.resourceUsage.totalStorage || '0'}
								limit={team.resourceLimits?.maxStorage}
							/>
							{team.resourceLimits?.maxNodesPerCluster != null && (
								<div className="space-y-1.5">
									<div className="flex justify-between items-baseline">
										<span className="text-sm text-neutral-300">Max Nodes per Cluster</span>
										<span className="text-sm font-mono text-neutral-400">
											{team.resourceLimits.maxNodesPerCluster}
										</span>
									</div>
									<div className="h-2" />
								</div>
							)}
						</div>
					) : (
						<div className="text-sm text-neutral-500">
							Resource usage data is not yet available. The controller has not populated usage metrics for this team.
						</div>
					)}
				</Card>

				{/* Cluster Defaults Section */}
				<Card className="p-5">
					<div className="flex items-center justify-between mb-4">
						<h3 className="text-sm font-medium text-neutral-400 uppercase tracking-wide">
							Cluster Defaults
						</h3>
						<Button size="sm" variant="secondary" onClick={() => setShowEditDefaultsModal(true)}>
							Edit Defaults
						</Button>
					</div>
					{team.clusterDefaults ? (
						<div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-5 gap-4">
							{team.clusterDefaults.kubernetesVersion && (
								<div>
									<p className="text-xs text-neutral-500">K8s Version</p>
									<p className="text-sm font-mono text-neutral-200">{team.clusterDefaults.kubernetesVersion}</p>
								</div>
							)}
							{team.clusterDefaults.workerCount != null && (
								<div>
									<p className="text-xs text-neutral-500">Worker Count</p>
									<p className="text-sm font-mono text-neutral-200">{team.clusterDefaults.workerCount}</p>
								</div>
							)}
							{team.clusterDefaults.workerCPU != null && (
								<div>
									<p className="text-xs text-neutral-500">Worker CPU</p>
									<p className="text-sm font-mono text-neutral-200">{team.clusterDefaults.workerCPU} cores</p>
								</div>
							)}
							{team.clusterDefaults.workerMemoryGi != null && (
								<div>
									<p className="text-xs text-neutral-500">Worker Memory</p>
									<p className="text-sm font-mono text-neutral-200">{team.clusterDefaults.workerMemoryGi} Gi</p>
								</div>
							)}
							{team.clusterDefaults.workerDiskGi != null && (
								<div>
									<p className="text-xs text-neutral-500">Worker Disk</p>
									<p className="text-sm font-mono text-neutral-200">{team.clusterDefaults.workerDiskGi} Gi</p>
								</div>
							)}
						</div>
					) : (
						<div className="text-sm text-neutral-500">
							No cluster defaults configured. New clusters will use platform defaults.
						</div>
					)}
				</Card>

				{/* Members Section */}
				<Card className="overflow-hidden">
					<div className="px-5 py-4 border-b border-neutral-800 flex items-center justify-between">
						<h2 className="text-lg font-medium text-neutral-100">Members</h2>
						<Button size="sm" onClick={() => setShowAddMemberModal(true)}>
							<svg
								className="w-4 h-4 mr-1"
								fill="none"
								viewBox="0 0 24 24"
								stroke="currentColor"
							>
								<path
									strokeLinecap="round"
									strokeLinejoin="round"
									strokeWidth={2}
									d="M12 4v16m8-8H4"
								/>
							</svg>
							Add Member
						</Button>
					</div>

					{members.length === 0 ? (
						<div className="px-5 py-8 text-center text-neutral-500">
							No members in this team
						</div>
					) : (
						<table className="w-full">
							<thead className="bg-neutral-800/50">
								<tr>
									<th className="px-5 py-3 text-left text-xs font-medium text-neutral-400 uppercase">
										Email
									</th>
									<th className="px-5 py-3 text-left text-xs font-medium text-neutral-400 uppercase">
										Role
									</th>
									<th className="px-5 py-3 text-right text-xs font-medium text-neutral-400 uppercase">
										Actions
									</th>
								</tr>
							</thead>
							<tbody className="divide-y divide-neutral-800">
								{members.map((member) => (
									<tr key={member.email} className="hover:bg-neutral-800/30">
										<td className="px-5 py-4">
											<div className="flex items-center gap-2">
												<span className="text-neutral-200">{member.email}</span>
												{member.source === 'elevated' && (
													<span className="px-1.5 py-0.5 text-[10px] font-medium bg-amber-500/20 text-amber-400 rounded">
														ELEVATED
													</span>
												)}
											</div>
										</td>
										<td className="px-5 py-4">
											{member.source === 'group' ? (
												<div className="flex items-center gap-2">
													<span className={`px-2 py-1 text-xs rounded ${member.role === 'admin' ? 'bg-violet-500/20 text-violet-400' :
														member.role === 'operator' ? 'bg-green-500/20 text-green-400' :
															'bg-neutral-700 text-neutral-300'
														}`}>
														{member.role}
													</span>
													<span className="text-xs text-blue-400 flex items-center gap-1" title={`Role from ${member.groupName}`}>
														<svg className="w-3 h-3" fill="none" viewBox="0 0 24 24" stroke="currentColor">
															<path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0zm6 3a2 2 0 11-4 0 2 2 0 014 0zM7 10a2 2 0 11-4 0 2 2 0 014 0z" />
														</svg>
														via group
													</span>
												</div>
											) : member.source === 'elevated' ? (
												<div className="flex items-center gap-2">
													<select
														value={member.role}
														onChange={(e) => handleChangeRole(member, e.target.value)}
														className="text-sm px-2 py-1 rounded bg-neutral-800 border border-neutral-700 text-neutral-200 focus:outline-none focus:ring-1 focus:ring-violet-500"
													>
														<option value="viewer">Viewer</option>
														<option value="operator">Operator</option>
														<option value="admin">Admin</option>
													</select>
													<span className="text-xs text-amber-400" title={`Elevated from ${member.groupRole} via ${member.groupName}`}>
														↑ from {member.groupRole}
													</span>
												</div>
											) : (
												<select
													value={member.role}
													onChange={(e) => handleChangeRole(member, e.target.value)}
													className="text-sm px-2 py-1 rounded bg-neutral-800 border border-neutral-700 text-neutral-200 focus:outline-none focus:ring-1 focus:ring-violet-500"
												>
													<option value="viewer">Viewer</option>
													<option value="operator">Operator</option>
													<option value="admin">Admin</option>
												</select>
											)}
										</td>
										<td className="px-5 py-4 text-right">
											{member.source === 'group' ? (
												<span className="text-xs text-neutral-500" title="Manage via group membership">
													via group
												</span>
											) : member.source === 'elevated' ? (
												<button
													onClick={() => setMemberToRemove(member)}
													className="text-sm text-amber-400 hover:text-amber-300"
													title={member.removeNote}
												>
													Remove Elevation
												</button>
											) : (
												<button
													onClick={() => setMemberToRemove(member)}
													className="text-sm text-red-400 hover:text-red-300"
												>
													Remove
												</button>
											)}
										</td>
									</tr>
								))}
							</tbody>
						</table>
					)}
				</Card>

				{/* Group Sync Section */}
				<Card className="overflow-hidden">
					<div className="px-5 py-4 border-b border-neutral-800 flex items-center justify-between">
						<div>
							<h2 className="text-lg font-medium text-neutral-100">Group Sync</h2>
							<p className="text-xs text-neutral-500 mt-0.5">
								Automatically grant access to users based on their IdP groups
							</p>
						</div>
						<Button size="sm" onClick={() => setShowAddGroupSyncModal(true)}>
							<svg
								className="w-4 h-4 mr-1"
								fill="none"
								viewBox="0 0 24 24"
								stroke="currentColor"
							>
								<path
									strokeLinecap="round"
									strokeLinejoin="round"
									strokeWidth={2}
									d="M12 4v16m8-8H4"
								/>
							</svg>
							Add Group
						</Button>
					</div>

					{groupSyncs.length === 0 ? (
						<div className="px-5 py-8 text-center">
							<div className="text-neutral-500 mb-2">No group syncs configured</div>
							<p className="text-xs text-neutral-600">
								Map IdP groups to automatically grant team access to their members
							</p>
						</div>
					) : (
						<table className="w-full">
							<thead className="bg-neutral-800/50">
								<tr>
									<th className="px-5 py-3 text-left text-xs font-medium text-neutral-400 uppercase">
										Group
									</th>
									<th className="px-5 py-3 text-left text-xs font-medium text-neutral-400 uppercase">
										Identity Provider
									</th>
									<th className="px-5 py-3 text-left text-xs font-medium text-neutral-400 uppercase">
										Role
									</th>
									<th className="px-5 py-3 text-right text-xs font-medium text-neutral-400 uppercase">
										Actions
									</th>
								</tr>
							</thead>
							<tbody className="divide-y divide-neutral-800">
								{groupSyncs.map((group, index) => (
									<tr key={`${group.name}-${group.identityProvider || index}`} className="hover:bg-neutral-800/30">
										<td className="px-5 py-4">
											<span className="text-neutral-200 font-mono text-sm">{group.name}</span>
										</td>
										<td className="px-5 py-4">
											{group.identityProvider ? (
												<span className="text-neutral-300">{group.identityProvider}</span>
											) : (
												<span className="text-neutral-500 italic">Any</span>
											)}
										</td>
										<td className="px-5 py-4">
											<select
												value={group.role}
												onChange={(e) => handleChangeGroupRole(group, e.target.value)}
												className="text-sm px-2 py-1 rounded bg-neutral-800 border border-neutral-700 text-neutral-200 focus:outline-none focus:ring-1 focus:ring-violet-500"
											>
												<option value="viewer">Viewer</option>
												<option value="operator">Operator</option>
												<option value="admin">Admin</option>
											</select>
										</td>
										<td className="px-5 py-4 text-right">
											<button
												onClick={() => setGroupSyncToRemove(group)}
												className="text-sm text-red-400 hover:text-red-300"
											>
												Remove
											</button>
										</td>
									</tr>
								))}
							</tbody>
						</table>
					)}
				</Card>

				{/* Clusters Section */}
				<Card className="overflow-hidden">
					<div className="px-5 py-4 border-b border-neutral-800 flex items-center justify-between">
						<h2 className="text-lg font-medium text-neutral-100">Clusters</h2>
						<Link to={`/admin/clusters?team=${team.name}`}>
							<span className="text-sm text-violet-400 hover:text-violet-300">
								View all →
							</span>
						</Link>
					</div>

					{clusters.length === 0 ? (
						<div className="px-5 py-8 text-center text-neutral-500">
							No clusters in this team
						</div>
					) : (
						<div className="divide-y divide-neutral-800">
							{clusters.slice(0, 5).map((cluster) => (
								<Link
									key={`${cluster.metadata.namespace}/${cluster.metadata.name}`}
									to={`/admin/clusters/${cluster.metadata.namespace}/${cluster.metadata.name}`}
									className="flex items-center justify-between px-5 py-4 hover:bg-neutral-800/50 transition-colors"
								>
									<div className="flex items-center gap-3">
										<div className="w-10 h-10 rounded-lg bg-green-500/10 flex items-center justify-center">
											<svg
												className="w-5 h-5 text-green-500"
												fill="none"
												stroke="currentColor"
												viewBox="0 0 24 24"
											>
												<path
													strokeLinecap="round"
													strokeLinejoin="round"
													strokeWidth={2}
													d="M5 12h14M5 12a2 2 0 01-2-2V6a2 2 0 012-2h14a2 2 0 012 2v4a2 2 0 01-2 2M5 12a2 2 0 00-2 2v4a2 2 0 002 2h14a2 2 0 002-2v-4a2 2 0 00-2-2"
												/>
											</svg>
										</div>
										<div>
											<p className="font-medium text-neutral-200">
												{cluster.metadata.name}
											</p>
											<p className="text-xs text-neutral-500">
												{cluster.spec.kubernetesVersion} • {cluster.spec.workers?.replicas || 0} workers
											</p>
										</div>
									</div>
									<div className="flex items-center gap-4">
										<StatusBadge status={cluster.status?.phase || 'Unknown'} />
										<svg
											className="w-5 h-5 text-neutral-600"
											fill="none"
											viewBox="0 0 24 24"
											stroke="currentColor"
										>
											<path
												strokeLinecap="round"
												strokeLinejoin="round"
												strokeWidth={2}
												d="M9 5l7 7-7 7"
											/>
										</svg>
									</div>
								</Link>
							))}
						</div>
					)}
				</Card>
			</div>

			{/* Add Member Modal */}
			<Modal isOpen={showAddMemberModal} onClose={() => setShowAddMemberModal(false)}>
				<ModalHeader>
					<h2 className="text-lg font-semibold text-neutral-100">Add Team Member</h2>
				</ModalHeader>
				<form onSubmit={handleAddMember}>
					<ModalBody className="space-y-4">
						{groupSyncs.length > 0 && (
							<div className="p-3 bg-blue-500/10 border border-blue-500/20 rounded-lg">
								<p className="text-sm text-blue-200">
									If this user already has access via a group, you can only add them with a higher role to elevate their permissions.
								</p>
							</div>
						)}

						<Input
							id="memberEmail"
							label="User Email"
							type="email"
							value={newMemberEmail}
							onChange={(e) => setNewMemberEmail(e.target.value)}
							placeholder="user@example.com"
							required
						/>

						<div>
							<label className="block text-sm font-medium text-neutral-300 mb-1">
								Role
							</label>
							<select
								value={newMemberRole}
								onChange={(e) =>
									setNewMemberRole(e.target.value as 'admin' | 'operator' | 'viewer')
								}
								className="w-full px-3 py-2 bg-neutral-800 border border-neutral-700 rounded-lg text-neutral-200 focus:outline-none focus:ring-2 focus:ring-violet-500"
							>
								<option value="viewer">Viewer - Can view resources</option>
								<option value="operator">Operator - Can manage clusters</option>
								<option value="admin">Admin - Full team access</option>
							</select>
						</div>
					</ModalBody>
					<ModalFooter>
						<Button
							type="button"
							variant="secondary"
							onClick={() => setShowAddMemberModal(false)}
						>
							Cancel
						</Button>
						<Button type="submit" disabled={addingMember}>
							{addingMember ? 'Adding...' : 'Add Member'}
						</Button>
					</ModalFooter>
				</form>
			</Modal>

			{/* Remove Member Confirmation */}
			<Modal isOpen={!!memberToRemove} onClose={() => setMemberToRemove(null)}>
				<ModalHeader>
					<h2 className="text-lg font-semibold text-neutral-100">
						{memberToRemove?.source === 'elevated' ? 'Remove Elevation' : 'Remove Member'}
					</h2>
				</ModalHeader>
				<ModalBody>
					{memberToRemove?.source === 'elevated' ? (
						<>
							<p className="text-neutral-400">
								Remove elevated access for{' '}
								<strong className="text-neutral-200">{memberToRemove?.email}</strong>?
							</p>
							<p className="text-sm text-amber-400/80 mt-2">
								They will revert to {memberToRemove?.groupRole} access via {memberToRemove?.groupName}.
							</p>
						</>
					) : (
						<p className="text-neutral-400">
							Are you sure you want to remove{' '}
							<strong className="text-neutral-200">{memberToRemove?.email}</strong> from{' '}
							<strong className="text-neutral-200">{team.displayName || team.name}</strong>?
						</p>
					)}
				</ModalBody>
				<ModalFooter>
					<Button variant="secondary" onClick={() => setMemberToRemove(null)}>
						Cancel
					</Button>
					<Button variant="danger" onClick={handleRemoveMember} disabled={removing}>
						{removing ? 'Removing...' : memberToRemove?.source === 'elevated' ? 'Remove Elevation' : 'Remove Member'}
					</Button>
				</ModalFooter>
			</Modal>

			{/* Add Group Sync Modal */}
			<Modal isOpen={showAddGroupSyncModal} onClose={() => setShowAddGroupSyncModal(false)}>
				<ModalHeader>
					<h2 className="text-lg font-semibold text-neutral-100">Add Group Sync</h2>
				</ModalHeader>
				<form onSubmit={handleAddGroupSync}>
					<ModalBody className="space-y-4">
						<Input
							id="groupName"
							label="Group Name"
							value={newGroupName}
							onChange={(e) => setNewGroupName(e.target.value)}
							placeholder="engineering-platform"
							required
						/>
						<p className="text-xs text-neutral-500 -mt-2">
							The group name as it appears in your identity provider (e.g., AD group name, Google group, Okta group)
						</p>

						<div>
							<label className="block text-sm font-medium text-neutral-300 mb-1">
								Identity Provider (Optional)
							</label>
							<select
								value={newGroupIdP}
								onChange={(e) => setNewGroupIdP(e.target.value)}
								className="w-full px-3 py-2 bg-neutral-800 border border-neutral-700 rounded-lg text-neutral-200 focus:outline-none focus:ring-2 focus:ring-violet-500"
							>
								<option value="">Any identity provider</option>
								{identityProviders.map((idp) => (
									<option key={idp.name} value={idp.name}>
										{idp.displayName || idp.name}
									</option>
								))}
							</select>
							<p className="text-xs text-neutral-500 mt-1">
								Restrict this mapping to a specific IdP, or leave as "Any" to match groups from any provider
							</p>
						</div>

						<div>
							<label className="block text-sm font-medium text-neutral-300 mb-1">
								Role
							</label>
							<select
								value={newGroupRole}
								onChange={(e) =>
									setNewGroupRole(e.target.value as 'admin' | 'operator' | 'viewer')
								}
								className="w-full px-3 py-2 bg-neutral-800 border border-neutral-700 rounded-lg text-neutral-200 focus:outline-none focus:ring-2 focus:ring-violet-500"
							>
								<option value="viewer">Viewer - Can view resources</option>
								<option value="operator">Operator - Can manage clusters</option>
								<option value="admin">Admin - Full team access</option>
							</select>
						</div>
					</ModalBody>
					<ModalFooter>
						<Button
							type="button"
							variant="secondary"
							onClick={() => setShowAddGroupSyncModal(false)}
						>
							Cancel
						</Button>
						<Button type="submit" disabled={addingGroupSync}>
							{addingGroupSync ? 'Adding...' : 'Add Group Sync'}
						</Button>
					</ModalFooter>
				</form>
			</Modal>

			{/* Remove Group Sync Confirmation */}
			<Modal isOpen={!!groupSyncToRemove} onClose={() => setGroupSyncToRemove(null)}>
				<ModalHeader>
					<h2 className="text-lg font-semibold text-neutral-100">Remove Group Sync</h2>
				</ModalHeader>
				<ModalBody>
					<p className="text-neutral-400">
						Are you sure you want to remove the group sync for{' '}
						<strong className="text-neutral-200 font-mono">{groupSyncToRemove?.name}</strong>
						{groupSyncToRemove?.identityProvider && (
							<>
								{' '}from <strong className="text-neutral-200">{groupSyncToRemove.identityProvider}</strong>
							</>
						)}
						?
					</p>
					<p className="text-sm text-neutral-500 mt-2">
						Users from this group will lose access unless they have direct membership or match another group sync.
					</p>
				</ModalBody>
				<ModalFooter>
					<Button variant="secondary" onClick={() => setGroupSyncToRemove(null)}>
						Cancel
					</Button>
					<Button variant="danger" onClick={handleRemoveGroupSync} disabled={removingGroupSync}>
						{removingGroupSync ? 'Removing...' : 'Remove Group Sync'}
					</Button>
				</ModalFooter>
			</Modal>
			{/* Edit Resource Limits Modal */}
			<EditResourceLimitsModal
				isOpen={showEditLimitsModal}
				onClose={() => setShowEditLimitsModal(false)}
				onSave={handleSaveLimits}
				currentLimits={team.resourceLimits}
				saving={savingLimits}
			/>

			{/* Edit Cluster Defaults Modal */}
			<EditClusterDefaultsModal
				isOpen={showEditDefaultsModal}
				onClose={() => setShowEditDefaultsModal(false)}
				onSave={handleSaveDefaults}
				currentDefaults={team.clusterDefaults}
				saving={savingDefaults}
			/>

			{/* Delete Team Confirmation */}
			<Modal isOpen={showDeleteTeamModal} onClose={() => { setShowDeleteTeamModal(false); setDeleteConfirmName('') }}>
				<ModalHeader>
					<h2 className="text-lg font-semibold text-neutral-100">Delete Team</h2>
				</ModalHeader>
				<ModalBody className="space-y-4">
					<p className="text-neutral-400">
						This will permanently delete{' '}
						<strong className="text-neutral-200">{team.displayName || team.name}</strong> and
						its namespace. This action cannot be undone.
					</p>
					{clusters.length > 0 && (
						<div className="p-3 bg-red-500/10 border border-red-500/20 rounded-lg">
							<p className="text-sm text-red-300">
								This team has <strong>{clusters.length} cluster{clusters.length !== 1 ? 's' : ''}</strong> that
								will be affected. Ensure all clusters are deleted before removing the team.
							</p>
						</div>
					)}
					{members.length > 0 && (
						<p className="text-sm text-neutral-500">
							{members.length} member{members.length !== 1 ? 's' : ''} will lose access.
						</p>
					)}
					<Input
						id="deleteConfirm"
						label={`Type "${teamName}" to confirm`}
						value={deleteConfirmName}
						onChange={(e) => setDeleteConfirmName(e.target.value)}
						placeholder={teamName}
					/>
				</ModalBody>
				<ModalFooter>
					<Button variant="secondary" onClick={() => { setShowDeleteTeamModal(false); setDeleteConfirmName('') }}>
						Cancel
					</Button>
					<Button
						variant="danger"
						onClick={handleDeleteTeam}
						disabled={deletingTeam || deleteConfirmName !== teamName}
					>
						{deletingTeam ? 'Deleting...' : 'Delete Team'}
					</Button>
				</ModalFooter>
			</Modal>
		</FadeIn>
	)
}

function EditResourceLimitsModal({
	isOpen,
	onClose,
	onSave,
	currentLimits,
	saving,
}: {
	isOpen: boolean
	onClose: () => void
	onSave: (limits: TeamResourceLimits) => void
	currentLimits?: TeamResourceLimits
	saving: boolean
}) {
	const [form, setForm] = useState({
		maxClusters: '',
		maxTotalNodes: '',
		maxNodesPerCluster: '',
		maxCPUCores: '',
		maxMemory: '',
		maxStorage: '',
	})

	const [lastOpenLimits, setLastOpenLimits] = useState(false)
	if (isOpen && !lastOpenLimits) {
		setForm({
			maxClusters: currentLimits?.maxClusters?.toString() || '',
			maxTotalNodes: currentLimits?.maxTotalNodes?.toString() || '',
			maxNodesPerCluster: currentLimits?.maxNodesPerCluster?.toString() || '',
			maxCPUCores: currentLimits?.maxCPUCores || '',
			maxMemory: currentLimits?.maxMemory || '',
			maxStorage: currentLimits?.maxStorage || '',
		})
	}
	if (isOpen !== lastOpenLimits) {
		setLastOpenLimits(isOpen)
	}

	const handleSubmit = (e: React.FormEvent) => {
		e.preventDefault()
		const limits: TeamResourceLimits = {}
		if (form.maxClusters) limits.maxClusters = parseInt(form.maxClusters, 10)
		if (form.maxTotalNodes) limits.maxTotalNodes = parseInt(form.maxTotalNodes, 10)
		if (form.maxNodesPerCluster) limits.maxNodesPerCluster = parseInt(form.maxNodesPerCluster, 10)
		if (form.maxCPUCores) limits.maxCPUCores = form.maxCPUCores
		if (form.maxMemory) limits.maxMemory = form.maxMemory
		if (form.maxStorage) limits.maxStorage = form.maxStorage
		onSave(limits)
	}

	return (
		<Modal isOpen={isOpen} onClose={onClose}>
			<ModalHeader>
				<h2 className="text-lg font-semibold text-neutral-100">Edit Resource Limits</h2>
			</ModalHeader>
			<form onSubmit={handleSubmit}>
				<ModalBody className="space-y-4">
					<p className="text-sm text-neutral-500">
						Set resource quotas for this team. Leave fields empty to remove the limit.
					</p>
					<div className="grid grid-cols-2 gap-4">
						<Input
							id="maxClusters"
							label="Max Clusters"
							type="number"
							min={0}
							value={form.maxClusters}
							onChange={(e) => setForm({ ...form, maxClusters: e.target.value })}
							placeholder="Unlimited"
						/>
						<Input
							id="maxTotalNodes"
							label="Max Total Nodes"
							type="number"
							min={0}
							value={form.maxTotalNodes}
							onChange={(e) => setForm({ ...form, maxTotalNodes: e.target.value })}
							placeholder="Unlimited"
						/>
						<Input
							id="maxNodesPerCluster"
							label="Max Nodes per Cluster"
							type="number"
							min={0}
							value={form.maxNodesPerCluster}
							onChange={(e) => setForm({ ...form, maxNodesPerCluster: e.target.value })}
							placeholder="Unlimited"
						/>
						<Input
							id="maxCPUCores"
							label="Max CPU Cores"
							value={form.maxCPUCores}
							onChange={(e) => setForm({ ...form, maxCPUCores: e.target.value })}
							placeholder="e.g. 200"
						/>
						<Input
							id="maxMemory"
							label="Max Memory"
							value={form.maxMemory}
							onChange={(e) => setForm({ ...form, maxMemory: e.target.value })}
							placeholder="e.g. 400Gi"
						/>
						<Input
							id="maxStorage"
							label="Max Storage"
							value={form.maxStorage}
							onChange={(e) => setForm({ ...form, maxStorage: e.target.value })}
							placeholder="e.g. 2Ti"
						/>
					</div>
				</ModalBody>
				<ModalFooter>
					<Button type="button" variant="secondary" onClick={onClose}>
						Cancel
					</Button>
					<Button type="submit" disabled={saving}>
						{saving ? 'Saving...' : 'Save Limits'}
					</Button>
				</ModalFooter>
			</form>
		</Modal>
	)
}

function EditClusterDefaultsModal({
	isOpen,
	onClose,
	onSave,
	currentDefaults,
	saving,
}: {
	isOpen: boolean
	onClose: () => void
	onSave: (defaults: ClusterDefaults) => void
	currentDefaults?: ClusterDefaults
	saving: boolean
}) {
	const [form, setForm] = useState({
		kubernetesVersion: '',
		workerCount: '',
		workerCPU: '',
		workerMemoryGi: '',
		workerDiskGi: '',
	})

	const [lastOpenDefaults, setLastOpenDefaults] = useState(false)
	if (isOpen && !lastOpenDefaults) {
		setForm({
			kubernetesVersion: currentDefaults?.kubernetesVersion || '',
			workerCount: currentDefaults?.workerCount?.toString() || '',
			workerCPU: currentDefaults?.workerCPU?.toString() || '',
			workerMemoryGi: currentDefaults?.workerMemoryGi?.toString() || '',
			workerDiskGi: currentDefaults?.workerDiskGi?.toString() || '',
		})
	}
	if (isOpen !== lastOpenDefaults) {
		setLastOpenDefaults(isOpen)
	}

	const handleSubmit = (e: React.FormEvent) => {
		e.preventDefault()
		const defaults: ClusterDefaults = {}
		if (form.kubernetesVersion) defaults.kubernetesVersion = form.kubernetesVersion
		if (form.workerCount) defaults.workerCount = parseInt(form.workerCount, 10)
		if (form.workerCPU) defaults.workerCPU = parseInt(form.workerCPU, 10)
		if (form.workerMemoryGi) defaults.workerMemoryGi = parseInt(form.workerMemoryGi, 10)
		if (form.workerDiskGi) defaults.workerDiskGi = parseInt(form.workerDiskGi, 10)
		onSave(defaults)
	}

	return (
		<Modal isOpen={isOpen} onClose={onClose}>
			<ModalHeader>
				<h2 className="text-lg font-semibold text-neutral-100">Edit Cluster Defaults</h2>
			</ModalHeader>
			<form onSubmit={handleSubmit}>
				<ModalBody className="space-y-4">
					<p className="text-sm text-neutral-500">
						Set default values for new clusters created by this team. Leave fields empty to use platform defaults.
					</p>
					<Input
						id="kubernetesVersion"
						label="Kubernetes Version"
						value={form.kubernetesVersion}
						onChange={(e) => setForm({ ...form, kubernetesVersion: e.target.value })}
						placeholder="e.g. v1.31.0"
					/>
					<div className="grid grid-cols-2 gap-4">
						<Input
							id="workerCount"
							label="Worker Count"
							type="number"
							min={0}
							value={form.workerCount}
							onChange={(e) => setForm({ ...form, workerCount: e.target.value })}
							placeholder="Platform default"
						/>
						<Input
							id="workerCPU"
							label="Worker CPU (cores)"
							type="number"
							min={1}
							value={form.workerCPU}
							onChange={(e) => setForm({ ...form, workerCPU: e.target.value })}
							placeholder="Platform default"
						/>
						<Input
							id="workerMemoryGi"
							label="Worker Memory (Gi)"
							type="number"
							min={1}
							value={form.workerMemoryGi}
							onChange={(e) => setForm({ ...form, workerMemoryGi: e.target.value })}
							placeholder="Platform default"
						/>
						<Input
							id="workerDiskGi"
							label="Worker Disk (Gi)"
							type="number"
							min={10}
							value={form.workerDiskGi}
							onChange={(e) => setForm({ ...form, workerDiskGi: e.target.value })}
							placeholder="Platform default"
						/>
					</div>
				</ModalBody>
				<ModalFooter>
					<Button type="button" variant="secondary" onClick={onClose}>
						Cancel
					</Button>
					<Button type="submit" disabled={saving}>
						{saving ? 'Saving...' : 'Save Defaults'}
					</Button>
				</ModalFooter>
			</form>
		</Modal>
	)
}
