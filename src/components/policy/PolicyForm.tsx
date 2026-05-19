// Copyright 2026 The Butler Authors.
// SPDX-License-Identifier: Apache-2.0

import { useEffect, useMemo, useState } from 'react'
import { Card, Button, Input } from '@/components/ui'
import { SearchableSelect, type SearchableSelectOption } from '@/components/ui/SearchableSelect'
import { providersApi, type Provider } from '@/api/providers'
import type {
	ClusterCreationPolicy,
	PolicyOptionMode,
	PolicyOptionRule,
	PolicyOptionType,
	WebhookError,
} from '@/api/policies'

const OPTION_TYPES: PolicyOptionType[] = ['image', 'network', 'cluster', 'storageContainer']
const OPTION_MODES: PolicyOptionMode[] = ['pin', 'allowList', 'default', 'recommended']

// Option types each provider type can populate via the existing
// butler-server list endpoints. Nutanix supports all four; Harvester
// supports image and network only. Provider types not in this map have
// no live discovery support; the form falls back to raw-IDs mode.
const PROVIDER_OPTION_SUPPORT: Record<string, PolicyOptionType[]> = {
	nutanix: ['image', 'network', 'cluster', 'storageContainer'],
	harvester: ['image', 'network'],
}

export interface PolicyFormProps {
	initial?: ClusterCreationPolicy
	nameLocked?: boolean
	teams: Array<{ name: string; environments?: Array<{ name: string }> }>
	onSubmit: (policy: ClusterCreationPolicy) => Promise<void>
	onCancel: () => void
	submitLabel?: string
	webhookError?: WebhookError | null
}

type ScopeKind = 'platformWide' | 'team' | 'teamAndEnvironment'

interface RuleEntry {
	optionType: PolicyOptionType
	rule: PolicyOptionRule
	// When true, the user is editing values as raw IDs in a textarea
	// instead of using the picker. Per-rule local toggle.
	rawMode: boolean
}

interface ProviderEntry {
	id: string
	name: string
}

function blankPolicy(): ClusterCreationPolicy {
	return {
		metadata: { name: '' },
		spec: { scope: { platformWide: {} }, targetProviders: [], options: {} },
	}
}

function scopeKindOf(p: ClusterCreationPolicy): ScopeKind {
	if (p.spec.scope.teamAndEnvironment) return 'teamAndEnvironment'
	if (p.spec.scope.team) return 'team'
	return 'platformWide'
}

function rulesFromPolicy(p: ClusterCreationPolicy): RuleEntry[] {
	const opts = p.spec.options || {}
	return (Object.keys(opts) as PolicyOptionType[]).map(k => ({
		optionType: k,
		rule: opts[k]!,
		rawMode: false,
	}))
}

export function PolicyForm({
	initial,
	nameLocked,
	teams,
	onSubmit,
	onCancel,
	submitLabel = 'Save',
	webhookError,
}: PolicyFormProps) {
	const start = initial ? structuredClone(initial) : blankPolicy()
	const [name, setName] = useState(start.metadata.name)
	const [scopeKind, setScopeKind] = useState<ScopeKind>(scopeKindOf(start))
	const [teamName, setTeamName] = useState(
		start.spec.scope.teamAndEnvironment?.teamRef.name ||
			start.spec.scope.team?.teamRef.name ||
			''
	)
	const [envName, setEnvName] = useState(start.spec.scope.teamAndEnvironment?.environmentName || '')
	const [providers, setProviders] = useState<string[]>(start.spec.targetProviders || [])
	const [rules, setRules] = useState<RuleEntry[]>(rulesFromPolicy(start))
	const [submitting, setSubmitting] = useState(false)
	const [localError, setLocalError] = useState<string | null>(null)

	// All ProviderConfigs configured on the cluster. Drives the
	// targetProviders multi-select (filtered to the distinct types in
	// use) and the discovery provider picker (a specific instance to
	// query for option list entries).
	const [allProviders, setAllProviders] = useState<Provider[]>([])
	const [providersLoading, setProvidersLoading] = useState(true)

	// The ProviderConfig whose option lists the value pickers query.
	// Stored as "namespace/name" because Provider IDs are not unique on
	// their own. Defaults to the first matching configured provider.
	const [discoveryKey, setDiscoveryKey] = useState<string>('')

	// Live entries for each option type, cached by discoveryKey. Cleared
	// when the discovery provider changes.
	const [entries, setEntries] = useState<Partial<Record<PolicyOptionType, ProviderEntry[]>>>({})
	const [entriesLoading, setEntriesLoading] = useState<Partial<Record<PolicyOptionType, boolean>>>({})

	// Fetch the configured providers once on mount.
	useEffect(() => {
		void providersApi.list().then(resp => {
			setAllProviders(resp.providers || [])
		}).catch(() => {
			setAllProviders([])
		}).finally(() => {
			setProvidersLoading(false)
		})
	}, [])

	const configuredTypes = useMemo(() => {
		const types = new Set<string>()
		for (const p of allProviders) types.add(p.spec.provider)
		return Array.from(types).sort()
	}, [allProviders])

	const eligibleDiscoveryProviders = useMemo(() => {
		// When targetProviders is empty, any configured provider is
		// eligible. When set, restrict to providers whose type appears
		// in the target list.
		if (providers.length === 0) return allProviders
		return allProviders.filter(p => providers.includes(p.spec.provider))
	}, [allProviders, providers])

	// Auto-pick a discovery provider when the eligible set changes.
	useEffect(() => {
		if (eligibleDiscoveryProviders.length === 0) {
			setDiscoveryKey('')
			return
		}
		const existing = eligibleDiscoveryProviders.find(
			p => `${p.metadata.namespace}/${p.metadata.name}` === discoveryKey,
		)
		if (existing) return
		const first = eligibleDiscoveryProviders[0]
		setDiscoveryKey(`${first.metadata.namespace}/${first.metadata.name}`)
		setEntries({})
	}, [eligibleDiscoveryProviders, discoveryKey])

	const discoveryProvider = useMemo(() => {
		return eligibleDiscoveryProviders.find(
			p => `${p.metadata.namespace}/${p.metadata.name}` === discoveryKey,
		)
	}, [eligibleDiscoveryProviders, discoveryKey])

	const supportedOptionTypes = useMemo(() => {
		if (!discoveryProvider) return [] as PolicyOptionType[]
		return PROVIDER_OPTION_SUPPORT[discoveryProvider.spec.provider] || []
	}, [discoveryProvider])

	// Lazy-fetch the option list for an option type from the discovery
	// provider. Memoized in entries[optionType].
	async function ensureEntries(optionType: PolicyOptionType) {
		if (!discoveryProvider) return
		if (entries[optionType] !== undefined) return
		if (!supportedOptionTypes.includes(optionType)) return
		setEntriesLoading(prev => ({ ...prev, [optionType]: true }))
		try {
			const ns = discoveryProvider.metadata.namespace
			const nm = discoveryProvider.metadata.name
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
			// Leave undefined; the form falls back to raw IDs.
			setEntries(prev => ({ ...prev, [optionType]: [] }))
		} finally {
			setEntriesLoading(prev => ({ ...prev, [optionType]: false }))
		}
	}

	function entriesAsOptions(optionType: PolicyOptionType): SearchableSelectOption[] {
		return (entries[optionType] || []).map(e => ({
			value: e.id,
			label: e.name,
			suffix: e.id.slice(0, 8),
		}))
	}

	function entryLabelById(optionType: PolicyOptionType, id: string): string {
		const e = (entries[optionType] || []).find(x => x.id === id)
		return e ? e.name : id
	}

	useEffect(() => {
		// When team changes, reset env if the new team does not have it
		const t = teams.find(x => x.name === teamName)
		if (t && envName && !(t.environments || []).some(e => e.name === envName)) {
			setEnvName('')
		}
	}, [teamName, envName, teams])

	const currentTeamEnvs = teams.find(t => t.name === teamName)?.environments || []

	function toggleProvider(p: string) {
		setProviders(prev => (prev.includes(p) ? prev.filter(x => x !== p) : [...prev, p]))
		setEntries({})
	}

	function addRule() {
		const taken = new Set(rules.map(r => r.optionType))
		const free = OPTION_TYPES.find(t => !taken.has(t))
		if (!free) return
		setRules(prev => [...prev, { optionType: free, rule: { mode: 'pin', values: [] }, rawMode: false }])
	}

	function removeRule(i: number) {
		setRules(prev => prev.filter((_, idx) => idx !== i))
	}

	function updateRule(i: number, patch: Partial<RuleEntry>) {
		setRules(prev => prev.map((r, idx) => (idx === i ? { ...r, ...patch, rule: patch.rule ? { ...r.rule, ...patch.rule } : r.rule } : r)))
	}

	function buildPolicy(): ClusterCreationPolicy {
		const policy: ClusterCreationPolicy = {
			apiVersion: 'butler.butlerlabs.dev/v1alpha1',
			kind: 'ClusterCreationPolicy',
			metadata: { name },
			spec: {
				scope:
					scopeKind === 'platformWide'
						? { platformWide: {} }
						: scopeKind === 'team'
							? { team: { teamRef: { name: teamName } } }
							: { teamAndEnvironment: { teamRef: { name: teamName }, environmentName: envName } },
				targetProviders: providers.length > 0 ? providers : undefined,
				options: rules.reduce<Partial<Record<PolicyOptionType, PolicyOptionRule>>>((acc, r) => {
					acc[r.optionType] = r.rule
					return acc
				}, {}),
			},
		}
		if (initial?.metadata.resourceVersion) {
			policy.metadata.resourceVersion = initial.metadata.resourceVersion
		}
		return policy
	}

	function validateLocal(): string | null {
		if (!name.trim()) return 'name is required'
		if (scopeKind !== 'platformWide' && !teamName) return 'team is required for team scope'
		if (scopeKind === 'teamAndEnvironment' && !envName) return 'environment is required for teamAndEnvironment scope'
		if (rules.length === 0) return 'at least one option rule is required'
		for (const r of rules) {
			if (r.rule.mode === 'pin') {
				if (!r.rule.values || r.rule.values.length !== 1) {
					return `mode pin on ${r.optionType} requires exactly one value`
				}
			} else if ((r.rule.mode === 'allowList' || r.rule.mode === 'recommended') && (!r.rule.values || r.rule.values.length === 0)) {
				return `mode ${r.rule.mode} on ${r.optionType} requires at least one value`
			}
			if (r.rule.mode === 'default' && !r.rule.default) {
				return `mode default on ${r.optionType} requires a default value`
			}
		}
		return null
	}

	async function handleSubmit(e: React.FormEvent) {
		e.preventDefault()
		setLocalError(null)
		const err = validateLocal()
		if (err) {
			setLocalError(err)
			return
		}
		setSubmitting(true)
		try {
			await onSubmit(buildPolicy())
		} finally {
			setSubmitting(false)
		}
	}

	function fieldDeniedFor(path: string): boolean {
		return !!webhookError && webhookError.field === path
	}

	// Lazy-fetch entries for every option type referenced by a non-raw
	// rule whenever the discovery provider changes. Centralised here
	// (rather than inside per-rule inner components) so the rule cards
	// can render plain JSX and the SearchableSelect inside them retains
	// its open/query state across parent re-renders.
	useEffect(() => {
		if (!discoveryProvider) return
		for (const r of rules) {
			if (!r.rawMode && supportedOptionTypes.includes(r.optionType)) {
				void ensureEntries(r.optionType)
			}
		}
		// eslint-disable-next-line react-hooks/exhaustive-deps
	}, [discoveryKey, rules.length])

	return (
		<form onSubmit={handleSubmit} className="space-y-6">
			{webhookError && (
				<Card className="p-4 border-red-700 bg-red-950/50">
					<p className="text-red-300 text-sm font-medium">Admission webhook denied the request</p>
					<p className="text-red-200 text-xs mt-1 whitespace-pre-wrap">{webhookError.message}</p>
					{webhookError.field && (
						<p className="text-red-400 text-xs mt-1">field: <span className="font-mono">{webhookError.field}</span></p>
					)}
				</Card>
			)}
			{localError && (
				<Card className="p-3 border-amber-700 bg-amber-950/50">
					<p className="text-amber-300 text-sm">{localError}</p>
				</Card>
			)}

			<Card className="p-5 space-y-4">
				<h3 className="text-sm font-medium text-neutral-300 uppercase tracking-wide">Identity</h3>
				<Input
					id="policy-name"
					label="Name"
					value={name}
					onChange={e => setName(e.target.value)}
					disabled={nameLocked}
					required
				/>
			</Card>

			<Card className="p-5 space-y-4">
				<h3 className="text-sm font-medium text-neutral-300 uppercase tracking-wide">Scope</h3>
				<div className="space-y-2 text-sm">
					{(['platformWide', 'team', 'teamAndEnvironment'] as ScopeKind[]).map(k => (
						<label key={k} className="flex items-center gap-2 cursor-pointer">
							<input
								type="radio"
								name="scope-kind"
								checked={scopeKind === k}
								onChange={() => setScopeKind(k)}
							/>
							<span className="text-neutral-200">{k === 'platformWide' ? 'Platform-wide' : k === 'team' ? 'Team' : 'Team and environment'}</span>
						</label>
					))}
				</div>
				{scopeKind !== 'platformWide' && (
					<div className="grid grid-cols-2 gap-3">
						<div>
							<label className="block text-sm text-neutral-400 mb-1">Team</label>
							<select
								value={teamName}
								onChange={e => setTeamName(e.target.value)}
								className="w-full px-3 py-2 bg-neutral-800 border border-neutral-700 rounded-lg text-neutral-200 focus:outline-none focus:ring-2 focus:ring-violet-500"
							>
								<option value="">Select team…</option>
								{teams.map(t => (
									<option key={t.name} value={t.name}>{t.name}</option>
								))}
							</select>
						</div>
						{scopeKind === 'teamAndEnvironment' && (
							<div>
								<label className="block text-sm text-neutral-400 mb-1">Environment</label>
								<select
									value={envName}
									onChange={e => setEnvName(e.target.value)}
									disabled={!teamName}
									className="w-full px-3 py-2 bg-neutral-800 border border-neutral-700 rounded-lg text-neutral-200 focus:outline-none focus:ring-2 focus:ring-violet-500 disabled:opacity-50"
								>
									<option value="">Select environment…</option>
									{currentTeamEnvs.map(e => (
										<option key={e.name} value={e.name}>{e.name}</option>
									))}
								</select>
								{teamName && currentTeamEnvs.length === 0 && (
									<p className="text-xs text-neutral-500 mt-1">Team {teamName} has no environments defined</p>
								)}
							</div>
						)}
					</div>
				)}
			</Card>

			<Card className="p-5 space-y-4">
				<h3 className="text-sm font-medium text-neutral-300 uppercase tracking-wide">Target providers</h3>
				<p className="text-xs text-neutral-500">Empty selection means the policy applies to every provider type. Only provider types configured on this cluster are shown.</p>
				{providersLoading ? (
					<p className="text-sm text-neutral-500">Loading providers…</p>
				) : configuredTypes.length === 0 ? (
					<p className="text-sm text-amber-400">No ProviderConfigs are configured on this cluster. Policies still apply, but the value picker below will have nothing to populate.</p>
				) : (
					<div className="flex flex-wrap gap-2">
						{configuredTypes.map(p => (
							<label key={p} className="flex items-center gap-2 px-3 py-1.5 bg-neutral-800 border border-neutral-700 rounded-lg cursor-pointer hover:bg-neutral-700/50">
								<input type="checkbox" checked={providers.includes(p)} onChange={() => toggleProvider(p)} />
								<span className="text-sm text-neutral-200">{p}</span>
							</label>
						))}
					</div>
				)}
			</Card>

			<Card className="p-5 space-y-3">
				<h3 className="text-sm font-medium text-neutral-300 uppercase tracking-wide">Discovery provider</h3>
				<p className="text-xs text-neutral-500">
					The ProviderConfig the value pickers below query for live entries. Picking a discovery provider does not change what the policy targets; it only sources the dropdowns. Defaults to the first eligible configured provider.
				</p>
				{eligibleDiscoveryProviders.length === 0 ? (
					<p className="text-sm text-amber-400">No eligible ProviderConfig found. Value pickers will fall back to raw IDs.</p>
				) : (
					<select
						value={discoveryKey}
						onChange={e => { setDiscoveryKey(e.target.value); setEntries({}) }}
						className="w-full md:w-auto px-3 py-2 bg-neutral-800 border border-neutral-700 rounded-lg text-neutral-200 text-sm"
					>
						{eligibleDiscoveryProviders.map(p => (
							<option key={`${p.metadata.namespace}/${p.metadata.name}`} value={`${p.metadata.namespace}/${p.metadata.name}`}>
								{p.metadata.namespace}/{p.metadata.name} ({p.spec.provider})
							</option>
						))}
					</select>
				)}
			</Card>

			<Card className="p-5 space-y-4">
				<div className="flex items-center justify-between">
					<h3 className="text-sm font-medium text-neutral-300 uppercase tracking-wide">Option rules</h3>
					<Button type="button" variant="secondary" size="sm" onClick={addRule} disabled={rules.length >= OPTION_TYPES.length}>
						Add rule
					</Button>
				</div>
				{rules.length === 0 && (
					<p className="text-sm text-neutral-500">No rules yet. Add at least one option rule.</p>
				)}
				{rules.map((r, i) => {
					const fieldPath = `spec.options[${r.optionType}]`
					const optionType = r.optionType
					const pickerSupported = supportedOptionTypes.includes(optionType) && !!discoveryProvider
					const useRaw = r.rawMode || !pickerSupported
					const currentValues = r.rule.values || []
					const allEntryOptions = entriesAsOptions(optionType)
					const remainingEntryOptions = allEntryOptions.filter(o => !currentValues.includes(o.value))
					// pin is exactly one value; treat as single-select.
					// allowList and recommended accept multiple.
					const isMultiValue = r.rule.mode === 'allowList' || r.rule.mode === 'recommended'
					const isSinglePin = r.rule.mode === 'pin'
					const pinnedValue = currentValues[0] || ''

					return (
						<div key={i} className={`p-4 border rounded-lg space-y-3 ${fieldDeniedFor(fieldPath) ? 'border-red-700 bg-red-950/30' : 'border-neutral-700 bg-neutral-900/50'}`}>
							<div className="grid grid-cols-2 gap-3">
								<div>
									<label className="block text-xs text-neutral-400 mb-1">Option type</label>
									<select
										value={r.optionType}
										onChange={e => updateRule(i, { optionType: e.target.value as PolicyOptionType })}
										className="w-full px-3 py-2 bg-neutral-800 border border-neutral-700 rounded-lg text-neutral-200 text-sm"
									>
										{OPTION_TYPES.map(t => (
											<option key={t} value={t} disabled={rules.some((other, j) => j !== i && other.optionType === t)}>{t}</option>
										))}
									</select>
								</div>
								<div>
									<label className="block text-xs text-neutral-400 mb-1">Mode</label>
									<select
										value={r.rule.mode}
										onChange={e => updateRule(i, { rule: { ...r.rule, mode: e.target.value as PolicyOptionMode } })}
										className="w-full px-3 py-2 bg-neutral-800 border border-neutral-700 rounded-lg text-neutral-200 text-sm"
									>
										{OPTION_MODES.map(m => (
											<option key={m} value={m}>{m}</option>
										))}
									</select>
								</div>
							</div>

							{!pickerSupported && discoveryProvider && (
								<p className="text-xs text-amber-400">
									{discoveryProvider.spec.provider} does not expose {optionType} via list API. Falling back to raw IDs.
								</p>
							)}

							{isSinglePin && (
								<div className="space-y-2">
									<div className="flex items-center justify-between">
										<label className="block text-xs text-neutral-400">Pinned value (exactly one)</label>
										{discoveryProvider && supportedOptionTypes.includes(optionType) && (
											<button
												type="button"
												className="text-xs text-neutral-500 hover:text-neutral-300"
												onClick={() => updateRule(i, { rawMode: !r.rawMode })}
											>
												{r.rawMode ? 'Use picker' : 'Edit raw ID'}
											</button>
										)}
									</div>
									{useRaw ? (
										<Input
											id={`rule-${i}-pin`}
											label=""
											value={pinnedValue}
											onChange={e => updateRule(i, { rule: { ...r.rule, values: e.target.value ? [e.target.value.trim()] : [] } })}
										/>
									) : (
										<SearchableSelect
											value={pinnedValue}
											onChange={val => updateRule(i, { rule: { ...r.rule, values: val ? [val] : [] } })}
											options={allEntryOptions}
											placeholder={entriesLoading[optionType] ? 'Loading…' : `Pin to one ${optionType}…`}
											loading={!!entriesLoading[optionType]}
											loadingText="Loading…"
											focusRingColor="focus-within:ring-violet-500"
										/>
									)}
								</div>
							)}

							{isMultiValue && (
								<div className="space-y-2">
									<div className="flex items-center justify-between">
										<label className="block text-xs text-neutral-400">Values</label>
										{discoveryProvider && supportedOptionTypes.includes(optionType) && (
											<button
												type="button"
												className="text-xs text-neutral-500 hover:text-neutral-300"
												onClick={() => updateRule(i, { rawMode: !r.rawMode })}
											>
												{r.rawMode ? 'Use picker' : 'Edit raw IDs'}
											</button>
										)}
									</div>
									{useRaw ? (
										<textarea
											value={currentValues.join('\n')}
											onChange={e => updateRule(i, { rule: { ...r.rule, values: e.target.value.split('\n').map(s => s.trim()).filter(Boolean) } })}
											rows={3}
											placeholder="One ID per line"
											className="w-full px-3 py-2 bg-neutral-800 border border-neutral-700 rounded-lg text-neutral-200 text-sm font-mono"
										/>
									) : (
										<>
											{currentValues.length > 0 && (
												<div className="flex flex-wrap gap-2">
													{currentValues.map(v => (
														<span key={v} className="inline-flex items-center gap-1 px-2 py-1 bg-violet-500/15 border border-violet-700/40 rounded text-xs">
															<span className="text-violet-200 font-mono">{entryLabelById(optionType, v)}</span>
															<button
																type="button"
																onClick={() => updateRule(i, { rule: { ...r.rule, values: currentValues.filter(x => x !== v) } })}
																className="text-violet-300 hover:text-violet-100"
																aria-label={`remove ${v}`}
															>×</button>
														</span>
													))}
												</div>
											)}
											<SearchableSelect
												value=""
												onChange={(val) => {
													if (val && !currentValues.includes(val)) {
														updateRule(i, { rule: { ...r.rule, values: [...currentValues, val] } })
													}
												}}
												options={remainingEntryOptions}
												placeholder={entriesLoading[optionType] ? 'Loading…' : `Add ${optionType}…`}
												loading={!!entriesLoading[optionType]}
												loadingText="Loading…"
												focusRingColor="focus-within:ring-violet-500"
											/>
										</>
									)}
								</div>
							)}

							{r.rule.mode === 'default' && (
								<div className="space-y-2">
									<div className="flex items-center justify-between">
										<label className="block text-xs text-neutral-400">Default</label>
										{discoveryProvider && supportedOptionTypes.includes(optionType) && (
											<button
												type="button"
												className="text-xs text-neutral-500 hover:text-neutral-300"
												onClick={() => updateRule(i, { rawMode: !r.rawMode })}
											>
												{r.rawMode ? 'Use picker' : 'Edit raw ID'}
											</button>
										)}
									</div>
									{useRaw ? (
										<Input
											id={`rule-${i}-default`}
											label=""
											value={r.rule.default || ''}
											onChange={e => updateRule(i, { rule: { ...r.rule, default: e.target.value } })}
										/>
									) : (
										<SearchableSelect
											value={r.rule.default || ''}
											onChange={val => updateRule(i, { rule: { ...r.rule, default: val } })}
											options={allEntryOptions}
											placeholder={entriesLoading[optionType] ? 'Loading…' : 'Select…'}
											loading={!!entriesLoading[optionType]}
											loadingText="Loading…"
											focusRingColor="focus-within:ring-violet-500"
										/>
									)}
								</div>
							)}

							{r.rule.mode === 'allowList' && (
								<Input
									id={`rule-${i}-default-opt`}
									label="Default (optional, pre-selects within allow-list)"
									value={r.rule.default || ''}
									onChange={e => updateRule(i, { rule: { ...r.rule, default: e.target.value } })}
								/>
							)}
							{r.rule.mode === 'recommended' && (
								<Input
									id={`rule-${i}-reason`}
									label="Recommended reason (optional)"
									value={r.rule.recommendedReason || ''}
									onChange={e => updateRule(i, { rule: { ...r.rule, recommendedReason: e.target.value } })}
								/>
							)}
							<div className="flex justify-end">
								<button type="button" onClick={() => removeRule(i)} className="text-xs text-red-400 hover:text-red-300">
									Remove rule
								</button>
							</div>
						</div>
					)
				})}
			</Card>

			<div className="flex justify-end gap-2">
				<Button type="button" variant="secondary" onClick={onCancel} disabled={submitting}>
					Cancel
				</Button>
				<Button type="submit" disabled={submitting}>
					{submitting ? 'Saving…' : submitLabel}
				</Button>
			</div>
		</form>
	)
}
