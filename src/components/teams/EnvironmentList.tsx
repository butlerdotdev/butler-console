// Copyright 2026 The Butler Authors.
// SPDX-License-Identifier: Apache-2.0

import { Card, Button } from '@/components/ui'
import type { TeamEnvironment } from '@/types/environments'

interface Props {
	envs: TeamEnvironment[]
	clusterCountsByEnv: Record<string, number>
	canEdit: boolean
	onEdit: (env: TeamEnvironment) => void
	onDelete: (env: TeamEnvironment) => void
}

function formatLimit(v: number | undefined): string {
	return v == null ? 'unlimited' : String(v)
}

export function EnvironmentList({ envs, clusterCountsByEnv, canEdit, onEdit, onDelete }: Props) {
	if (envs.length === 0) {
		return (
			<Card className="p-8 text-center">
				<p className="text-neutral-400">No environments defined yet.</p>
				<p className="text-sm text-neutral-500 mt-2">
					Add one to gate cluster creation with per-environment quotas.
				</p>
			</Card>
		)
	}

	return (
		<Card className="overflow-hidden">
			<div className="grid grid-cols-[1.4fr,1.6fr,140px,140px,120px,140px] gap-4 px-5 py-3 border-b border-neutral-800 text-xs font-semibold uppercase tracking-wider text-neutral-500">
				<div>Name</div>
				<div>Description</div>
				<div>Max clusters</div>
				<div>Max per member</div>
				<div>Clusters</div>
				<div className="text-right">Actions</div>
			</div>
			<div className="divide-y divide-neutral-800">
				{envs.map((env) => {
					const count = clusterCountsByEnv[env.name] ?? 0
					const accessCount =
						(env.access?.users?.length ?? 0) + (env.access?.groups?.length ?? 0)
					const defaultsCount = env.clusterDefaults
						? Object.values(env.clusterDefaults).filter((v) => v != null && v !== '').length
						: 0
					return (
						<div
							key={env.name}
							className="grid grid-cols-[1.4fr,1.6fr,140px,140px,120px,140px] gap-4 px-5 py-4 items-start"
						>
							<div>
								<p className="font-mono text-neutral-100">{env.name}</p>
								{(accessCount > 0 || defaultsCount > 0) && (
									<p className="text-xs text-neutral-500 mt-1">
										{defaultsCount > 0 && <>defaults: {defaultsCount} </>}
										{accessCount > 0 && <>· access: {accessCount}</>}
									</p>
								)}
							</div>
							<div className="text-sm text-neutral-300">
								{env.description?.trim() ? (
									env.description
								) : (
									<span className="italic text-neutral-500">—</span>
								)}
							</div>
							<div className="text-sm text-neutral-300">
								{formatLimit(env.limits?.maxClusters)}
							</div>
							<div className="text-sm text-neutral-300">
								{formatLimit(env.limits?.maxClustersPerMember)}
							</div>
							<div className="text-sm text-neutral-300">
								{count} cluster{count === 1 ? '' : 's'}
							</div>
							<div className="flex items-center justify-end gap-2">
								<Button
									variant="secondary"
									size="sm"
									onClick={() => onEdit(env)}
									disabled={!canEdit}
								>
									Edit
								</Button>
								<Button
									variant="danger"
									size="sm"
									onClick={() => onDelete(env)}
									disabled={!canEdit}
								>
									Delete
								</Button>
							</div>
						</div>
					)
				})}
			</div>
		</Card>
	)
}
