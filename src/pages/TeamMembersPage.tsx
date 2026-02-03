// Copyright 2026 The Butler Authors.
// SPDX-License-Identifier: Apache-2.0

import { useState, useEffect, useCallback } from 'react'
import { useTeamContext } from '@/hooks/useTeamContext'
import { useAuth } from '@/hooks/useAuth'
import { useDocumentTitle } from '@/hooks'
import { Card, FadeIn, Spinner, Button, Modal, ModalHeader, ModalBody, ModalFooter } from '@/components/ui'
import { useToast } from '@/hooks/useToast'
import { usePermissionWarning } from '@/hooks/usePermissionWarning'

interface TeamMember {
	email: string
	name?: string
	role: string
	source: 'direct' | 'group' | 'elevated'
	groupName?: string
	groupRole?: string
	directRole?: string
	canRemove?: boolean
	removeNote?: string
}

interface TeamGroup {
	name: string
	role: string
}

interface UserTeam {
	name?: string
	metadata?: { name?: string }
	role?: string
}

export function TeamMembersPage() {
	const { currentTeam, currentTeamDisplayName } = useTeamContext()
	const { user } = useAuth()
	useDocumentTitle(currentTeamDisplayName ? `${currentTeamDisplayName} Members` : 'Members')
	const { success, error: showError } = useToast()
	const { checkAndWarn } = usePermissionWarning()

	const [members, setMembers] = useState<TeamMember[]>([])
	const [groups, setGroups] = useState<TeamGroup[]>([])
	const [loading, setLoading] = useState(true)
	const [apiAvailable, setApiAvailable] = useState(true)
	const [showAddModal, setShowAddModal] = useState(false)
	const [newMemberEmail, setNewMemberEmail] = useState('')
	const [newMemberRole, setNewMemberRole] = useState('viewer')
	const [adding, setAdding] = useState(false)
	const [memberToRemove, setMemberToRemove] = useState<TeamMember | null>(null)
	const [removing, setRemoving] = useState(false)

	const fetchMembers = useCallback(async () => {
		if (!currentTeam) return
		try {
			const response = await fetch(`/api/teams/${currentTeam}/members`, {
				credentials: 'include',
			})
			if (response.ok) {
				const data = await response.json()
				setMembers(data.members || [])
				setGroups(data.groups || [])
				setApiAvailable(true)
			} else if (response.status === 404) {
				setApiAvailable(false)
				if (user) {
					const currentUserTeam = user.teams?.find((t: UserTeam) =>
						t.name === currentTeam || t.metadata?.name === currentTeam
					)
					setMembers([{
						email: user.email || 'unknown',
						name: user.name,
						role: currentUserTeam?.role || 'viewer',
						source: 'direct',
					}])
				}
			} else {
				setMembers([])
				setGroups([])
			}
		} catch (err) {
			console.error('Failed to fetch members:', err)
			setApiAvailable(false)
			if (user) {
				setMembers([{
					email: user.email || 'unknown',
					name: user.name,
					role: 'viewer',
					source: 'direct',
				}])
			}
		} finally {
			setLoading(false)
		}
	}, [currentTeam, user])

	useEffect(() => {
		fetchMembers()
	}, [fetchMembers])

	async function handleAddMember(e: React.FormEvent) {
		e.preventDefault()
		if (!currentTeam || !newMemberEmail) return

		if (!apiAvailable) {
			showError('Not Available', 'Team members API is not implemented yet')
			return
		}

		setAdding(true)
		try {
			const response = await fetch(`/api/admin/teams/${currentTeam}/members`, {
				method: 'POST',
				headers: { 'Content-Type': 'application/json' },
				credentials: 'include',
				body: JSON.stringify({ email: newMemberEmail, role: newMemberRole }),
			})

			const data = await response.json()

			if (response.ok) {
				if (data.elevated) {
					success('Member Elevated', `${newMemberEmail} elevated from ${data.groupRole} to ${data.role}`)
				} else {
					success('Member Added', `${newMemberEmail} has been added to the team`)
				}
				// Check if we modified our own permissions
				checkAndWarn(newMemberEmail)
				setShowAddModal(false)
				setNewMemberEmail('')
				setNewMemberRole('viewer')
				fetchMembers()
			} else {
				showError('Failed to Add Member', data.error || 'Unknown error')
			}
		} catch {
			showError('Error', 'Failed to add member')
		} finally {
			setAdding(false)
		}
	}

	async function handleRemoveMember() {
		if (!currentTeam || !memberToRemove) return

		if (!apiAvailable) {
			showError('Not Available', 'Team members API is not implemented yet')
			return
		}

		setRemoving(true)

		try {
			const response = await fetch(`/api/admin/teams/${currentTeam}/members/${encodeURIComponent(memberToRemove.email)}`, {
				method: 'DELETE',
				credentials: 'include',
			})

			const data = await response.json()

			if (response.ok) {
				if (data.retainsAccess) {
					success('Elevation Removed', `${memberToRemove.email} now has ${data.groupRole} access via ${data.groupName}`)
				} else {
					success('Member Removed', `${memberToRemove.email} has been removed from the team`)
				}
				// Check if we modified our own permissions
				checkAndWarn(memberToRemove.email)
				setMemberToRemove(null)
				fetchMembers()
			} else {
				showError('Failed to Remove', data.error || 'Unknown error')
			}
		} catch {
			showError('Error', 'Failed to remove member')
		} finally {
			setRemoving(false)
		}
	}

	function RoleBadge({ member }: { member: TeamMember }) {
		const colors: Record<string, string> = {
			admin: 'bg-violet-500/20 text-violet-400',
			operator: 'bg-green-500/20 text-green-400',
			viewer: 'bg-neutral-700 text-neutral-300',
		}

		if (member.source === 'elevated') {
			return (
				<div className="flex items-center gap-2">
					<span className={`px-2 py-1 text-xs rounded ${colors[member.role] || colors.viewer}`}>
						{member.role}
					</span>
					<span className="flex items-center gap-1 text-xs text-amber-400" title={`Elevated from ${member.groupRole} via ${member.groupName}`}>
						<svg className="w-3 h-3" fill="currentColor" viewBox="0 0 20 20">
							<path fillRule="evenodd" d="M5.293 9.707a1 1 0 010-1.414l4-4a1 1 0 011.414 0l4 4a1 1 0 01-1.414 1.414L11 7.414V15a1 1 0 11-2 0V7.414L6.707 9.707a1 1 0 01-1.414 0z" clipRule="evenodd" />
						</svg>
						from {member.groupRole}
					</span>
				</div>
			)
		}

		return (
			<span className={`px-2 py-1 text-xs rounded ${colors[member.role] || colors.viewer}`}>
				{member.role}
			</span>
		)
	}

	function SourceInfo({ member }: { member: TeamMember }) {
		if (member.source === 'group' && member.groupName) {
			return (
				<span className="text-xs text-blue-400 flex items-center gap-1">
					<svg className="w-3 h-3" fill="none" viewBox="0 0 24 24" stroke="currentColor">
						<path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0zm6 3a2 2 0 11-4 0 2 2 0 014 0zM7 10a2 2 0 11-4 0 2 2 0 014 0z" />
					</svg>
					via {member.groupName}
				</span>
			)
		}

		if (member.source === 'elevated' && member.groupName) {
			return (
				<span className="text-xs text-amber-400/70 flex items-center gap-1">
					<svg className="w-3 h-3" fill="none" viewBox="0 0 24 24" stroke="currentColor">
						<path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0zm6 3a2 2 0 11-4 0 2 2 0 014 0zM7 10a2 2 0 11-4 0 2 2 0 014 0z" />
					</svg>
					{member.groupName} + elevated
				</span>
			)
		}

		if (member.source === 'direct') {
			return <span className="text-xs text-neutral-500">direct member</span>
		}

		return null
	}

	if (loading) {
		return (
			<div className="flex items-center justify-center h-64">
				<Spinner size="lg" />
			</div>
		)
	}

	return (
		<FadeIn>
			<div className="space-y-6">
				<div className="flex items-center justify-between">
					<div>
						<h1 className="text-2xl font-semibold text-neutral-50">Members</h1>
						<p className="text-neutral-400 mt-1">Manage team members and their roles</p>
					</div>
					<Button onClick={() => setShowAddModal(true)}>
						<svg className="w-4 h-4 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
							<path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
						</svg>
						Add Member
					</Button>
				</div>

				{!apiAvailable && (
					<Card className="p-4 border-yellow-500/20 bg-yellow-500/5">
						<div className="flex items-start gap-3">
							<svg className="w-5 h-5 text-yellow-500 flex-shrink-0 mt-0.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
								<path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
							</svg>
							<div>
								<p className="text-sm text-yellow-200 font-medium">Team Members API not implemented</p>
								<p className="text-sm text-yellow-200/70 mt-1">
									Showing you as the only member. The backend needs a <code className="bg-yellow-500/20 px-1 rounded">/api/teams/:team/members</code> endpoint.
								</p>
							</div>
						</div>
					</Card>
				)}

				{groups.length > 0 && (
					<Card className="p-4 border-blue-500/20 bg-blue-500/5">
						<div className="flex items-start gap-3">
							<svg className="w-5 h-5 text-blue-400 flex-shrink-0 mt-0.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
								<path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0zm6 3a2 2 0 11-4 0 2 2 0 014 0zM7 10a2 2 0 11-4 0 2 2 0 014 0z" />
							</svg>
							<div>
								<p className="text-sm text-blue-200 font-medium">Group Access Rules</p>
								<p className="text-sm text-blue-200/70 mt-1">
									Members of these groups automatically have access to this team:
								</p>
								<div className="flex flex-wrap gap-2 mt-2">
									{groups.map((group) => (
										<span key={group.name} className="inline-flex items-center gap-1.5 px-2 py-1 bg-blue-500/20 rounded text-sm text-blue-200">
											<span className="font-medium">{group.name}</span>
											<span className="text-blue-300/60">({group.role})</span>
										</span>
									))}
								</div>
							</div>
						</div>
					</Card>
				)}

				<Card className="overflow-hidden">
					{members.length === 0 ? (
						<div className="p-8 text-center text-neutral-500">No members yet</div>
					) : (
						<div className="divide-y divide-neutral-800">
							{members.map((member) => (
								<div key={member.email} className="flex items-center justify-between px-5 py-4">
									<div className="flex items-center gap-3">
										<div className={`w-10 h-10 rounded-full flex items-center justify-center ${member.source === 'elevated'
											? 'bg-amber-500/20 ring-2 ring-amber-500/30'
											: member.source === 'group'
												? 'bg-blue-500/20'
												: 'bg-neutral-700'
											}`}>
											<span className={`font-medium ${member.source === 'elevated'
												? 'text-amber-300'
												: member.source === 'group'
													? 'text-blue-300'
													: 'text-neutral-300'
												}`}>
												{(member.name || member.email).charAt(0).toUpperCase()}
											</span>
										</div>
										<div>
											<div className="flex items-center gap-2">
												<p className="font-medium text-neutral-200">
													{member.name || member.email}
													{member.email === user?.email && (
														<span className="ml-2 text-xs text-neutral-500">(you)</span>
													)}
												</p>
												{member.source === 'elevated' && (
													<span className="px-1.5 py-0.5 text-[10px] font-medium bg-amber-500/20 text-amber-400 rounded">
														ELEVATED
													</span>
												)}
											</div>
											<div className="flex items-center gap-3 mt-0.5">
												{member.name && <p className="text-sm text-neutral-500">{member.email}</p>}
												<SourceInfo member={member} />
											</div>
										</div>
									</div>

									<div className="flex items-center gap-4">
										<RoleBadge member={member} />
										{apiAvailable && member.canRemove && (
											<button
												onClick={() => setMemberToRemove(member)}
												className="text-neutral-500 hover:text-red-400 transition-colors"
												title={member.removeNote || 'Remove member'}
											>
												<svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
													<path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
												</svg>
											</button>
										)}
										{member.source === 'group' && !member.canRemove && (
											<span className="text-neutral-600" title="Access managed via group membership">
												<svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
													<path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z" />
												</svg>
											</span>
										)}
									</div>
								</div>
							))}
						</div>
					)}
				</Card>

				{members.some(m => m.source !== 'direct') && (
					<div className="flex items-center gap-6 text-xs text-neutral-500">
						<div className="flex items-center gap-2">
							<div className="w-3 h-3 rounded-full bg-neutral-700" />
							<span>Direct member</span>
						</div>
						<div className="flex items-center gap-2">
							<div className="w-3 h-3 rounded-full bg-blue-500/20" />
							<span>Via group</span>
						</div>
						<div className="flex items-center gap-2">
							<div className="w-3 h-3 rounded-full bg-amber-500/20 ring-1 ring-amber-500/30" />
							<span>Elevated</span>
						</div>
					</div>
				)}

				<Modal isOpen={showAddModal} onClose={() => setShowAddModal(false)}>
					<ModalHeader>
						<h2 className="text-lg font-semibold text-neutral-100">Add Member</h2>
					</ModalHeader>
					<form onSubmit={handleAddMember}>
						<ModalBody className="space-y-4">
							{!apiAvailable && (
								<div className="p-3 bg-yellow-500/10 border border-yellow-500/20 rounded-lg">
									<p className="text-sm text-yellow-200">
										This feature requires the backend API to be implemented.
									</p>
								</div>
							)}
							{groups.length > 0 && (
								<div className="p-3 bg-blue-500/10 border border-blue-500/20 rounded-lg">
									<p className="text-sm text-blue-200">
										If this user already has access via a group, you can only add them with a higher role to elevate their permissions.
									</p>
								</div>
							)}
							<div>
								<label className="block text-sm font-medium text-neutral-400 mb-1">Email</label>
								<input
									type="email"
									value={newMemberEmail}
									onChange={(e) => setNewMemberEmail(e.target.value)}
									className="w-full px-3 py-2 bg-neutral-900 border border-neutral-700 rounded-lg text-neutral-200 focus:outline-none focus:ring-1 focus:ring-green-500"
									placeholder="user@example.com"
									required
								/>
							</div>
							<div>
								<label className="block text-sm font-medium text-neutral-400 mb-1">Role</label>
								<select
									value={newMemberRole}
									onChange={(e) => setNewMemberRole(e.target.value)}
									className="w-full px-3 py-2 bg-neutral-900 border border-neutral-700 rounded-lg text-neutral-200 focus:outline-none focus:ring-1 focus:ring-green-500"
								>
									<option value="viewer">Viewer</option>
									<option value="operator">Operator</option>
									<option value="admin">Admin</option>
								</select>
							</div>
						</ModalBody>
						<ModalFooter>
							<Button type="button" variant="secondary" onClick={() => setShowAddModal(false)}>
								Cancel
							</Button>
							<Button type="submit" disabled={adding || !apiAvailable}>
								{adding ? 'Adding...' : 'Add Member'}
							</Button>
						</ModalFooter>
					</form>
				</Modal>

				{/* Remove Member Confirmation Modal */}
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
								<strong className="text-neutral-200">{currentTeamDisplayName || currentTeam}</strong>?
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
			</div>
		</FadeIn>
	)
}
