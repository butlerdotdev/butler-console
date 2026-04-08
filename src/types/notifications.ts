// Copyright 2026 The Butler Authors.
// SPDX-License-Identifier: Apache-2.0

export type NotificationSeverity = 'success' | 'warning' | 'error' | 'info'
export type NotificationCategory = 'cluster' | 'team' | 'infra' | 'security'

export interface ResourceRef {
	kind: string
	name: string
	namespace?: string
	team?: string
}

export interface Notification {
	id: string
	title: string
	message: string
	severity: NotificationSeverity
	category: NotificationCategory
	timestamp: string
	resourceRef?: ResourceRef
	read: boolean
}
