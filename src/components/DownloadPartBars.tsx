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

import { useEffect, useRef, useState, memo } from "react";

import Box from "@mui/material/Box";
import { useTheme } from "@mui/material/styles";

import { type DownloadPart } from "@/utils/downloader";

interface DownloadPartBarsProps {
	parts: DownloadPart[];
	height?: number;
	failed?: boolean;
	fetching?: boolean;
}

const samePart = (left: DownloadPart, right: DownloadPart) => {
	if (left.index !== right.index) return false;
	if (left.receivedBytes !== right.receivedBytes) return false;
	if (left.totalBytes !== right.totalBytes) return false;
	if (left.completed !== right.completed) return false;
	const a = left.segments ?? [];
	const b = right.segments ?? [];
	if (a.length !== b.length) return false;
	return a.every((segment, index) => {
		const other = b[index];
		return (
			other !== undefined &&
			segment.start === other.start &&
			segment.end === other.end &&
			segment.received === other.received &&
			segment.done === other.done
		);
	});
};

// A single canvas keeps the row geometry stable: splitting a part into more
// byte segments only repaints pixels; it never adds gaps or new DOM nodes.
function DownloadPartBars({
	parts,
	height = 8,
	failed = false,
	fetching = false,
}: DownloadPartBarsProps) {
	const canvasRef = useRef<HTMLCanvasElement | null>(null);
	const theme = useTheme();
	const [width, setWidth] = useState(0);

	useEffect(() => {
		const canvas = canvasRef.current;
		if (!canvas) return;
		const update = () => setWidth(canvas.clientWidth);
		const frame = requestAnimationFrame(update);
		const observer = new ResizeObserver(update);
		observer.observe(canvas);
		return () => {
			cancelAnimationFrame(frame);
			observer.disconnect();
		};
	}, []);

	useEffect(() => {
		const canvas = canvasRef.current;
		if (!canvas || width <= 0) return;
		const dpr = window.devicePixelRatio || 1;
		canvas.width = Math.round(width * dpr);
		canvas.height = Math.round(height * dpr);
		const context = canvas.getContext("2d");
		if (!context) return;
		context.setTransform(dpr, 0, 0, dpr, 0, 0);
		context.clearRect(0, 0, width, height);
		if (fetching) {
			context.globalAlpha = 0.45;
			context.fillStyle = theme.palette.primary.main;
			context.fillRect(0, 0, width, height);
			context.globalAlpha = 1;
			return;
		}
		context.fillStyle = theme.palette.action.hover;
		context.fillRect(0, 0, width, height);

		const totalBytes = parts.reduce(
			(sum, part) => sum + Math.max(part.totalBytes, 1),
			0,
		);
		let x = 0;
		for (const [partIndex, part] of parts.entries()) {
			const partSpan = (Math.max(part.totalBytes, 1) / totalBytes) * width;
			const segments =
				part.segments && part.segments.length > 0
					? part.segments
					: [
						{
							start: 0,
							end: Math.max(part.totalBytes, 1),
							received: part.receivedBytes,
							done: part.completed,
						},
					];

			// Byte order matters: a later split can append a middle range after wider ones.
			const ordered = [...segments].sort((left, right) => left.start - right.start);
			const partBytes = Math.max(
				part.totalBytes,
				ordered.reduce(
					(sum, segment) => sum + Math.max(segment.end - segment.start, 1),
					0,
				),
				1,
			);
			let segmentX = x;
			for (const [segmentIndex, segment] of ordered.entries()) {
				const segmentSpan =
					(Math.max(segment.end - segment.start, 1) / partBytes) * partSpan;
				const fill = segment.done
					? 1
					: Math.min(
						1,
						segment.received / Math.max(segment.end - segment.start, 1),
					);
				context.fillStyle = theme.palette.action.selected;
				context.fillRect(segmentX, 0, segmentSpan, height);
				context.fillStyle = segment.done
					? theme.palette.success.main
					: failed
						? theme.palette.error.main
						: theme.palette.primary.main;
				context.fillRect(segmentX, 0, segmentSpan * fill, height);
				if (segmentIndex > 0) {
					context.fillStyle = theme.palette.grey[600];
					context.fillRect(segmentX - 0.5, 0, 1, height);
				}
				segmentX += segmentSpan;
			}
			x = segmentX;
			if (partIndex < parts.length - 1) {
				context.fillStyle = theme.palette.divider;
				context.fillRect(x - 1, 0, 2, height);
			}
		}
	}, [parts, failed, fetching, height, theme, width]);


	return (
		<Box sx={{ width: "100%", height, minWidth: 0 }}>
			<canvas
				ref={canvasRef}
				style={{ display: "block", width: "100%", height }}
			/>
		</Box>
	);
}

export default memo(
	DownloadPartBars,
	(previous, next) =>
		previous.height === next.height &&
		previous.failed === next.failed &&
		previous.fetching === next.fetching &&
		previous.parts.length === next.parts.length &&
		previous.parts.every((part, index) => samePart(part, next.parts[index])),
);
