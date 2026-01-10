// Copyright 2025 The Butler Authors.
// SPDX-License-Identifier: Apache-2.0

import { useParams, useNavigate } from 'react-router-dom'
import { useDocumentTitle } from '@/hooks'
import { Card } from '@/components/ui'
import { ClusterTerminal } from '@/components/terminal'

export function TerminalPage() {
	const { type, namespace, cluster } = useParams<{
		type: string
		namespace: string
		cluster: string
	}>()
	const navigate = useNavigate()

	useDocumentTitle(`Terminal - ${cluster}`)

	if (!type || !namespace || !cluster) {
		return (
			<div className="p-4 bg-red-500/10 border border-red-500/20 rounded-lg">
				<p className="text-red-400">Invalid terminal parameters</p>
			</div>
		)
	}

	return (
		<div className="h-full flex flex-col">
			<div className="flex items-center gap-4 mb-4">
				<button
					onClick={() => navigate(`/clusters/${namespace}/${cluster}`)}
					className="p-2 hover:bg-neutral-800 rounded-lg transition-colors"
				>
					<svg className="w-5 h-5 text-neutral-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
						<path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
					</svg>
				</button>
				<div>
					<h1 className="text-xl font-semibold text-neutral-50">Terminal</h1>
					<p className="text-neutral-400 text-sm">
						{type} cluster: {namespace}/{cluster}
					</p>
				</div>
			</div>
			<Card className="flex-1 overflow-hidden">
				<ClusterTerminal
					type={type as 'management' | 'tenant'}
					namespace={namespace}
					cluster={cluster}
				/>
			</Card>
		</div>
	)
}
