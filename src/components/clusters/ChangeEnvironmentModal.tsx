// Copyright 2026 The Butler Authors.
// SPDX-License-Identifier: Apache-2.0

import { useState } from 'react'
import { Modal, ModalHeader, ModalBody, ModalFooter } from '@/components/ui/Modal'
import { Button } from '@/components/ui'
import { envAccent } from '@/lib/envColor'
import { cn } from '@/lib/utils'
import { extractWebhookDenial } from '@/lib/webhookError'
import { clustersApi } from '@/api'
import type { TeamEnvironment } from '@/types/environments'

interface ChangeEnvironmentModalProps {
	isOpen: boolean
	onClose: () => void
	onChanged: (newEnv: string) => void
	clusterName: string
	namespace: string
	currentEnvironment: string
	availableEnvs: TeamEnvironment[]
	// When true, the "None (clear label)" option is offered. Useful for
	// teams that still have pre-migration clusters; hidden otherwise
	// because unlabeled clusters cannot be re-created once envs are
	// defined on the team.
	allowClear?: boolean
}

export function ChangeEnvironmentModal({
	isOpen,
	onClose,
	onChanged,
	clusterName,
	namespace,
	currentEnvironment,
	availableEnvs,
	allowClear = false,
}: ChangeEnvironmentModalProps) {
	const [selected, setSelected] = useState(currentEnvironment)
	const [submitting, setSubmitting] = useState(false)
	const [error, setError] = useState<string | null>(null)
	const [lastOpen, setLastOpen] = useState(false)

	// Reset internal state when the modal opens. ScaleWorkersModal uses
	// the same sentinel pattern to avoid the useEffect+setState
	// cascading-render lint rule.
	if (isOpen && !lastOpen) {
		setSelected(currentEnvironment)
		setError(null)
		setSubmitting(false)
	}
	if (isOpen !== lastOpen) {
		setLastOpen(isOpen)
	}

	const sortedEnvs = [...availableEnvs].sort((a, b) => a.name.localeCompare(b.name))

	const changed = selected !== currentEnvironment
	const canSubmit = changed && !submitting

	const handleClose = () => {
		if (submitting) return
		onClose()
	}

	const handleSubmit = async () => {
		if (!canSubmit) return
		setSubmitting(true)
		setError(null)
		try {
			await clustersApi.changeEnvironment(namespace, clusterName, selected)
			onChanged(selected)
			onClose()
		} catch (err) {
			const denial = extractWebhookDenial(err)
			if (denial) {
				setError(denial.message)
			} else {
				setError(err instanceof Error ? err.message : 'Failed to change environment')
			}
			setSubmitting(false)
		}
	}

	return (
		<Modal isOpen={isOpen} onClose={handleClose} className="w-full max-w-md">
			<ModalHeader>
				<div className="flex items-center gap-3">
					<div className="w-10 h-10 rounded-full bg-blue-500/10 flex items-center justify-center">
						<svg className="w-5 h-5 text-blue-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
							<path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7h12m0 0l-4-4m4 4l-4 4m0 6H4m0 0l4 4m-4-4l4-4" />
						</svg>
					</div>
					<div>
						<h2 className="text-lg font-semibold text-neutral-100">Change environment</h2>
						<p className="text-sm text-neutral-400">{clusterName}</p>
					</div>
				</div>
			</ModalHeader>

			<ModalBody>
				<p className="text-sm text-neutral-400 mb-4">
					Moves this cluster into a different environment. The new env's
					quota and per-member cap apply from the next reconcile. The
					cluster continues running during the move.
				</p>

				<div className="space-y-2">
					{sortedEnvs.map((env) => {
						const accent = envAccent(env.name)
						const active = selected === env.name
						const isCurrent = currentEnvironment === env.name
						return (
							<button
								key={env.name}
								type="button"
								disabled={submitting}
								onClick={() => setSelected(env.name)}
								className={cn(
									'w-full flex items-center gap-3 px-3 py-2.5 rounded-lg border text-left transition-colors',
									active
										? cn('border-blue-500/40', accent.pillBg)
										: 'border-neutral-800 hover:border-neutral-700 bg-neutral-900'
								)}
							>
								<span className={cn('w-2.5 h-2.5 rounded-full flex-shrink-0', accent.dot)} />
								<div className="flex-1 min-w-0">
									<div className={cn('text-sm font-medium truncate', active ? accent.pillText : 'text-neutral-200')}>
										{env.name}
										{isCurrent ? <span className="ml-2 text-xs text-neutral-500">(current)</span> : null}
									</div>
									<div className="text-xs text-neutral-500 truncate">
										{formatLimits(env.limits)}
									</div>
								</div>
								{active && (
									<svg className="w-4 h-4 text-blue-400 flex-shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor">
										<path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
									</svg>
								)}
							</button>
						)
					})}

					{allowClear && (
						<button
							type="button"
							disabled={submitting}
							onClick={() => setSelected('')}
							className={cn(
								'w-full flex items-center gap-3 px-3 py-2.5 rounded-lg border text-left transition-colors',
								selected === ''
									? 'border-blue-500/40 bg-blue-500/10'
									: 'border-neutral-800 hover:border-neutral-700 bg-neutral-900'
							)}
						>
							<span className="w-2.5 h-2.5 rounded-full flex-shrink-0 bg-neutral-500" />
							<div className="flex-1 min-w-0">
								<div className={cn('text-sm font-medium', selected === '' ? 'text-blue-300' : 'text-neutral-200')}>
									No environment
									{currentEnvironment === '' ? <span className="ml-2 text-xs text-neutral-500">(current)</span> : null}
								</div>
								<div className="text-xs text-neutral-500">
									Remove the env label. Only valid for teams without env quotas.
								</div>
							</div>
						</button>
					)}
				</div>

				{error && (
					<div className="mt-4 p-3 rounded-md bg-red-500/10 border border-red-500/20">
						<p className="text-sm text-red-300 whitespace-pre-wrap">{error}</p>
					</div>
				)}
			</ModalBody>

			<ModalFooter>
				<Button variant="secondary" onClick={handleClose} disabled={submitting}>
					Cancel
				</Button>
				<Button onClick={handleSubmit} disabled={!canSubmit}>
					{submitting ? 'Moving...' : changed ? `Move to ${selected || 'no environment'}` : 'Select a different environment'}
				</Button>
			</ModalFooter>
		</Modal>
	)
}

function formatLimits(limits?: { maxClusters?: number; maxClustersPerMember?: number }): string {
	if (!limits) return 'No quota'
	const parts: string[] = []
	if (limits.maxClusters != null) parts.push(`max ${limits.maxClusters}`)
	if (limits.maxClustersPerMember != null) parts.push(`${limits.maxClustersPerMember}/member`)
	return parts.length > 0 ? parts.join(', ') : 'No quota'
}
