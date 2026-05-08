// Copyright 2026 The Butler Authors.
// SPDX-License-Identifier: Apache-2.0

import type { AllocationRange, NetworkPoolSpec } from '@/types/networks'

/**
 * Returns the effective tenant allocation ranges for a NetworkPool.
 * When ranges is populated, it takes precedence over start/end.
 * When only start/end are present, they are returned as a single range.
 * Mirrors butler-api's GetEffectiveRanges Go helper.
 */
export function getEffectiveRanges(
	ta: NetworkPoolSpec['tenantAllocation']
): AllocationRange[] {
	if (!ta) return []
	if (ta.ranges && ta.ranges.length > 0) {
		return ta.ranges
	}
	if (ta.start && ta.end) {
		return [{ start: ta.start, end: ta.end }]
	}
	return []
}
