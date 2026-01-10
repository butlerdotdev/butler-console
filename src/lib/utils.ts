// Copyright 2025 The Butler Authors.
// SPDX-License-Identifier: Apache-2.0

export function cn(...classes: (string | boolean | undefined | null)[]): string {
	return classes.filter(Boolean).join(' ')
}
