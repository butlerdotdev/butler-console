// Copyright 2026 The Butler Authors.
// SPDX-License-Identifier: Apache-2.0

import { useEffect, useMemo, useCallback, useState, type ReactNode } from 'react'
import { useSearchParams } from 'react-router-dom'
import { apiClient } from '@/api/client'
import { useTeamContext } from '@/hooks/useTeamContext'
import type { TeamEnvironment } from '@/types/environments'
import { EnvContext, type EnvContextValue } from './EnvContext'

// Minimal shape returned by GET /api/teams/{name}. The server's
// TeamResponse does not currently surface spec.environments[]; we read
// raw spec when present and fall back to an empty list otherwise.
// Once butler-server adds environments to the response contract, the
// `environments` field is preferred.
interface RawTeamResponse {
	environments?: TeamEnvironment[]
	spec?: {
		environments?: TeamEnvironment[]
	}
}

function extractEnvs(raw: RawTeamResponse | null | undefined): TeamEnvironment[] {
	if (!raw) return []
	if (Array.isArray(raw.environments)) return raw.environments
	if (Array.isArray(raw.spec?.environments)) return raw.spec!.environments!
	return []
}

function sortEnvsByName(envs: TeamEnvironment[]): TeamEnvironment[] {
	return [...envs].sort((a, b) => a.name.localeCompare(b.name))
}

interface EnvProviderProps {
	children: ReactNode
}

export function EnvProvider({ children }: EnvProviderProps) {
	const { currentTeam, isTeamAdmin, canAccessAdmin } = useTeamContext()
	const [searchParams, setSearchParams] = useSearchParams()
	const [availableEnvs, setAvailableEnvs] = useState<TeamEnvironment[]>([])
	const [envsLoading, setEnvsLoading] = useState(false)

	// URL is the source of truth for env selection. Empty / missing param
	// means "All environments".
	const rawEnv = searchParams.get('env')
	const currentEnv = rawEnv && rawEnv.length > 0 ? rawEnv : null

	// Push env into the shared apiClient so outgoing requests carry
	// X-Butler-Environment. Clear on team switch or when env removed.
	useEffect(() => {
		apiClient.setEnvironment(currentEnv)
	}, [currentEnv])

	// Load environments from the current team's spec. We fetch via raw
	// fetch to avoid coupling the EnvProvider to the full team response
	// shape; the endpoint is the same one TeamSettingsPage calls.
	const fetchEnvs = useCallback(async () => {
		if (!currentTeam) {
			setAvailableEnvs([])
			return
		}
		setEnvsLoading(true)
		try {
			const res = await fetch(`/api/teams/${encodeURIComponent(currentTeam)}`, {
				credentials: 'include',
			})
			if (!res.ok) {
				setAvailableEnvs([])
				return
			}
			const data: RawTeamResponse = await res.json()
			setAvailableEnvs(sortEnvsByName(extractEnvs(data)))
		} catch {
			setAvailableEnvs([])
		} finally {
			setEnvsLoading(false)
		}
	}, [currentTeam])

	useEffect(() => {
		void fetchEnvs()
	}, [fetchEnvs])

	// If the selected env disappears from the team (removed, team
	// switched), drop it so the URL and apiClient do not carry a stale
	// selection. Deliberately does NOT clear when envs are still
	// loading; we only react after a successful load.
	useEffect(() => {
		if (envsLoading || !currentEnv) return
		const exists = availableEnvs.some((e) => e.name === currentEnv)
		if (!exists) {
			const next = new URLSearchParams(searchParams)
			next.delete('env')
			setSearchParams(next, { replace: true })
		}
	}, [availableEnvs, currentEnv, envsLoading, searchParams, setSearchParams])

	const setCurrentEnv = useCallback(
		(env: string | null) => {
			const next = new URLSearchParams(searchParams)
			if (env && env.length > 0) {
				next.set('env', env)
			} else {
				next.delete('env')
			}
			setSearchParams(next)
		},
		[searchParams, setSearchParams],
	)

	// Conservative env-admin approximation: team-admin OR platform-admin
	// is always treated as env-admin. This intentionally ignores ADR-009
	// additive-only inheritance where a team operator can be elevated to
	// env-admin via env.access. The server's Team admission webhook is
	// authoritative; this flag is a client-side guidance gate only.
	// TODO: once butler-server exposes a per-env effective role via
	// /api/auth/me or a dedicated endpoint, derive isEnvAdmin from it.
	const isEnvAdmin = useMemo(() => {
		return Boolean(isTeamAdmin || canAccessAdmin)
	}, [isTeamAdmin, canAccessAdmin])

	const value = useMemo<EnvContextValue>(
		() => ({
			currentEnv,
			availableEnvs,
			envsLoading,
			isEnvAdmin,
			setCurrentEnv,
			refreshEnvs: fetchEnvs,
		}),
		[currentEnv, availableEnvs, envsLoading, isEnvAdmin, setCurrentEnv, fetchEnvs],
	)

	return <EnvContext.Provider value={value}>{children}</EnvContext.Provider>
}
