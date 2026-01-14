// Copyright 2026 The Butler Authors.
// SPDX-License-Identifier: Apache-2.0

import { useMemo } from 'react'
import { Link } from 'react-router-dom'
import { useDocumentTitle } from '@/hooks'
import { useAuth } from '@/hooks/useAuth'
import { Card, FadeIn, Spinner } from '@/components/ui'

interface Team {
	name: string
	displayName?: string
	namespace?: string
	role?: string
}

interface RawTeam {
	metadata?: { name?: string }
	spec?: { displayName?: string; role?: string }
	status?: { namespace?: string }
	name?: string
	displayName?: string
	namespace?: string
	role?: string
}

function normalizeTeam(t: RawTeam | null | undefined): Team | null {
	if (!t) return null
	if (t.metadata?.name) {
		return {
			name: t.metadata.name,
			displayName: t.spec?.displayName || t.metadata.name,
			namespace: t.status?.namespace || t.metadata.name,
			role: t.role || t.spec?.role,
		}
	}
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

export function OverviewPage() {
	useDocumentTitle('Overview')
	const { user, isLoading } = useAuth()

	const userTeams = user?.teams
	const teams = useMemo(() => {
		if (!userTeams) return []
		return userTeams
			.map(normalizeTeam)
			.filter((t): t is Team => t !== null)
	}, [userTeams])

	if (isLoading) {
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
				<div>
					<h1 className="text-2xl font-semibold text-neutral-50">Overview</h1>
					<p className="text-neutral-400 mt-1">
						Welcome back! Select a team to get started.
					</p>
				</div>

				{/* Teams Grid */}
				{teams.length === 0 ? (
					<Card className="p-8 text-center">
						<svg
							className="mx-auto h-12 w-12 text-neutral-600 mb-4"
							fill="none"
							viewBox="0 0 24 24"
							stroke="currentColor"
						>
							<path
								strokeLinecap="round"
								strokeLinejoin="round"
								strokeWidth={1.5}
								d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0z"
							/>
						</svg>
						<h3 className="text-lg font-medium text-neutral-300">
							No teams yet
						</h3>
						<p className="mt-2 text-sm text-neutral-500">
							You're not a member of any teams. Contact an administrator to get access.
						</p>
					</Card>
				) : (
					<div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
						{teams.map((team) => (
							<Link key={team.name} to={`/t/${team.name}`}>
								<Card className="p-5 hover:bg-neutral-800/50 transition-colors cursor-pointer h-full">
									<div className="flex items-start gap-4">
										{/* Team Avatar */}
										<div className="w-12 h-12 rounded-lg bg-green-500/20 flex items-center justify-center flex-shrink-0">
											<span className="text-green-400 font-bold text-lg">
												{(team.displayName || team.name).charAt(0).toUpperCase()}
											</span>
										</div>
										<div className="min-w-0">
											<div className="flex items-center gap-2">
												<p className="font-medium text-neutral-100 truncate">
													{team.displayName || team.name}
												</p>
												{team.role === 'admin' && (
													<span className="px-2 py-0.5 text-xs font-medium bg-violet-500/10 text-violet-400 rounded flex-shrink-0">
														Admin
													</span>
												)}
											</div>
											<p className="text-sm text-neutral-500 truncate">
												@{team.name}
											</p>
										</div>
									</div>
								</Card>
							</Link>
						))}
					</div>
				)}
			</div>
		</FadeIn>
	)
}
