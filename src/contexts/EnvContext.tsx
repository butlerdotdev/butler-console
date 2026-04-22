// Copyright 2026 The Butler Authors.
// SPDX-License-Identifier: Apache-2.0

import { createContext } from 'react'
import type { TeamEnvironment } from '@/types/environments'

export interface EnvContextValue {
	/** Current environment name, or null when "All environments" is active. */
	currentEnv: string | null

	/**
	 * Environments available on the current team. Empty when no team is
	 * selected or the team has no environments defined.
	 */
	availableEnvs: TeamEnvironment[]

	/** True while the provider is fetching the current team's envs. */
	envsLoading: boolean

	/**
	 * Whether the caller has env-admin-equivalent privileges on the
	 * current env. Conservative approximation: team-admin OR
	 * platform-admin. See EnvProvider for the documented gap regarding
	 * ADR-009 additive inheritance.
	 */
	isEnvAdmin: boolean

	/**
	 * Set the current env. Updates the ?env= query param on the current
	 * URL, preserving other params. Pass null to clear the env (returns
	 * to the "All environments" state).
	 */
	setCurrentEnv: (env: string | null) => void

	/** Re-fetch the current team's environments list. */
	refreshEnvs: () => Promise<void>
}

export const EnvContext = createContext<EnvContextValue | null>(null)
