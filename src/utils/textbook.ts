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

import { Textbook } from "@/types/textbook";
import { getJsonUrl } from "./url";

export async function fetchTextbookDetail(
	bookId: string,
	signal?: AbortSignal,
): Promise<Textbook> {
	const response = await fetch(getJsonUrl(bookId), { signal });
	if (!response.ok) throw new Error(`HTTP ${response.status}`);
	const result: unknown = await response.json();
	// The repository stores raw textbook objects; also accept older API envelopes.
	const book =
		result && typeof result === "object" && "success" in result
			? result.success && "data" in result
				? result.data
				: null
			: result;
	if (
		!book ||
		typeof book !== "object" ||
		!("uuid" in book) ||
		book.uuid !== bookId ||
		!("title" in book) ||
		typeof book.title !== "string"
	) {
		throw new Error("Invalid textbook detail");
	}
	return book as Textbook;
}
