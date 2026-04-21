// Copyright 2026 The Butler Authors.
// SPDX-License-Identifier: Apache-2.0

import { useEffect, useState, type FormEvent } from 'react'
import { Modal, ModalHeader, ModalBody, ModalFooter } from '@/components/ui/Modal'
import { Button, Input } from '@/components/ui'
import { environmentsApi } from '@/api/environments'
import type {
	EnvironmentRequest,
	TeamEnvironment,
} from '@/types/environments'
import {
	ENVIRONMENT_NAME_MAX_LENGTH,
	ENVIRONMENT_NAME_PATTERN,
} from '@/types/environments'
import { extractWebhookDenial } from '@/lib/webhookError'
import { useToast } from '@/hooks/useToast'

// Used to distinguish "create a new env" from "edit an existing env" on
// the same form component. In edit mode the name field is read-only
// and carries a tooltip pointing operators at delete + recreate; this
// mirrors the CRD listMapKey semantics and the server's UpdateEnvironment
// handler that rejects name mismatches with a 400.
interface Props {
	isOpen: boolean
	team: string
	mode: 'create' | 'edit'
	initial?: TeamEnvironment
	onClose: () => void
	onSaved: () => void
}

type LimitInput = string

function parseLimit(v: LimitInput): { ok: boolean; value?: number } {
	const trimmed = v.trim()
	if (trimmed === '') return { ok: true, value: undefined }
	if (!/^\d+$/.test(trimmed)) return { ok: false }
	const n = parseInt(trimmed, 10)
	if (!Number.isFinite(n) || n < 0) return { ok: false }
	return { ok: true, value: n }
}

export function EnvironmentFormModal({ isOpen, team, mode, initial, onClose, onSaved }: Props) {
	const { success, error: showError } = useToast()
	const [name, setName] = useState('')
	const [maxClusters, setMaxClusters] = useState<LimitInput>('')
	const [maxPerMember, setMaxPerMember] = useState<LimitInput>('')
	const [nameError, setNameError] = useState<string | null>(null)
	const [submitError, setSubmitError] = useState<string | null>(null)
	const [saving, setSaving] = useState(false)

	useEffect(() => {
		if (!isOpen) return
		setName(initial?.name ?? '')
		setMaxClusters(initial?.limits?.maxClusters != null ? String(initial.limits.maxClusters) : '')
		setMaxPerMember(
			initial?.limits?.maxClustersPerMember != null
				? String(initial.limits.maxClustersPerMember)
				: '',
		)
		setNameError(null)
		setSubmitError(null)
		setSaving(false)
	}, [isOpen, initial])

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

		const req: EnvironmentRequest = { name }
		if (limMax.value != null || limPer.value != null) {
			req.limits = {}
			if (limMax.value != null) req.limits.maxClusters = limMax.value
			if (limPer.value != null) req.limits.maxClustersPerMember = limPer.value
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
		<Modal isOpen={isOpen} onClose={saving ? () => {} : onClose} size="md">
			<ModalHeader>
				<h2 className="text-lg font-semibold text-neutral-100">
					{isEdit ? 'Edit Environment' : 'Create Environment'}
				</h2>
				<p className="text-sm text-neutral-400 mt-1">
					{isEdit
						? 'Update per-environment quota limits.'
						: 'Define a new environment within this team.'}
				</p>
			</ModalHeader>
			<form onSubmit={handleSubmit}>
				<ModalBody>
					<div className="space-y-5">
						<div>
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
								<p className="text-xs text-neutral-500 mt-1">
									Environment names cannot be changed after creation. Delete and recreate if needed.
								</p>
							)}
						</div>

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
							Leave a limit blank to leave that dimension uncapped within the team's
							total quota ceiling.
						</p>

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
