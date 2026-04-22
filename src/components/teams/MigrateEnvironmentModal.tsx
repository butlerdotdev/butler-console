// Copyright 2026 The Butler Authors.
// SPDX-License-Identifier: Apache-2.0

import { useCallback, useEffect, useMemo, useState } from 'react'
import { Modal, ModalHeader, ModalBody, ModalFooter } from '@/components/ui/Modal'
import { Button } from '@/components/ui'
import { clustersApi } from '@/api'
import { extractWebhookDenial } from '@/lib/webhookError'
import { ENVIRONMENT_LABEL, type TeamEnvironment } from '@/types/environments'
import { envAccent, NEUTRAL_ACCENT } from '@/lib/envColor'
import { cn } from '@/lib/utils'

interface ClusterRef {
	namespace: string
	name: string
	currentEnv: string
}

interface Props {
	isOpen: boolean
	team: string
	teamNamespace: string | null
	envs: TeamEnvironment[]
	onClose: () => void
	onDone: () => void
}

// Three source-filter modes. "unlabeled" matches butleradm env migrate
// --all (the step-6 default). "from" migrates already-labeled clusters
// out of a specific env; server sees this as a relabel and requires
// the migration annotation (butler-server's ChangeEnvironment handler
// sets it automatically). "individual" is cherry-pick from the full
// list.
type SourceMode = 'unlabeled' | 'from' | 'individual'

type RowStatus = 'pending' | 'in-progress' | 'succeeded' | 'failed'

interface RowState {
	cluster: ClusterRef
	status: RowStatus
	error?: string
}

export function MigrateEnvironmentModal({
	isOpen,
	team,
	teamNamespace,
	envs,
	onClose,
	onDone,
}: Props) {
	const [sourceMode, setSourceMode] = useState<SourceMode>('unlabeled')
	const [sourceEnv, setSourceEnv] = useState<string>('')
	const [targetEnv, setTargetEnv] = useState<string>('')
	const [allClusters, setAllClusters] = useState<ClusterRef[]>([])
	const [selected, setSelected] = useState<Set<string>>(new Set())
	const [loading, setLoading] = useState(false)
	const [rows, setRows] = useState<RowState[]>([])
	const [running, setRunning] = useState(false)
	const [abortRequested, setAbortRequested] = useState(false)
	const [showAbortConfirm, setShowAbortConfirm] = useState(false)
	const [loadError, setLoadError] = useState<string | null>(null)

	// Reset state whenever the modal opens. Target defaults to first
	// env; source-env defaults to second env (if one exists) so the
	// dropdown shows something sensible.
	useEffect(() => {
		if (!isOpen) return
		setSourceMode('unlabeled')
		const sorted = [...envs].sort((a, b) => a.name.localeCompare(b.name))
		setTargetEnv(sorted[0]?.name ?? '')
		setSourceEnv(sorted[1]?.name ?? sorted[0]?.name ?? '')
		setSelected(new Set())
		setRows([])
		setRunning(false)
		setAbortRequested(false)
		setShowAbortConfirm(false)
		setLoadError(null)
	}, [isOpen, envs])

	// Fetch the team's clusters whenever the modal opens.
	const fetchClusters = useCallback(async () => {
		if (!isOpen) return
		setLoading(true)
		setLoadError(null)
		try {
			const res = await fetch(`/api/teams/${encodeURIComponent(team)}/clusters`, {
				credentials: 'include',
			})
			if (!res.ok) {
				setLoadError('Failed to load clusters for this team.')
				setAllClusters([])
				return
			}
			const data: {
				clusters?: Array<{
					metadata?: { name?: string; namespace?: string; labels?: Record<string, string> }
				}>
			} = await res.json()
			const list: ClusterRef[] = (data.clusters ?? []).flatMap((c) => {
				const n = c.metadata?.name
				const ns = c.metadata?.namespace
				if (!n || !ns) return []
				return [{
					namespace: ns,
					name: n,
					currentEnv: c.metadata?.labels?.[ENVIRONMENT_LABEL] || '',
				}]
			})
			setAllClusters(list)
		} catch {
			setLoadError('Failed to load clusters for this team.')
			setAllClusters([])
		} finally {
			setLoading(false)
		}
	}, [isOpen, team])

	useEffect(() => {
		void fetchClusters()
	}, [fetchClusters])

	// Derive the preview set from the source-mode + current selections.
	const previewClusters = useMemo(() => {
		if (sourceMode === 'unlabeled') {
			return allClusters.filter((c) => c.currentEnv === '')
		}
		if (sourceMode === 'from') {
			if (!sourceEnv) return []
			return allClusters.filter((c) => c.currentEnv === sourceEnv)
		}
		return allClusters.filter((c) => selected.has(clusterKey(c)))
	}, [sourceMode, sourceEnv, allClusters, selected])

	const isRelabel = useMemo(() => {
		return previewClusters.some((c) => c.currentEnv !== '' && c.currentEnv !== targetEnv)
	}, [previewClusters, targetEnv])

	const canSubmit =
		!!targetEnv && previewClusters.length > 0 && !running && !loading

	const toggleSelection = (c: ClusterRef) => {
		const key = clusterKey(c)
		setSelected((prev) => {
			const next = new Set(prev)
			if (next.has(key)) next.delete(key)
			else next.add(key)
			return next
		})
	}

	const runMigration = async (targets: ClusterRef[]) => {
		setRunning(true)
		setAbortRequested(false)
		setRows(targets.map((c) => ({ cluster: c, status: 'pending' })))
		for (let i = 0; i < targets.length; i++) {
			if (abortRequested) break
			const c = targets[i]
			setRows((prev) =>
				prev.map((r, idx) => (idx === i ? { ...r, status: 'in-progress' } : r)),
			)
			try {
				await clustersApi.changeEnvironment(c.namespace, c.name, targetEnv)
				setRows((prev) =>
					prev.map((r, idx) => (idx === i ? { ...r, status: 'succeeded' } : r)),
				)
			} catch (err) {
				const denial = extractWebhookDenial(err)
				const msg = denial?.message ?? (err instanceof Error ? err.message : 'Unknown error')
				setRows((prev) =>
					prev.map((r, idx) =>
						idx === i ? { ...r, status: 'failed', error: msg } : r,
					),
				)
			}
		}
		setRunning(false)
		// Refresh parent list so succeeded migrations show up.
		onDone()
	}

	const handleSubmit = () => {
		const targets = previewClusters.slice()
		void runMigration(targets)
	}

	const retryFailed = () => {
		const failed = rows.filter((r) => r.status === 'failed').map((r) => r.cluster)
		if (failed.length === 0) return
		void runMigration(failed)
	}

	const requestClose = () => {
		if (running) {
			setShowAbortConfirm(true)
			return
		}
		onClose()
	}

	const confirmAbort = () => {
		setAbortRequested(true)
		setShowAbortConfirm(false)
	}

	const successCount = rows.filter((r) => r.status === 'succeeded').length
	const failedCount = rows.filter((r) => r.status === 'failed').length
	const pendingCount = rows.filter((r) => r.status === 'pending' || r.status === 'in-progress').length
	const allDone = rows.length > 0 && pendingCount === 0

	const targetAccent = envAccent(targetEnv)

	return (
		<Modal isOpen={isOpen} onClose={requestClose} size="xl">
			<ModalHeader>
				<div className="flex items-center gap-3">
					<div className={cn('w-10 h-10 rounded-full flex items-center justify-center', targetAccent.pillBg)}>
						<svg className={cn('w-5 h-5', targetAccent.pillText)} fill="none" stroke="currentColor" viewBox="0 0 24 24">
							<path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7h12m0 0l-4-4m4 4l-4 4m0 6H4m0 0l4 4m-4-4l4-4" />
						</svg>
					</div>
					<div>
						<h2 className="text-lg font-semibold text-neutral-100">Migrate clusters to an environment</h2>
						<p className="text-sm text-neutral-400">{team}{teamNamespace ? ` · ${teamNamespace}` : ''}</p>
					</div>
				</div>
			</ModalHeader>

			<ModalBody>
				{rows.length === 0 ? (
					<ConfigureView
						envs={envs}
						allClusters={allClusters}
						loading={loading}
						loadError={loadError}
						sourceMode={sourceMode}
						setSourceMode={setSourceMode}
						sourceEnv={sourceEnv}
						setSourceEnv={setSourceEnv}
						targetEnv={targetEnv}
						setTargetEnv={setTargetEnv}
						selected={selected}
						toggleSelection={toggleSelection}
						previewClusters={previewClusters}
						isRelabel={isRelabel}
					/>
				) : (
					<ProgressView
						rows={rows}
						running={running}
						allDone={allDone}
						successCount={successCount}
						failedCount={failedCount}
						pendingCount={pendingCount}
						abortRequested={abortRequested}
						targetEnv={targetEnv}
					/>
				)}
				{showAbortConfirm && (
					<div className="mt-4 p-3 rounded-md bg-amber-500/10 border border-amber-500/20 text-sm">
						<p className="text-amber-300 mb-2">
							{successCount} complete, {pendingCount} pending. Cancel remaining?
							Completed migrations stay in place.
						</p>
						<div className="flex gap-2">
							<Button variant="danger" onClick={confirmAbort}>Cancel remaining</Button>
							<Button variant="secondary" onClick={() => setShowAbortConfirm(false)}>Keep running</Button>
						</div>
					</div>
				)}
			</ModalBody>

			<ModalFooter>
				{rows.length === 0 ? (
					<>
						<Button variant="secondary" onClick={requestClose} disabled={running}>Cancel</Button>
						<Button onClick={handleSubmit} disabled={!canSubmit}>
							Migrate {previewClusters.length} cluster{previewClusters.length === 1 ? '' : 's'}
						</Button>
					</>
				) : (
					<>
						{allDone && failedCount > 0 && (
							<Button variant="secondary" onClick={retryFailed}>
								Retry {failedCount} failed
							</Button>
						)}
						<Button variant="secondary" onClick={requestClose} disabled={running && !abortRequested}>
							Close
						</Button>
					</>
				)}
			</ModalFooter>
		</Modal>
	)
}

function clusterKey(c: ClusterRef): string {
	return `${c.namespace}/${c.name}`
}

function ConfigureView({
	envs,
	allClusters,
	loading,
	loadError,
	sourceMode,
	setSourceMode,
	sourceEnv,
	setSourceEnv,
	targetEnv,
	setTargetEnv,
	selected,
	toggleSelection,
	previewClusters,
	isRelabel,
}: {
	envs: TeamEnvironment[]
	allClusters: ClusterRef[]
	loading: boolean
	loadError: string | null
	sourceMode: SourceMode
	setSourceMode: (v: SourceMode) => void
	sourceEnv: string
	setSourceEnv: (v: string) => void
	targetEnv: string
	setTargetEnv: (v: string) => void
	selected: Set<string>
	toggleSelection: (c: ClusterRef) => void
	previewClusters: ClusterRef[]
	isRelabel: boolean
}) {
	const sortedEnvs = useMemo(() => [...envs].sort((a, b) => a.name.localeCompare(b.name)), [envs])
	return (
		<div className="space-y-4">
			<section className="space-y-2">
				<h3 className="text-sm font-semibold text-neutral-200">Source</h3>
				<div className="flex gap-2">
					<ChipBtn active={sourceMode === 'unlabeled'} onClick={() => setSourceMode('unlabeled')}>
						Unlabeled only
					</ChipBtn>
					<ChipBtn active={sourceMode === 'from'} onClick={() => setSourceMode('from')}>
						From an environment
					</ChipBtn>
					<ChipBtn active={sourceMode === 'individual'} onClick={() => setSourceMode('individual')}>
						Pick clusters
					</ChipBtn>
				</div>
				{sourceMode === 'from' && (
					<select
						value={sourceEnv}
						onChange={(e) => setSourceEnv(e.target.value)}
						className="w-full px-3 py-2 bg-neutral-900 border border-neutral-700 rounded-lg text-sm text-neutral-100"
					>
						{sortedEnvs.map((env) => (
							<option key={env.name} value={env.name}>{env.name}</option>
						))}
					</select>
				)}
			</section>

			<section className="space-y-2">
				<h3 className="text-sm font-semibold text-neutral-200">Target environment</h3>
				<select
					value={targetEnv}
					onChange={(e) => setTargetEnv(e.target.value)}
					className="w-full px-3 py-2 bg-neutral-900 border border-neutral-700 rounded-lg text-sm text-neutral-100"
				>
					{sortedEnvs.map((env) => (
						<option key={env.name} value={env.name}>{env.name}</option>
					))}
				</select>
			</section>

			{sourceMode === 'individual' && (
				<section className="space-y-2">
					<h3 className="text-sm font-semibold text-neutral-200">Pick clusters</h3>
					{loading ? (
						<p className="text-sm text-neutral-500">Loading clusters...</p>
					) : allClusters.length === 0 ? (
						<p className="text-sm text-neutral-500">No clusters in this team.</p>
					) : (
						<div className="max-h-48 overflow-y-auto border border-neutral-800 rounded-lg">
							{allClusters.map((c) => {
								const accent = c.currentEnv ? envAccent(c.currentEnv) : NEUTRAL_ACCENT
								const key = clusterKey(c)
								return (
									<label key={key} className="flex items-center gap-3 px-3 py-2 hover:bg-neutral-800/50 cursor-pointer">
										<input
											type="checkbox"
											checked={selected.has(key)}
											onChange={() => toggleSelection(c)}
											className="rounded border-neutral-700 bg-neutral-900"
										/>
										<span className={cn('w-2 h-2 rounded-full', accent.dot)} />
										<span className="text-sm text-neutral-200">{c.name}</span>
										<span className="text-xs text-neutral-500">
											{c.currentEnv || '(no environment)'}
										</span>
									</label>
								)
							})}
						</div>
					)}
				</section>
			)}

			<section className="space-y-2">
				<h3 className="text-sm font-semibold text-neutral-200">Preview</h3>
				{loadError ? (
					<p className="text-sm text-red-400">{loadError}</p>
				) : previewClusters.length === 0 ? (
					<p className="text-sm text-neutral-500 italic">No clusters match this selection.</p>
				) : (
					<div className="rounded-lg border border-neutral-800 divide-y divide-neutral-800 max-h-48 overflow-y-auto">
						{previewClusters.map((c) => (
							<div key={clusterKey(c)} className="flex items-center justify-between px-3 py-1.5 text-sm">
								<span className="text-neutral-200">{c.name}</span>
								<span className="text-neutral-500">
									{(c.currentEnv || '(no env)')} → <span className="text-neutral-300">{targetEnv || '?'}</span>
								</span>
							</div>
						))}
					</div>
				)}
				<p className="text-xs text-neutral-500">
					Preview shows intent, not admission result. Actual migration may surface
					per-cluster errors if webhook denials fire (per-member cap, identity
					mismatches).
				</p>
			</section>

			{isRelabel && (
				<div className="p-3 rounded-md bg-amber-500/10 border border-amber-500/20">
					<p className="text-sm text-amber-300">
						This will change the environment of {previewClusters.filter((c) => c.currentEnv !== '' && c.currentEnv !== targetEnv).length} already-labeled
						cluster(s). They will count against the target env quota as soon as
						migration completes.
					</p>
				</div>
			)}
		</div>
	)
}

function ProgressView({
	rows,
	running,
	allDone,
	successCount,
	failedCount,
	pendingCount,
	abortRequested,
	targetEnv,
}: {
	rows: RowState[]
	running: boolean
	allDone: boolean
	successCount: number
	failedCount: number
	pendingCount: number
	abortRequested: boolean
	targetEnv: string
}) {
	return (
		<div className="space-y-3">
			<div className="flex items-center justify-between text-sm">
				<span className="text-neutral-400">
					Target: <span className="text-neutral-200 font-medium">{targetEnv}</span>
				</span>
				<span className="text-neutral-500">
					{successCount} succeeded · {failedCount} failed · {pendingCount} pending
				</span>
			</div>
			<div className="rounded-lg border border-neutral-800 divide-y divide-neutral-800 max-h-72 overflow-y-auto">
				{rows.map((r) => (
					<div key={clusterKey(r.cluster)} className="px-3 py-2 text-sm">
						<div className="flex items-center justify-between">
							<span className="text-neutral-200">{r.cluster.name}</span>
							<StatusPill status={r.status} />
						</div>
						{r.status === 'failed' && r.error && (
							<p className="text-xs text-red-300 mt-1 whitespace-pre-wrap">{r.error}</p>
						)}
					</div>
				))}
			</div>
			{allDone && (
				<p className="text-sm text-neutral-400">
					{failedCount > 0
						? `Migration complete: ${successCount} succeeded, ${failedCount} failed.`
						: `All ${successCount} migrations succeeded.`}
					{abortRequested ? ' (Cancelled before completing all rows.)' : ''}
				</p>
			)}
			{running && !abortRequested && (
				<p className="text-xs text-neutral-500">
					Running. Close attempts during execution will prompt to cancel remaining rows.
				</p>
			)}
		</div>
	)
}

function ChipBtn({ active, onClick, children }: { active: boolean; onClick: () => void; children: React.ReactNode }) {
	return (
		<button
			type="button"
			onClick={onClick}
			aria-pressed={active}
			className={cn(
				'px-3 py-1.5 rounded-full text-xs font-medium border transition-colors',
				active
					? 'bg-blue-500/20 text-blue-300 border-blue-500/40'
					: 'bg-neutral-900 text-neutral-400 border-neutral-800 hover:border-neutral-700',
			)}
		>
			{children}
		</button>
	)
}

function StatusPill({ status }: { status: RowStatus }) {
	const styles: Record<RowStatus, string> = {
		pending: 'bg-neutral-800 text-neutral-400',
		'in-progress': 'bg-blue-500/20 text-blue-300',
		succeeded: 'bg-emerald-500/20 text-emerald-300',
		failed: 'bg-red-500/10 text-red-300',
	}
	const label: Record<RowStatus, string> = {
		pending: 'pending',
		'in-progress': 'running',
		succeeded: 'succeeded',
		failed: 'failed',
	}
	return (
		<span className={cn('px-2 py-0.5 rounded text-xs', styles[status])}>
			{label[status]}
		</span>
	)
}
