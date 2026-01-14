// Copyright 2026 The Butler Authors.
// SPDX-License-Identifier: Apache-2.0

import { useState, useEffect, useCallback } from 'react'
import { useParams, Link, useNavigate } from 'react-router-dom'
import { useDocumentTitle } from '@/hooks'
import { useToast } from '@/hooks/useToast'
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
} from '@/components/ui'

interface TeamMember {
	email: string
	role: 'admin' | 'operator' | 'viewer'
}

interface TeamDetails {
	name: string
	displayName: string
	description?: string
	phase: string
	namespace?: string
	clusterCount: number
	memberCount: number
}

export function AdminTeamDetailPage() {
	const { teamName } = useParams<{ teamName: string }>()
	const navigate = useNavigate()
	useDocumentTitle(teamName ? `${teamName} - Team` : 'Team')

	const toast = useToast()
	const [team, setTeam] = useState<TeamDetails | null>(null)
	const [members, setMembers] = useState<TeamMember[]>([])
	const [clusters, setClusters] = useState<Cluster[]>([])
	const [loading, setLoading] = useState(true)
	const [error, setError] = useState<string | null>(null)

	// Add member modal
	const [showAddMemberModal, setShowAddMemberModal] = useState(false)
	const [newMemberEmail, setNewMemberEmail] = useState('')
	const [newMemberRole, setNewMemberRole] = useState<'admin' | 'operator' | 'viewer'>('viewer')
	const [addingMember, setAddingMember] = useState(false)

	// Delete confirmation
	const [memberToRemove, setMemberToRemove] = useState<string | null>(null)
	const [removing, setRemoving] = useState(false)

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

			if (!response.ok) {
				const data = await response.json()
				toast.error('Failed to add member', data.error || 'Unknown error')
				return
			}

			toast.success('Member Added', `${newMemberEmail} has been added to ${team?.displayName || teamName}`)
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
				`/api/admin/teams/${teamName}/members/${encodeURIComponent(memberToRemove)}`,
				{
					method: 'DELETE',
					credentials: 'include',
				}
			)

			if (!response.ok) {
				const data = await response.json()
				toast.error('Failed to remove member', data.error || 'Unknown error')
				return
			}

			toast.success('Member Removed', `${memberToRemove} has been removed from the team`)
			setMemberToRemove(null)
			fetchTeam()
		} catch {
			toast.error('Error', 'An error occurred while removing the member')
		} finally {
			setRemoving(false)
		}
	}

	const handleChangeRole = async (memberEmail: string, newRole: string) => {
		if (!teamName) return

		try {
			const response = await fetch(
				`/api/admin/teams/${teamName}/members/${encodeURIComponent(memberEmail)}`,
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

			toast.success('Role Updated', `${memberEmail} is now ${newRole}`)
			fetchTeam()
		} catch {
			toast.error('Error', 'An error occurred while changing the role')
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
											<span className="text-neutral-200">{member.email}</span>
										</td>
										<td className="px-5 py-4">
											<select
												value={member.role}
												onChange={(e) => handleChangeRole(member.email, e.target.value)}
												className="text-sm px-2 py-1 rounded bg-neutral-800 border border-neutral-700 text-neutral-200 focus:outline-none focus:ring-1 focus:ring-violet-500"
											>
												<option value="viewer">Viewer</option>
												<option value="operator">Operator</option>
												<option value="admin">Admin</option>
											</select>
										</td>
										<td className="px-5 py-4 text-right">
											<button
												onClick={() => setMemberToRemove(member.email)}
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
					<h2 className="text-lg font-semibold text-neutral-100">Remove Member</h2>
				</ModalHeader>
				<ModalBody>
					<p className="text-neutral-400">
						Are you sure you want to remove{' '}
						<strong className="text-neutral-200">{memberToRemove}</strong> from{' '}
						<strong className="text-neutral-200">{team.displayName || team.name}</strong>?
					</p>
				</ModalBody>
				<ModalFooter>
					<Button variant="secondary" onClick={() => setMemberToRemove(null)}>
						Cancel
					</Button>
					<Button variant="danger" onClick={handleRemoveMember} disabled={removing}>
						{removing ? 'Removing...' : 'Remove Member'}
					</Button>
				</ModalFooter>
			</Modal>
		</FadeIn>
	)
}
