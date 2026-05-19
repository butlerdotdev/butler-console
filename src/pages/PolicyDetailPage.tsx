// Copyright 2026 The Butler Authors.
// SPDX-License-Identifier: Apache-2.0

import { useEffect, useState } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import { useDocumentTitle } from '@/hooks'
import { useToast } from '@/hooks/useToast'
import { policiesApi, type ClusterCreationPolicy, type WebhookError } from '@/api/policies'
import { PolicyForm } from '@/components/policy/PolicyForm'
import { Card, Button, FadeIn, Spinner, Modal, ModalHeader, ModalBody, ModalFooter } from '@/components/ui'

interface TeamSummary {
	name: string
	environments?: Array<{ name: string }>
}

async function fetchTeamsForForm(): Promise<TeamSummary[]> {
	const res = await fetch('/api/teams', { credentials: 'include' })
	if (!res.ok) return []
	const body = await res.json()
	const items = Array.isArray(body) ? body : (body.teams || [])
	return items.map((t: { name?: string; metadata?: { name?: string }; spec?: { environments?: Array<{ name: string }> }; environments?: Array<{ name: string }> }) => ({
		name: t.name || t.metadata?.name || '',
		environments: t.spec?.environments || t.environments || [],
	})).filter((t: TeamSummary) => t.name)
}

export function PolicyDetailPage() {
	const { name } = useParams<{ name: string }>()
	useDocumentTitle(name ? `Policy: ${name}` : 'Policy')
	const navigate = useNavigate()
	const toast = useToast()
	const [policy, setPolicy] = useState<ClusterCreationPolicy | null>(null)
	const [teams, setTeams] = useState<TeamSummary[]>([])
	const [loading, setLoading] = useState(true)
	const [editing, setEditing] = useState(false)
	const [webhookError, setWebhookError] = useState<WebhookError | null>(null)
	const [showDelete, setShowDelete] = useState(false)
	const [deleting, setDeleting] = useState(false)

	async function load() {
		if (!name) return
		setLoading(true)
		try {
			const got = await policiesApi.get(name)
			setPolicy(got)
		} catch (err) {
			toast.error('Failed to load policy', String(err))
		} finally {
			setLoading(false)
		}
	}

	useEffect(() => {
		void load()
		void fetchTeamsForForm().then(setTeams)
	}, [name])

	async function handleUpdate(updated: ClusterCreationPolicy) {
		if (!name) return
		setWebhookError(null)
		try {
			const result = await policiesApi.update(name, updated)
			setPolicy(result)
			setEditing(false)
			toast.success('Policy updated', `${name} saved`)
		} catch (err: unknown) {
			const we = extractWebhookError(err)
			if (we) {
				setWebhookError(we)
			} else {
				toast.error('Failed to update policy', err instanceof Error ? err.message : String(err))
			}
		}
	}

	async function handleDelete() {
		if (!name) return
		setDeleting(true)
		try {
			await policiesApi.delete(name)
			toast.success('Policy deleted', `${name} removed`)
			navigate('/admin/policies/cluster-creation')
		} catch (err) {
			toast.error('Failed to delete policy', String(err))
		} finally {
			setDeleting(false)
			setShowDelete(false)
		}
	}

	if (loading) {
		return <div className="flex items-center justify-center h-32"><Spinner size="lg" /></div>
	}

	if (!policy) {
		return (
			<Card className="p-6">
				<p className="text-red-400">Policy not found.</p>
				<Button className="mt-2" variant="secondary" onClick={() => navigate('/admin/policies/cluster-creation')}>Back to list</Button>
			</Card>
		)
	}

	if (editing) {
		return (
			<FadeIn>
				<div className="space-y-6">
					<button
						type="button"
						onClick={() => { setEditing(false); setWebhookError(null) }}
						className="inline-flex items-center gap-1 text-sm text-neutral-400 hover:text-neutral-200"
					>
						<svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
							<path strokeLinecap="round" strokeLinejoin="round" d="M15 19l-7-7 7-7" />
						</svg>
						{policy.metadata.name}
					</button>
					<div>
						<h1 className="text-2xl font-semibold text-neutral-50">Edit: <span className="font-mono">{policy.metadata.name}</span></h1>
					</div>
					<PolicyForm
						initial={policy}
						nameLocked
						teams={teams}
						onSubmit={handleUpdate}
						onCancel={() => { setEditing(false); setWebhookError(null) }}
						submitLabel="Save changes"
						webhookError={webhookError}
					/>
				</div>
			</FadeIn>
		)
	}

	const opts = policy.spec.options || {}
	const optKeys = Object.keys(opts)

	return (
		<FadeIn>
			<div className="space-y-6">
				<button
					type="button"
					onClick={() => navigate('/admin/policies/cluster-creation')}
					className="inline-flex items-center gap-1 text-sm text-neutral-400 hover:text-neutral-200"
				>
					<svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
						<path strokeLinecap="round" strokeLinejoin="round" d="M15 19l-7-7 7-7" />
					</svg>
					Cluster Creation Policies
				</button>
				<div className="flex items-center justify-between">
					<div>
						<h1 className="text-2xl font-semibold text-neutral-50 font-mono">{policy.metadata.name}</h1>
						<p className="text-sm text-neutral-400 mt-1">ClusterCreationPolicy</p>
					</div>
					<div className="flex gap-2">
						<Button variant="secondary" onClick={() => setEditing(true)}>Edit</Button>
						<Button variant="danger" onClick={() => setShowDelete(true)}>Delete</Button>
					</div>
				</div>

				<Card className="p-5">
					<h3 className="text-sm font-medium text-neutral-300 uppercase tracking-wide mb-3">Scope</h3>
					<pre className="text-xs text-neutral-300 bg-neutral-900 p-3 rounded overflow-x-auto">{JSON.stringify(policy.spec.scope, null, 2)}</pre>
				</Card>

				<Card className="p-5">
					<h3 className="text-sm font-medium text-neutral-300 uppercase tracking-wide mb-3">Target providers</h3>
					<p className="text-sm text-neutral-200 font-mono">
						{policy.spec.targetProviders && policy.spec.targetProviders.length > 0 ? policy.spec.targetProviders.join(', ') : 'all providers'}
					</p>
				</Card>

				<Card className="p-5">
					<h3 className="text-sm font-medium text-neutral-300 uppercase tracking-wide mb-3">Option rules ({optKeys.length})</h3>
					{optKeys.length === 0 && <p className="text-sm text-neutral-500">No option rules defined.</p>}
					<div className="space-y-3">
						{optKeys.map(k => {
							const r = opts[k as keyof typeof opts]!
							return (
								<div key={k} className="p-3 bg-neutral-900 border border-neutral-800 rounded">
									<div className="flex items-center justify-between mb-2">
										<span className="text-sm text-neutral-200 font-mono">{k}</span>
										<span className="px-2 py-0.5 text-xs bg-violet-500/20 text-violet-300 rounded font-mono">{r.mode}</span>
									</div>
									{r.values && r.values.length > 0 && (
										<div className="text-xs text-neutral-400 font-mono">values: {r.values.join(', ')}</div>
									)}
									{r.default && <div className="text-xs text-neutral-400 font-mono">default: {r.default}</div>}
									{r.recommendedReason && <div className="text-xs text-neutral-400">reason: {r.recommendedReason}</div>}
								</div>
							)
						})}
					</div>
				</Card>

				{showDelete && (
					<Modal isOpen={showDelete} onClose={() => setShowDelete(false)}>
						<ModalHeader>
							<h2 className="text-lg font-semibold text-neutral-100">Delete policy?</h2>
						</ModalHeader>
						<ModalBody>
							<p className="text-neutral-400">
								Delete <span className="font-mono text-neutral-200">{policy.metadata.name}</span>? Operators affected by this policy will see the unfiltered provider lists immediately.
							</p>
						</ModalBody>
						<ModalFooter>
							<Button variant="secondary" onClick={() => setShowDelete(false)} disabled={deleting}>Cancel</Button>
							<Button variant="danger" onClick={handleDelete} disabled={deleting}>{deleting ? 'Deleting…' : 'Delete'}</Button>
						</ModalFooter>
					</Modal>
				)}
			</div>
		</FadeIn>
	)
}

interface MaybeApiError {
	body?: { reason?: string; message?: string; error?: string; field?: string }
	reason?: string
	message?: string
	error?: string
	field?: string
}

function extractWebhookError(err: unknown): WebhookError | null {
	if (!err || typeof err !== 'object') return null
	const maybe = err as MaybeApiError
	const body: MaybeApiError = maybe.body ? maybe.body : maybe
	if (body.reason === 'webhook-denied') {
		return {
			error: body.error || 'webhook denied',
			reason: 'webhook-denied',
			message: body.message || '',
			field: body.field,
		}
	}
	return null
}
