// Copyright 2026 The Butler Authors.
// SPDX-License-Identifier: Apache-2.0

import { useEffect, useState, type FormEvent } from 'react'
import { Modal, ModalHeader, ModalBody, ModalFooter } from '@/components/ui/Modal'
import { Button, Input } from '@/components/ui'
import { environmentsApi } from '@/api/environments'
import type {
	EnvironmentAccessGroup,
	EnvironmentAccessUser,
	EnvironmentClusterDefaults,
	EnvironmentRequest,
	TeamEnvironment,
} from '@/types/environments'
import {
	ENVIRONMENT_NAME_MAX_LENGTH,
	ENVIRONMENT_NAME_PATTERN,
} from '@/types/environments'
import { extractWebhookDenial } from '@/lib/webhookError'
import { useToast } from '@/hooks/useToast'

interface Props {
	isOpen: boolean
	team: string
	mode: 'create' | 'edit'
	initial?: TeamEnvironment
	onClose: () => void
	onSaved: () => void
}

type Role = 'admin' | 'operator' | 'viewer'

// Rank used to enforce ADR-009 additive-only inheritance: env role
// must be >= team role. Matches butler-server's roleLevel.
const ROLE_RANK: Record<Role, number> = { admin: 3, operator: 2, viewer: 1 }

interface TeamMember {
	email: string
	role: Role
}

interface UserRow extends EnvironmentAccessUser {
	id: string
}
interface GroupRow extends EnvironmentAccessGroup {
	id: string
}

// Default slot — 5 cluster-default fields. Empty string means "unset,
// fall through to team-level default". Numeric fields parse at submit.
interface DefaultsInput {
	kubernetesVersion: string
	workerCount: string
	workerCPU: string
	workerMemoryGi: string
	workerDiskGi: string
}

const EMPTY_DEFAULTS: DefaultsInput = {
	kubernetesVersion: '',
	workerCount: '',
	workerCPU: '',
	workerMemoryGi: '',
	workerDiskGi: '',
}

function parseLimit(v: string): { ok: boolean; value?: number } {
	const trimmed = v.trim()
	if (trimmed === '') return { ok: true, value: undefined }
	if (!/^\d+$/.test(trimmed)) return { ok: false }
	const n = parseInt(trimmed, 10)
	if (!Number.isFinite(n) || n < 0) return { ok: false }
	return { ok: true, value: n }
}

function defaultsToInput(d: EnvironmentClusterDefaults | undefined): DefaultsInput {
	return {
		kubernetesVersion: d?.kubernetesVersion ?? '',
		workerCount: d?.workerCount != null ? String(d.workerCount) : '',
		workerCPU: d?.workerCPU != null ? String(d.workerCPU) : '',
		workerMemoryGi: d?.workerMemoryGi != null ? String(d.workerMemoryGi) : '',
		workerDiskGi: d?.workerDiskGi != null ? String(d.workerDiskGi) : '',
	}
}

function inputToDefaults(d: DefaultsInput): {
	ok: boolean
	defaults?: EnvironmentClusterDefaults
	error?: string
} {
	const out: EnvironmentClusterDefaults = {}
	if (d.kubernetesVersion.trim()) out.kubernetesVersion = d.kubernetesVersion.trim()
	for (const [key, raw] of [
		['workerCount', d.workerCount],
		['workerCPU', d.workerCPU],
		['workerMemoryGi', d.workerMemoryGi],
		['workerDiskGi', d.workerDiskGi],
	] as const) {
		const trimmed = raw.trim()
		if (!trimmed) continue
		if (!/^\d+$/.test(trimmed)) return { ok: false, error: `${key} must be a non-negative integer` }
		out[key] = parseInt(trimmed, 10)
	}
	return Object.keys(out).length > 0 ? { ok: true, defaults: out } : { ok: true, defaults: undefined }
}

function rowId(): string {
	return Math.random().toString(36).slice(2, 10)
}

export function EnvironmentFormModal({ isOpen, team, mode, initial, onClose, onSaved }: Props) {
	const { success, error: showError } = useToast()
	const [name, setName] = useState('')
	const [description, setDescription] = useState('')
	const [maxClusters, setMaxClusters] = useState('')
	const [maxPerMember, setMaxPerMember] = useState('')
	const [defaults, setDefaults] = useState<DefaultsInput>(EMPTY_DEFAULTS)
	const [users, setUsers] = useState<UserRow[]>([])
	const [groups, setGroups] = useState<GroupRow[]>([])
	const [nameError, setNameError] = useState<string | null>(null)
	const [submitError, setSubmitError] = useState<string | null>(null)
	const [saving, setSaving] = useState(false)
	const [teamMembers, setTeamMembers] = useState<TeamMember[]>([])

	useEffect(() => {
		if (!isOpen) return
		setName(initial?.name ?? '')
		setDescription(initial?.description ?? '')
		setMaxClusters(initial?.limits?.maxClusters != null ? String(initial.limits.maxClusters) : '')
		setMaxPerMember(
			initial?.limits?.maxClustersPerMember != null
				? String(initial.limits.maxClustersPerMember)
				: '',
		)
		setDefaults(defaultsToInput(initial?.clusterDefaults))
		setUsers((initial?.access?.users ?? []).map((u) => ({ ...u, id: rowId() })))
		setGroups((initial?.access?.groups ?? []).map((g) => ({ ...g, id: rowId() })))
		setNameError(null)
		setSubmitError(null)
		setSaving(false)
	}, [isOpen, initial])

	// Pull team members on open so the Access section can show the team
	// role next to each env-access entry.
	useEffect(() => {
		if (!isOpen) return
		let cancelled = false
		void (async () => {
			try {
				const res = await fetch(`/api/teams/${encodeURIComponent(team)}/members`, {
					credentials: 'include',
				})
				if (!res.ok) return
				const data: { members?: { email: string; role: string }[] } = await res.json()
				if (cancelled) return
				const parsed: TeamMember[] = (data.members ?? [])
					.filter((m): m is { email: string; role: Role } =>
						m.role === 'admin' || m.role === 'operator' || m.role === 'viewer',
					)
					.map((m) => ({ email: m.email.toLowerCase(), role: m.role }))
				setTeamMembers(parsed)
			} catch {
				// Access section degrades gracefully; team-role lookup
				// stays empty and additive-inheritance check silently
				// passes. Server webhook is the authoritative gate.
			}
		})()
		return () => {
			cancelled = true
		}
	}, [isOpen, team])

	const isEdit = mode === 'edit'

	const validateName = (value: string): string | null => {
		if (!value) return 'Name is required'
		if (value.length > ENVIRONMENT_NAME_MAX_LENGTH) {
			return `Name must be ${ENVIRONMENT_NAME_MAX_LENGTH} characters or fewer`
		}
		if (!ENVIRONMENT_NAME_PATTERN.test(value)) {
			return 'Name must match Kubernetes label-value syntax (letters, digits, -, _, . ; start and end with alphanumeric)'
		}
		return null
	}

	const findTeamRole = (email: string): Role | null => {
		const m = teamMembers.find((tm) => tm.email === email.toLowerCase())
		return m?.role ?? null
	}

	const addUser = () => setUsers((prev) => [...prev, { id: rowId(), name: '', role: 'operator' }])
	const removeUser = (id: string) => setUsers((prev) => prev.filter((u) => u.id !== id))
	const updateUser = (id: string, patch: Partial<EnvironmentAccessUser>) =>
		setUsers((prev) => prev.map((u) => (u.id === id ? { ...u, ...patch } : u)))

	const addGroup = () =>
		setGroups((prev) => [...prev, { id: rowId(), name: '', role: 'operator' }])
	const removeGroup = (id: string) => setGroups((prev) => prev.filter((g) => g.id !== id))
	const updateGroup = (id: string, patch: Partial<EnvironmentAccessGroup>) =>
		setGroups((prev) => prev.map((g) => (g.id === id ? { ...g, ...patch } : g)))

	const handleSubmit = async (e: FormEvent) => {
		e.preventDefault()
		setSubmitError(null)

		const nameErr = validateName(name)
		if (nameErr) {
			setNameError(nameErr)
			return
		}
		setNameError(null)

		const limMax = parseLimit(maxClusters)
		const limPer = parseLimit(maxPerMember)
		if (!limMax.ok) {
			setSubmitError('Max clusters must be a non-negative integer')
			return
		}
		if (!limPer.ok) {
			setSubmitError('Max clusters per member must be a non-negative integer')
			return
		}

		const defaultsResult = inputToDefaults(defaults)
		if (!defaultsResult.ok) {
			setSubmitError(defaultsResult.error ?? 'Invalid cluster defaults')
			return
		}

		// Additive-only inheritance: env role must be >= team role.
		// Server webhook enforces this too; client validation is UX.
		const invalidUsers: string[] = []
		for (const u of users) {
			if (!u.name.trim()) {
				setSubmitError('All access users must have a non-empty email')
				return
			}
			const teamRole = findTeamRole(u.name)
			if (teamRole && ROLE_RANK[u.role] < ROLE_RANK[teamRole]) {
				invalidUsers.push(`${u.name} (team ${teamRole} > env ${u.role})`)
			}
		}
		if (invalidUsers.length > 0) {
			setSubmitError(
				`Env role cannot reduce below team role for: ${invalidUsers.join(', ')}`,
			)
			return
		}

		for (const g of groups) {
			if (!g.name.trim()) {
				setSubmitError('All access groups must have a non-empty name')
				return
			}
		}

		const req: EnvironmentRequest = { name }
		if (description.trim()) req.description = description.trim()
		if (limMax.value != null || limPer.value != null) {
			req.limits = {}
			if (limMax.value != null) req.limits.maxClusters = limMax.value
			if (limPer.value != null) req.limits.maxClustersPerMember = limPer.value
		}
		if (defaultsResult.defaults) req.clusterDefaults = defaultsResult.defaults
		if (users.length > 0 || groups.length > 0) {
			req.access = {}
			if (users.length > 0) {
				req.access.users = users.map((u) => ({ name: u.name.trim(), role: u.role }))
			}
			if (groups.length > 0) {
				req.access.groups = groups.map((g) => {
					const entry: EnvironmentAccessGroup = { name: g.name.trim(), role: g.role }
					if (g.identityProvider?.trim()) entry.identityProvider = g.identityProvider.trim()
					return entry
				})
			}
		}

		setSaving(true)
		try {
			if (isEdit) {
				await environmentsApi.update(team, name, req)
				success('Environment updated', `${name} has been updated`)
			} else {
				await environmentsApi.create(team, req)
				success('Environment created', `${name} has been created`)
			}
			onSaved()
		} catch (err) {
			const denial = extractWebhookDenial(err)
			if (denial) {
				setSubmitError(denial.message)
			} else {
				const msg = err instanceof Error ? err.message : 'Failed to save environment'
				setSubmitError(msg)
				showError('Save failed', msg)
			}
		} finally {
			setSaving(false)
		}
	}

	return (
		<Modal isOpen={isOpen} onClose={saving ? () => {} : onClose} size="xl">
			<ModalHeader>
				<h2 className="text-lg font-semibold text-neutral-100">
					{isEdit ? 'Edit Environment' : 'Create Environment'}
				</h2>
				<p className="text-sm text-neutral-400 mt-1">
					{isEdit ? 'Update environment settings.' : 'Define a new environment within this team.'}
				</p>
			</ModalHeader>
			<form onSubmit={handleSubmit}>
				<ModalBody>
					<div className="space-y-6 max-h-[70vh] overflow-y-auto pr-2">
						{/* Section: basic */}
						<section className="space-y-3">
							<h3 className="text-sm font-semibold text-neutral-200">Basics</h3>
							<Input
								label="Name"
								id="env-name"
								value={name}
								onChange={(e) => setName(e.target.value)}
								placeholder="dev"
								readOnly={isEdit}
								disabled={isEdit}
								aria-readonly={isEdit}
								title={
									isEdit
										? 'Environment names cannot be changed after creation. Delete and recreate if needed.'
										: undefined
								}
								error={nameError ?? undefined}
							/>
							{isEdit && (
								<p className="text-xs text-neutral-500">
									Names are immutable after creation.
								</p>
							)}
							<Input
								label="Description"
								id="env-description"
								value={description}
								onChange={(e) => setDescription(e.target.value)}
								placeholder="Short blurb shown in env list and cluster context"
							/>
						</section>

						{/* Section: limits */}
						<section className="space-y-3">
							<h3 className="text-sm font-semibold text-neutral-200">Quota limits</h3>
							<div className="grid grid-cols-2 gap-4">
								<Input
									label="Max clusters"
									id="env-max-clusters"
									type="number"
									min={0}
									value={maxClusters}
									onChange={(e) => setMaxClusters(e.target.value)}
									placeholder="unlimited"
								/>
								<Input
									label="Max per member"
									id="env-max-per-member"
									type="number"
									min={0}
									value={maxPerMember}
									onChange={(e) => setMaxPerMember(e.target.value)}
									placeholder="unlimited"
								/>
							</div>
							<p className="text-xs text-neutral-500">
								Blank leaves the dimension uncapped within the team's total ceiling.
							</p>
						</section>

						{/* Section: cluster defaults */}
						<section className="space-y-3">
							<h3 className="text-sm font-semibold text-neutral-200">Cluster defaults</h3>
							<p className="text-xs text-neutral-500">
								Applied when a cluster is created in this env without the field
								set. Overrides team-level defaults.
							</p>
							<div className="grid grid-cols-2 gap-4">
								<Input
									label="Kubernetes version"
									id="env-defaults-k8s"
									value={defaults.kubernetesVersion}
									onChange={(e) => setDefaults({ ...defaults, kubernetesVersion: e.target.value })}
									placeholder="v1.31.0"
								/>
								<Input
									label="Worker count"
									id="env-defaults-workers"
									type="number"
									min={0}
									value={defaults.workerCount}
									onChange={(e) => setDefaults({ ...defaults, workerCount: e.target.value })}
									placeholder="team default"
								/>
								<Input
									label="Worker CPU"
									id="env-defaults-cpu"
									type="number"
									min={0}
									value={defaults.workerCPU}
									onChange={(e) => setDefaults({ ...defaults, workerCPU: e.target.value })}
									placeholder="cores"
								/>
								<Input
									label="Worker memory (Gi)"
									id="env-defaults-mem"
									type="number"
									min={0}
									value={defaults.workerMemoryGi}
									onChange={(e) => setDefaults({ ...defaults, workerMemoryGi: e.target.value })}
									placeholder="Gi"
								/>
								<Input
									label="Worker disk (Gi)"
									id="env-defaults-disk"
									type="number"
									min={0}
									value={defaults.workerDiskGi}
									onChange={(e) => setDefaults({ ...defaults, workerDiskGi: e.target.value })}
									placeholder="Gi"
								/>
							</div>
						</section>

						{/* Section: access */}
						<section className="space-y-3">
							<div>
								<h3 className="text-sm font-semibold text-neutral-200">Environment access</h3>
								<p className="text-xs text-neutral-500 mt-1">
									Elevates team members within this env. Cannot reduce a team role
									(additive-only inheritance).
								</p>
							</div>

							<div className="space-y-2">
								<div className="flex items-center justify-between">
									<h4 className="text-xs font-medium uppercase tracking-wide text-neutral-400">Users</h4>
									<button
										type="button"
										onClick={addUser}
										className="text-xs text-blue-400 hover:text-blue-300"
									>
										+ Add user
									</button>
								</div>
								{users.length === 0 ? (
									<p className="text-xs text-neutral-500 italic">No user elevations.</p>
								) : (
									<div className="space-y-2">
										{users.map((u) => {
											const teamRole = findTeamRole(u.name)
											const reducesRole =
												teamRole != null && ROLE_RANK[u.role] < ROLE_RANK[teamRole]
											const noEffect =
												teamRole != null && ROLE_RANK[u.role] === ROLE_RANK[teamRole]
											return (
												<div key={u.id} className="grid grid-cols-[1fr_auto_auto_auto] gap-2 items-center">
													<Input
														id={`env-access-user-${u.id}`}
														value={u.name}
														onChange={(e) => updateUser(u.id, { name: e.target.value })}
														placeholder="user@example.com"
													/>
													<span className="text-xs text-neutral-500 min-w-[88px]">
														{teamRole ? `team: ${teamRole}` : 'team: —'}
													</span>
													<select
														value={u.role}
														onChange={(e) => updateUser(u.id, { role: e.target.value as Role })}
														className="bg-neutral-900 border border-neutral-700 rounded-lg px-2 py-2 text-sm text-neutral-100"
													>
														<option value="admin">admin</option>
														<option value="operator">operator</option>
														<option value="viewer">viewer</option>
													</select>
													<button
														type="button"
														onClick={() => removeUser(u.id)}
														className="text-xs text-neutral-500 hover:text-red-400 px-2"
														aria-label="Remove user"
													>
														✕
													</button>
													{reducesRole && (
														<p className="col-span-4 text-xs text-red-400">
															Env role lower than team role ({teamRole}); save will be rejected.
														</p>
													)}
													{noEffect && !reducesRole && (
														<p className="col-span-4 text-xs text-amber-400">
															No effect — member already has this role at team level.
														</p>
													)}
												</div>
											)
										})}
									</div>
								)}
							</div>

							<div className="space-y-2">
								<div className="flex items-center justify-between">
									<h4 className="text-xs font-medium uppercase tracking-wide text-neutral-400">Groups</h4>
									<button
										type="button"
										onClick={addGroup}
										className="text-xs text-blue-400 hover:text-blue-300"
									>
										+ Add group
									</button>
								</div>
								{groups.length === 0 ? (
									<p className="text-xs text-neutral-500 italic">No group elevations.</p>
								) : (
									<div className="space-y-2">
										{groups.map((g) => (
											<div key={g.id} className="grid grid-cols-[1fr_1fr_auto_auto] gap-2 items-center">
												<Input
													id={`env-access-group-${g.id}`}
													value={g.name}
													onChange={(e) => updateGroup(g.id, { name: e.target.value })}
													placeholder="group-name"
												/>
												<Input
													id={`env-access-group-idp-${g.id}`}
													value={g.identityProvider ?? ''}
													onChange={(e) => updateGroup(g.id, { identityProvider: e.target.value })}
													placeholder="idp (optional)"
												/>
												<select
													value={g.role}
													onChange={(e) => updateGroup(g.id, { role: e.target.value as Role })}
													className="bg-neutral-900 border border-neutral-700 rounded-lg px-2 py-2 text-sm text-neutral-100"
												>
													<option value="admin">admin</option>
													<option value="operator">operator</option>
													<option value="viewer">viewer</option>
												</select>
												<button
													type="button"
													onClick={() => removeGroup(g.id)}
													className="text-xs text-neutral-500 hover:text-red-400 px-2"
													aria-label="Remove group"
												>
													✕
												</button>
											</div>
										))}
									</div>
								)}
							</div>
						</section>

						{submitError && (
							<div className="p-3 bg-red-500/10 border border-red-500/20 rounded-lg">
								<p className="text-sm text-red-400 whitespace-pre-wrap">{submitError}</p>
							</div>
						)}
					</div>
				</ModalBody>
				<ModalFooter>
					<Button type="button" variant="secondary" onClick={onClose} disabled={saving}>
						Cancel
					</Button>
					<Button type="submit" disabled={saving}>
						{saving ? 'Saving...' : isEdit ? 'Save changes' : 'Create environment'}
					</Button>
				</ModalFooter>
			</form>
		</Modal>
	)
}
