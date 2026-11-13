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

import type { DownloadPart } from "@/utils/downloader";

export type DownloadStatus = "pending" | "downloading" | "failed" | "done";

export interface DownloadQueueItem {
	uuid: string;
	title: string;
	status: DownloadStatus;
	parts: DownloadPart[];
	receivedBytes: number;
	totalBytes: number;
	error?: string;
}

export interface BookRef {
	uuid: string;
	title: string;
}

const QUEUE_KEY = "downloadQueue";
const CONCURRENCY_KEY = "downloadConcurrency";

export const DEFAULT_CONCURRENCY = 5;
// Finished entries are kept as history, but never more than this many.
const MAX_DONE_ITEMS = 50;
const MIN_CONCURRENCY = 1;
const MAX_CONCURRENCY = 32;

const isQueueItem = (value: unknown): value is DownloadQueueItem => {
	if (typeof value !== "object" || value === null) return false;
	const item = value as Partial<DownloadQueueItem>;
	return typeof item.uuid === "string" && typeof item.title === "string";
};

const numberOf = (value: unknown) => {
	const parsed = Number(value);
	return Number.isFinite(parsed) && parsed > 0 ? parsed : 0;
};

const clampConcurrency = (value: number) =>
	Math.max(MIN_CONCURRENCY, Math.min(MAX_CONCURRENCY, Math.round(value)));

const readParts = (value: unknown): DownloadPart[] => {
	if (!Array.isArray(value)) return [];
	return value.flatMap((part) => {
		if (typeof part !== "object" || part === null) return [];
		const item = part as Partial<DownloadPart>;
		if (typeof item.index !== "number") return [];
		return [
			{
				index: item.index,
				receivedBytes: numberOf(item.receivedBytes),
				totalBytes: numberOf(item.totalBytes),
				completed: Boolean(item.completed),
				url: typeof item.url === "string" ? item.url : undefined,
			},
		];
	});
};

// `segments` only describes the live request; persisting it would blow the
// queue up by an order of magnitude.
const compactPart = (part: DownloadPart): DownloadPart => ({
	index: part.index,
	receivedBytes: part.receivedBytes,
	totalBytes: part.totalBytes,
	completed: part.completed,
	url: part.url,
});

// Same stripping, exposed so live queue updates never carry `segments` either.
export const stripPartSegments = (parts: DownloadPart[]): DownloadPart[] =>
	parts.map(compactPart);

export const trimDoneItems = (
	items: DownloadQueueItem[],
): DownloadQueueItem[] => {
	const done = items.filter((item) => item.status === "done");
	const excess = done.length - MAX_DONE_ITEMS;
	if (excess <= 0) return items;
	const dropped = new Set(done.slice(0, excess).map((item) => item.uuid));
	return items.filter((item) => !dropped.has(item.uuid));
};

export function createQueueItem(book: BookRef): DownloadQueueItem {
	return {
		uuid: book.uuid,
		title: book.title,
		status: "pending",
		parts: [],
		receivedBytes: 0,
		totalBytes: 0,
	};
}

export function readDownloadQueue(): DownloadQueueItem[] {
	if (typeof window === "undefined") return [];
	try {
		const parsed: unknown = JSON.parse(
			window.localStorage.getItem(QUEUE_KEY) || "[]",
		);
		if (!Array.isArray(parsed)) return [];
		const items = parsed
			.filter(isQueueItem)
			.map<DownloadQueueItem>((item) => ({
				uuid: item.uuid,
				title: item.title,
				// After a reload only pending / failed / done are meaningful: an
				// interrupted "downloading" entry has to resume as pending.
				status:
					item.status === "done" || item.status === "failed"
						? item.status
						: "pending",
				parts: readParts(item.parts),
				receivedBytes: numberOf(item.receivedBytes),
				totalBytes: numberOf(item.totalBytes),
				error: typeof item.error === "string" ? item.error : undefined,
			}));
		// A duplicated uuid would make removal and progress updates ambiguous.
		const unique = new Map<string, DownloadQueueItem>();
		for (const item of items) unique.set(item.uuid, item);
		return trimDoneItems([...unique.values()]);
	} catch {
		return [];
	}
}

export function writeDownloadQueue(items: DownloadQueueItem[]) {
	if (typeof window === "undefined") return;
	try {
		// Written field by field: `segments` is runtime state and must never be
		// persisted, and a stale extra key would only cost storage quota.
		const compact = trimDoneItems(items).map((item) => ({
			uuid: item.uuid,
			title: item.title,
			status: item.status,
			parts: stripPartSegments(item.parts),
			receivedBytes: item.receivedBytes,
			totalBytes: item.totalBytes,
			error: item.error,
		}));
		window.localStorage.setItem(QUEUE_KEY, JSON.stringify(compact));
	} catch {
		// Storage may be full or blocked, the in-memory queue keeps working.
	}
}

export function readConcurrency(): number {
	if (typeof window === "undefined") return DEFAULT_CONCURRENCY;
	const value = Number(window.localStorage.getItem(CONCURRENCY_KEY));
	if (!Number.isFinite(value) || value <= 0) return DEFAULT_CONCURRENCY;
	return clampConcurrency(value);
}

export function writeConcurrency(value: number) {
	if (typeof window === "undefined") return;
	try {
		window.localStorage.setItem(CONCURRENCY_KEY, String(clampConcurrency(value)));
	} catch {
		// Ignore storage errors, the in-memory value still applies.
	}
}
