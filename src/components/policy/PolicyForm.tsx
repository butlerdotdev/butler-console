// Copyright 2026 The Butler Authors.
// SPDX-License-Identifier: Apache-2.0

import { useEffect, useState } from 'react'
import { Card, Button, Input } from '@/components/ui'
import type {
	ClusterCreationPolicy,
	PolicyOptionMode,
	PolicyOptionRule,
	PolicyOptionType,
	WebhookError,
} from '@/api/policies'

const OPTION_TYPES: PolicyOptionType[] = ['image', 'network', 'cluster', 'storageContainer']
const OPTION_MODES: PolicyOptionMode[] = ['pin', 'allowList', 'default', 'recommended']

export interface PolicyFormProps {
	initial?: ClusterCreationPolicy
	nameLocked?: boolean
	teams: Array<{ name: string; environments?: Array<{ name: string }> }>
	providerTypes: string[]
	onSubmit: (policy: ClusterCreationPolicy) => Promise<void>
	onCancel: () => void
	submitLabel?: string
	webhookError?: WebhookError | null
}

type ScopeKind = 'clusterWide' | 'team' | 'teamAndEnvironment'

interface RuleEntry {
	optionType: PolicyOptionType
	rule: PolicyOptionRule
}

function blankPolicy(): ClusterCreationPolicy {
	return {
		metadata: { name: '' },
		spec: {
			scope: { clusterWide: {} },
			targetProviders: [],
			options: {},
		},
	}
}

function scopeKindOf(policy: ClusterCreationPolicy): ScopeKind {
	if (policy.spec.scope.teamAndEnvironment) return 'teamAndEnvironment'
	if (policy.spec.scope.team) return 'team'
	return 'clusterWide'
}

function rulesFromPolicy(policy: ClusterCreationPolicy): RuleEntry[] {
	const opts = policy.spec.options || {}
	return (Object.keys(opts) as PolicyOptionType[]).map(k => ({
		optionType: k,
		rule: opts[k]!,
	}))
}

export function PolicyForm({
	initial,
	nameLocked,
	teams,
	providerTypes,
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
	}

	function addRule() {
		const taken = new Set(rules.map(r => r.optionType))
		const free = OPTION_TYPES.find(t => !taken.has(t))
		if (!free) return
		setRules(prev => [...prev, { optionType: free, rule: { mode: 'pin', values: [] } }])
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
					scopeKind === 'clusterWide'
						? { clusterWide: {} }
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
		if (scopeKind !== 'clusterWide' && !teamName) return 'team is required for team scope'
		if (scopeKind === 'teamAndEnvironment' && !envName) return 'environment is required for teamAndEnvironment scope'
		if (rules.length === 0) return 'at least one option rule is required'
		for (const r of rules) {
			if ((r.rule.mode === 'pin' || r.rule.mode === 'allowList' || r.rule.mode === 'recommended') && (!r.rule.values || r.rule.values.length === 0)) {
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
					{(['clusterWide', 'team', 'teamAndEnvironment'] as ScopeKind[]).map(k => (
						<label key={k} className="flex items-center gap-2 cursor-pointer">
							<input
								type="radio"
								name="scope-kind"
								checked={scopeKind === k}
								onChange={() => setScopeKind(k)}
							/>
							<span className="text-neutral-200">{k === 'clusterWide' ? 'Cluster-wide' : k === 'team' ? 'Team' : 'Team and environment'}</span>
						</label>
					))}
				</div>
				{scopeKind !== 'clusterWide' && (
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
				<p className="text-xs text-neutral-500">Empty selection means the policy applies to every provider.</p>
				<div className="flex flex-wrap gap-2">
					{providerTypes.map(p => (
						<label key={p} className="flex items-center gap-2 px-3 py-1.5 bg-neutral-800 border border-neutral-700 rounded-lg cursor-pointer hover:bg-neutral-700/50">
							<input type="checkbox" checked={providers.includes(p)} onChange={() => toggleProvider(p)} />
							<span className="text-sm text-neutral-200">{p}</span>
						</label>
					))}
				</div>
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
							{(r.rule.mode === 'pin' || r.rule.mode === 'allowList' || r.rule.mode === 'recommended') && (
								<div>
									<label className="block text-xs text-neutral-400 mb-1">Values (one per line, provider IDs)</label>
									<textarea
										value={(r.rule.values || []).join('\n')}
										onChange={e => updateRule(i, { rule: { ...r.rule, values: e.target.value.split('\n').map(s => s.trim()).filter(Boolean) } })}
										rows={3}
										className="w-full px-3 py-2 bg-neutral-800 border border-neutral-700 rounded-lg text-neutral-200 text-sm font-mono"
									/>
								</div>
							)}
							{r.rule.mode === 'default' && (
								<Input
									id={`rule-${i}-default`}
									label="Default value (provider ID)"
									value={r.rule.default || ''}
									onChange={e => updateRule(i, { rule: { ...r.rule, default: e.target.value } })}
								/>
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
