// Copyright 2026 The Butler Authors.
// SPDX-License-Identifier: Apache-2.0

import { useState, useEffect, useCallback } from 'react'
import { Button, Input, Card, Modal, ModalHeader, ModalBody, ModalFooter } from '@/components/ui'
import { useDocumentTitle } from '@/hooks'
import { useAuth } from '@/hooks'

interface User {
	username: string
	email: string
	displayName: string
	phase: 'Pending' | 'Active' | 'Disabled' | 'Locked'
	disabled: boolean
	authType: 'internal' | 'sso'
	teams?: string[]
}

interface CreateUserResponse {
	user: User
	inviteUrl: string
}

interface ErrorResponse {
	error?: string
}

export function UsersPage() {
	useDocumentTitle('User Management')

	const { user: currentUser } = useAuth()
	const [users, setUsers] = useState<User[]>([])
	const [loading, setLoading] = useState(true)
	const [error, setError] = useState('')

	// Check if current user can manage users (platform admin OR team admin)
	const isAdmin = currentUser?.isPlatformAdmin || currentUser?.teams?.some(t => t.role === 'admin') || false

	// Create user modal
	const [showCreateModal, setShowCreateModal] = useState(false)
	const [newUserEmail, setNewUserEmail] = useState('')
	const [newUserDisplayName, setNewUserDisplayName] = useState('')
	const [creating, setCreating] = useState(false)
	const [createError, setCreateError] = useState('')

	// Invite URL modal (shown after creating user)
	const [showInviteModal, setShowInviteModal] = useState(false)
	const [inviteUrl, setInviteUrl] = useState('')
	const [copied, setCopied] = useState(false)

	// Delete confirmation
	const [userToDelete, setUserToDelete] = useState<string | null>(null)
	const [deleting, setDeleting] = useState(false)

	const fetchUsers = useCallback(async () => {
		try {
			const response = await fetch('/api/users', {
				credentials: 'include',
			})
			if (!response.ok) {
				throw new Error('Failed to fetch users')
			}
			const data = await response.json()
			setUsers(data.users || [])
		} catch (err) {
			setError(err instanceof Error ? err.message : 'Failed to load users')
		} finally {
			setLoading(false)
		}
	}, [])

	useEffect(() => {
		fetchUsers()
	}, [fetchUsers])

	const handleCreateUser = async (e: React.FormEvent) => {
		e.preventDefault()
		setCreateError('')
		setCreating(true)

		try {
			const response = await fetch('/api/admin/users', {
				method: 'POST',
				headers: {
					'Content-Type': 'application/json',
				},
				credentials: 'include',
				body: JSON.stringify({
					email: newUserEmail,
					displayName: newUserDisplayName,
				}),
			})

			const data: CreateUserResponse = await response.json()

			if (!response.ok) {
				setCreateError((data as unknown as ErrorResponse).error || 'Failed to create user')
				return
			}

			// Close create modal, show invite URL
			setShowCreateModal(false)
			setInviteUrl(data.inviteUrl)
			setShowInviteModal(true)

			// Reset form
			setNewUserEmail('')
			setNewUserDisplayName('')

			// Refresh user list
			fetchUsers()
		} catch {
			setCreateError('An error occurred. Please try again.')
		} finally {
			setCreating(false)
		}
	}

	const handleCopyInvite = async () => {
		try {
			await navigator.clipboard.writeText(inviteUrl)
			setCopied(true)
			setTimeout(() => setCopied(false), 2000)
		} catch {
			// Fallback for older browsers
			const textArea = document.createElement('textarea')
			textArea.value = inviteUrl
			document.body.appendChild(textArea)
			textArea.select()
			document.execCommand('copy')
			document.body.removeChild(textArea)
			setCopied(true)
			setTimeout(() => setCopied(false), 2000)
		}
	}

	const handleResendInvite = async (username: string) => {
		try {
			const response = await fetch(`/api/admin/users/${username}/invite`, {
				method: 'POST',
				credentials: 'include',
			})

			const data = await response.json()

			if (!response.ok) {
				setError(data.error || 'Failed to resend invite')
				return
			}

			// Show invite URL
			setInviteUrl(data.inviteUrl)
			setShowInviteModal(true)
		} catch {
			setError('Failed to resend invite')
		}
	}

	const handleToggleDisable = async (username: string, disabled: boolean) => {
		try {
			const endpoint = disabled ? 'enable' : 'disable'
			const response = await fetch(`/api/admin/users/${username}/${endpoint}`, {
				method: 'POST',
				credentials: 'include',
			})

			if (!response.ok) {
				const data = await response.json()
				setError(data.error || `Failed to ${endpoint} user`)
				return
			}

			fetchUsers()
		} catch {
			setError(`Failed to ${disabled ? 'enable' : 'disable'} user`)
		}
	}

	const handleDeleteUser = async () => {
		if (!userToDelete) return

		setDeleting(true)
		try {
			const response = await fetch(`/api/admin/users/${userToDelete}`, {
				method: 'DELETE',
				credentials: 'include',
			})

			if (!response.ok) {
				const data = await response.json()
				setError(data.error || 'Failed to delete user')
				return
			}

			setUserToDelete(null)
			fetchUsers()
		} catch {
			setError('Failed to delete user')
		} finally {
			setDeleting(false)
		}
	}

	const getStatusBadge = (phase: string, disabled: boolean) => {
		if (disabled) {
			return (
				<span className="inline-flex items-center px-2 py-0.5 rounded text-xs font-medium bg-neutral-700 text-neutral-300">
					Disabled
				</span>
			)
		}
		switch (phase) {
			case 'Active':
				return (
					<span className="inline-flex items-center px-2 py-0.5 rounded text-xs font-medium bg-green-500/20 text-green-400">
						Active
					</span>
				)
			case 'Pending':
				return (
					<span className="inline-flex items-center px-2 py-0.5 rounded text-xs font-medium bg-yellow-500/20 text-yellow-400">
						Pending
					</span>
				)
			case 'Locked':
				return (
					<span className="inline-flex items-center px-2 py-0.5 rounded text-xs font-medium bg-red-500/20 text-red-400">
						Locked
					</span>
				)
			default:
				return (
					<span className="inline-flex items-center px-2 py-0.5 rounded text-xs font-medium bg-neutral-700 text-neutral-300">
						{phase}
					</span>
				)
		}
	}

	if (loading) {
		return (
			<div className="p-6">
				<div className="text-neutral-400">Loading users...</div>
			</div>
		)
	}

	return (
		<div className="p-6 max-w-6xl mx-auto">
			{/* Header */}
			<div className="flex items-center justify-between mb-6">
				<div>
					<h1 className="text-2xl font-semibold text-neutral-100">User Management</h1>
					<p className="text-sm text-neutral-400 mt-1">
						View all users with platform access (SSO and internal accounts)
					</p>
				</div>
				{isAdmin && (
					<Button onClick={() => setShowCreateModal(true)}>
						<svg className="w-4 h-4 mr-2" fill="none" viewBox="0 0 24 24" stroke="currentColor">
							<path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
						</svg>
						Add User
					</Button>
				)}
			</div>

			{/* Error */}
			{error && (
				<div className="mb-4 p-3 bg-red-500/10 border border-red-500/20 rounded-lg">
					<p className="text-sm text-red-400">{error}</p>
					<button
						onClick={() => setError('')}
						className="text-xs text-red-400 hover:text-red-300 mt-1"
					>
						Dismiss
					</button>
				</div>
			)}

			{/* Users Table */}
			<Card className="overflow-hidden">
				<div className="overflow-x-auto">
					<table className="w-full">
						<thead>
							<tr className="border-b border-neutral-800">
								<th className="text-left py-3 px-4 text-xs font-medium text-neutral-400 uppercase tracking-wider">
									User
								</th>
								<th className="text-left py-3 px-4 text-xs font-medium text-neutral-400 uppercase tracking-wider">
									Email
								</th>
								<th className="text-left py-3 px-4 text-xs font-medium text-neutral-400 uppercase tracking-wider">
									Type
								</th>
								<th className="text-left py-3 px-4 text-xs font-medium text-neutral-400 uppercase tracking-wider">
									Status
								</th>
								<th className="text-left py-3 px-4 text-xs font-medium text-neutral-400 uppercase tracking-wider">
									Teams
								</th>
								<th className="text-right py-3 px-4 text-xs font-medium text-neutral-400 uppercase tracking-wider">
									Actions
								</th>
							</tr>
						</thead>
						<tbody className="divide-y divide-neutral-800">
							{users.length === 0 ? (
								<tr>
									<td colSpan={6} className="py-8 text-center text-neutral-500">
										No users found. Create your first user or add members to teams.
									</td>
								</tr>
							) : (
								users.map((user) => (
									<tr key={user.username} className="hover:bg-neutral-800/50">
										<td className="py-3 px-4">
											<div className="flex items-center gap-3">
												<div className="w-8 h-8 rounded-full bg-neutral-700 flex items-center justify-center">
													<span className="text-sm font-medium text-neutral-300">
														{(user.displayName || user.email).charAt(0).toUpperCase()}
													</span>
												</div>
												<div>
													<div className="text-sm font-medium text-neutral-200">
														{user.displayName || user.username}
													</div>
													{user.authType === 'internal' && (
														<div className="text-xs text-neutral-500">@{user.username}</div>
													)}
												</div>
											</div>
										</td>
										<td className="py-3 px-4">
											<span className="text-sm text-neutral-300">{user.email}</span>
										</td>
										<td className="py-3 px-4">
											{user.authType === 'sso' ? (
												<span className="inline-flex items-center px-2 py-0.5 rounded text-xs font-medium bg-blue-500/20 text-blue-400">
													SSO
												</span>
											) : (
												<span className="inline-flex items-center px-2 py-0.5 rounded text-xs font-medium bg-purple-500/20 text-purple-400">
													Internal
												</span>
											)}
										</td>
										<td className="py-3 px-4">
											{getStatusBadge(user.phase, user.disabled)}
										</td>
										<td className="py-3 px-4">
											{user.teams && user.teams.length > 0 ? (
												<div className="flex flex-wrap gap-1">
													{user.teams.slice(0, 2).map((team) => (
														<span
															key={team}
															className="inline-flex items-center px-2 py-0.5 rounded text-xs bg-neutral-700 text-neutral-300"
														>
															{team}
														</span>
													))}
													{user.teams.length > 2 && (
														<span className="text-xs text-neutral-500">
															+{user.teams.length - 2}
														</span>
													)}
												</div>
											) : (
												<span className="text-xs text-neutral-500">—</span>
											)}
										</td>
										<td className="py-3 px-4">
											<div className="flex items-center justify-end gap-2">
												{/* Only show management actions for internal users AND if current user is admin */}
												{isAdmin && user.authType === 'internal' && (
													<>
														{user.phase === 'Pending' && (
															<Button
																variant="ghost"
																size="sm"
																onClick={() => handleResendInvite(user.username)}
															>
																Resend Invite
															</Button>
														)}
														<Button
															variant="ghost"
															size="sm"
															onClick={() => handleToggleDisable(user.username, user.disabled)}
														>
															{user.disabled ? 'Enable' : 'Disable'}
														</Button>
														{currentUser?.email !== user.email && (
															<Button
																variant="ghost"
																size="sm"
																className="text-red-400 hover:text-red-300"
																onClick={() => setUserToDelete(user.username)}
															>
																Delete
															</Button>
														)}
													</>
												)}
												{user.authType === 'sso' && (
													<span className="text-xs text-neutral-500">
														Managed via Teams
													</span>
												)}
												{!isAdmin && user.authType === 'internal' && (
													<span className="text-xs text-neutral-500">—</span>
												)}
											</div>
										</td>
									</tr>
								))
							)}
						</tbody>
					</table>
				</div>
			</Card>

			{/* Create User Modal */}
			<Modal
				isOpen={showCreateModal}
				onClose={() => setShowCreateModal(false)}
			>
				<ModalHeader>
					<h2 className="text-lg font-semibold text-neutral-100">Add New User</h2>
				</ModalHeader>
				<form onSubmit={handleCreateUser}>
					<ModalBody className="space-y-4">
						{createError && (
							<div className="p-3 bg-red-500/10 border border-red-500/20 rounded-lg">
								<p className="text-sm text-red-400">{createError}</p>
							</div>
						)}

						<Input
							id="email"
							label="Email Address"
							type="email"
							value={newUserEmail}
							onChange={(e) => setNewUserEmail(e.target.value)}
							placeholder="user@example.com"
							required
						/>

						<Input
							id="displayName"
							label="Display Name (optional)"
							type="text"
							value={newUserDisplayName}
							onChange={(e) => setNewUserDisplayName(e.target.value)}
							placeholder="John Doe"
						/>

						<p className="text-xs text-neutral-500">
							An invite link will be generated. Share it with the user to let them set their password.
						</p>
					</ModalBody>
					<ModalFooter>
						<Button
							type="button"
							variant="secondary"
							onClick={() => setShowCreateModal(false)}
						>
							Cancel
						</Button>
						<Button type="submit" disabled={creating}>
							{creating ? 'Creating...' : 'Create User'}
						</Button>
					</ModalFooter>
				</form>
			</Modal>

			{/* Invite URL Modal */}
			<Modal
				isOpen={showInviteModal}
				onClose={() => {
					setShowInviteModal(false)
					setInviteUrl('')
					setCopied(false)
				}}
			>
				<ModalHeader>
					<h2 className="text-lg font-semibold text-neutral-100">Invite Link Generated</h2>
				</ModalHeader>
				<ModalBody className="space-y-4">
					<p className="text-sm text-neutral-400">
						Share this link with the user. They will use it to set their password and activate their account.
					</p>

					<div className="relative">
						<input
							type="text"
							readOnly
							value={inviteUrl}
							className="w-full bg-neutral-800 border border-neutral-700 rounded-lg px-3 py-2 pr-20 text-sm text-neutral-300 font-mono"
						/>
						<Button
							type="button"
							size="sm"
							className="absolute right-1 top-1"
							onClick={handleCopyInvite}
						>
							{copied ? 'Copied!' : 'Copy'}
						</Button>
					</div>

					<p className="text-xs text-neutral-500">
						⚠️ This link is only shown once and expires in 48 hours.
					</p>
				</ModalBody>
				<ModalFooter>
					<Button
						onClick={() => {
							setShowInviteModal(false)
							setInviteUrl('')
							setCopied(false)
						}}
					>
						Done
					</Button>
				</ModalFooter>
			</Modal>

			{/* Delete Confirmation Modal */}
			<Modal
				isOpen={!!userToDelete}
				onClose={() => setUserToDelete(null)}
			>
				<ModalHeader>
					<h2 className="text-lg font-semibold text-neutral-100">Delete User</h2>
				</ModalHeader>
				<ModalBody>
					<p className="text-sm text-neutral-400">
						Are you sure you want to delete user <strong className="text-neutral-200">{userToDelete}</strong>? This action cannot be undone.
					</p>
				</ModalBody>
				<ModalFooter>
					<Button variant="secondary" onClick={() => setUserToDelete(null)}>
						Cancel
					</Button>
					<Button
						variant="danger"
						onClick={handleDeleteUser}
						disabled={deleting}
					>
						{deleting ? 'Deleting...' : 'Delete User'}
					</Button>
				</ModalFooter>
			</Modal>
		</div>
	)
}
