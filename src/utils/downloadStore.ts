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

export interface StoredChunk {
	uuid: string;
	index: number;
	offset: number;
	blob: Blob;
	totalBytes: number;
}

const DB_NAME = "textbook-downloads";
const STORE_NAME = "chunks";
// Version 2 removes the legacy `parts` store created by older builds.
const DB_VERSION = 2;

const indexPrefix = (uuid: string, index: number) =>
	`${uuid}:${String(index).padStart(4, "0")}:`;

const chunkKey = (chunk: StoredChunk) =>
	indexPrefix(chunk.uuid, chunk.index) +
		String(chunk.offset).padStart(12, "0");

// Keys are `${uuid}:${paddedIndex}:${paddedOffset}`. A whole-book range
// must keep the trailing colon: `${uuid}::` sorts above `${uuid}:0000:`
// because ':' > '0', which would make every lookup return no rows.
const keyRange = (uuid: string, index?: number) => {
	const prefix =
		index === undefined ? `${uuid}:` : indexPrefix(uuid, index);
	return IDBKeyRange.bound(prefix, `${prefix}\uffff`);
};

// Fallback copy, kept only while IndexedDB is unavailable or a write
// failed, so a download can still resume inside this session.
const memory = new Map<string, StoredChunk>();
let database: Promise<IDBDatabase | null> | null = null;

function openDatabase(): Promise<IDBDatabase | null> {
	if (typeof indexedDB === "undefined") return Promise.resolve(null);
	if (database) return database;
	let settled = false;
	const promise = new Promise<IDBDatabase | null>((resolve) => {
		const finish = (value: IDBDatabase | null) => {
			if (settled) {
				value?.close();
				return;
			}
			settled = true;
			resolve(value);
		};
		try {
			const request = indexedDB.open(DB_NAME, DB_VERSION);
			request.onupgradeneeded = () => {
				const db = request.result;
				if (!db.objectStoreNames.contains(STORE_NAME))
					db.createObjectStore(STORE_NAME);
				try {
					if (db.objectStoreNames.contains("parts"))
						db.deleteObjectStore("parts");
				} catch {
					// A blocking connection can veto the store removal.
				}
			};
			request.onsuccess = () => {
				const db = request.result;
				db.onversionchange = () => db.close();
				finish(db);
			};
			request.onerror = () => finish(null);
			request.onblocked = () => finish(null);
		} catch {
			finish(null);
		}
	}).then((db) => {
		// Never cache a failed open: the next call retries instead of falling
		// back to memory for the whole session.
		if (!db) database = null;
		return db;
	});
	database = promise;
	return promise;
}

function runRequest<T>(
	mode: IDBTransactionMode,
	action: (store: IDBObjectStore) => IDBRequest<T>,
): Promise<T | null> {
	return openDatabase().then((db) =>
		db
			? new Promise<T | null>((resolve, reject) => {
				const request = action(
					db.transaction(STORE_NAME, mode).objectStore(STORE_NAME),
				);
				request.onsuccess = () => resolve(request.result);
				request.onerror = () => reject(request.error);
			})
			: Promise.resolve(null),
		);
}

export async function writeChunk(chunk: StoredChunk): Promise<void> {
	const key = chunkKey(chunk);
	memory.set(key, chunk);
	try {
		const stored = await runRequest(
			"readwrite",
			(store) => store.put(chunk, key),
		);
		// Only drop the fallback copy when the write really reached IDB.
		if (stored !== null) memory.delete(key);
	} catch {
		// Keep the memory copy so the download still resumes in this session.
	}
}

export async function readChunks(uuid: string): Promise<StoredChunk[]> {
	let stored: StoredChunk[] = [];
	try {
		const all = await runRequest<StoredChunk[]>("readonly", (store) =>
			store.getAll(keyRange(uuid)),
		);
		if (all) stored = all;
	} catch {
		stored = [];
	}
	const merged = new Map<string, StoredChunk>();
	for (const chunk of stored) merged.set(chunkKey(chunk), chunk);
	for (const [key, chunk] of memory)
		if (chunk.uuid === uuid) merged.set(key, chunk);
	return [...merged.values()].sort((left, right) =>
		left.index === right.index
			? left.offset - right.offset
			: left.index - right.index,
	);
}

export async function deleteChunks(uuid: string): Promise<void> {
	for (const [key, chunk] of memory) if (chunk.uuid === uuid) memory.delete(key);
	try {
		const keys = await runRequest<IDBValidKey[]>("readonly", (store) =>
			store.getAllKeys(keyRange(uuid)),
		);
		if (!keys || keys.length === 0) return;
		await runRequest("readwrite", (store) => {
			keys.forEach((key) => store.delete(key));
			return store.count();
		});
	} catch {
		// Memory entries are already cleared; nothing else to do.
	}
}

// Drops chunks written past the contiguous prefix of one part. A download
// interrupted mid-split leaves chunks at high offsets whose boundaries no
// longer line up with the linear resume, so they must go before rewriting.
export async function deleteChunksAfter(
	uuid: string,
	index: number,
	offset: number,
): Promise<void> {
	for (const [key, chunk] of memory)
		if (chunk.uuid === uuid && chunk.index === index && chunk.offset > offset)
			memory.delete(key);
	try {
		const keys = await runRequest<IDBValidKey[]>("readonly", (store) =>
			store.getAllKeys(keyRange(uuid, index)),
		);
		if (!keys || keys.length === 0) return;
		const prefix = indexPrefix(uuid, index);
		const stale = keys.filter((key) => {
			const value = Number(String(key).slice(prefix.length));
			return Number.isFinite(value) && value > offset;
		});
		if (stale.length === 0) return;
		await runRequest("readwrite", (store) => {
			stale.forEach((key) => store.delete(key));
			return store.count();
		});
	} catch {
		// Memory entries are gone; later linear writes replace the IDB copies.
	}
}
