// Copyright 2026 The Butler Authors.
// SPDX-License-Identifier: Apache-2.0

// ----------------------------------------------------------------------------
// Kubernetes Common Types
// ----------------------------------------------------------------------------

export interface ObjectMeta {
	name: string
	namespace: string
	uid?: string
	creationTimestamp?: string
	labels?: Record<string, string>
	annotations?: Record<string, string>
}

export interface Condition {
	type: string
	status: string
	reason?: string
	message?: string
	lastTransitionTime?: string
}

// ----------------------------------------------------------------------------
// Auth Types
// ----------------------------------------------------------------------------

export interface LoginCredentials {
	username?: string
	email?: string
	password: string
}

export interface AuthState {
	user: User | null
	isAuthenticated: boolean
	isLoading: boolean
}

// ----------------------------------------------------------------------------
// User Types
// ----------------------------------------------------------------------------

export interface UserTeam {
	name: string
	displayName?: string
	namespace?: string
	role: 'admin' | 'operator' | 'viewer' | 'member'
	// K8s-style nested structure (alternative shape from API)
	metadata?: {
		name: string
		role?: string
	}
	spec?: {
		displayName?: string
	}
	status?: {
		namespace?: string
	}
}

export interface User {
	// Identity
	id?: string
	username?: string
	email?: string
	name?: string
	displayName?: string
	picture?: string

	// Platform-level admin flags
	// Backend sets these based on User CRD or conventions
	role?: 'admin' | 'user' | string
	isAdmin?: boolean
	isPlatformAdmin?: boolean

	// Team memberships
	teams?: UserTeam[]

	// SSO metadata
	provider?: 'oidc' | 'internal'
	sub?: string // OIDC subject
}

// ----------------------------------------------------------------------------
// TenantCluster CRD
// ----------------------------------------------------------------------------

export type ClusterPhase =
	| 'Pending'
	| 'Provisioning'
	| 'Ready'
	| 'Updating'
	| 'Deleting'
	| 'Failed'
	| 'Unknown'

export interface TenantClusterSpec {
	kubernetesVersion?: string
	teamRef?: {
		name: string
	}
	providerConfigRef?: {
		name: string
		namespace?: string
	}
	workers?: {
		replicas?: number
		machineTemplate?: {
			cpu?: number
			memory?: string
			diskSize?: string
		}
	}
	networking?: {
		loadBalancerPool?: {
			start?: string
			end?: string
		}
	}
}

export interface TenantClusterStatus {
	phase?: ClusterPhase
	tenantNamespace?: string
	controlPlaneReady?: boolean
	workersReady?: number
	workersTotal?: number
	conditions?: Condition[]
}

export interface TenantCluster {
	apiVersion?: string
	kind?: string
	metadata: ObjectMeta
	spec: TenantClusterSpec
	status?: TenantClusterStatus
}

// ----------------------------------------------------------------------------
// ProviderConfig CRD
// ----------------------------------------------------------------------------

export interface ProviderConfig {
	apiVersion?: string
	kind?: string
	metadata: ObjectMeta
	spec: {
		type: string
		credentialsRef?: {
			name: string
			namespace?: string
		}
	}
	status?: {
		ready?: boolean
		message?: string
	}
}

// ----------------------------------------------------------------------------
// Node Info (from tenant cluster)
// ----------------------------------------------------------------------------

export interface NodeInfo {
	name: string
	status: string
	roles: string[]
	version: string
	internalIP: string
	os: string
	containerRuntime: string
	cpu: string
	memory: string
	age: string
}

// ----------------------------------------------------------------------------
// Addon Status
// ----------------------------------------------------------------------------

export interface AddonStatus {
	name: string
	status: 'Installed' | 'Installing' | 'NotInstalled' | 'Failed'
	message?: string
}

// ----------------------------------------------------------------------------
// Kubernetes Events
// ----------------------------------------------------------------------------

export interface ClusterEvent {
	type: string
	reason: string
	message: string
	source: string
	firstTimestamp: string
	lastTimestamp: string
	count: number
}

// ----------------------------------------------------------------------------
// API Response Types
// ----------------------------------------------------------------------------

export interface ClusterListResponse {
	clusters: TenantCluster[]
}

export interface ProviderListResponse {
	providers: ProviderConfig[]
}

export interface NodesResponse {
	nodes: NodeInfo[]
}

export interface AddonsResponse {
	addons: AddonStatus[]
}

export interface EventsResponse {
	events: ClusterEvent[]
}

// ----------------------------------------------------------------------------
// API Error
// ----------------------------------------------------------------------------

export interface ApiError {
	message: string
	code?: string
	status?: number
}

// ----------------------------------------------------------------------------
// GitOps Types
// ----------------------------------------------------------------------------

export * from './gitops'
