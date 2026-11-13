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

import { Textbook } from "@/types/textbook";
import { generateFriendlyFilename } from "@/utils/helpers";
import { getPdfPrefix } from "@/utils/url";
import {
	deleteChunks,
	deleteChunksAfter,
	readChunks,
	writeChunk,
	type StoredChunk,
} from "@/utils/downloadStore";

export interface DownloadSegment {
	start: number;
	end: number;
	received: number;
	done: boolean;
}

export interface DownloadPart {
	index: number;
	receivedBytes: number;
	totalBytes: number;
	completed: boolean;
	url?: string;
	segments?: DownloadSegment[];
}

export type DownloadPhase = "discovering" | "downloading";

export interface DownloadProgress {
	phase: DownloadPhase;
	parts: DownloadPart[];
	receivedBytes: number;
	totalBytes: number;
	bytesPerSecond: number;
}

export interface DownloadTask extends DownloadProgress {
	uuid: string;
	title: string;
}

export interface PartInfo {
	url: string;
	size: number;
}

export interface DownloadLease {
	release(): void;
	waitIfPaused(signal: AbortSignal): Promise<boolean>;
}

export interface DownloadLimiter {
	acquire(signal: AbortSignal): Promise<DownloadLease | null>;
	spare(): number;
	refresh(): void;
}

export interface DownloadBookOptions {
	book: Textbook;
	signal: AbortSignal;
	limiter: DownloadLimiter;
	parts?: PartInfo[];
	onProgress?: (progress: DownloadProgress) => void;
	onCheckpoint?: (progress: DownloadProgress) => void;
}

interface LeaseEntry {
	paused: boolean;
	resolvers: Set<() => void>;
}

const MAX_PARTS = 32;
const MAX_CONCURRENCY = 32;
const PROGRESS_INTERVAL_MS = 200;
const HEARTBEAT_MS = 300;
const SPEED_SAMPLE_MS = 500;
const SPLIT_MIN_BYTES = 8 * 1024 * 1024;
const SPLIT_MAX_SEGMENTS = 8;
const FLUSH_BYTES = 1024 * 1024;
const SAVE_GAP_MS = 1200;
const REVOKE_DELAY_MS = 60_000;
const DELETE_DELAY_MS = 60_000;
const FETCH_TIMEOUT_MS = 30_000;
const STALL_TIMEOUT_MS = 30_000;
const SEGMENT_RETRIES = 3;
const RETRY_BASE_MS = 1_000;
const PDF_TYPES = [
	"application/pdf",
	"application/octet-stream",
	"binary/octet-stream",
];

const isPdfType = (type: string | null) => {
	if (!type) return true;
	const base = type.split(";")[0].trim().toLowerCase();
	return PDF_TYPES.includes(base);
};

const isPdfResponse = (response: Response) =>
	isPdfType(response.headers.get("content-type"));

interface ContentRange {
	start: number;
	end: number;
	total: number;
}

const readContentRange = (response: Response): ContentRange | null => {
	const header = response.headers.get("content-range");
	if (!header) return null;
	const match = /^bytes\s+(\d+)-(\d+)\/(\d+|\*)$/i.exec(header.trim());
	if (!match) return null;
	return {
		start: Number(match[1]),
		end: Number(match[2]),
		total: match[3] === "*" ? 0 : Number(match[3]),
	};
};

const abortError = () => new DOMException("下载已暂停", "AbortError");


class TerminalDownloadError extends Error {}

// Raised by split segments that a linear collapse has abandoned; it is a
// deliberate stop, not a download failure.
class CollapsedError extends Error {}

class DownloadTimeoutError extends Error {
	constructor() {
		super("下载超时，数据源长时间没有响应");
		this.name = "DownloadTimeoutError";
	}
}

interface AttemptSignal {
	signal: AbortSignal;
	disarm(): void;
	cleanup(): void;
}

// One request deadline: covers connect and response headers, then disarms so a
// large but steadily streaming body is not cut off by a total-time limit.
const createAttemptSignal = (parent: AbortSignal): AttemptSignal => {
	const controller = new AbortController();
	const onAbort = () => controller.abort(parent.reason);
	if (parent.aborted) controller.abort(parent.reason);
	else parent.addEventListener("abort", onAbort, { once: true });
	const timer = setTimeout(
		() => controller.abort(new DownloadTimeoutError()),
		FETCH_TIMEOUT_MS,
	);
	return {
		signal: controller.signal,
		disarm: () => clearTimeout(timer),
		cleanup: () => {
			clearTimeout(timer);
			parent.removeEventListener("abort", onAbort);
		},
	};
};

// Every chunk read gets its own stall deadline; a hung socket cancels the
// reader instead of pinning the lease forever.
const readChunk = (
	reader: ReadableStreamDefaultReader<Uint8Array>,
	parent: AbortSignal,
) =>
	new Promise<ReadableStreamReadResult<Uint8Array>>((resolve, reject) => {
		const timer = setTimeout(() => {
			finish();
			reader.cancel().catch(() => {});
			reject(new DownloadTimeoutError());
		}, STALL_TIMEOUT_MS);
		function finish() {
			clearTimeout(timer);
			parent.removeEventListener("abort", onAbort);
		}
		function onAbort() {
			finish();
			reject(abortError());
		}
		function settleError(error: unknown) {
			finish();
			reject(error);
		}
		if (parent.aborted) {
			onAbort();
			return;
		}
		parent.addEventListener("abort", onAbort, { once: true });
		reader.read().then(
			(result) => {
				finish();
				resolve(result);
			},
			(error) => settleError(error),
		);
	});

const backoffDelay = (parent: AbortSignal, attempt: number) =>
	new Promise<void>((resolve, reject) => {
		const timer = setTimeout(() => finish(), RETRY_BASE_MS * 2 ** (attempt - 1));
		function finish() {
			clearTimeout(timer);
			parent.removeEventListener("abort", onAbort);
			resolve();
		}
		function onAbort() {
			finish();
			reject(abortError());
		}
		if (parent.aborted) {
			onAbort();
			return;
		}
		parent.addEventListener("abort", onAbort, { once: true });
	});



export function createDownloadLimiter(
	concurrency: () => number,
): DownloadLimiter {
	const entries = new Map<number, LeaseEntry>();
	const waiters: (() => void)[] = [];
	let nextId = 0;
	const limit = () =>
		Math.max(1, Math.min(MAX_CONCURRENCY, Math.round(concurrency())));
	const running = () => {
		let count = 0;
		entries.forEach((entry) => {
			if (!entry.paused) count++;
		});
		return count;
	};
	const waitIfPaused = (entry: LeaseEntry, signal: AbortSignal) => {
		if (signal.aborted) return Promise.resolve(false);
		if (!entry.paused) return Promise.resolve(true);
		return new Promise<boolean>((resolve) => {
			const done = (value: boolean) => {
				entry.resolvers.delete(wake);
				signal.removeEventListener("abort", onAbort);
				resolve(value);
			};
			const wake = () => done(true);
			const onAbort = () => done(false);
			entry.resolvers.add(wake);
			signal.addEventListener("abort", onAbort, { once: true });
		});
	};
	const grant = (): DownloadLease => {
		const id = nextId++;
		const entry: LeaseEntry = { paused: false, resolvers: new Set() };
		entries.set(id, entry);
		return {
			release: () => {
				entries.delete(id);
				pump();
			},
			waitIfPaused: (signal) => waitIfPaused(entry, signal),
		};
	};
	const newestRunning = () => {
		let found: LeaseEntry | undefined;
		entries.forEach((entry) => {
			if (!entry.paused) found = entry;
		});
		return found;
	};
	const oldestPaused = () => {
		for (const entry of entries.values()) if (entry.paused) return entry;
		return undefined;
	};
	const resume = (entry: LeaseEntry) => {
		entry.paused = false;
		entry.resolvers.forEach((resolve) => resolve());
		entry.resolvers.clear();
	};
	// A paused lease still occupies a slot, so capacity is entries.size: the
	// shrink pass pauses by active count, the grow pass resumes frozen leases
	// before handing slots to new acquisitions.
	const pump = () => {
		while (running() > limit()) {
			const entry = newestRunning();
			if (!entry) break;
			entry.paused = true;
		}
		while (running() < limit()) {
			const paused = oldestPaused();
			if (paused) {
				resume(paused);
				continue;
			}
			const waiter = waiters.shift();
			if (!waiter) break;
			waiter();
		}
	};
	return {
		acquire(signal) {
			if (signal.aborted) return Promise.resolve(null);
			if (waiters.length === 0 && entries.size < limit())
				return Promise.resolve(grant());
			return new Promise<DownloadLease | null>((resolve) => {
				const wake = () => {
					signal.removeEventListener("abort", onAbort);
					resolve(grant());
				};
				const onAbort = () => {
					const index = waiters.indexOf(wake);
					if (index >= 0) waiters.splice(index, 1);
					resolve(null);
				};
				waiters.push(wake);
				signal.addEventListener("abort", onAbort, { once: true });
				pump();
			});
		},
		spare() {
			return Math.max(0, limit() - entries.size);
		},
		refresh() {
			pump();
		},
	};
}

const createSpeedMeter = () => {
	let total = 0;
	let windowTotal = 0;
	let windowStart = performance.now();
	let speed = 0;
	return {
		add(bytes: number) {
			total += bytes;
		},
		value() {
			const now = performance.now();
			const span = now - windowStart;
			if (span < SPEED_SAMPLE_MS) return Math.round(speed);
			const rate = Math.max(0, ((total - windowTotal) / span) * 1000);
			speed = speed === 0 ? rate : speed * 0.6 + rate * 0.4;
			windowTotal = total;
			windowStart = now;
			return Math.round(speed);
		},
	};
};


const probeUrl = async (url: string, signal: AbortSignal) => {
	const headAttempt = createAttemptSignal(signal);
	try {
		const head = await fetch(url, {
			method: "HEAD",
			signal: headAttempt.signal,
		});
		headAttempt.disarm();
		const size = head.ok
			? Number(head.headers.get("content-length")) || 0
			: 0;
		if (size > 0 && isPdfType(head.headers.get("content-type"))) return size;
	} finally {
		headAttempt.cleanup();
	}
	// Many mirrors answer HEAD poorly, so probe an actual first byte range.
	const rangeAttempt = createAttemptSignal(signal);
	try {
		const response = await fetch(url, {
			headers: { Range: "bytes=0-0" },
			signal: rangeAttempt.signal,
		});
		rangeAttempt.disarm();
		let size = -1;
		if (response.ok && isPdfResponse(response)) {
			const range = readContentRange(response);
			if (range && range.total > 0) size = range.total;
			else if (response.status === 200) {
				// Only a 200 carries the full length; a 206 reports the slice.
				const length = Number(response.headers.get("content-length")) || 0;
				if (length > 0) size = length;
			}
		}
		await response.body?.cancel().catch(() => {});
		return size;
	} finally {
		rangeAttempt.cleanup();
	}
};


export async function discoverBookParts(
	book: Textbook,
	signal: AbortSignal,
): Promise<PartInfo[]> {
	const base = getPdfPrefix(book.uuid);
	const parts: PartInfo[] = [];
	const baseSize = await probeUrl(base, signal);
	if (baseSize > 0) parts.push({ url: base, size: baseSize });
	let index = 1;
	while (parts.length < MAX_PARTS) {
		const url = `${base}.${index}`;
		const size = await probeUrl(url, signal);
		if (size <= 0) return parts;
		parts.push({ url, size });
		index += 1;
	}
	// The next part existing means the cap would silently ship a truncated PDF.
	if ((await probeUrl(`${base}.${index}`, signal)) > 0)
		throw new Error("下载失败，分片数量超过上限，请尝试换源");
	return parts;
}

interface Segment {
	start: number;
	end: number;
	received: number;
	chunks: BlobPart[];
	flushed: number;
	done: boolean;
	cancelled: boolean;
	workers: number;
	cancelReader?: () => void;
}

interface PartTask {
	url: string;
	index: number;
	size: number;
	receivedBytes: number;
	completed: boolean;
	storedEnd: number;
	segments: Segment[];
}

const bucketByIndex = (chunks: StoredChunk[]) => {
	const buckets = new Map<number, StoredChunk[]>();
	for (const chunk of chunks) {
		const bucket = buckets.get(chunk.index);
		if (bucket) bucket.push(chunk);
		else buckets.set(chunk.index, [chunk]);
	}
	return buckets;
};

const storedEndForTask = (chunks: StoredChunk[]) => {
	let end = 0;
	for (const chunk of chunks) {
		if (chunk.offset !== end) continue;
		end += chunk.blob.size;
	}
	return end;
};

interface PartContext {
	uuid: string;
	task: PartTask;
	signal: AbortSignal;
	meter: ReturnType<typeof createSpeedMeter>;
	limiter: DownloadLimiter;
	redraw: () => void;
}


const downloadPart = async (context: PartContext) => {
	const { uuid, task, signal, meter, limiter, redraw } = context;
	if (task.size > 0 && task.storedEnd >= task.size) {
		task.receivedBytes = task.storedEnd;
		task.completed = true;
		return;
	}

	const knownSize = task.size > 0;
	const segments: Segment[] = [
		{
			start: task.storedEnd,
			end: knownSize ? task.size : Number.POSITIVE_INFINITY,
			received: 0,
			chunks: [],
			flushed: 0,
			done: false,
			cancelled: false,
			workers: 0,
		},
	];
	task.segments = segments;

	const partController = new AbortController();
	const partSignal = partController.signal;
	const forwardAbort = () => partController.abort();
	if (signal.aborted) partController.abort();
	else signal.addEventListener("abort", forwardAbort, { once: true });

	let firstError: unknown = null;
	let received = task.storedEnd;
	let lastFlush = task.storedEnd;
	let persistChain: Promise<void> = Promise.resolve();
	let rangeUnsupported = false;

	const fail = (error: unknown) => {
		if (!firstError) firstError = error;
		partController.abort();
	};

	const flush = (force = false) => {
		const pendingBytes = received - lastFlush;
		if (!force && pendingBytes < FLUSH_BYTES) return;
		lastFlush = received;
		persistChain = persistChain
			.then(async () => {
				if (pruneBarrier) await pruneBarrier;
				for (const segment of segments) {
					const batch = segment.chunks;
					if (batch.length === 0) continue;
					segment.chunks = [];
					const offset = segment.start + segment.flushed;
					const blob = new Blob(batch);
					const chunkTotal = knownSize
						? task.size
						: offset + blob.size;
					try {
						await writeChunk({
							uuid,
							index: task.index,
							offset,
							blob,
							totalBytes: chunkTotal,
						});
						segment.flushed += blob.size;
					} catch {
						// Put the batch back so the next flush retries it in order.
						segment.chunks = [...batch, ...segment.chunks];
					}
				}
			})
			.catch(() => {});
	};

	let collapsing = false;
	let pruneBarrier: Promise<void> | null = null;

	const collapseToLinear = () => {
		if (collapsing) return;
		collapsing = true;
		const keep = segments[0];
		if (segments.length <= 1) return;
		const keepEnd = keep.start + keep.received;
		for (const segment of segments.slice(1)) {
			segment.cancelled = true;
			segment.cancelReader?.();
			segment.chunks = [];
			segment.flushed = 0;
		}
		segments.length = 0;
		segments.push(keep);
		task.segments = segments;
		keep.done = false;
		keep.end = knownSize ? task.size : Number.POSITIVE_INFINITY;
		received = keep.start + keep.received;
		lastFlush = keep.start + keep.flushed;
		task.receivedBytes = received;
		redraw();
		// Everything at or above the kept prefix belongs to abandoned splits and
		// would collide with the linear rewrite, so drop it before it continues.
		pruneBarrier = deleteChunksAfter(uuid, task.index, keepEnd - 1)
			.catch(() => {})
			.finally(() => {
				pruneBarrier = null;
			});
		if (keep.workers === 0 || keep.done) startSegment(keep, false);
	};

	const maybeSplit = () => {
		if (firstError || signal.aborted || partSignal.aborted) return;
		if (!knownSize || rangeUnsupported) return;
		if (segments.length >= SPLIT_MAX_SEGMENTS) return;
		if (limiter.spare() <= 0) return;
		let target: Segment | null = null;
		let targetRemaining = 0;
		for (const segment of segments) {
			if (segment.done || segment.end === Number.POSITIVE_INFINITY) continue;
			const remaining = segment.end - (segment.start + segment.received);
			if (remaining <= SPLIT_MIN_BYTES) continue;
			if (remaining > targetRemaining) {
				target = segment;
				targetRemaining = remaining;
			}
		}
		if (!target) return;
		const position = target.start + target.received;
		const mid = position + Math.floor(targetRemaining / 2);
		if (mid <= position) return;
		const next: Segment = {
			start: mid,
			end: target.end,
			received: 0,
			chunks: [],
			flushed: 0,
			done: false,
			cancelled: false,
			workers: 0,
		};
		target.end = mid;
		segments.push(next);
		task.segments = segments;
		startSegment(next);
	};

	const active = new Set<Promise<void>>();

	const startSegment = (segment: Segment, fresh = true) => {
		const promise = (async () => {
			const lease = await limiter.acquire(partSignal);
			if (!lease) return;
			if (fresh) {
				segment.chunks = [];
				segment.flushed = 0;
			}
			let retries = 0;
			let cancelReader: (() => void) | undefined;
			try {
				if (segment.start >= segment.end) {
					segment.done = true;
					return;
				}
				while (!segment.done) {
					if (signal.aborted) throw abortError();
					if (segment.cancelled) throw new CollapsedError();
					if (firstError) throw new Error("下载失败，其余分片已停止");
					const allowed = await lease.waitIfPaused(partSignal);
					if (!allowed) throw abortError();
					const from = segment.start + segment.received;
					if (from >= segment.end) {
						segment.done = true;
						break;
					}
					const rangeEnd =
						segment.end === Number.POSITIVE_INFINITY
							? ""
							: segment.end - 1;
					const attempt = createAttemptSignal(partSignal);
					let reader: ReadableStreamDefaultReader<Uint8Array> | undefined;
					let attemptError: unknown = null;
					try {
						const response = await fetch(task.url, {
							headers: { Range: `bytes=${from}-${rangeEnd}` },
							signal: attempt.signal,
						});
						attempt.disarm();
						if (response.status === 416) {
							if (
								segment.end === Number.POSITIVE_INFINITY &&
								segment.received > 0
							) {
								segment.done = true;
								break;
							}
							throw new TerminalDownloadError(
								"下载失败，数据源上的文件比预期短，请尝试换源",
							);
						}
						if (!response.ok)
							throw new TerminalDownloadError(
								"下载失败，文件不可访问，请尝试换源",
							);
						if (!isPdfResponse(response))
							throw new TerminalDownloadError(
								"下载失败，数据源返回了非文件内容，请尝试换源",
							);
						const range = readContentRange(response);
						const ranged = response.status === 206 && range !== null;
						if (!ranged) {
							rangeUnsupported = true;
							// A 206 without Content-Range cannot be located unless it
							// starts at zero, which is the only safe linear fallback.
							if (response.status !== 200 && from > 0)
								throw new TerminalDownloadError(
									"下载失败，数据源返回了无法校验的分片范围，请尝试换源",
								);
							const isKeeper = segment === segments[0];
							collapseToLinear();
							if (!isKeeper) throw new CollapsedError();
						}
						if (ranged) {
							if (range.start !== from)
								throw new Error(
									"下载失败，数据源返回的分片范围不正确，请尝试换源",
								);
							if (task.size > 0 && range.total !== task.size)
								throw new Error(
									"下载失败，数据源上的文件大小与预期不一致，请尝试换源",
								);
							if (
								segment.end !== Number.POSITIVE_INFINITY &&
								range.end !== segment.end - 1
							)
								throw new Error(
									"下载失败，数据源返回的分片范围不正确，请尝试换源",
								);
						}
						reader = response.body?.getReader();
						if (!reader)
							throw new TerminalDownloadError("下载失败，无法读取文件流");
						const ownedReader = reader;
						const cancel = () => {
							ownedReader.cancel().catch(() => {});
						};
						segment.cancelReader = cancel;
						let skip = ranged ? 0 : from;
						let position = from;
						let lastByteAt = performance.now();
						while (position < segment.end) {
							if (signal.aborted) throw abortError();
							if (segment.cancelled) throw new CollapsedError();
							if (firstError) throw new Error("下载失败，其余分片已停止");
							if (performance.now() - lastByteAt > STALL_TIMEOUT_MS)
								throw new DownloadTimeoutError();
							const result = await readChunk(ownedReader, attempt.signal);
							if (result.done) break;
							// Bytes consumed while skipping a full-body prefix still count
							// as progress, otherwise a long skip trips the stall watchdog.
							lastByteAt = performance.now();
							let chunk: Uint8Array = result.value;
							if (skip > 0) {
								const dropped = Math.min(skip, chunk.length);
								skip -= dropped;
								if (dropped >= chunk.length) continue;
								chunk = chunk.subarray(dropped);
							}
							if (position + chunk.length > segment.end)
								chunk = chunk.subarray(
									0,
									Math.max(0, segment.end - position),
								);
							if (chunk.length === 0) continue;
							segment.chunks.push(chunk as BlobPart);
							position += chunk.length;
							segment.received = position - segment.start;
							received += chunk.length;
							task.receivedBytes = received;
							meter.add(chunk.length);
							lastByteAt = performance.now();
							redraw();
							flush();
							maybeSplit();
						}
						if (segment.cancelled) throw new CollapsedError();
						if (skip > 0)
							throw new TerminalDownloadError(
								"下载失败，数据源返回内容过短，请尝试换源",
							);
						if (
							segment.end !== Number.POSITIVE_INFINITY &&
							position < segment.end
						)
							throw new Error("下载失败，分片数据不完整，请重试");
						if (
							segment.end === Number.POSITIVE_INFINITY &&
							segment.received <= 0
						)
							throw new TerminalDownloadError(
								"下载失败，数据源没有返回任何数据，请尝试换源",
							);
						segment.done = true;
						flush();
					} catch (error) {
						attemptError = error;
					} finally {
						if (cancelReader && segment.cancelReader === cancelReader)
							segment.cancelReader = undefined;
						attempt.cleanup();
						await reader?.cancel().catch(() => {});
					}
					if (attemptError === null) break;
					if (signal.aborted) throw abortError();
					if (segment.cancelled) throw new CollapsedError();
					if (firstError) throw attemptError;
					if (attemptError instanceof CollapsedError) throw attemptError;
					if (attemptError instanceof TerminalDownloadError)
						throw attemptError;
					retries += 1;
					if (retries > SEGMENT_RETRIES) throw attemptError;
					await backoffDelay(partSignal, retries);
				}
			} catch (error) {
				if (!signal.aborted && !(error instanceof CollapsedError))
					fail(error);
				throw error;
			} finally {
				lease.release();
			}
		})();
		segment.workers += 1;
		active.add(promise);
		const settle = () => {
			segment.workers -= 1;
			active.delete(promise);
		};
		promise.then(settle, settle);
	};

	try {
		startSegment(segments[0]);
		while (active.size > 0 && !firstError && !signal.aborted) {
			await Promise.race(active).catch(() => {});
		}
		await Promise.allSettled(active);
		flush(true);
		await persistChain;
		if (signal.aborted) throw abortError();
		if (firstError) throw firstError;
		if (!segments.every((segment) => segment.done))
			throw new Error("下载失败，分片数据不完整，请重试");
		task.receivedBytes = received;
		task.completed = true;
		redraw();
	} finally {
		signal.removeEventListener("abort", forwardAbort);
	}
};

let lastSaveAt = 0;
let saveChain: Promise<void> = Promise.resolve();

// Guard delayed chunk deletion against a newer download of the same book.
const completedGenerations = new Map<string, number>();
const deleteTimers = new Map<string, ReturnType<typeof setTimeout>>();

const saveDownload = (blob: Blob, filename: string) => {
	const run = saveChain.then(async () => {
		const wait = Math.max(0, SAVE_GAP_MS - (performance.now() - lastSaveAt));
		if (wait > 0) await new Promise((resolve) => setTimeout(resolve, wait));
		lastSaveAt = performance.now();
		const url = URL.createObjectURL(blob);
		const link = document.createElement("a");
		link.href = url;
		link.download = filename;
		document.body.appendChild(link);
		link.click();
		link.remove();
		setTimeout(() => URL.revokeObjectURL(url), REVOKE_DELAY_MS);
	});
	saveChain = run.catch(() => {});
	return run;
};

export async function downloadBook({
	book,
	signal,
	limiter,
	parts,
	onProgress,
	onCheckpoint,
}: DownloadBookOptions): Promise<void> {
	// A new attempt cancels the previous completion's pending deletion; the
	// generation only moves forward once this attempt actually completes, so a
	// failed retry cannot invalidate the previous run's cleanup.
	const pendingDelete = deleteTimers.get(book.uuid);
	if (pendingDelete !== undefined) {
		clearTimeout(pendingDelete);
		deleteTimers.delete(book.uuid);
	}
	if (!parts || parts.length === 0)
		onProgress?.({
			phase: "discovering",
			parts: [],
			receivedBytes: 0,
			totalBytes: 0,
			bytesPerSecond: 0,
		});
	const discovered =
		parts && parts.length > 0 ? parts : await discoverBookParts(book, signal);
	if (discovered.length === 0)
		throw new Error("下载失败，文件不存在或数据源不可访问，请尝试换源");

	const storedBuckets = bucketByIndex(await readChunks(book.uuid));
	const tasks: PartTask[] = [];
	for (let index = 0; index < discovered.length; index++) {
		if (signal.aborted) throw abortError();
		const part = discovered[index];
		const stored = storedEndForTask(storedBuckets.get(index) ?? []);
		const completed = part.size > 0 && stored >= part.size;
		// Interrupted split downloads leave chunks above the contiguous
		// prefix whose offsets no longer match a linear resume.
		if (!completed) await deleteChunksAfter(book.uuid, index, stored);
		tasks.push({
			url: part.url,
			index,
			size: part.size,
			receivedBytes: stored,
			completed,
			storedEnd: stored,
			segments: [],
		});
	}

	const knownTotal = tasks.every((task) => task.size > 0);
	const meter = createSpeedMeter();

	const buildProgress = (): DownloadProgress => {
		const received = tasks.reduce(
			(sum, task) => sum + task.receivedBytes,
			0,
		);
		const totalBytes = knownTotal
			? tasks.reduce(
				(sum, task) => sum + Math.max(task.size, task.receivedBytes),
				0,
			)
			: received;
		return {
			phase: "downloading",
			parts: tasks.map((task) => ({
				index: task.index,
				receivedBytes: task.receivedBytes,
				totalBytes: Math.max(task.size, task.receivedBytes),
				completed: task.completed,
				url: task.url,
				segments: task.segments.map((segment) => ({
					start: segment.start,
					end:
						segment.end === Number.POSITIVE_INFINITY
							? segment.start + segment.received
							: segment.end,
					received: segment.received,
					done: segment.done,
				})),
			})),
			receivedBytes: received,
			totalBytes,
			bytesPerSecond: meter.value(),
		};
	};

	let dirty = false;
	const markDirty = () => {
		dirty = true;
	};
	const publish = (persist: boolean) => {
		const progress = buildProgress();
		onProgress?.(progress);
		if (persist) onCheckpoint?.(progress);
	};
	const progressTimer = setInterval(() => {
		if (!dirty) return;
		dirty = false;
		publish(true);
	}, PROGRESS_INTERVAL_MS);
	const heartbeatTimer = setInterval(() => publish(false), HEARTBEAT_MS);
	publish(false);

	let results: PromiseSettledResult<void>[] = [];
	try {
		results = await Promise.allSettled(
			tasks.map((task) =>
				downloadPart({
					uuid: book.uuid,
					task,
					signal,
					meter,
					limiter,
					redraw: markDirty,
				}),
			),
		);
	} finally {
		clearInterval(progressTimer);
		clearInterval(heartbeatTimer);
	}
	if (signal.aborted) throw abortError();
	const failure = results.find((result) => result.status === "rejected");
	if (failure && failure.status === "rejected") throw failure.reason;

	const assembledBuckets = bucketByIndex(await readChunks(book.uuid));
	const blobParts: BlobPart[] = [];
	for (let index = 0; index < tasks.length; index++) {
		const task = tasks[index];
		const owned = (assembledBuckets.get(index) ?? []).sort(
			(left, right) => left.offset - right.offset,
		);
		let end = 0;
		let recordedTotal = 0;
		for (const chunk of owned) {
			if (task.size > 0 && end >= task.size) break;
			if (chunk.offset !== end)
				throw new Error("下载失败，文件不完整，请重试");
			blobParts.push(chunk.blob);
			end += chunk.blob.size;
			recordedTotal = Math.max(recordedTotal, chunk.totalBytes);
		}
		if (end <= 0) throw new Error("下载失败，文件不完整，请重试");
		if (task.size > 0) {
			if (end !== task.size)
				throw new Error("下载失败，文件长度与数据源不一致，请重试");
		} else if (end !== recordedTotal) {
			// Unknown length: the chunks themselves are the only size witness.
			throw new Error("下载失败，文件不完整，请重试");
		}
		tasks[index].receivedBytes = end;
	}

	const blob = new Blob(blobParts, { type: "application/pdf" });
	await saveDownload(blob, generateFriendlyFilename(book));
	publish(true);
	const generation = (completedGenerations.get(book.uuid) ?? 0) + 1;
	completedGenerations.set(book.uuid, generation);
	const timer = setTimeout(() => {
		deleteTimers.delete(book.uuid);
		// Only the newest completed download of this uuid may clear the store;
		// a newer generation (or a restarted download) cancels this first.
		if (completedGenerations.get(book.uuid) !== generation) return;
		completedGenerations.delete(book.uuid);
		void deleteChunks(book.uuid);
	}, DELETE_DELAY_MS);
	deleteTimers.set(book.uuid, timer);
}
