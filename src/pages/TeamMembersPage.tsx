// Copyright 2026 The Butler Authors.
// SPDX-License-Identifier: Apache-2.0

import { useState, useEffect, useCallback } from 'react'
import { useTeamContext } from '@/hooks/useTeamContext'
import { useAuth } from '@/hooks/useAuth'
import { useDocumentTitle } from '@/hooks'
import { Card, FadeIn, Spinner, Button } from '@/components/ui'
import { useToast } from '@/hooks/useToast'

interface TeamMember {
	email: string
	name?: string
	role: string
	joinedAt?: string
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

	const [members, setMembers] = useState<TeamMember[]>([])
	const [loading, setLoading] = useState(true)
	const [apiAvailable, setApiAvailable] = useState(true)
	const [showAddModal, setShowAddModal] = useState(false)
	const [newMemberEmail, setNewMemberEmail] = useState('')
	const [newMemberRole, setNewMemberRole] = useState('member')
	const [adding, setAdding] = useState(false)

	const fetchMembers = useCallback(async () => {
		if (!currentTeam) return
		try {
			const response = await fetch(`/api/teams/${currentTeam}/members`, {
				credentials: 'include',
			})
			if (response.ok) {
				const data = await response.json()
				setMembers(data.members || [])
				setApiAvailable(true)
			} else if (response.status === 404) {
				// API not implemented yet - show current user as fallback
				setApiAvailable(false)
				// The user viewing this page must be a member
				if (user) {
					const currentUserTeam = user.teams?.find((t: UserTeam) =>
						t.name === currentTeam || t.metadata?.name === currentTeam
					)
					const role = currentUserTeam?.role || 'member'
					setMembers([{
						email: user.email || 'unknown',
						name: user.name,
						role: role,
					}])
				}
			} else {
				setMembers([])
			}
		} catch (err) {
			console.error('Failed to fetch members:', err)
			setApiAvailable(false)
			// Show current user as fallback
			if (user) {
				setMembers([{
					email: user.email || 'unknown',
					name: user.name,
					role: 'member',
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
			const response = await fetch(`/api/teams/${currentTeam}/members`, {
				method: 'POST',
				headers: { 'Content-Type': 'application/json' },
				credentials: 'include',
				body: JSON.stringify({ email: newMemberEmail, role: newMemberRole }),
			})

			if (response.ok) {
				success('Member Added', `${newMemberEmail} has been added to the team`)
				setShowAddModal(false)
				setNewMemberEmail('')
				setNewMemberRole('member')
				fetchMembers()
			} else {
				const data = await response.json()
				showError('Failed to Add Member', data.message || 'Unknown error')
			}
		} catch {
			showError('Error', 'Failed to add member')
		} finally {
			setAdding(false)
		}
	}

	async function handleRemoveMember(email: string) {
		if (!currentTeam) return

		if (!apiAvailable) {
			showError('Not Available', 'Team members API is not implemented yet')
			return
		}

		if (!confirm(`Remove ${email} from the team?`)) return

		try {
			const response = await fetch(`/api/teams/${currentTeam}/members/${encodeURIComponent(email)}`, {
				method: 'DELETE',
				credentials: 'include',
			})

			if (response.ok) {
				success('Member Removed', `${email} has been removed from the team`)
				fetchMembers()
			} else {
				const data = await response.json()
				showError('Failed to Remove', data.message || 'Unknown error')
			}
		} catch {
			showError('Error', 'Failed to remove member')
		}
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
				{/* Header */}
				<div className="flex items-center justify-between">
					<div>
						<h1 className="text-2xl font-semibold text-neutral-50">Members</h1>
						<p className="text-neutral-400 mt-1">
							Manage team members and their roles
						</p>
					</div>
					<Button onClick={() => setShowAddModal(true)}>
						<svg className="w-4 h-4 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
							<path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
						</svg>
						Add Member
					</Button>
				</div>

				{/* API Notice */}
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

				{/* Members List */}
				<Card className="overflow-hidden">
					{members.length === 0 ? (
						<div className="p-8 text-center text-neutral-500">
							No members yet
						</div>
					) : (
						<div className="divide-y divide-neutral-800">
							{members.map((member) => (
								<div
									key={member.email}
									className="flex items-center justify-between px-5 py-4"
								>
									<div className="flex items-center gap-3">
										<div className="w-10 h-10 rounded-full bg-neutral-700 flex items-center justify-center">
											<span className="text-neutral-300 font-medium">
												{(member.name || member.email).charAt(0).toUpperCase()}
											</span>
										</div>
										<div>
											<p className="font-medium text-neutral-200">
												{member.name || member.email}
												{member.email === user?.email && (
													<span className="ml-2 text-xs text-neutral-500">(you)</span>
												)}
											</p>
											{member.name && (
												<p className="text-sm text-neutral-500">{member.email}</p>
											)}
										</div>
									</div>

									<div className="flex items-center gap-4">
										<span
											className={`px-2 py-1 text-xs rounded ${member.role === 'admin'
												? 'bg-violet-500/20 text-violet-400'
												: 'bg-neutral-700 text-neutral-300'
												}`}
										>
											{member.role}
										</span>
										{apiAvailable && member.email !== user?.email && (
											<button
												onClick={() => handleRemoveMember(member.email)}
												className="text-neutral-500 hover:text-red-400 transition-colors"
											>
												<svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
													<path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
												</svg>
											</button>
										)}
									</div>
								</div>
							))}
						</div>
					)}
				</Card>

				{/* Add Member Modal */}
				{showAddModal && (
					<div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
						<Card className="w-full max-w-md p-6">
							<h2 className="text-lg font-semibold text-neutral-100 mb-4">Add Member</h2>
							{!apiAvailable && (
								<div className="mb-4 p-3 bg-yellow-500/10 border border-yellow-500/20 rounded-lg">
									<p className="text-sm text-yellow-200">
										This feature requires the backend API to be implemented.
									</p>
								</div>
							)}
							<form onSubmit={handleAddMember} className="space-y-4">
								<div>
									<label className="block text-sm font-medium text-neutral-400 mb-1">
										Email
									</label>
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
									<label className="block text-sm font-medium text-neutral-400 mb-1">
										Role
									</label>
									<select
										value={newMemberRole}
										onChange={(e) => setNewMemberRole(e.target.value)}
										className="w-full px-3 py-2 bg-neutral-900 border border-neutral-700 rounded-lg text-neutral-200 focus:outline-none focus:ring-1 focus:ring-green-500"
									>
										<option value="member">Member</option>
										<option value="admin">Admin</option>
									</select>
								</div>
								<div className="flex justify-end gap-3 pt-2">
									<button
										type="button"
										onClick={() => setShowAddModal(false)}
										className="px-4 py-2 text-neutral-400 hover:text-neutral-200 transition-colors"
									>
										Cancel
									</button>
									<Button type="submit" disabled={adding || !apiAvailable}>
										{adding ? 'Adding...' : 'Add Member'}
									</Button>
								</div>
							</form>
						</Card>
					</div>
				)}
			</div>
		</FadeIn>
	)
}
