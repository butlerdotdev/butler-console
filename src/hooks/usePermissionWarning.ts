// Copyright 2026 The Butler Authors.
// SPDX-License-Identifier: Apache-2.0

import { useCallback } from 'react'
import { useAuth } from './useAuth'
import { useToast } from './useToast'

/**
 * Hook for showing a warning toast when the current user's permissions change.
 * 
 * When a user modifies their own team membership (or an admin modifies it for them),
 * the changes won't take effect until they refresh their permissions or re-login.
 * 
 * Usage:
 * ```tsx
 * const { checkAndWarn } = usePermissionWarning()
 * 
 * // After a successful role change
 * await api.updateRole(email, newRole)
 * checkAndWarn(email)  // Shows warning if email matches current user
 * ```
 */
export function usePermissionWarning() {
	const { user } = useAuth()
	const toast = useToast()

	const checkAndWarn = useCallback((affectedEmail: string) => {
		// Check if the current user's permissions were affected
		if (user?.email?.toLowerCase() === affectedEmail.toLowerCase()) {
			toast.warning(
				'Your Permissions Changed',
				'Use "Refresh Permissions" in the user menu to apply changes.'
			)
		}
	}, [user?.email, toast])

	return { checkAndWarn }
}
