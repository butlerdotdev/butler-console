// Copyright 2026 The Butler Authors.
// SPDX-License-Identifier: Apache-2.0

import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useDocumentTitle } from '@/hooks'
import { useToast } from '@/hooks/useToast'
import { policiesApi, type ClusterCreationPolicy, type WebhookError } from '@/api/policies'
import { PolicyForm } from '@/components/policy/PolicyForm'
import { FadeIn } from '@/components/ui'

interface TeamSummary {
	name: string
	environments?: Array<{ name: string }>
}

const PROVIDER_TYPES = ['harvester', 'nutanix', 'proxmox', 'aws', 'azure', 'gcp']

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

export function PolicyCreatePage() {
	useDocumentTitle('New Cluster Creation Policy')
	const navigate = useNavigate()
	const toast = useToast()
	const [teams, setTeams] = useState<TeamSummary[]>([])
	const [webhookError, setWebhookError] = useState<WebhookError | null>(null)

	useEffect(() => {
		void fetchTeamsForForm().then(setTeams)
	}, [])

	async function handleSubmit(policy: ClusterCreationPolicy) {
		setWebhookError(null)
		try {
			const created = await policiesApi.create(policy)
			toast.success('Policy created', `${created.metadata.name} created successfully`)
			navigate(`/admin/policies/${encodeURIComponent(created.metadata.name)}`)
		} catch (err: unknown) {
			const we = extractWebhookError(err)
			if (we) {
				setWebhookError(we)
			} else {
				toast.error('Failed to create policy', err instanceof Error ? err.message : String(err))
			}
		}
	}

	return (
		<FadeIn>
			<div className="space-y-6">
				<div>
					<h1 className="text-2xl font-semibold text-neutral-50">New Cluster Creation Policy</h1>
					<p className="text-sm text-neutral-400 mt-1">Define scope, target providers, and per-option-type rules.</p>
				</div>
				<PolicyForm
					teams={teams}
					providerTypes={PROVIDER_TYPES}
					onSubmit={handleSubmit}
					onCancel={() => navigate('/admin/policies')}
					submitLabel="Create policy"
					webhookError={webhookError}
				/>
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
