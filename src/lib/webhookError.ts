// Copyright 2026 The Butler Authors.
// SPDX-License-Identifier: Apache-2.0

import { ApiError } from '@/api/client'

// The butler-server writeWebhookError helper emits this exact body
// shape on Kubernetes admission-webhook denials. See ADR-010 "Error
// passthrough" and butler-server/internal/api/handlers/helpers.go:
//
//   {"error":"webhook denied","reason":"webhook-denied",
//    "message":"admission webhook ... denied the request: ...",
//    "field":"spec.resourceLimits"}
//
// The field is a best-effort extraction from the apiserver Status
// Details.Causes; it can be an empty string.
const WEBHOOK_DENIED_REASON = 'webhook-denied'

export interface WebhookDenial {
	message: string
	field: string
}

function hasStringField(body: Record<string, unknown>, key: string): string | null {
	const v = body[key]
	return typeof v === 'string' ? v : null
}

/**
 * isWebhookDenied returns true when the error is a butler-server
 * structured 403 surfaced from a Kubernetes admission webhook denial.
 */
export function isWebhookDenied(err: unknown): boolean {
	if (!(err instanceof ApiError)) return false
	if (err.status !== 403) return false
	if (!err.body) return false
	return hasStringField(err.body, 'reason') === WEBHOOK_DENIED_REASON
}

/**
 * extractWebhookDenial returns the operator-legible message and field
 * path from a butler-server webhook-denied 403, or null when the error
 * is not a webhook denial. The `field` component may be empty when the
 * apiserver Status did not surface a field path; callers should treat
 * an empty field as "no specific field" and render near the submit
 * control instead of next to a particular input.
 */
export function extractWebhookDenial(err: unknown): WebhookDenial | null {
	if (!isWebhookDenied(err)) return null
	const body = (err as ApiError).body!
	const message = hasStringField(body, 'message') ?? ''
	const field = hasStringField(body, 'field') ?? ''
	return { message, field }
}
