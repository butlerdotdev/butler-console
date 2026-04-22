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

export interface EnvironmentAccessUser {
	name: string
	role: 'admin' | 'operator' | 'viewer'
}

export interface EnvironmentAccessGroup {
	name: string
	role: 'admin' | 'operator' | 'viewer'
	identityProvider?: string
}

// Env-level RBAC elevation per ADR-009 additive-only inheritance.
// These roles can elevate a team member within this env; they cannot
// reduce a team-level role. Webhook enforces at admission.
export interface EnvironmentAccess {
	users?: EnvironmentAccessUser[]
	groups?: EnvironmentAccessGroup[]
}

// ClusterDefaults mirrors Team.spec.clusterDefaults shape. Per-env
// defaults override team-level defaults when a TC is created in the
// env without the field set explicitly.
export interface EnvironmentClusterDefaults {
	kubernetesVersion?: string
	workerCount?: number
	workerCPU?: number
	workerMemoryGi?: number
	workerDiskGi?: number
}

export interface TeamEnvironment {
	name: string
	description?: string
	limits?: EnvironmentLimits
	access?: EnvironmentAccess
	clusterDefaults?: EnvironmentClusterDefaults
}

// EnvironmentRequest is the body for POST/PUT on
// /api/teams/{name}/environments. Name is immutable after create
// (server UpdateEnvironment handler rejects name mismatches).
export interface EnvironmentRequest {
	name: string
	description?: string
	limits?: EnvironmentLimits
	access?: EnvironmentAccess
	clusterDefaults?: EnvironmentClusterDefaults
}

// Env-name character class matches the CRD validation pattern applied
// to EnvironmentSpec.Name, which enforces Kubernetes label-value
// semantics: `^[A-Za-z0-9]([-A-Za-z0-9_.]*[A-Za-z0-9])?$`
export const ENVIRONMENT_NAME_PATTERN = /^[A-Za-z0-9]([-A-Za-z0-9_.]*[A-Za-z0-9])?$/
export const ENVIRONMENT_NAME_MAX_LENGTH = 63

// Label key stamped on TenantClusters that belong to a team environment.
// Constant mirrored from butler-api common_types.go LabelEnvironment.
export const ENVIRONMENT_LABEL = 'butler.butlerlabs.dev/environment'
