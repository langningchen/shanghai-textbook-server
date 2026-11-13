// Copyright (C) 2026 Langning Chen
//
// This program is free software: you can redistribute it and/or modify
// it under the terms of the GNU Affero General Public License as
// published by the Free Software Foundation, either version 3 of the
// License, or (at your option) any later version.
//
// This program is distributed in the hope that it will be useful,
// but WITHOUT ANY WARRANTY; without even the implied warranty of
// MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE.  See the
// GNU Affero General Public License for more details.
//
// You should have received a copy of the GNU Affero General Public License
// along with this program.  If not, see <https://www.gnu.org/licenses/>.

"use client";

import { useState, useEffect, useCallback, useMemo, useRef } from "react";
import Container from "@mui/material/Container";
import Typography from "@mui/material/Typography";
import Box from "@mui/material/Box";
import CircularProgress from "@mui/material/CircularProgress";
import Alert from "@mui/material/Alert";
import Snackbar from "@mui/material/Snackbar";
import AppBar from "@mui/material/AppBar";
import Toolbar from "@mui/material/Toolbar";
import Fab from "@mui/material/Fab";
import Pagination from "@mui/material/Pagination";
import IconButton from "@mui/material/IconButton";
import Menu from "@mui/material/Menu";
import MenuItem from "@mui/material/MenuItem";
import ListItemIcon from "@mui/material/ListItemIcon";
import ListItemText from "@mui/material/ListItemText";
import Divider from "@mui/material/Divider";
import ToggleButton from "@mui/material/ToggleButton";
import ToggleButtonGroup from "@mui/material/ToggleButtonGroup";
import Button from "@mui/material/Button";
import Tooltip from "@mui/material/Tooltip";
import SchoolIcon from "@mui/icons-material/School";
import KeyboardArrowUpIcon from "@mui/icons-material/KeyboardArrowUp";
import GitHubIcon from "@mui/icons-material/GitHub";
import DownloadIcon from "@mui/icons-material/Download";
import ViewModuleIcon from "@mui/icons-material/ViewModule";
import ViewListIcon from "@mui/icons-material/ViewList";
import SwapHorizIcon from "@mui/icons-material/SwapHoriz";
import SpeedIcon from "@mui/icons-material/Speed";
import { ThemeProvider, createTheme } from "@mui/material/styles";
import CssBaseline from "@mui/material/CssBaseline";
import useMediaQuery from "@mui/material/useMediaQuery";

import type { Textbook, FilterOptions } from "@/types/textbook";
import { filterBooks } from "@/utils/helpers";
import { getIndexUrl, getPdfPrefix } from "@/utils/url";
import BookCard from "@/components/BookCard";
import BookList from "@/components/BookList";
import { fetchTextbookDetail } from "@/utils/textbook";
import BookFilter from "@/components/BookFilter";
import BookDetailDialog from "@/components/BookDetailDialog";
import SourceSwitchDialog from "@/components/SourceSwitchDialog";
import DownloadQueueDialog from "@/components/DownloadQueueDialog";
import DownloadQueuePanel from "@/components/DownloadQueuePanel";
import {
	DEFAULT_CONCURRENCY,
	createQueueItem,
	readConcurrency,
	readDownloadQueue,
	stripPartSegments,
	trimDoneItems,
	writeConcurrency,
	writeDownloadQueue,
	type DownloadQueueItem,
} from "@/utils/downloadQueue";
import {
	createDownloadLimiter,
	discoverBookParts,
	downloadBook,
	type DownloadProgress,
	type DownloadTask,
	type PartInfo,
} from "@/utils/downloader";
import { deleteChunks } from "@/utils/downloadStore";

async function loadBooks(signal?: AbortSignal): Promise<Textbook[]> {
	const response = await fetch(getIndexUrl(), { signal });
	if (!response.ok) throw new Error(`HTTP ${response.status}`);
	return response.json();
}

const theme = createTheme({
	palette: {
		primary: {
			main: "#1976d2",
		},
		secondary: {
			main: "#dc004e",
		},
	},
	typography: {
		h4: {
			fontWeight: 600,
		},
		h6: {
			fontWeight: 500,
		},
	},
});

const MAX_DOWNLOAD_BOOKS = 3;
const PREFETCH_BOOKS = 3;
const MIN_CONCURRENCY = 1;
const MAX_CONCURRENCY = 32;
const SLOW_SPEED_BYTES = 1024 * 1024;
const SLOW_RECOVER_MS = 5000;
const SLOW_CHECK_MS = 500;
// Progress checkpoints fire a few times a second per book; coalesce the writes.
const QUEUE_PERSIST_DEBOUNCE_MS = 750;

// Queue-level progress commits are throttled to this byte step.
const CHECKPOINT_COMMIT_BYTES = 1024 * 1024;

const BOOKS_PER_PAGE = 50;

// Queue entries keep the compact form; `PartInfo` is what the engine expects.
const queuePartsFrom = (parts: PartInfo[]): DownloadQueueItem["parts"] =>
	parts.map((part, index) => ({
		index,
		receivedBytes: 0,
		totalBytes: part.size,
		completed: false,
		url: part.url,
	}));

// A remembered part list is only reusable while every part still points at
// the current source; anything else would mix two sources into one file.
const partsBelongTo = (
	parts: DownloadQueueItem["parts"],
	prefix: string,
): boolean =>
	parts.length > 0 &&
	parts.every((part) => part.url?.startsWith(prefix) === true);

const partInfosFrom = (
	parts: DownloadQueueItem["parts"],
	prefix: string,
): PartInfo[] | undefined => {
	// Mixed or partially remembered lists fall back to a fresh probe.
	if (!partsBelongTo(parts, prefix)) return undefined;
	return parts.flatMap((part) =>
		part.url ? [{ url: part.url, size: part.totalBytes }] : [],
	);
};

export default function HomePage() {
	const isMobile = useMediaQuery(theme.breakpoints.down("sm"));
	const [books, setBooks] = useState<Textbook[]>([]);
	const [filters, setFilters] = useState<FilterOptions>({});
	const filteredBooks = useMemo(
		() => filterBooks(books, filters),
		[books, filters],
	);
	const [loading, setLoading] = useState(true);
	const [error, setError] = useState<string | null>(null);
	const [snackbar, setSnackbar] = useState({
		open: false,
		message: "",
		severity: "success" as "success" | "error" | "info" | "warning",
	});
	const [showScrollTop, setShowScrollTop] = useState(false);
	const [anchorEl, setAnchorEl] = useState<null | HTMLElement>(null);
	const [viewMode, setViewMode] = useState<"grid" | "list">("grid");
	const [selectedBookIds, setSelectedBookIds] = useState<string[]>([]);
	const [detailDialogOpen, setDetailDialogOpen] = useState(false);
	const [detailBook, setDetailBook] = useState<Textbook | null>(null);
	const [detailLoading, setDetailLoading] = useState(false);
	const [sourceDialogOpen, setSourceDialogOpen] = useState(false);
	const [loadingTimeout, setLoadingTimeout] = useState(false);
	const [queue, setQueue] = useState<DownloadQueueItem[]>([]);
	const [queueReady, setQueueReady] = useState(false);
	const [queueDialogOpen, setQueueDialogOpen] = useState(false);
	const [activeTasks, setActiveTasks] = useState<DownloadTask[]>([]);
	const [running, setRunning] = useState(false);
	const [slow, setSlow] = useState(false);
	const [currentPage, setCurrentPage] = useState(1);
	const [prefetchingIds, setPrefetchingIds] = useState<string[]>([]);
	const [concurrency, setConcurrency] = useState(DEFAULT_CONCURRENCY);
	const queueRef = useRef<DownloadQueueItem[]>([]);
	const concurrencyRef = useRef(DEFAULT_CONCURRENCY);
	const pumpingRef = useRef(false);
	const runControllerRef = useRef<AbortController | null>(null);
	const detailController = useRef<AbortController | null>(null);
	const runningRef = useRef(false);
	const speedRef = useRef(0);
	const fastSince = useRef<number | null>(null);
	const prefetchedParts = useRef(new Map<string, PartInfo[]>());
	const prefetching = useRef(new Set<string>());
	const prefetchController = useRef<AbortController | null>(null);
	const inflightIds = useRef(new Set<string>());
	// One controller per running book, so removing one book cancels only that one.
	const itemControllers = useRef(new Map<string, AbortController>());
	const restartRequested = useRef(false);
	// Set on unmount so a queued restart cannot start downloads afterwards.
	const disposedRef = useRef(false);
	// localStorage writes are debounced; the snapshot keeps the latest queue.
	const persistTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
	const pendingPersist = useRef<DownloadQueueItem[] | null>(null);
	const pumpQueueRef = useRef<() => void>(() => {});

	// Unmount cleanup: abort the queue run, the prefetcher and every item run.
	useEffect(() => {
		// StrictMode mounts, cleans up and re-mounts in dev: re-arm the flag every
		// mount, otherwise the first cleanup would leave pumpQueue dead forever.
		disposedRef.current = false;
		// Snapshot the live runs; anything started later still listens to the
		// queue controller that cleanup aborts below.
		const mountedControllers = itemControllers.current;
		return () => {
			// Flush the debounced snapshot so the last state reaches storage.
			if (persistTimer.current !== null) {
				clearTimeout(persistTimer.current);
				persistTimer.current = null;
			}
			const latestQueue = pendingPersist.current;
			pendingPersist.current = null;
			if (latestQueue) writeDownloadQueue(latestQueue);
			restartRequested.current = false;
			disposedRef.current = true;
			runControllerRef.current?.abort();
			prefetchController.current?.abort();
			prefetchController.current = null;
			for (const controller of mountedControllers.values())
				controller.abort();
			mountedControllers.clear();
			detailController.current?.abort();
		};
		// Refs have stable identities, so this effect still runs exactly once.
	}, [itemControllers, runControllerRef, prefetchController, detailController]);

	// Read storage after mount so the prerendered HTML stays deterministic.
	useEffect(() => {
		const timer = setTimeout(() => {
			const stored = readDownloadQueue();
			queueRef.current = stored;
			setQueue(stored);
			// Only unfinished work is worth interrupting the user for.
			if (
				stored.some(
					(item) => item.status === "pending" || item.status === "failed",
				)
			)
				setQueueDialogOpen(true);
			const storedConcurrency = readConcurrency();
			concurrencyRef.current = storedConcurrency;
			setConcurrency(storedConcurrency);
			setQueueReady(true);
		}, 0);
		return () => clearTimeout(timer);
	}, []);

	// Keep the in-memory queue instant; only the storage write is debounced.
	useEffect(() => {
		if (!queueReady) return;
		pendingPersist.current = queue;
		// An armed timer always writes the latest snapshot, so the final state lands
		// even while progress checkpoints keep arriving.
		if (persistTimer.current !== null) return;
		persistTimer.current = setTimeout(() => {
			persistTimer.current = null;
			const latest = pendingPersist.current;
			pendingPersist.current = null;
			if (latest) writeDownloadQueue(latest);
		}, QUEUE_PERSIST_DEBOUNCE_MS);
	}, [queue, queueReady]);

	const visibleBooks = viewMode === "grid" ? filteredBooks : books;
	const menuOpen = Boolean(anchorEl);

	useEffect(() => {
		if (loading) {
			const timer = setTimeout(() => {
				setLoadingTimeout(true);
			}, 3000);
			return () => clearTimeout(timer);
		}
	}, [loading]);

	useEffect(() => {
		const controller = new AbortController();
		loadBooks(controller.signal)
			.then((result) => {
				if (!controller.signal.aborted) setBooks(result);
			})
			.catch(() => {
				if (!controller.signal.aborted)
					setError("网络错误或数据源不可访问，请检查连接或更换源");
			})
			.finally(() => {
				if (!controller.signal.aborted) setLoading(false);
			});
		return () => controller.abort();
	}, []);

	// Handle scroll to show/hide scroll-to-top button
	useEffect(() => {
		const handleScroll = () => {
			setShowScrollTop(window.scrollY > 300);
		};

		window.addEventListener("scroll", handleScroll);
		return () => window.removeEventListener("scroll", handleScroll);
	}, []);

	const handleFiltersChange = (nextFilters: FilterOptions) => {
		setFilters(nextFilters);
		setCurrentPage(1);
	};

	const fetchBooks = async () => {
		try {
			setLoading(true);
			setError(null);
			setLoadingTimeout(false);
			setBooks(await loadBooks());
		} catch {
			setError("网络错误或数据源不可访问，请检查连接或更换源");
		} finally {
			setLoading(false);
		}
	};

	const handleMenuClick = (event: React.MouseEvent<HTMLButtonElement>) => {
		setAnchorEl(event.currentTarget);
	};

	const handleMenuClose = () => {
		setAnchorEl(null);
	};

	const handleGitHubOpen = (url: string) => {
		window.open(url, "_blank", "noopener,noreferrer");
		handleMenuClose();
	};

	const handleShowDetail = useCallback(async (bookId: string) => {
		detailController.current?.abort();
		const controller = new AbortController();
		detailController.current = controller;
		setDetailDialogOpen(true);
		setDetailBook(null);
		setDetailLoading(true);
		try {
			const book = await fetchTextbookDetail(bookId, controller.signal);
			if (!controller.signal.aborted) setDetailBook(book);
		} catch {
			if (!controller.signal.aborted)
				setSnackbar({
					open: true,
					message: "加载详情失败，请稍后重试或切换数据源",
					severity: "error",
				});
		} finally {
			if (!controller.signal.aborted) setDetailLoading(false);
		}
	}, []);

	const handleCloseDetail = () => {
		detailController.current?.abort();
		setDetailDialogOpen(false);
		setDetailBook(null);
	};

	const handleViewModeChange = (
		_event: React.MouseEvent<HTMLElement>,
		nextMode: "grid" | "list" | null,
	) => {
		if (nextMode) {
			setViewMode(nextMode);
			setCurrentPage(1);
			setSelectedBookIds([]);
		}
	};

	const commitQueue = useCallback(
		(updater: (items: DownloadQueueItem[]) => DownloadQueueItem[]) => {
			const next = trimDoneItems(updater(queueRef.current));
			queueRef.current = next;
			setQueue(next);
		},
		[],
	);

	const limiter = useMemo(
		() => createDownloadLimiter(() => concurrencyRef.current),
		[],
	);

	const updateTask = useCallback((task: DownloadTask) => {
		setActiveTasks((previous) => {
			const index = previous.findIndex((entry) => entry.uuid === task.uuid);
			if (index < 0) return [...previous, task];
			const next = [...previous];
			next[index] = task;
			return next;
		});
	}, []);

	const prefetchAhead = useCallback(() => {
		if (books.length === 0) return;
		if (inflightIds.current.size === 0) return;
		// At most three books ahead of the running ones keep discovered metadata.
		const ahead = queueRef.current.filter(
			(item) =>
				item.status === "pending" &&
				!inflightIds.current.has(item.uuid) &&
				(item.parts.length > 0 || prefetching.current.has(item.uuid)),
		).length;
		if (ahead >= PREFETCH_BOOKS) return;
		const targets = queueRef.current
			.filter(
				(item) =>
					item.status === "pending" &&
					!inflightIds.current.has(item.uuid) &&
					item.parts.length === 0 &&
					!prefetchedParts.current.has(item.uuid) &&
					!prefetching.current.has(item.uuid),
			)
			.slice(0, PREFETCH_BOOKS - ahead);
		if (targets.length === 0) return;
		const controller = prefetchController.current ?? new AbortController();
		prefetchController.current = controller;
		for (const item of targets) {
			const book = books.find((entry) => entry.uuid === item.uuid);
			if (!book) continue;
			const uuid = item.uuid;
			prefetching.current.add(uuid);
			setPrefetchingIds((previous) =>
				previous.includes(uuid) ? previous : [...previous, uuid],
			);
			discoverBookParts(book, controller.signal)
				.then((parts) => {
					if (parts.length === 0) return;
					// Cleared or removed while probing: never resurrect it.
					if (!prefetching.current.has(uuid)) return;
					prefetchedParts.current.set(uuid, parts);
					commitQueue((items) =>
						items.map((entry) =>
							entry.uuid === uuid &&
							entry.status === "pending" &&
							entry.parts.length === 0
								? { ...entry, parts: queuePartsFrom(parts) }
								: entry,
						),
					);
				})
				.catch(() => {})
				.finally(() => {
					prefetching.current.delete(uuid);
					setPrefetchingIds((previous) =>
						previous.filter((entry) => entry !== uuid),
					);
				});
		}
	}, [books, commitQueue]);

	const pumpQueue = useCallback(() => {
		if (disposedRef.current) return;
		if (pumpingRef.current) {
			// The previous run is still winding down (a stop just fired, or its last
			// part is finishing). Remember the request instead of dropping it: a
			// dropped request left the freshly enqueued book pending forever.
			restartRequested.current = true;
			return;
		}
		const controller = new AbortController();
		runControllerRef.current = controller;
		pumpingRef.current = true;
		restartRequested.current = false;
		setRunning(true);
		const inFlight = new Map<string, Promise<void>>();

		// Only touch entries that still exist, so a removed book never comes back.
		const commitFor = (
			uuid: string,
			update: (entry: DownloadQueueItem) => DownloadQueueItem,
		) => {
			if (!queueRef.current.some((entry) => entry.uuid === uuid)) return;
			commitQueue((items) =>
				items.map((entry) => (entry.uuid === uuid ? update(entry) : entry)),
			);
		};

		const runItem = async (book: Textbook, parts?: PartInfo[]) => {
			const uuid = book.uuid;
			let latest: DownloadProgress | null = null;
			// Last byte offset that reached the queue, -1 until the first commit.
			let committedBytes = -1;
			const child = new AbortController();
			const abortChild = () => child.abort();
			if (controller.signal.aborted) child.abort();
			else
				controller.signal.addEventListener("abort", abortChild, {
					once: true,
				});
			itemControllers.current.set(uuid, child);
			commitFor(uuid, (entry) => ({
				...entry,
				status: "downloading",
				error: undefined,
			}));
			try {
				await downloadBook({
					book,
					signal: child.signal,
					limiter,
					parts,
					onProgress: (progress) => {
						if (child.signal.aborted) return;
						latest = progress;
						updateTask({ uuid, title: book.title, ...progress });
					},
					onCheckpoint: (progress) => {
						if (child.signal.aborted) return;
						const entry = queueRef.current.find((item) => item.uuid === uuid);
						// Only coarse progress reaches the queue: one commit per part tick would
						// push React state and storage writes several times a second per book.
						const shapeChanged =
							!entry ||
							entry.parts.length !== progress.parts.length ||
							progress.parts.some(
								(part) =>
									part.completed !== entry.parts[part.index]?.completed,
							);
						if (
							!shapeChanged &&
							committedBytes >= 0 &&
							Math.abs(progress.receivedBytes - committedBytes) <
								CHECKPOINT_COMMIT_BYTES
						)
							return;
						committedBytes = progress.receivedBytes;
						commitFor(uuid, (item) => ({
							...item,
							status: "downloading",
							// `segments` is runtime-only, the queue keeps the compact form.
							parts: progress.parts.map((part) => ({
								index: part.index,
								receivedBytes: part.receivedBytes,
								totalBytes: part.totalBytes,
								completed: part.completed,
								url: part.url ?? item.parts[part.index]?.url,
							})),
						}));
					},
				});
				// A newer run (or a removal) owns this uuid now: leave its state alone.
				if (itemControllers.current.get(uuid) !== child) return;
				commitFor(uuid, (entry) => ({
					...entry,
					status: "done",
					error: undefined,
					parts: latest ? stripPartSegments(latest.parts) : entry.parts,
					receivedBytes: latest?.receivedBytes ?? entry.receivedBytes,
					totalBytes: latest?.totalBytes ?? entry.totalBytes,
				}));
				setSnackbar({
					open: true,
					message: `已完成下载：${book.title}`,
					severity: "success",
				});
			} catch (error) {
				if (child.signal.aborted) {
					// Stopped or removed: reset to pending only while this run still owns
					// the item, never on top of a newer run's state.
					if (itemControllers.current.get(uuid) === child)
						commitFor(uuid, (entry) =>
							entry.status === "downloading"
								? { ...entry, status: "pending" as const }
								: entry,
						);
					return;
				}
				if (itemControllers.current.get(uuid) !== child) return;
				commitFor(uuid, (entry) => ({
					...entry,
					status: "failed",
					error:
						error instanceof Error ? error.message : "下载失败，请稍后重试",
				}));
			} finally {
				controller.signal.removeEventListener("abort", abortChild);
				// A newer run owning this uuid keeps its own task row; anything else is
				// this run's to clean up.
				const owner = itemControllers.current.get(uuid);
				if (!owner || owner === child) {
					if (owner === child) itemControllers.current.delete(uuid);
					setActiveTasks((previous) =>
						previous.filter((entry) => entry.uuid !== uuid),
					);
					// Only now that the engine settled: a uuid that left the queue while running
					// (removed / cleared) owns orphaned chunks, and deleting them here cannot
					// collide with a flush or a parallel run. A re-added entry keeps its chunks.
					if (!queueRef.current.some((entry) => entry.uuid === uuid))
						await deleteChunks(uuid);
				}
			}
		};

		// Forget metadata that belongs to another source before (re)starting a book.
		const resetEntryParts = (uuid: string) => {
			prefetchedParts.current.delete(uuid);
			prefetching.current.delete(uuid);
			setPrefetchingIds((previous) => previous.filter((entry) => entry !== uuid));
			// Chunks stay: keys are source independent and the engine validates them
			// against the new Content-Range before resuming, so switching sources can
			// still continue from what was already downloaded.
			commitFor(uuid, (entry) => ({ ...entry, parts: [], receivedBytes: 0 }));
		};

		const memoryPartsFor = (uuid: string, prefix: string) => {
			const cached = prefetchedParts.current.get(uuid);
			if (!cached) return undefined;
			if (cached.every((part) => part.url.startsWith(prefix))) return cached;
			prefetchedParts.current.delete(uuid);
			return undefined;
		};

		const launch = () => {
			if (controller.signal.aborted) return;
			// The index is not loaded yet: keep everything pending instead of
			// marking books failed because `books` happens to be empty.
			if (books.length === 0) return;
			for (const entry of queueRef.current) {
				if (inFlight.size >= MAX_DOWNLOAD_BOOKS) break;
				if (entry.status !== "pending" || inFlight.has(entry.uuid))
					continue;
				const book = books.find((item) => item.uuid === entry.uuid);
				if (!book) {
					commitFor(entry.uuid, (item) => ({
						...item,
						status: "failed",
						error: "当前数据源中找不到这本教材",
					}));
					continue;
				}
				const prefix = getPdfPrefix(book.uuid);
				if (entry.parts.length > 0 && !partsBelongTo(entry.parts, prefix))
					resetEntryParts(entry.uuid);
				const current =
					queueRef.current.find((item) => item.uuid === entry.uuid) ?? entry;
				// Prefer metadata discovered ahead of time, then whatever the entry still
				// remembers for this source, and only probe as a last resort.
				const cached =
					memoryPartsFor(entry.uuid, prefix) ??
					partInfosFrom(current.parts, prefix);
				prefetchedParts.current.delete(entry.uuid);
				inflightIds.current.add(entry.uuid);
				const promise = runItem(book, cached).finally(() => {
					inFlight.delete(entry.uuid);
					inflightIds.current.delete(entry.uuid);
				});
				inFlight.set(entry.uuid, promise);
			}
		};

		const loop = async () => {
			try {
				launch();
				prefetchAhead();
				while (!controller.signal.aborted && inFlight.size > 0) {
					await Promise.race(inFlight.values());
					launch();
					prefetchAhead();
				}
			} finally {
				// Only the current run may reset the shared run state, otherwise a
				// stale pump would clear running/slow of the newer run.
				if (runControllerRef.current === controller) {
					runControllerRef.current = null;
					pumpingRef.current = false;
					setRunning(false);
					fastSince.current = null;
					setSlow(false);
					setActiveTasks([]);
				}
				if (restartRequested.current) {
					restartRequested.current = false;
					// Deferred so the restart never recurses into this pump's stack.
					setTimeout(() => pumpQueueRef.current(), 0);
				}
			}
		};

		void loop();
	}, [books, commitQueue, limiter, prefetchAhead, updateTask]);

	useEffect(() => {
		pumpQueueRef.current = pumpQueue;
	}, [pumpQueue]);

	const enqueueDownload = useCallback(
		(bookId: string) => {
			const book = books.find((item) => item.uuid === bookId);
			if (!book) {
				setSnackbar({
					open: true,
					message: "下载失败，教材不存在",
					severity: "error",
				});
				return;
			}
			const existing = queueRef.current.find((item) => item.uuid === bookId);
			if (existing && existing.status !== "failed") {
				// A running book needs no second entry and a finished one is not queued
				// again, so never claim it was just added.
				if (existing.status === "pending") pumpQueue();
				setSnackbar({
					open: true,
					message:
						existing.status === "done"
							? `该教材已下载完成：${book.title}`
							: `该教材已在下载队列中：${book.title}`,
					severity: "info",
				});
				return;
			}
			commitQueue((items) => {
				if (!items.some((item) => item.uuid === bookId))
					return [...items, createQueueItem(book)];
				return items.map((item) =>
					item.uuid === bookId && item.status === "failed"
						? { ...item, status: "pending" as const, error: undefined }
						: item,
				);
			});
			setSnackbar({
				open: true,
				message: `已加入下载队列：${book.title}`,
				severity: "success",
			});
			pumpQueue();
		},
		[books, commitQueue, pumpQueue],
	);

	const enqueueSelected = () => {
		if (selectedBookIds.length === 0) {
			setSnackbar({
				open: true,
				message: "请先选择要下载的教材",
				severity: "error",
			});
			return;
		}
		const queued = new Set(queueRef.current.map((item) => item.uuid));
		const additions = selectedBookIds
			.map((uuid) => books.find((book) => book.uuid === uuid))
			.filter((book): book is Textbook => book !== undefined)
			.filter((book) => !queued.has(book.uuid));
		const retries = new Set(
			selectedBookIds.filter((uuid) =>
				queueRef.current.some(
					(item) => item.uuid === uuid && item.status === "failed",
				),
			),
		);
		if (additions.length === 0 && retries.size === 0) {
			setSnackbar({
				open: true,
				message: "所选教材均已在下载队列中",
				severity: "info",
			});
			pumpQueue();
			return;
		}
		commitQueue((items) => [
			...items.map((item) =>
				retries.has(item.uuid)
					? {
						...item,
						status: "pending" as const,
						error: undefined,
						// Same reset as retryQueueItem: upstream files can change, so
						// drop the remembered part list and re-probe sizes.
						parts: [],
						receivedBytes: 0,
						totalBytes: 0,
					}
					: item,
			),
			...additions.map((book) => createQueueItem(book)),
		]);
		// Report what was really added, not how many rows were ticked.
		setSnackbar({
			open: true,
			message: `已加入下载队列：${additions.length + retries.size} 本`,
			severity: "success",
		});
		pumpQueue();
	};

	const retryQueueItem = (uuid: string) => {
		commitQueue((items) =>
			items.map((item) =>
				item.uuid === uuid
					? {
						...item,
						status: "pending" as const,
						error: undefined,
						// Upstream files can change between attempts: drop the remembered part
						// list so the engine probes sizes again instead of resuming a stale range.
						parts: [],
						receivedBytes: 0,
						totalBytes: 0,
					}
					: item,
			),
		);
		pumpQueue();
	};

	const removeQueueItem = (uuid: string) => {
		// Cancel the running download of exactly this book before forgetting it.
		const controller = itemControllers.current.get(uuid);
		if (controller) {
			// Its run deletes the chunks once the engine has settled.
			itemControllers.current.delete(uuid);
			controller.abort();
		} else {
			// Nothing is writing this uuid, so the store can go right away.
			void deleteChunks(uuid);
		}
		setActiveTasks((previous) => previous.filter((entry) => entry.uuid !== uuid));
		prefetchedParts.current.delete(uuid);
		prefetching.current.delete(uuid);
		setPrefetchingIds((previous) => previous.filter((entry) => entry !== uuid));
		commitQueue((items) => items.filter((item) => item.uuid !== uuid));
	};

	const clearQueue = () => {
		const cleared = queueRef.current;
		const runningIds = new Set(itemControllers.current.keys());
		commitQueue(() => []);
		restartRequested.current = false;
		runControllerRef.current?.abort();
		for (const controller of itemControllers.current.values())
			controller.abort();
		itemControllers.current.clear();
		prefetchController.current?.abort();
		prefetchController.current = null;
		prefetchedParts.current.clear();
		prefetching.current.clear();
		setPrefetchingIds([]);
		inflightIds.current.clear();
		// Aborted runs delete their own chunks; idle entries would keep orphans.
		for (const item of cleared)
			if (!runningIds.has(item.uuid)) void deleteChunks(item.uuid);
	};

	const startQueue = () => pumpQueue();

	const stopQueue = () => runControllerRef.current?.abort();

	const handleConcurrencyChange = (value: number) => {
		const next = Math.max(
			MIN_CONCURRENCY,
			Math.min(MAX_CONCURRENCY, Math.round(value)),
		);
		concurrencyRef.current = next;
		setConcurrency(next);
		writeConcurrency(next);
		limiter.refresh();
	};

	const totalSpeed = useMemo(
		() => activeTasks.reduce((sum, task) => sum + task.bytesPerSecond, 0),
		[activeTasks],
	);

	useEffect(() => {
		speedRef.current = totalSpeed;
	}, [totalSpeed]);

	useEffect(() => {
		runningRef.current = running;
	}, [running]);

	// Keep the slow hint until the speed stays above the threshold for SLOW_RECOVER_MS.
	useEffect(() => {
		const timer = setInterval(() => {
			if (!runningRef.current) {
				fastSince.current = null;
				setSlow(false);
				return;
			}
			const speed = speedRef.current;
			if (speed <= 0) {
				// No throughput at all: idle, not slow, and never latch the hint.
				fastSince.current = null;
				setSlow(false);
				return;
			}
			if (speed >= SLOW_SPEED_BYTES) {
				if (fastSince.current === null) fastSince.current = performance.now();
				if (performance.now() - fastSince.current >= SLOW_RECOVER_MS)
					setSlow(false);
				return;
			}
			fastSince.current = null;
			setSlow(true);
		}, SLOW_CHECK_MS);
		return () => clearInterval(timer);
	}, []);

	const doneCount = queue.filter((item) => item.status === "done").length;

	// Calculate pagination
	const totalPages = Math.ceil(filteredBooks.length / BOOKS_PER_PAGE);
	const startIndex = (currentPage - 1) * BOOKS_PER_PAGE;
	const endIndex = startIndex + BOOKS_PER_PAGE;
	const currentBooks = filteredBooks.slice(startIndex, endIndex);

	if (loading) {
		return (
			<ThemeProvider theme={theme}>
				<CssBaseline />
				<Box
					sx={{
						display: "flex",
						justifyContent: "center",
						alignItems: "center",
						minHeight: "100vh",
						flexDirection: "column",
						px: 2,
					}}
				>
					<CircularProgress size={60} />
					<Typography variant="h6" sx={{ mt: 3, fontWeight: 500 }}>
						正在加载上海教科书数据...
					</Typography>

					{loadingTimeout && (
						<Box
							sx={{
								mt: 3,
								display: "flex",
								flexDirection: "column",
								alignItems: "center",
								gap: 1.5,
								animation: "fadeIn 0.5s ease-in-out",
							}}
						>
							<Typography variant="body2" color="text.secondary">
								响应较慢？当前数据源可能受网络波动影响
							</Typography>
							<Button
								variant="contained"
								color="warning"
								startIcon={<SwapHorizIcon />}
								onClick={() => setSourceDialogOpen(true)}
							>
								切换数据源
							</Button>
						</Box>
					)}
				</Box>
				{sourceDialogOpen && (
					<SourceSwitchDialog
						open={sourceDialogOpen}
						onClose={() => setSourceDialogOpen(false)}
					/>
				)}
			</ThemeProvider>
		);
	}

	if (error) {
		return (
			<ThemeProvider theme={theme}>
				<CssBaseline />
				<Container maxWidth="md" sx={{ py: 6, textAlign: "center" }}>
					<Alert severity="error" sx={{ mb: 3 }}>
						{error}
					</Alert>
					<Box sx={{ display: "flex", gap: 2, justifyContent: "center" }}>
						<Button
							variant="contained"
							color="primary"
							startIcon={<SwapHorizIcon />}
							onClick={() => setSourceDialogOpen(true)}
						>
							换源与测速
						</Button>
						<Button variant="outlined" onClick={fetchBooks}>
							重试
						</Button>
					</Box>
				</Container>
				{sourceDialogOpen && (
					<SourceSwitchDialog
						open={sourceDialogOpen}
						onClose={() => setSourceDialogOpen(false)}
					/>
				)}
			</ThemeProvider>
		);
	}

	return (
		<ThemeProvider theme={theme}>
			<CssBaseline />

			{/* App Bar */}
			<AppBar position="sticky" elevation={2}>
				<Toolbar
					sx={{
						flexWrap: { xs: "wrap", sm: "nowrap" },
						py: { xs: 1, sm: 0 },
						columnGap: { xs: 0.5, sm: 0 },
					}}
				>
					<SchoolIcon sx={{ mr: { xs: 0.5, sm: 2 }, flexShrink: 0 }} />
					<Typography
						variant="h6"
						component="div"
						sx={{
							flexGrow: 1,
							minWidth: 0,
							fontSize: { xs: "1rem", sm: "1.25rem" },
						}}
					>
						上海教科书资源库
					</Typography>
					<Typography
						variant="body2"
						sx={{
							mr: { sm: 2 },
							order: { xs: 1, sm: 0 },
							width: { xs: "100%", sm: "auto" },
							mt: { xs: 0.5, sm: 0 },
							fontSize: { xs: "0.75rem", sm: "0.875rem" },
						}}
					>
						共 {visibleBooks.length} 本教科书
						{viewMode === "grid" && totalPages > 1 && (
							<span>
								{" "}
								• 第 {currentPage} / {totalPages} 页
							</span>
						)}
					</Typography>

					{/* 换源按钮 */}
					<Tooltip title="切换数据源">
						<Button
							color="inherit"
							variant="outlined"
							size="small"
							startIcon={<SpeedIcon />}
							onClick={() => setSourceDialogOpen(true)}
							sx={{
								mr: { xs: 0, sm: 1.5 },
								flexShrink: 0,
								minHeight: { xs: 40, sm: "auto" },
								borderColor: "rgba(255,255,255,0.6)",
								"&:hover": {
									borderColor: "#fff",
									backgroundColor: "rgba(255,255,255,0.1)",
								},
							}}
						>
							换源
						</Button>
					</Tooltip>

					{/* GitHub 仓库菜单 */}
					<IconButton
						color="inherit"
						onClick={handleMenuClick}
						aria-label="GitHub 仓库"
					>
						<GitHubIcon />
					</IconButton>
					<Menu
						slotProps={{
							paper: {
								sx: {
									maxWidth: "calc(100% - 24px)",
									"& .MuiListItemText-secondary": {
										overflowWrap: "anywhere",
										whiteSpace: "normal",
									},
								},
							},
						}}
						anchorEl={anchorEl}
						open={menuOpen}
						onClose={handleMenuClose}
						transformOrigin={{ horizontal: "right", vertical: "top" }}
						anchorOrigin={{ horizontal: "right", vertical: "bottom" }}
					>
						<MenuItem
							onClick={() =>
								handleGitHubOpen(
									"https://github.com/langningchen/shanghai-textbook-server",
								)
							}
						>
							<ListItemIcon>
								<GitHubIcon fontSize="small" />
							</ListItemIcon>
							<ListItemText
								primary="服务器仓库"
								secondary="langningchen/shanghai-textbook-server"
							/>
						</MenuItem>
						<Divider />
						<MenuItem
							onClick={() =>
								handleGitHubOpen(
									"https://github.com/langningchen/shanghai-textbook-data",
								)
							}
						>
							<ListItemIcon>
								<GitHubIcon fontSize="small" />
							</ListItemIcon>
							<ListItemText
								primary="数据仓库"
								secondary="langningchen/shanghai-textbook-data"
							/>
						</MenuItem>
						<Divider />
						<MenuItem
							onClick={() =>
								handleGitHubOpen(
									"https://github.com/langningchen/shanghai-textbook",
								)
							}
						>
							<ListItemIcon>
								<GitHubIcon fontSize="small" />
							</ListItemIcon>
							<ListItemText
								primary="爬虫仓库"
								secondary="langningchen/shanghai-textbook"
							/>
						</MenuItem>
					</Menu>
				</Toolbar>
			</AppBar>

			{/* Main Content */}
			<Container
				maxWidth="xl"
				sx={{ py: { xs: 2, sm: 3 }, px: { xs: 1.5, sm: 3 } }}
			>
				{/* Header */}
				<Box sx={{ mb: { xs: 2, sm: 4 }, textAlign: "center" }}>
					<Typography
						variant="h4"
						component="h1"
						gutterBottom
						sx={{ fontSize: { xs: "1.5rem", sm: "2.125rem" } }}
					>
						上海教科书资源库
					</Typography>
					<Typography variant="body1" color="text.secondary">
						提供上海地区各年级、各学科教科书的在线浏览和下载服务
					</Typography>
				</Box>

				<Box
					sx={{
						display: "flex",
						justifyContent: "space-between",
						alignItems: "center",
						mb: 2,
						gap: 2,
						flexWrap: "wrap",
					}}
				>
					<ToggleButtonGroup
						value={viewMode}
						exclusive
						size="small"
						onChange={handleViewModeChange}
						aria-label="展示方式"
					>
						<ToggleButton value="grid" aria-label="卡片模式">
							<ViewModuleIcon sx={{ mr: 0.5 }} />
							卡片
						</ToggleButton>
						<ToggleButton value="list" aria-label="列表模式">
							<ViewListIcon sx={{ mr: 0.5 }} />
							列表
						</ToggleButton>
					</ToggleButtonGroup>

					{viewMode === "list" && (
						<Button
							variant="contained"
							sx={{
								width: { xs: "100%", sm: "auto" },
								minHeight: { xs: 44, sm: "auto" },
							}}
							startIcon={<DownloadIcon />}
							onClick={enqueueSelected}
							disabled={selectedBookIds.length === 0}
						>
							批量下载 {selectedBookIds.length} 本
						</Button>
					)}
				</Box>

				{/* Card filters */}
				{viewMode === "grid" && (
					<BookFilter
						filters={filters}
						onFiltersChange={handleFiltersChange}
						onClearFilters={() => {
							handleFiltersChange({});
						}}
						books={books}
					/>
				)}

				{/* Results */}
				{visibleBooks.length === 0 ? (
					<Box sx={{ textAlign: "center", py: 8 }}>
						<Typography variant="h6" color="text.secondary">
							没有找到符合条件的教科书
						</Typography>
						<Typography variant="body2" color="text.secondary" sx={{ mt: 1 }}>
							请调整筛选条件后重试
						</Typography>
					</Box>
				) : (
					<>
						{viewMode === "grid" ? (
							<Box
								sx={{
									display: "grid",
									gridTemplateColumns: {
										xs: "repeat(1, 1fr)",
										sm: "repeat(2, 1fr)",
										md: "repeat(3, 1fr)",
										lg: "repeat(4, 1fr)",
									},
									gap: { xs: 1.5, sm: 3 },
									mb: 4,
								}}
							>
								{currentBooks.map((book, index) => {
									const uniqueKey = `${book.uuid}-${book.isbn}-${startIndex + index}`;
									return (
										<BookCard
											key={uniqueKey}
											book={book}
											onDownload={enqueueDownload}
											onShowDetail={handleShowDetail}
										/>
									);
								})}
							</Box>
						) : (
							<BookList
								books={books}
								selectedBookIds={selectedBookIds}
								onSelectionChange={setSelectedBookIds}
								onShowDetail={handleShowDetail}
								onDownload={enqueueDownload}
							/>
						)}

						{/* Pagination */}
						{viewMode === "grid" && totalPages > 1 && (
							<>
								<Box sx={{ display: "flex", justifyContent: "center", mt: 4 }}>
									<Pagination
										count={totalPages}
										page={currentPage}
										onChange={(_, value) => {
											setCurrentPage(value);
											window.scrollTo({ top: 0, behavior: "smooth" });
										}}
										color="primary"
										size={isMobile ? "small" : "large"}
										siblingCount={isMobile ? 0 : 1}
										showFirstButton={!isMobile}
										showLastButton={!isMobile}
										sx={{
											"& .MuiPagination-ul": {
												flexWrap: "wrap",
												justifyContent: "center",
											},
										}}
									/>
								</Box>

								{/* Pagination Info */}
								<Box sx={{ textAlign: "center", mt: 2, mb: 2 }}>
									<Typography variant="body2" color="text.secondary">
										显示第 {startIndex + 1} -
										{Math.min(endIndex, filteredBooks.length)} 本， 共
										{filteredBooks.length} 本教科书
									</Typography>
								</Box>
							</>
						)}
					</>
				)}
			</Container>

			<BookDetailDialog
				open={detailDialogOpen}
				onClose={handleCloseDetail}
				book={detailBook}
				loading={detailLoading}
				onDownload={enqueueDownload}
			/>

			{sourceDialogOpen && (
				<SourceSwitchDialog
					open={sourceDialogOpen}
					onClose={() => setSourceDialogOpen(false)}
				/>
			)}

			<DownloadQueueDialog
				open={queueDialogOpen}
				items={queue}
				tasks={activeTasks}
				running={running}
				slow={slow}
				concurrency={concurrency}
				onClose={() => setQueueDialogOpen(false)}
				onStart={startQueue}
				onStop={stopQueue}
				onRetry={retryQueueItem}
				onRemove={removeQueueItem}
				onClear={clearQueue}
				prefetching={prefetchingIds}
				onSwitchSource={() => {
					setQueueDialogOpen(false);
					setSourceDialogOpen(true);
				}}
				onConcurrencyChange={handleConcurrencyChange}
			/>

			<DownloadQueuePanel
				tasks={activeTasks}
				total={queue.length}
				done={doneCount}
				slow={slow}
				onOpen={() => setQueueDialogOpen(true)}
			/>

			{/* Scroll to Top */}
			{showScrollTop && (
				<Fab
					color="primary"
					size="small"
					onClick={() => window.scrollTo({ top: 0, behavior: "smooth" })}
					sx={{
						position: "fixed",
						bottom: "max(16px, env(safe-area-inset-bottom))",
						right: 16,
						zIndex: 1000,
					}}
				>
					<KeyboardArrowUpIcon />
				</Fab>
			)}

			{/* Snackbar */}
			<Snackbar
				open={snackbar.open}
				autoHideDuration={6000}
				anchorOrigin={{ vertical: "bottom", horizontal: "center" }}
				onClose={() => setSnackbar({ ...snackbar, open: false })}
			>
				<Alert
					onClose={() => setSnackbar({ ...snackbar, open: false })}
					severity={snackbar.severity}
					sx={{ width: "100%" }}
				>
					{snackbar.message}
				</Alert>
			</Snackbar>
		</ThemeProvider>
	);
}
