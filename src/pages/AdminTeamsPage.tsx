// Copyright 2026 The Butler Authors.
// SPDX-License-Identifier: Apache-2.0

import { useState, useEffect, useCallback } from 'react'
import { Link } from 'react-router-dom'
import { useDocumentTitle } from '@/hooks'
import { useAuth } from '@/hooks'
import { useToast } from '@/hooks/useToast'
import { Button, Input, Card, Modal, ModalHeader, ModalBody, ModalFooter, FadeIn, Spinner } from '@/components/ui'

interface Team {
	name: string
	displayName: string
	description?: string
	phase: string
	namespace?: string
	clusterCount: number
	memberCount: number
}

export function AdminTeamsPage() {
	useDocumentTitle('Teams')

	const { user } = useAuth()
	const toast = useToast()
	const [teams, setTeams] = useState<Team[]>([])
	const [loading, setLoading] = useState(true)
	const [error, setError] = useState('')

	// Check if current user is admin of any team
	const isAdmin = user?.teams?.some(t => t.role === 'admin') ?? false

	// Create team modal
	const [showCreateModal, setShowCreateModal] = useState(false)
	const [newTeamName, setNewTeamName] = useState('')
	const [newTeamDisplayName, setNewTeamDisplayName] = useState('')
	const [newTeamDescription, setNewTeamDescription] = useState('')
	const [creating, setCreating] = useState(false)

	const fetchTeams = useCallback(async () => {
		try {
			const response = await fetch('/api/teams', {
				credentials: 'include',
			})
			if (!response.ok) {
				throw new Error('Failed to fetch teams')
			}
			const data = await response.json()
			setTeams(data.teams || [])
		} catch (err) {
			setError(err instanceof Error ? err.message : 'Failed to load teams')
		} finally {
			setLoading(false)
		}
	}, [])

	useEffect(() => {
		fetchTeams()
	}, [fetchTeams])

	const handleCreateTeam = async (e: React.FormEvent) => {
		e.preventDefault()
		setCreating(true)

		try {
			const response = await fetch('/api/admin/teams', {
				method: 'POST',
				headers: { 'Content-Type': 'application/json' },
				credentials: 'include',
				body: JSON.stringify({
					name: newTeamName,
					displayName: newTeamDisplayName,
					description: newTeamDescription,
				}),
			})

			if (!response.ok) {
				const data = await response.json()
				toast.error('Failed to create team', data.error || 'Unknown error')
				return
			}

			toast.success('Team Created', `Team "${newTeamDisplayName || newTeamName}" has been created`)
			setShowCreateModal(false)
			setNewTeamName('')
			setNewTeamDisplayName('')
			setNewTeamDescription('')
			fetchTeams()
		} catch {
			toast.error('Error', 'An error occurred while creating the team')
		} finally {
			setCreating(false)
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
						<h1 className="text-2xl font-semibold text-neutral-100">Teams</h1>
						<p className="text-sm text-neutral-400 mt-1">
							Manage team access and permissions
						</p>
					</div>
					{isAdmin && (
						<Button onClick={() => setShowCreateModal(true)}>
							<svg className="w-4 h-4 mr-2" fill="none" viewBox="0 0 24 24" stroke="currentColor">
								<path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
							</svg>
							Create Team
						</Button>
					)}
				</div>

				{/* Error */}
				{error && (
					<div className="p-3 bg-red-500/10 border border-red-500/20 rounded-lg">
						<p className="text-sm text-red-400">{error}</p>
						<button onClick={() => setError('')} className="text-xs text-red-400 hover:text-red-300 mt-1">
							Dismiss
						</button>
					</div>
				)}

				{/* Teams Grid */}
				{teams.length === 0 ? (
					<Card className="p-8 text-center">
						<div className="w-16 h-16 mx-auto mb-4 rounded-full bg-neutral-800 flex items-center justify-center">
							<svg className="w-8 h-8 text-neutral-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
								<path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0zm6 3a2 2 0 11-4 0 2 2 0 014 0zM7 10a2 2 0 11-4 0 2 2 0 014 0z" />
							</svg>
						</div>
						<p className="text-neutral-400 mb-4">No teams found</p>
						{isAdmin && (
							<Button onClick={() => setShowCreateModal(true)}>
								Create Your First Team
							</Button>
						)}
					</Card>
				) : (
					<div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
						{teams.map((team) => (
							<Link
								key={team.name}
								to={`/admin/teams/${team.name}`}
								className="block"
							>
								<Card className="p-5 h-full hover:bg-neutral-800/50 transition-colors cursor-pointer">
									<div className="flex items-start justify-between mb-3">
										<div className="flex items-center gap-3">
											<div className="w-10 h-10 rounded-lg bg-violet-500/20 flex items-center justify-center">
												<span className="text-violet-400 font-bold">
													{(team.displayName || team.name).charAt(0).toUpperCase()}
												</span>
											</div>
											<div>
												<h3 className="font-medium text-neutral-100">
													{team.displayName || team.name}
												</h3>
												<p className="text-xs text-neutral-500">@{team.name}</p>
											</div>
										</div>
										<span className={`px-2 py-1 text-xs font-medium rounded ${(team.phase || 'Ready') === 'Ready'
											? 'bg-green-500/20 text-green-400'
											: 'bg-yellow-500/20 text-yellow-400'
											}`}>
											{team.phase || 'Ready'}
										</span>
									</div>

									{team.description && (
										<p className="text-sm text-neutral-400 mb-3 line-clamp-2">
											{team.description}
										</p>
									)}

									<div className="flex items-center gap-4 text-sm text-neutral-500">
										<span className="flex items-center gap-1">
											<svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
												<path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4.354a4 4 0 110 5.292M15 21H3v-1a6 6 0 0112 0v1zm0 0h6v-1a6 6 0 00-9-5.197M13 7a4 4 0 11-8 0 4 4 0 018 0z" />
											</svg>
											{team.memberCount || 0} members
										</span>
										<span className="flex items-center gap-1">
											<svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
												<path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 12h14M5 12a2 2 0 01-2-2V6a2 2 0 012-2h14a2 2 0 012 2v4a2 2 0 01-2 2M5 12a2 2 0 00-2 2v4a2 2 0 002 2h14a2 2 0 002-2v-4a2 2 0 00-2-2" />
											</svg>
											{team.clusterCount} clusters
										</span>
									</div>

									{/* Subtle arrow indicator */}
									<div className="mt-3 pt-3 border-t border-neutral-800 flex items-center justify-end">
										<span className="text-xs text-neutral-500 flex items-center gap-1">
											View details
											<svg className="w-3 h-3" fill="none" viewBox="0 0 24 24" stroke="currentColor">
												<path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
											</svg>
										</span>
									</div>
								</Card>
							</Link>
						))}
					</div>
				)}
			</div>

			{/* Create Team Modal */}
			<Modal isOpen={showCreateModal} onClose={() => setShowCreateModal(false)}>
				<ModalHeader>
					<h2 className="text-lg font-semibold text-neutral-100">Create Team</h2>
				</ModalHeader>
				<form onSubmit={handleCreateTeam}>
					<ModalBody className="space-y-4">
						<Input
							id="teamName"
							label="Team Name (slug)"
							type="text"
							value={newTeamName}
							onChange={(e) => setNewTeamName(e.target.value.toLowerCase().replace(/[^a-z0-9-]/g, '-'))}
							placeholder="engineering-team"
							required
						/>

						<Input
							id="displayName"
							label="Display Name"
							type="text"
							value={newTeamDisplayName}
							onChange={(e) => setNewTeamDisplayName(e.target.value)}
							placeholder="Engineering Team"
						/>

						<div>
							<label className="block text-sm font-medium text-neutral-300 mb-1">
								Description (optional)
							</label>
							<textarea
								value={newTeamDescription}
								onChange={(e) => setNewTeamDescription(e.target.value)}
								placeholder="Team description..."
								className="w-full px-3 py-2 bg-neutral-800 border border-neutral-700 rounded-lg text-neutral-200 placeholder-neutral-500 focus:outline-none focus:ring-2 focus:ring-green-500"
								rows={3}
							/>
						</div>
					</ModalBody>
					<ModalFooter>
						<Button type="button" variant="secondary" onClick={() => setShowCreateModal(false)}>
							Cancel
						</Button>
						<Button type="submit" disabled={creating}>
							{creating ? 'Creating...' : 'Create Team'}
						</Button>
					</ModalFooter>
				</form>
			</Modal>
		</FadeIn>
	)
}
