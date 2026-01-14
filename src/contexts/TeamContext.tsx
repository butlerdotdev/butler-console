// Copyright 2026 The Butler Authors.
// SPDX-License-Identifier: Apache-2.0

import { createContext } from 'react'

export type ContextMode = 'team' | 'admin' | 'overview'

export interface TeamInfo {
	name: string
	displayName?: string
	namespace?: string  // The namespace where team's resources live
	role?: string
}

export interface TeamContextValue {
	/** Current mode: viewing a specific team, admin view, or overview */
	mode: ContextMode

	/** Current team name (null in admin/overview mode) */
	currentTeam: string | null

	/** Current team's display name */
	currentTeamDisplayName: string | null

	/** Current team's namespace (where clusters are created) */
	currentTeamNamespace: string | null

	/** Whether user is currently in admin mode */
	isAdminMode: boolean

	/** Whether user has platform admin privileges (can access admin mode) */
	canAccessAdmin: boolean

	/** Whether user is an admin of the current team (team-level admin, not platform admin) */
	isTeamAdmin: boolean

	/** Navigate to a specific team */
	switchToTeam: (teamName: string) => void

	/** Navigate to admin mode */
	switchToAdmin: () => void

	/** Navigate to overview (multi-team home) */
	switchToOverview: () => void

	/** Get the base path for current context (for building URLs) */
	basePath: string

	/** Build a path within current context */
	buildPath: (subPath: string) => string
}

export const TeamContext = createContext<TeamContextValue | null>(null)
