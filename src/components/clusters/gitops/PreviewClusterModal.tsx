/*
 * Copyright 2026 The Butler Authors.
 * SPDX-License-Identifier: Apache-2.0
 */

import { useState, useEffect, useMemo, useCallback, useRef } from 'react';
import { Button, Spinner, SearchableSelect } from '@/components/ui';
import { Modal, ModalHeader, ModalBody, ModalFooter } from '@/components/ui/Modal';
import { useToast } from '@/hooks/useToast';
import { gitopsApi } from '@/api/gitops';
import type {
	Repository,
	Branch,
	PreviewClusterResponse,
	CapturedItem,
	CapturedItemSource,
	CapturedItemIdentity,
} from '@/types/gitops';

/**
 * PreviewClusterModal — the v2 cluster-wide export preview.
 *
 * Three sections:
 *   1. Summary: file count, captured-by-source breakdown
 *      (with native-inventory called out as the agnostic-discovery
 *      surface), loud flags for collisions and discovery failures.
 *   2. Captured by source: three expandable buckets (known addons,
 *      helm unmatched, discovered natives). Per-item selection so the
 *      operator can export a subset.
 *   3. File tree: directory-organized view of what will commit, with
 *      content inspection via <details>.
 *
 * Preview-first: the modal renders the preview from the moment it
 * opens. The Export button commits the (possibly filtered-by-selection)
 * tree via the export-cluster endpoint.
 */

interface PreviewClusterModalProps {
	/** Empty for management cluster; populated for tenant. */
	clusterNamespace?: string;
	/** Cluster name shown in the header. Use "management" for mgmt. */
	clusterName: string;
	/** Whether this targets the management cluster (selects the API method). */
	isManagement?: boolean;
	/** Default apps overlay env (defaults to "prd"). */
	defaultEnv?: string;
	repositories: Repository[];
	loadingRepos?: boolean;
	/** owner/repo to auto-select if available. */
	configuredRepository?: string;
	onClose: () => void;
	onSuccess: (result: { prUrl?: string; commitSha?: string }) => void;
}

export function PreviewClusterModal({
	clusterNamespace,
	clusterName,
	isManagement = false,
	defaultEnv = 'prd',
	repositories,
	loadingRepos,
	configuredRepository,
	onClose,
	onSuccess,
}: PreviewClusterModalProps) {
	const { error: showError } = useToast();

	const [env, setEnv] = useState(defaultEnv);
	const [repository, setRepository] = useState(configuredRepository || '');
	const [branch, setBranch] = useState('main');
	const [createPR, setCreatePR] = useState(true);

	const [branches, setBranches] = useState<Branch[]>([]);
	const [loadingBranches, setLoadingBranches] = useState(false);

	const [preview, setPreview] = useState<PreviewClusterResponse | null>(null);
	const [loadingPreview, setLoadingPreview] = useState(false);
	const [previewError, setPreviewError] = useState<string | null>(null);

	const [exporting, setExporting] = useState(false);

	// Selection state — set of identityKeys for items the operator
	// wants to export. Empty means "export everything" (all captured
	// items are sent without a selection filter).
	const [selected, setSelected] = useState<Set<string>>(new Set());

	const [showSummary, setShowSummary] = useState(true);
	const [showTree, setShowTree] = useState(false);
	const [showBuckets, setShowBuckets] = useState(false);

	// Empty = server derives from the cluster's Flux root path.
	const [clusterNameOverride, setClusterNameOverride] = useState('');
	// Ref tracks the latest override so runPreview can read it without
	// adding the override to its dep list (we don't want each keystroke
	// triggering a re-preview — the operator hits Refresh deliberately).
	const clusterNameOverrideRef = useRef('');
	useEffect(() => { clusterNameOverrideRef.current = clusterNameOverride; }, [clusterNameOverride]);
	const allCollapsed = !showSummary && !showBuckets && !showTree;
	const toggleAllSections = () => {
		const next = !allCollapsed;
		setShowSummary(next);
		setShowBuckets(next);
		setShowTree(next);
	};

	const runPreview = useCallback(async () => {
		setLoadingPreview(true);
		setPreviewError(null);
		try {
			const body = {
				env,
				clusterName: clusterNameOverrideRef.current || undefined,
			};
			const result = isManagement
				? await gitopsApi.previewManagementCluster(body)
				: await gitopsApi.previewCluster(clusterNamespace ?? '', clusterName, body);
			setPreview(result);
			// Seed the override field with the resolved name only on
			// first load. Operator edits then take precedence; we don't
			// clobber their typed value on subsequent refreshes.
			setClusterNameOverride(prev => prev || result.clusterName);
			const allKeys = new Set(result.coverage.captured.map(identityKey));
			setSelected(allKeys);
		} catch (err) {
			const message = err instanceof Error ? err.message : 'Failed to load preview';
			setPreviewError(message);
		} finally {
			setLoadingPreview(false);
		}
	}, [clusterNamespace, clusterName, isManagement, env]);

	useEffect(() => {
		runPreview();
	}, [runPreview]);

	useEffect(() => {
		if (!repository) {
			setBranches([]);
			return;
		}
		const load = async () => {
			setLoadingBranches(true);
			try {
				const list = await gitopsApi.listBranches(repository);
				setBranches(list ?? []);
				const defaultBranch = repositories.find(r => r.fullName === repository)?.defaultBranch;
				if (defaultBranch) setBranch(defaultBranch);
			} catch (err) {
				console.warn('Failed to load branches:', err);
				setBranches([]);
			} finally {
				setLoadingBranches(false);
			}
		};
		load();
	}, [repository, repositories]);

	useEffect(() => {
		if (repositories.length > 0 && !repository) {
			setRepository(repositories[0].fullName);
		}
	}, [repositories, repository]);

	const buckets = useMemo(() => {
		const out: Record<CapturedItemSource, CapturedItem[]> = {
			'helm-addon': [],
			'helm-unmatched': [],
			'native-inventory': [],
		};
		preview?.coverage.captured.forEach(item => {
			out[item.source].push(item);
		});
		return out;
	}, [preview]);

	// Directories first, alphabetical within each level.
	const fileTree = useMemo<TreeNode>(() => {
		const root: TreeNode = { name: '', isDir: true, children: new Map() };
		if (!preview) return root;
		Object.keys(preview.files).sort().forEach(path => {
			const parts = path.split('/');
			let node = root;
			parts.forEach((part, i) => {
				const isLeaf = i === parts.length - 1;
				if (!node.children!.has(part)) {
					if (isLeaf) {
						node.children!.set(part, { name: part, isDir: false, fullPath: path });
					} else {
						node.children!.set(part, { name: part, isDir: true, children: new Map() });
					}
				}
				if (!isLeaf) {
					node = node.children!.get(part)!;
				}
			});
		});
		return root;
	}, [preview]);

	const toggleItem = (item: CapturedItem) => {
		const key = identityKey(item);
		setSelected(prev => {
			const next = new Set(prev);
			if (next.has(key)) next.delete(key);
			else next.add(key);
			return next;
		});
	};

	const toggleBucket = (source: CapturedItemSource) => {
		const bucketKeys = buckets[source].map(identityKey);
		const allSelected = bucketKeys.every(k => selected.has(k));
		setSelected(prev => {
			const next = new Set(prev);
			if (allSelected) {
				bucketKeys.forEach(k => next.delete(k));
			} else {
				bucketKeys.forEach(k => next.add(k));
			}
			return next;
		});
	};

	const handleExport = async () => {
		if (!repository) {
			showError('Repository Required', 'Please select a repository');
			return;
		}
		if (!preview) return;

		// Build the selection identities. If the operator left everything
		// selected, send an empty selection (server interprets as
		// "export all"); if they deselected anything, send the explicit
		// list so the server filters to the chosen subset.
		const allKeys = new Set(preview.coverage.captured.map(identityKey));
		const allSelected = preview.coverage.captured.length === selected.size &&
			preview.coverage.captured.every(item => selected.has(identityKey(item)));
		const selection: CapturedItemIdentity[] = allSelected
			? []
			: preview.coverage.captured
				.filter(item => selected.has(identityKey(item)))
				.map(item => ({ kind: item.kind, namespace: item.namespace, name: item.name }));

		if (!allSelected && selection.length === 0) {
			showError('Nothing Selected', 'Select at least one resource to export, or select all to export the full cluster.');
			return;
		}
		// (allKeys unused in normal-path; kept for the validation logic above)
		void allKeys;

		setExporting(true);
		try {
			const request = {
				env,
				clusterName: clusterNameOverride || undefined,
				repository,
				branch,
				createPR,
				prTitle: `Export cluster ${clusterNameOverride || clusterName} to GitOps`,
				selection,
			};
			const result = isManagement
				? await gitopsApi.exportManagementCluster(request)
				: await gitopsApi.exportCluster(clusterNamespace ?? '', clusterName, request);
			if (result.success) {
				onSuccess({ prUrl: result.prUrl, commitSha: result.commitSha });
			} else {
				showError('Export Failed', result.message);
			}
		} catch (err) {
			const message = err instanceof Error ? err.message : 'Failed to export';
			showError('Export Failed', message);
		} finally {
			setExporting(false);
		}
	};

	const selectedCount = selected.size;
	const totalCaptured = preview?.coverage.captured.length ?? 0;

	return (
		<Modal isOpen onClose={onClose} size="xl">
			<ModalHeader>
				Preview Cluster Export — {clusterName}
			</ModalHeader>

			<ModalBody>
				<div className="space-y-4">
					{/* Target config — repo, branch, env */}
					<div className="p-3 rounded-lg bg-neutral-800/50 border border-neutral-700 space-y-3">
						<div>
							<label className="block text-sm font-medium text-neutral-300 mb-1">
								Target Repository
							</label>
							<SearchableSelect
								value={repository}
								onChange={setRepository}
								options={repositories.map(repo => ({ value: repo.fullName, label: repo.fullName }))}
								placeholder="Select a repository..."
								loading={loadingRepos}
								loadingText="Loading repositories..."
							/>
						</div>
						<div className="grid grid-cols-3 gap-3">
							<div>
								<label className="block text-sm font-medium text-neutral-300 mb-1">Branch</label>
								<div className="relative">
									<select
										value={branch}
										onChange={(e) => setBranch(e.target.value)}
										disabled={loadingBranches || branches.length === 0}
										className="w-full px-3 py-2 bg-neutral-800 border border-neutral-700 rounded-lg text-neutral-200 focus:outline-none focus:ring-2 focus:ring-green-500 disabled:opacity-50"
									>
										{branches.length === 0 ? (
											<option value={branch}>{branch}</option>
										) : (
											branches.map(b => (
												<option key={b.name} value={b.name}>{b.name}</option>
											))
										)}
									</select>
									{loadingBranches && (
										<div className="absolute right-3 top-1/2 -translate-y-1/2">
											<Spinner size="sm" />
										</div>
									)}
								</div>
							</div>
							<div>
								<label className="block text-sm font-medium text-neutral-300 mb-1">Env</label>
								<input
									type="text"
									value={env}
									onChange={(e) => setEnv(e.target.value)}
									placeholder="prd"
									className="w-full px-3 py-2 bg-neutral-800 border border-neutral-700 rounded-lg text-neutral-200 focus:outline-none focus:ring-2 focus:ring-green-500"
								/>
							</div>
							<div className="flex items-end">
								<label className="flex items-center gap-2 cursor-pointer text-sm">
									<input
										type="checkbox"
										checked={createPR}
										onChange={(e) => setCreatePR(e.target.checked)}
										className="w-4 h-4 rounded border-neutral-600 bg-neutral-800 text-green-500"
									/>
									<span className="text-neutral-200">Create PR</span>
								</label>
							</div>
						</div>
						<div>
							<label className="block text-sm font-medium text-neutral-300 mb-1">
								Cluster name <span className="text-neutral-500 font-normal">(directory under clusters/)</span>
							</label>
							<input
								type="text"
								value={clusterNameOverride}
								onChange={(e) => setClusterNameOverride(e.target.value)}
								placeholder="auto-detect from Flux root path"
								className="w-full px-3 py-2 bg-neutral-800 border border-neutral-700 rounded-lg text-neutral-200 focus:outline-none focus:ring-2 focus:ring-green-500 font-mono text-sm"
							/>
							<p className="text-xs text-neutral-500 mt-1">
								Tree emits at clusters/<span className="font-mono text-neutral-400">{clusterNameOverride || '…'}</span>/. Change to match your Flux bootstrap path (e.g. "butler"), then click Refresh preview.
							</p>
						</div>
						<div>
							<button
								onClick={runPreview}
								disabled={loadingPreview}
								className="text-sm text-green-400 hover:text-green-300 flex items-center gap-2"
							>
								{loadingPreview ? <Spinner size="sm" /> : null}
								Refresh preview
							</button>
						</div>
					</div>

					{/* Preview content */}
					{loadingPreview && !preview && (
						<div className="flex items-center justify-center py-12">
							<Spinner />
							<span className="ml-3 text-neutral-400">Running discovery + layout against {clusterName}...</span>
						</div>
					)}

					{previewError && (
						<div className="p-3 rounded-lg bg-red-900/20 border border-red-500/30">
							<p className="text-red-200 text-sm font-medium">Preview failed</p>
							<p className="text-red-300/70 text-xs mt-1">{previewError}</p>
						</div>
					)}

					{preview && (
						<>
							{/* Section toolbar: collapse/expand all */}
							<div className="flex justify-end">
								<button
									onClick={toggleAllSections}
									className="text-xs text-neutral-400 hover:text-neutral-200"
								>
									{allCollapsed ? 'Expand all sections' : 'Collapse all sections'}
								</button>
							</div>

							{/* Section 1 — Summary (at-a-glance numbers) */}
							<SummarySection
								preview={preview}
								open={showSummary}
								onToggle={() => setShowSummary(v => !v)}
							/>

							{/* Section 2 — File tree (the WYSIWYG of what will commit) */}
							<FileTreeSection
								root={fileTree}
								files={preview.files}
								totalFiles={preview.summary.fileCount}
								open={showTree}
								onToggle={() => setShowTree(v => !v)}
							/>

							{/* Section 3 — Captured by source (selection / narrowing) */}
							<CapturedBucketsSection
								buckets={buckets}
								selected={selected}
								toggleItem={toggleItem}
								toggleBucket={toggleBucket}
								open={showBuckets}
								onToggle={() => setShowBuckets(v => !v)}
							/>
						</>
					)}
				</div>
			</ModalBody>

			<ModalFooter>
				<div className="flex items-center justify-between w-full">
					<div className="text-sm text-neutral-400">
						{preview && (
							<>
								Selected: <span className="text-neutral-200 font-medium">{selectedCount}</span> / {totalCaptured} captured
							</>
						)}
					</div>
					<div className="flex gap-2">
						<Button variant="secondary" onClick={onClose}>
							Cancel
						</Button>
						<Button
							onClick={handleExport}
							disabled={exporting || !preview || !repository || selectedCount === 0}
						>
							{exporting ? (
								<>
									<Spinner size="sm" />
									<span className="ml-2">Exporting...</span>
								</>
							) : createPR ? (
								`Create PR with ${selectedCount} resource${selectedCount === 1 ? '' : 's'}`
							) : (
								`Export ${selectedCount} resource${selectedCount === 1 ? '' : 's'}`
							)}
						</Button>
					</div>
				</div>
			</ModalFooter>
		</Modal>
	);
}

// SectionCaret is the click-affordance chevron on collapsible section
// headers. Sized + accent-colored to read as obviously interactive.
function SectionCaret({ open }: { open: boolean }) {
	return (
		<span
			className={`flex-shrink-0 inline-flex items-center justify-center w-5 h-5 rounded text-sky-300 bg-sky-500/10 transition-transform duration-150 ${open ? 'rotate-90' : ''}`}
		>
			<svg viewBox="0 0 16 16" className="w-3.5 h-3.5" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
				<path d="M6 4l4 4-4 4" />
			</svg>
		</span>
	);
}

function SummarySection({
	preview,
	open,
	onToggle,
}: {
	preview: PreviewClusterResponse;
	open: boolean;
	onToggle: () => void;
}) {
	const { summary } = preview;
	const totalCaptured =
		summary.capturedBySource.helmAddon +
		summary.capturedBySource.helmUnmatched +
		summary.capturedBySource.nativeInventory;
	return (
		<div className="border border-neutral-700 rounded-lg overflow-hidden">
			<button
				onClick={onToggle}
				className="w-full bg-neutral-800 px-3 py-2.5 text-sm font-medium text-neutral-200 border-b border-neutral-700 hover:bg-neutral-700/60 flex items-center gap-2.5 text-left transition-colors"
			>
				<SectionCaret open={open} />
				<span>Summary</span>
			</button>
			{open && (
			<div className="p-4 space-y-3">
				<div className="text-neutral-200">
					<span className="font-medium">{summary.fileCount}</span> file{summary.fileCount === 1 ? '' : 's'} will be committed
				</div>
				<div className="text-sm text-neutral-300 space-y-1">
					<div>
						Captured resources: <span className="text-neutral-100 font-medium">{totalCaptured}</span>
					</div>
					<div className="ml-4 grid grid-cols-1 sm:grid-cols-3 gap-2">
						<SourceTile
							label="Known Butler addons"
							count={summary.capturedBySource.helmAddon}
							tone="neutral"
						/>
						<SourceTile
							label="Helm (unmatched)"
							count={summary.capturedBySource.helmUnmatched}
							tone="neutral"
						/>
						<SourceTile
							label="Discovered natives"
							count={summary.capturedBySource.nativeInventory}
							tone="emphasis"
							subtitle="unknown to Butler — agnostic discovery"
						/>
					</div>
				</div>
				<div className="text-sm flex gap-4 pt-2 border-t border-neutral-800">
					<FlagBadge label="Path collisions" count={summary.collisions} />
					<FlagBadge label="Discovery failures" count={summary.failures} />
				</div>
			</div>
			)}
		</div>
	);
}

function SourceTile({
	label,
	count,
	tone,
	subtitle,
}: {
	label: string;
	count: number;
	tone: 'neutral' | 'emphasis';
	subtitle?: string;
}) {
	const toneClasses =
		tone === 'emphasis'
			? 'border-purple-500/40 bg-purple-500/5'
			: 'border-neutral-700 bg-neutral-800/30';
	return (
		<div className={`p-2 rounded border ${toneClasses}`}>
			<div className="text-xs text-neutral-400">{label}</div>
			<div className="text-lg font-medium text-neutral-100">{count}</div>
			{subtitle && <div className="text-xs text-purple-300/70 mt-0.5">{subtitle}</div>}
		</div>
	);
}

function FlagBadge({ label, count }: { label: string; count: number }) {
	const tone = count === 0 ? 'text-green-400' : 'text-yellow-400';
	const icon = count === 0 ? '✓' : '!';
	return (
		<div className="flex items-center gap-2">
			<span className={`${tone} font-mono text-base`}>{icon}</span>
			<span className="text-neutral-300">
				{label}: <span className={tone}>{count}</span>
			</span>
		</div>
	);
}

function CapturedBucketsSection({
	buckets,
	selected,
	toggleItem,
	toggleBucket,
	open,
	onToggle,
}: {
	buckets: Record<CapturedItemSource, CapturedItem[]>;
	selected: Set<string>;
	toggleItem: (item: CapturedItem) => void;
	toggleBucket: (source: CapturedItemSource) => void;
	open: boolean;
	onToggle: () => void;
}) {
	const totalCaptured =
		buckets['helm-addon'].length +
		buckets['helm-unmatched'].length +
		buckets['native-inventory'].length;
	return (
		<div className="border border-neutral-700 rounded-lg overflow-hidden">
			<button
				onClick={onToggle}
				className="w-full bg-neutral-800 px-3 py-2.5 text-sm font-medium text-neutral-200 border-b border-neutral-700 hover:bg-neutral-700/60 flex items-center gap-2.5 text-left transition-colors"
			>
				<SectionCaret open={open} />
				<span>Captured resources by source</span>
				<span className="text-neutral-500 text-xs">({totalCaptured})</span>
			</button>
			{open && (
			<div className="divide-y divide-neutral-800">
				<Bucket
					label="Known Butler addons"
					source="helm-addon"
					items={buckets['helm-addon']}
					selected={selected}
					toggleItem={toggleItem}
					toggleBucket={toggleBucket}
					emphasis={false}
				/>
				<Bucket
					label="Helm releases (no addon match)"
					source="helm-unmatched"
					items={buckets['helm-unmatched']}
					selected={selected}
					toggleItem={toggleItem}
					toggleBucket={toggleBucket}
					emphasis={false}
				/>
				<Bucket
					label="Discovered natives — unknown to Butler"
					source="native-inventory"
					items={buckets['native-inventory']}
					selected={selected}
					toggleItem={toggleItem}
					toggleBucket={toggleBucket}
					emphasis={true}
				/>
			</div>
			)}
		</div>
	);
}

function Bucket({
	label,
	source,
	items,
	selected,
	toggleItem,
	toggleBucket,
	emphasis,
}: {
	label: string;
	source: CapturedItemSource;
	items: CapturedItem[];
	selected: Set<string>;
	toggleItem: (item: CapturedItem) => void;
	toggleBucket: (source: CapturedItemSource) => void;
	emphasis: boolean;
}) {
	const allSelected = items.length > 0 && items.every(item => selected.has(identityKey(item)));
	const someSelected = items.some(item => selected.has(identityKey(item)));
	const tone = emphasis ? 'text-purple-300' : 'text-neutral-200';
	return (
		<details open={items.length > 0 && items.length <= 25}>
			<summary className="px-3 py-2 cursor-pointer hover:bg-neutral-800/50 flex items-center gap-3">
				<input
					type="checkbox"
					checked={allSelected}
					ref={el => {
						if (el) el.indeterminate = !allSelected && someSelected;
					}}
					onChange={() => toggleBucket(source)}
					onClick={(e) => e.stopPropagation()}
					className="w-4 h-4 rounded border-neutral-600 bg-neutral-800 text-green-500"
				/>
				<span className={`font-medium ${tone}`}>{label}</span>
				<span className="text-sm text-neutral-500">({items.length})</span>
			</summary>
			<div className="px-3 py-2 bg-neutral-900/50">
				{items.length === 0 ? (
					<div className="text-sm text-neutral-500 italic">No items in this bucket.</div>
				) : (
					<ul className="space-y-1">
						{items.map(item => {
							const key = identityKey(item);
							const isSelected = selected.has(key);
							return (
								<li key={key} className="flex items-center gap-3 text-sm py-1">
									<input
										type="checkbox"
										checked={isSelected}
										onChange={() => toggleItem(item)}
										className="w-4 h-4 rounded border-neutral-600 bg-neutral-800 text-green-500"
									/>
									<span className="text-neutral-300 font-mono text-xs">
										{item.kind}
									</span>
									<span className="text-neutral-400">
										{item.namespace ? `${item.namespace}/` : ''}{item.name}
									</span>
									{item.addonDefinition && (
										<span className="text-xs text-neutral-500">
											({item.addonDefinition})
										</span>
									)}
									{item.path && (
										<span className="text-xs text-neutral-600 ml-auto truncate" title={item.path}>
											{item.path}
										</span>
									)}
								</li>
							);
						})}
					</ul>
				)}
			</div>
		</details>
	);
}

// TreeNode models a nested file tree. Directories carry children;
// files carry the full path used to look up content from preview.files.
interface TreeNode {
	name: string;
	isDir: boolean;
	children?: Map<string, TreeNode>;
	fullPath?: string;
}

// fileLeafCount totals the file leaves under a directory subtree so
// directory rows can show "(n)" without re-walking on every render.
function fileLeafCount(node: TreeNode): number {
	if (!node.isDir) return 1;
	let count = 0;
	node.children?.forEach(child => { count += fileLeafCount(child); });
	return count;
}

function FileTreeSection({
	root,
	files,
	totalFiles,
	open,
	onToggle,
}: {
	root: TreeNode;
	files: Record<string, string>;
	totalFiles: number;
	open: boolean;
	onToggle: () => void;
}) {
	// Track which directory paths are open. The native <details> handles
	// show/hide; this set is purely for picking the caret glyph so it
	// always matches the immediate node's own state (Tailwind's
	// group-open ancestor match was rotating nested carets when any
	// ancestor was open).
	const [openPaths, setOpenPaths] = useState<Set<string>>(new Set());
	const setOpen = useCallback((path: string, open: boolean) => {
		setOpenPaths(prev => {
			const next = new Set(prev);
			if (open) next.add(path); else next.delete(path);
			return next;
		});
	}, []);

	const topLevel = Array.from(root.children?.values() ?? []);
	topLevel.sort((a, b) => {
		if (a.isDir !== b.isDir) return a.isDir ? -1 : 1;
		return a.name.localeCompare(b.name);
	});
	return (
		<div className="border border-neutral-700 rounded-lg overflow-hidden">
			<button
				onClick={onToggle}
				className="w-full bg-neutral-800 px-3 py-2.5 text-sm font-medium text-neutral-200 border-b border-neutral-700 hover:bg-neutral-700/60 flex items-center gap-2.5 text-left transition-colors"
			>
				<SectionCaret open={open} />
				<span>File tree ({totalFiles} files)</span>
			</button>
			{open && (
			<div className="max-h-96 overflow-y-auto py-1">
				{topLevel.map(node => (
					<TreeNodeRow
						key={node.name}
						node={node}
						depth={0}
						parentPath=""
						files={files}
						openPaths={openPaths}
						setOpen={setOpen}
					/>
				))}
			</div>
			)}
		</div>
	);
}

function TreeNodeRow({
	node,
	depth,
	parentPath,
	files,
	openPaths,
	setOpen,
}: {
	node: TreeNode;
	depth: number;
	parentPath: string;
	files: Record<string, string>;
	openPaths: Set<string>;
	setOpen: (path: string, open: boolean) => void;
}) {
	// 12px per level of nesting; flat enough to read, indented enough
	// to show shape. Caret on dirs, dot-marker on files.
	const indent = { paddingLeft: `${depth * 12 + 8}px` };
	const path = parentPath === '' ? node.name : `${parentPath}/${node.name}`;

	if (node.isDir) {
		const children = Array.from(node.children?.values() ?? []);
		children.sort((a, b) => {
			if (a.isDir !== b.isDir) return a.isDir ? -1 : 1;
			return a.name.localeCompare(b.name);
		});
		const isOpen = openPaths.has(path);
		return (
			<details onToggle={(e) => setOpen(path, (e.currentTarget as HTMLDetailsElement).open)}>
				<summary
					className="py-1 text-sm text-neutral-300 cursor-pointer hover:bg-neutral-800/50 font-mono select-none flex items-center gap-1"
					style={indent}
				>
					<span className="text-neutral-500 inline-block w-3">{isOpen ? '▾' : '▸'}</span>
					<span>{node.name}/</span>
					<span className="text-neutral-500 text-xs">({fileLeafCount(node)})</span>
				</summary>
				<div>
					{children.map(child => (
						<TreeNodeRow
							key={child.name}
							node={child}
							depth={depth + 1}
							parentPath={path}
							files={files}
							openPaths={openPaths}
							setOpen={setOpen}
						/>
					))}
				</div>
			</details>
		);
	}

	// File leaf: <details> for inline content view. File rows pop via a
	// small page icon in an accent color, brighter text, and a thin
	// left rule that visually distinguishes leaves from the gray dir
	// hierarchy above.
	const ext = node.name.includes('.') ? node.name.split('.').pop()!.toLowerCase() : '';
	const iconTone =
		ext === 'yaml' || ext === 'yml' ? 'text-sky-400' :
		ext === 'json' ? 'text-amber-400' :
		ext === 'md' ? 'text-emerald-400' :
		'text-neutral-400';
	const content = files[node.fullPath!];
	return (
		<details>
			<summary
				className="py-1 text-xs cursor-pointer hover:bg-neutral-800/40 font-mono select-none flex items-center gap-1.5 border-l-2 border-transparent hover:border-sky-500/40"
				style={indent}
			>
				<svg
					className={`w-3 h-3 inline-block flex-shrink-0 ${iconTone}`}
					viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.4"
				>
					<path d="M9 1.5H3.5a1 1 0 0 0-1 1v11a1 1 0 0 0 1 1h9a1 1 0 0 0 1-1V6L9 1.5z" />
					<path d="M9 1.5V6h4.5" />
				</svg>
				<span className="text-neutral-100">{node.name}</span>
			</summary>
			<div
				className="relative my-1 border-l-2 border-sky-500/30 rounded-r bg-neutral-950"
				style={{ marginLeft: `${depth * 12 + 24}px` }}
			>
				<CopyButton text={content} />
				<pre className="text-xs text-neutral-300 overflow-x-auto whitespace-pre py-2 pl-3 pr-2">
					{content}
				</pre>
			</div>
		</details>
	);
}

// CopyButton renders a small clipboard control in the corner of a file
// content block. Shows transient "Copied!" feedback on success.
function CopyButton({ text }: { text: string }) {
	const [copied, setCopied] = useState(false);
	const onClick = async (e: React.MouseEvent) => {
		e.preventDefault();
		e.stopPropagation();
		try {
			await navigator.clipboard.writeText(text);
			setCopied(true);
			setTimeout(() => setCopied(false), 1500);
		} catch {
			// Clipboard write can fail (no permission, http context, etc.).
			// Surface visually so the operator knows to copy manually.
			setCopied(false);
		}
	};
	return (
		<button
			onClick={onClick}
			className="absolute top-1 right-1 p-1 rounded border border-neutral-700 bg-neutral-900/80 text-neutral-300 hover:bg-neutral-800 hover:text-neutral-100 z-10 flex items-center justify-center"
			title={copied ? 'Copied to clipboard' : 'Copy file contents'}
			aria-label="Copy file contents to clipboard"
		>
			{copied ? (
				<svg className="w-3.5 h-3.5 text-emerald-400" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="2">
					<path d="M3 8.5 6.5 12 13 4.5" strokeLinecap="round" strokeLinejoin="round" />
				</svg>
			) : (
				<svg className="w-3.5 h-3.5" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.4">
					<rect x="5" y="5" width="9" height="9" rx="1.2" />
					<path d="M11 5V3a1 1 0 0 0-1-1H3a1 1 0 0 0-1 1v7a1 1 0 0 0 1 1h2" />
				</svg>
			)}
		</button>
	);
}

function identityKey(item: { kind: string; namespace?: string; name: string }): string {
	return `${item.kind}|${item.namespace ?? ''}|${item.name}`;
}

export default PreviewClusterModal;
