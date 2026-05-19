// Copyright 2026 The Butler Authors.
// SPDX-License-Identifier: Apache-2.0

import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useDocumentTitle } from '@/hooks'
import { policiesApi } from '@/api/policies'
import { Card, FadeIn } from '@/components/ui'

interface PolicyKindCard {
	title: string
	description: string
	to: string
	icon: React.ReactNode
	count?: number
	available: boolean
}

function ClusterCreationIcon() {
	return (
		<svg className="w-6 h-6 text-violet-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.8}>
			<path strokeLinecap="round" strokeLinejoin="round" d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2m-6 9l2 2 4-4" />
		</svg>
	)
}

export function PoliciesHubPage() {
	useDocumentTitle('Policies')
	const navigate = useNavigate()
	const [creationCount, setCreationCount] = useState<number | undefined>(undefined)

	useEffect(() => {
		void policiesApi.list().then(r => setCreationCount(r.count)).catch(() => setCreationCount(undefined))
	}, [])

	const cards: PolicyKindCard[] = [
		{
			title: 'Cluster Creation Policies',
			description: 'Curate the create-cluster modal: pin, allow-list, default, or recommend values for image, network, cluster, and storage container dropdowns. Scoped cluster-wide, per-team, or per-team-and-environment.',
			to: '/admin/policies/cluster-creation',
			icon: <ClusterCreationIcon />,
			count: creationCount,
			available: true,
		},
	]

	return (
		<FadeIn>
			<div className="space-y-6">
				<div>
					<h1 className="text-2xl font-semibold text-neutral-50">Policies</h1>
					<p className="text-sm text-neutral-400 mt-1">
						Admin-curated rules that govern operator workflows. Each policy kind is authored through this surface; UI, GitOps, and kubectl all write to the same validation surface.
					</p>
				</div>

				<div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
					{cards.map(card => (
						<Card
							key={card.to}
							className={`p-5 transition-colors ${card.available ? 'cursor-pointer hover:border-violet-700/60 hover:bg-neutral-900/60' : 'opacity-60'}`}
							onClick={() => card.available && navigate(card.to)}
						>
							<div className="flex items-center gap-3 mb-3">
								<div className="p-2 rounded-lg bg-violet-500/10">
									{card.icon}
								</div>
								<h3 className="text-base font-semibold text-neutral-100">{card.title}</h3>
							</div>
							<p className="text-sm text-neutral-400 leading-relaxed">{card.description}</p>
							<div className="mt-4 flex items-center justify-between text-xs">
								{typeof card.count === 'number' ? (
									<span className="text-neutral-300">
										<span className="font-mono">{card.count}</span> {card.count === 1 ? 'policy' : 'policies'}
									</span>
								) : (
									<span className="text-neutral-600">-</span>
								)}
								{card.available && (
									<span className="text-violet-400 inline-flex items-center gap-1">
										Manage
										<svg className="w-3 h-3" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
											<path strokeLinecap="round" strokeLinejoin="round" d="M9 5l7 7-7 7" />
										</svg>
									</span>
								)}
							</div>
						</Card>
					))}
				</div>

				<p className="text-xs text-neutral-600 pt-4 border-t border-neutral-800">
					Future policy kinds (upgrade windows, addon governance, network pool allocation) will land as additional cards in this view as they're designed and shipped.
				</p>
			</div>
		</FadeIn>
	)
}
