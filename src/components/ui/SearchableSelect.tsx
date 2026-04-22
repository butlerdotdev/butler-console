/*
 * Copyright 2026 The Butler Authors.
 * SPDX-License-Identifier: Apache-2.0
 */

import { useState, useRef, useEffect, useCallback, useLayoutEffect } from 'react';
import { createPortal } from 'react-dom';
import { cn } from '@/lib/utils';

export interface SearchableSelectOption {
	value: string;
	label: string;
	suffix?: string;
}

interface SearchableSelectProps {
	value: string;
	onChange: (value: string) => void;
	options: SearchableSelectOption[];
	placeholder?: string;
	loading?: boolean;
	loadingText?: string;
	disabled?: boolean;
	className?: string;
	focusRingColor?: string;
}

export function SearchableSelect({
	value,
	onChange,
	options,
	placeholder = 'Select...',
	loading = false,
	loadingText = 'Loading...',
	disabled = false,
	className,
	focusRingColor = 'focus-within:ring-green-500',
}: SearchableSelectProps) {
	const [open, setOpen] = useState(false);
	const [query, setQuery] = useState('');
	const containerRef = useRef<HTMLDivElement>(null);
	const inputRef = useRef<HTMLInputElement>(null);
	const listRef = useRef<HTMLUListElement>(null);
	const dropdownRef = useRef<HTMLDivElement>(null);
	const [highlightIndex, setHighlightIndex] = useState(0);
	const [dropdownStyle, setDropdownStyle] = useState<React.CSSProperties>({});

	const filtered = query
		? options.filter((o) => o.label.toLowerCase().includes(query.toLowerCase()))
		: options;

	const selectedOption = options.find((o) => o.value === value);

	// Calculate dropdown position from trigger rect
	const updatePosition = useCallback(() => {
		if (!containerRef.current) return;
		const rect = containerRef.current.getBoundingClientRect();
		const spaceBelow = window.innerHeight - rect.bottom;
		const dropdownMaxH = 288; // max-h-60 + search input (~48px)
		const flipUp = spaceBelow < dropdownMaxH && rect.top > spaceBelow;

		setDropdownStyle({
			position: 'fixed',
			left: rect.left,
			width: rect.width,
			zIndex: 9999,
			...(flipUp
				? { bottom: window.innerHeight - rect.top + 4 }
				: { top: rect.bottom + 4 }),
		});
	}, []);

	// Reposition on scroll / resize while open
	useEffect(() => {
		if (!open) return;
		updatePosition();
		const handleReposition = () => updatePosition();
		window.addEventListener('scroll', handleReposition, true);
		window.addEventListener('resize', handleReposition);
		return () => {
			window.removeEventListener('scroll', handleReposition, true);
			window.removeEventListener('resize', handleReposition);
		};
	}, [open, updatePosition]);

	// Focus the search input when dropdown opens
	useLayoutEffect(() => {
		if (open) {
			setTimeout(() => inputRef.current?.focus(), 0);
		}
	}, [open]);

	// Close on outside click (handles both trigger and portaled dropdown)
	useEffect(() => {
		const handler = (e: MouseEvent) => {
			const target = e.target as Node;
			const inContainer = containerRef.current?.contains(target);
			const inDropdown = dropdownRef.current?.contains(target);
			if (!inContainer && !inDropdown) {
				setOpen(false);
				setQuery('');
			}
		};
		document.addEventListener('mousedown', handler);
		return () => document.removeEventListener('mousedown', handler);
	}, []);

	// Reset highlight when filter changes
	useEffect(() => {
		setHighlightIndex(0);
	}, [query]);

	// Scroll highlighted item into view
	useEffect(() => {
		if (open && listRef.current) {
			const item = listRef.current.children[highlightIndex] as HTMLElement | undefined;
			item?.scrollIntoView({ block: 'nearest' });
		}
	}, [highlightIndex, open]);

	const handleKeyDown = useCallback(
		(e: React.KeyboardEvent) => {
			if (!open) {
				if (e.key === 'ArrowDown' || e.key === 'Enter' || e.key === ' ') {
					e.preventDefault();
					setOpen(true);
				}
				return;
			}

			switch (e.key) {
				case 'ArrowDown':
					e.preventDefault();
					setHighlightIndex((i) => Math.min(i + 1, filtered.length - 1));
					break;
				case 'ArrowUp':
					e.preventDefault();
					setHighlightIndex((i) => Math.max(i - 1, 0));
					break;
				case 'Enter':
					e.preventDefault();
					if (filtered[highlightIndex]) {
						onChange(filtered[highlightIndex].value);
						setOpen(false);
						setQuery('');
					}
					break;
				case 'Escape':
					e.preventDefault();
					setOpen(false);
					setQuery('');
					break;
			}
		},
		[open, filtered, highlightIndex, onChange]
	);

	const handleSelect = (val: string) => {
		onChange(val);
		setOpen(false);
		setQuery('');
	};

	const displayText = loading
		? loadingText
		: selectedOption
			? selectedOption.label + (selectedOption.suffix ? ` ${selectedOption.suffix}` : '')
			: placeholder;

	return (
		<div ref={containerRef} className={cn('relative', className)} onKeyDown={handleKeyDown}>
			{/* Trigger */}
			<button
				type="button"
				onClick={() => {
					if (disabled || loading) return;
					setOpen(!open);
				}}
				disabled={disabled || loading}
				className={cn(
					'w-full px-3 py-2 bg-neutral-800 border border-neutral-700 rounded-lg text-left',
					'focus:outline-none focus-visible:ring-2',
					focusRingColor,
					'disabled:opacity-50 disabled:cursor-not-allowed',
					open && 'ring-2',
					value ? 'text-neutral-200' : 'text-neutral-500'
				)}
			>
				<span className="block truncate">{displayText}</span>
				<span className="absolute inset-y-0 right-0 flex items-center pr-3 pointer-events-none">
					<svg className="w-4 h-4 text-neutral-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
						<path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
					</svg>
				</span>
			</button>

			{/* Dropdown (portaled to body to avoid overflow clipping in modals) */}
			{open && createPortal(
				<div ref={dropdownRef} style={dropdownStyle} className="bg-neutral-800 border border-neutral-700 rounded-lg shadow-lg overflow-hidden">
					{/* Search input */}
					<div className="p-2 border-b border-neutral-700">
						<input
							ref={inputRef}
							type="text"
							value={query}
							onChange={(e) => setQuery(e.target.value)}
							onKeyDown={handleKeyDown}
							placeholder="Search..."
							className="w-full px-2 py-1.5 bg-neutral-900 border border-neutral-600 rounded text-sm text-neutral-200 placeholder-neutral-500 focus:outline-none focus:ring-1 focus:ring-neutral-500"
						/>
					</div>

					{/* Options list */}
					<ul ref={listRef} className="max-h-60 overflow-auto py-1" role="listbox">
						{filtered.length === 0 ? (
							<li className="px-3 py-2 text-sm text-neutral-500">
								{query ? 'No matches' : 'No options'}
							</li>
						) : (
							filtered.map((option, i) => (
								<li
									key={option.value}
									role="option"
									aria-selected={option.value === value}
									className={cn(
										'px-3 py-2 text-sm cursor-pointer',
										i === highlightIndex && 'bg-neutral-700',
										option.value === value
											? 'text-green-400'
											: 'text-neutral-200 hover:bg-neutral-700/50'
									)}
									onMouseEnter={() => setHighlightIndex(i)}
									onClick={() => handleSelect(option.value)}
								>
									<span>{option.label}</span>
									{option.suffix && (
										<span className="ml-1 text-neutral-500">{option.suffix}</span>
									)}
								</li>
							))
						)}
					</ul>
				</div>,
				document.body
			)}
		</div>
	);
}
