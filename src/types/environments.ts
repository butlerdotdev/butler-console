// Copyright 2026 The Butler Authors.
// SPDX-License-Identifier: Apache-2.0

// TeamEnvironment mirrors the shape butler-server returns and accepts
// for Team.spec.environments[] entries. See ADR-009 for the CRD schema;
// pointer fields on the server become optional TS numbers here because
// JSON renders an absent pointer as a missing key, not null.
export interface EnvironmentLimits {
	maxClusters?: number
	maxClustersPerMember?: number
}

export interface TeamEnvironment {
	name: string
	limits?: EnvironmentLimits
}

// EnvironmentRequest is the body for POST/PUT on
// /api/teams/{name}/environments. The server keys the URL on the env
// name on update; the body's Name field is validated for equality and
// is immutable after create (see UpdateEnvironment handler).
export interface EnvironmentRequest {
	name: string
	limits?: EnvironmentLimits
}

// Env-name character class matches the CRD validation pattern applied
// to EnvironmentSpec.Name, which enforces Kubernetes label-value
// semantics: `^[A-Za-z0-9]([-A-Za-z0-9_.]*[A-Za-z0-9])?$`
export const ENVIRONMENT_NAME_PATTERN = /^[A-Za-z0-9]([-A-Za-z0-9_.]*[A-Za-z0-9])?$/
export const ENVIRONMENT_NAME_MAX_LENGTH = 63

// Label key stamped on TenantClusters that belong to a team environment.
// Constant mirrored from butler-api common_types.go LabelEnvironment.
export const ENVIRONMENT_LABEL = 'butler.butlerlabs.dev/environment'
