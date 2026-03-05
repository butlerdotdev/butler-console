// Copyright 2026 The Butler Authors.
// SPDX-License-Identifier: Apache-2.0

import type { ObjectMeta, Condition } from './index'

// ----------------------------------------------------------------------------
// ImageSync CRD
// ----------------------------------------------------------------------------

export interface ImageFactoryRef {
	schematicID: string
	version: string
	arch?: string
	platform?: string
}

export interface ImageSyncSpec {
	factoryRef: ImageFactoryRef
	providerConfigRef: {
		name: string
		namespace?: string
	}
	format?: string
	transferMode?: string
	displayName?: string
}

export interface ImageSyncStatus {
	phase?: ImageSyncPhase
	providerImageRef?: string
	providerTaskID?: string
	artifactURL?: string
	artifactSHA256?: string
	failureReason?: string
	failureMessage?: string
	observedGeneration?: number
	lastUpdated?: string
	conditions?: Condition[]
}

export type ImageSyncPhase =
	| 'Pending'
	| 'Building'
	| 'Downloading'
	| 'Uploading'
	| 'Ready'
	| 'Failed'

export interface ImageSync {
	apiVersion?: string
	kind?: string
	metadata: ObjectMeta
	spec: ImageSyncSpec
	status?: ImageSyncStatus
}

export interface ImageSyncListResponse {
	imageSyncs: ImageSync[]
}

// ----------------------------------------------------------------------------
// Create Request
// ----------------------------------------------------------------------------

export interface CreateImageSyncRequest {
	schematicID: string
	version: string
	arch?: string
	platform?: string
	providerConfig: string // "namespace/name" format
	format?: string
	transferMode?: string
	displayName?: string
}

// ----------------------------------------------------------------------------
// Factory Catalog
// ----------------------------------------------------------------------------

export interface FactoryCatalogEntry {
	os: string
	versions: string[]
	formats: string[]
}

export interface FactoryCatalogResponse {
	entries: FactoryCatalogEntry[]
}
