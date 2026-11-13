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

import { type KeyboardEvent } from "react";

import Box from "@mui/material/Box";
import LinearProgress from "@mui/material/LinearProgress";
import Paper from "@mui/material/Paper";
import Typography from "@mui/material/Typography";

import { type DownloadTask } from "@/utils/downloader";
import { formatSpeed } from "@/utils/helpers";

interface DownloadQueuePanelProps {
	tasks: DownloadTask[];
	total: number;
	done: number;
	slow: boolean;
	onOpen: () => void;
}

// The compact status pill: one click target, so the whole surface is
// focusable and Enter/Space open the queue dialog like a click does.
export default function DownloadQueuePanel({
	tasks,
	total,
	done,
	slow,
	onOpen,
}: DownloadQueuePanelProps) {
	if (total === 0) return null;

	const bytesPerSecond = tasks.reduce(
		(sum, task) => sum + task.bytesPerSecond,
		0,
	);
	const discovering = tasks.some((task) => task.phase === "discovering");
	const percent = Math.min(100, (done / total) * 100);
	const currentTitle = getPanelTitle(tasks);

	const handleKeyDown = (event: KeyboardEvent<HTMLDivElement>) => {
		if (event.key !== "Enter" && event.key !== " ") return;
		event.preventDefault();
		onOpen();
	};

	return (
		<Paper
			elevation={8}
			role="button"
			tabIndex={0}
			aria-label="打开下载队列"
			onClick={onOpen}
			onKeyDown={handleKeyDown}
			sx={{
				position: "fixed",
				bottom: "max(16px, env(safe-area-inset-bottom))",
				left: 16,
				width: 420,
				maxWidth: "calc(100vw - 32px)",
				p: 1.75,
				borderRadius: 2,
				zIndex: 1000,
				cursor: "pointer",
				"&:focus-visible": {
					outline: "2px solid",
					outlineColor: "primary.main",
					outlineOffset: 2,
				},
			}}
		>
			<Box sx={{ display: "flex", justifyContent: "space-between", gap: 1 }}>
				<Typography variant="caption" color="text.secondary">
					下载队列 · {done} / {total} 本
				</Typography>
				<Typography
					variant="caption"
					sx={{ fontWeight: 600, color: "primary.main", flexShrink: 0 }}
				>
					{formatSpeed(bytesPerSecond)}
				</Typography>
			</Box>
			<Typography
				variant="subtitle2"
				title={currentTitle}
				sx={{
					mt: 0.5,
					fontWeight: 500,
					overflow: "hidden",
					textOverflow: "ellipsis",
					whiteSpace: "nowrap",
				}}
			>
				{currentTitle}
			</Typography>
			<LinearProgress
				variant="determinate"
				value={percent}
				sx={{ mt: 1, height: 8, borderRadius: 1 }}
			/>
			<Typography
				variant="caption"
				sx={{
					mt: 0.75,
					display: "block",
					color: slow ? "warning.main" : "text.secondary",
					overflow: "hidden",
					textOverflow: "ellipsis",
					whiteSpace: "nowrap",
				}}
			>
				已完成 {done} / {total} 本
				{discovering && done < total ? " · 正在获取文件信息…" : ""}
			</Typography>
		</Paper>
	);
}

// Extracted so the JSX stays flat: a nested ternary chain inside the
// Typography props is unreadable and renders the same text anyway.
function getPanelTitle(tasks: DownloadTask[]) {
	if (tasks.length === 1) {
		return tasks[0].title;
	}
	if (tasks.length > 1) {
		return "多本同时下载";
	}
	return "等待开始";
}
