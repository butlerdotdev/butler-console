// Copyright 2026 The Butler Authors.
// SPDX-License-Identifier: Apache-2.0

// Matrix of denial shapes. The repo does not currently wire Vitest or
// Jest; these cases are expressed as a plain exported matrix so a test
// runner added later can pick them up without restructuring. The
// matrix intentionally mirrors on-wire bodies butler-server emits via
// writeWebhookError (ADR-010 passthrough) plus common non-matches so
// regressions would fail immediately.

import { ApiError } from '@/api/client'
import { isWebhookDenied, extractWebhookDenial } from './webhookError'

interface Case {
	name: string
	err: unknown
	expectIsDenied: boolean
	expectField?: string
	expectMessageIncludes?: string
}

export const webhookErrorCases: Case[] = [
	{
		name: 'canonical butler-server webhook denial with field',
		err: new ApiError('webhook denied', 403, {
			error: 'webhook denied',
			reason: 'webhook-denied',
			message:
				'admission webhook "vteam.butler.butlerlabs.dev" denied the request: spec.resourceLimits can only be modified by platform admins',
			field: 'spec.resourceLimits',
		}),
		expectIsDenied: true,
		expectField: 'spec.resourceLimits',
		expectMessageIncludes: 'platform admins',
	},
	{
		name: 'webhook denial with empty field',
		err: new ApiError('webhook denied', 403, {
			error: 'webhook denied',
			reason: 'webhook-denied',
			message: 'admission webhook "vtenantcluster" denied the request: env quota exceeded',
			field: '',
		}),
		expectIsDenied: true,
		expectField: '',
		expectMessageIncludes: 'env quota exceeded',
	},
	{
		name: 'per-member cap rejection (step-6 integration shape)',
		err: new ApiError('webhook denied', 403, {
			error: 'webhook denied',
			reason: 'webhook-denied',
			message:
				'user "founder@butlerlabs.dev" already owns 1 cluster(s) in environment "dev"; env limits to 1 per member',
			field: 'metadata.labels[butler.butlerlabs.dev/environment]',
		}),
		expectIsDenied: true,
		expectField: 'metadata.labels[butler.butlerlabs.dev/environment]',
		expectMessageIncludes: 'per member',
	},
	{
		name: '403 without reason field is not recognized',
		err: new ApiError('Forbidden', 403, {
			error: 'Forbidden',
			message: 'some unrelated 403',
		}),
		expectIsDenied: false,
	},
	{
		name: '403 with wrong reason is not recognized',
		err: new ApiError('Forbidden', 403, {
			error: 'Forbidden',
			reason: 'not-webhook',
			message: 'foo',
		}),
		expectIsDenied: false,
	},
	{
		name: 'non-ApiError is not recognized',
		err: new Error('plain'),
		expectIsDenied: false,
	},
	{
		name: 'ApiError with non-403 status is not recognized',
		err: new ApiError('webhook denied', 500, {
			reason: 'webhook-denied',
			message: 'server error',
		}),
		expectIsDenied: false,
	},
]

// Simple runner-agnostic entry point. Invoke validateWebhookErrorCases()
// from any test framework (`it('matrix', validateWebhookErrorCases)`)
// or from an ad hoc script. Throws on first mismatch with a concrete
// case name.
export function validateWebhookErrorCases(): void {
	for (const c of webhookErrorCases) {
		const got = isWebhookDenied(c.err)
		if (got !== c.expectIsDenied) {
			throw new Error(
				`isWebhookDenied mismatch for ${c.name}: got ${got}, want ${c.expectIsDenied}`,
			)
		}
		if (!c.expectIsDenied) continue
		const denial = extractWebhookDenial(c.err)
		if (!denial) {
			throw new Error(`extractWebhookDenial returned null for ${c.name}`)
		}
		if (c.expectField != null && denial.field !== c.expectField) {
			throw new Error(
				`field mismatch for ${c.name}: got ${denial.field}, want ${c.expectField}`,
			)
		}
		if (
			c.expectMessageIncludes &&
			!denial.message.toLowerCase().includes(c.expectMessageIncludes.toLowerCase())
		) {
			throw new Error(
				`message mismatch for ${c.name}: got ${denial.message}, want substring ${c.expectMessageIncludes}`,
			)
		}
	}
}
