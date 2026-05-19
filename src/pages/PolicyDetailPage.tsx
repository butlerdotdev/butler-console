// Copyright 2026 The Butler Authors.
// SPDX-License-Identifier: Apache-2.0

import { useEffect, useMemo, useState } from 'react'
import { Link, useNavigate, useParams } from 'react-router-dom'
import { useDocumentTitle } from '@/hooks'
import { useToast } from '@/hooks/useToast'
import { policiesApi, type ClusterCreationPolicy, type PolicyOptionType, type WebhookError } from '@/api/policies'
import { providersApi, type Provider } from '@/api/providers'
import { PolicyForm } from '@/components/policy/PolicyForm'
import { Card, Button, FadeIn, Spinner, Modal, ModalHeader, ModalBody, ModalFooter } from '@/components/ui'

interface TeamSummary {
	name: string
	environments?: Array<{ name: string }>
}

interface ProviderEntry {
	id: string
	name: string
}

const PROVIDER_OPTION_SUPPORT: Record<string, PolicyOptionType[]> = {
	nutanix: ['image', 'network', 'cluster', 'storageContainer'],
	harvester: ['image', 'network'],
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

	// Cache of provider option lists for name resolution. Fetched once
	// per discovery provider for each option type referenced by the
	// policy. Falls back to raw IDs when fetch fails or the provider
	// type does not expose that option type.
	const [allProviders, setAllProviders] = useState<Provider[]>([])
	const [entries, setEntries] = useState<Partial<Record<PolicyOptionType, ProviderEntry[]>>>({})

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
		void providersApi.list().then(r => setAllProviders(r.providers || [])).catch(() => setAllProviders([]))
	}, [name])

	// Eligible discovery providers for name resolution: those whose
	// type appears in the policy's targetProviders (or any configured
	// provider if targetProviders is empty).
	const discoveryProvider = useMemo(() => {
		if (!policy) return undefined
		const targets = policy.spec.targetProviders || []
		const candidates = targets.length === 0
			? allProviders
			: allProviders.filter(p => targets.includes(p.spec.provider))
		return candidates[0]
	}, [policy, allProviders])

	// Fetch the option-list entries for every option type the policy
	// references. One pass per discovery provider; cached in state by
	// option type.
	useEffect(() => {
		if (!discoveryProvider || !policy) return
		const supportedTypes = PROVIDER_OPTION_SUPPORT[discoveryProvider.spec.provider] || []
		const referenced = Object.keys(policy.spec.options || {}) as PolicyOptionType[]
		const need = referenced.filter(t => supportedTypes.includes(t) && entries[t] === undefined)
		if (need.length === 0) return
		const ns = discoveryProvider.metadata.namespace
		const nm = discoveryProvider.metadata.name
		need.forEach(async (optionType) => {
			try {
				let items: ProviderEntry[] = []
				if (optionType === 'image') {
					const r = await providersApi.listImages(ns, nm)
					items = (r.images || []).map(i => ({ id: i.id, name: i.name }))
				} else if (optionType === 'network') {
					const r = await providersApi.listNetworks(ns, nm)
					items = (r.networks || []).map(i => ({ id: i.id, name: i.name }))
				} else if (optionType === 'cluster') {
					const r = await providersApi.listClusters(ns, nm)
					items = (r.clusters || []).map(i => ({ id: i.id, name: i.name }))
				} else if (optionType === 'storageContainer') {
					const r = await providersApi.listStorageContainers(ns, nm)
					items = (r.storageContainers || []).map(i => ({ id: i.id, name: i.name }))
				}
				setEntries(prev => ({ ...prev, [optionType]: items }))
			} catch {
				setEntries(prev => ({ ...prev, [optionType]: [] }))
			}
		})
		// eslint-disable-next-line react-hooks/exhaustive-deps
	}, [discoveryProvider, policy])

	function entryLabel(optionType: PolicyOptionType, id: string): string {
		const list = entries[optionType]
		if (!list) return id
		const found = list.find(e => e.id === id)
		return found ? found.name : id
	}

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
					<dl className="grid grid-cols-[120px_1fr] gap-y-2 text-sm">
						{policy.spec.scope.clusterWide && (
							<>
								<dt className="text-neutral-500">Type</dt>
								<dd className="text-neutral-100">Cluster-wide</dd>
								<dt className="text-neutral-500">Applies to</dt>
								<dd className="text-neutral-400">Every team on this cluster</dd>
							</>
						)}
						{policy.spec.scope.team && (
							<>
								<dt className="text-neutral-500">Type</dt>
								<dd className="text-neutral-100">Team</dd>
								<dt className="text-neutral-500">Team</dt>
								<dd>
									<Link
										to={`/admin/teams/${encodeURIComponent(policy.spec.scope.team.teamRef.name)}`}
										className="text-violet-400 hover:text-violet-300 font-mono"
									>
										{policy.spec.scope.team.teamRef.name}
									</Link>
								</dd>
							</>
						)}
						{policy.spec.scope.teamAndEnvironment && (
							<>
								<dt className="text-neutral-500">Type</dt>
								<dd className="text-neutral-100">Team and environment</dd>
								<dt className="text-neutral-500">Team</dt>
								<dd>
									<Link
										to={`/admin/teams/${encodeURIComponent(policy.spec.scope.teamAndEnvironment.teamRef.name)}`}
										className="text-violet-400 hover:text-violet-300 font-mono"
									>
										{policy.spec.scope.teamAndEnvironment.teamRef.name}
									</Link>
								</dd>
								<dt className="text-neutral-500">Environment</dt>
								<dd className="text-neutral-100 font-mono">{policy.spec.scope.teamAndEnvironment.environmentName}</dd>
							</>
						)}
					</dl>
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
							const optionType = k as PolicyOptionType
							const r = opts[optionType]!
							const isPin = r.mode === 'pin'
							const isMulti = r.mode === 'allowList' || r.mode === 'recommended'
							const pinnedValue = r.values && r.values[0]
							return (
								<div key={k} className="p-3 bg-neutral-900 border border-neutral-800 rounded">
									<div className="flex items-center justify-between mb-2">
										<span className="text-sm text-neutral-200 font-mono">{k}</span>
										<span className="px-2 py-0.5 text-xs bg-violet-500/20 text-violet-300 rounded font-mono">{r.mode}</span>
									</div>

									{isPin && pinnedValue && (
										<div className="text-xs">
											<span className="text-neutral-500">Value: </span>
											<span className="text-neutral-200">{entryLabel(optionType, pinnedValue)}</span>
											<span className="text-neutral-600 font-mono ml-2">({pinnedValue.slice(0, 8)})</span>
										</div>
									)}

									{isMulti && r.values && r.values.length > 0 && (
										<div className="text-xs space-y-1">
											<div className="text-neutral-500">Values ({r.values.length}):</div>
											<ul className="space-y-0.5 pl-2">
												{r.values.map(v => (
													<li key={v} className="flex items-center gap-2">
														<span className="text-neutral-200">{entryLabel(optionType, v)}</span>
														<span className="text-neutral-600 font-mono">({v.slice(0, 8)})</span>
													</li>
												))}
											</ul>
										</div>
									)}

									{r.default && (
										<div className="text-xs mt-1">
											<span className="text-neutral-500">Default: </span>
											<span className="text-neutral-200">{entryLabel(optionType, r.default)}</span>
											<span className="text-neutral-600 font-mono ml-2">({r.default.slice(0, 8)})</span>
										</div>
									)}

									{r.recommendedReason && (
										<div className="text-xs text-neutral-400 mt-1">
											<span className="text-neutral-500">Reason: </span>
											{r.recommendedReason}
										</div>
									)}
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
