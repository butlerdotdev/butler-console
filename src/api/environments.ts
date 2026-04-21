// Copyright 2026 The Butler Authors.
// SPDX-License-Identifier: Apache-2.0

import { apiClient } from './client'
import type { EnvironmentRequest, TeamEnvironment } from '@/types/environments'

// environmentsApi wraps the butler-server env CRUD endpoints that mutate
// Team.spec.environments[] via impersonated writes. All three mutations
// pass through the Team admission webhook (ADR-009), which may return a
// structured 403 webhook-denied response; callers should surface those
// via the webhookError helper so the denial renders inline on edit
// forms instead of as a generic toast.
export const environmentsApi = {
	// POST /api/teams/{name}/environments
	create: (team: string, req: EnvironmentRequest) =>
		apiClient.post<TeamEnvironment>(
			`/teams/${encodeURIComponent(team)}/environments`,
			req,
		),

	// PUT /api/teams/{name}/environments/{env}
	// Name is immutable at the server (rename = delete + recreate);
	// the modal form blocks edits of the name field.
	update: (team: string, name: string, req: EnvironmentRequest) =>
		apiClient.put<TeamEnvironment>(
			`/teams/${encodeURIComponent(team)}/environments/${encodeURIComponent(name)}`,
			req,
		),

	// DELETE /api/teams/{name}/environments/{env}
	delete: (team: string, name: string) =>
		apiClient.delete<{ status: string }>(
			`/teams/${encodeURIComponent(team)}/environments/${encodeURIComponent(name)}`,
		),
}
