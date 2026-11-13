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

import { useEffect, useMemo, useRef } from "react";

import { useVirtualizer } from "@tanstack/react-virtual";

import Alert from "@mui/material/Alert";
import Box from "@mui/material/Box";
import Button from "@mui/material/Button";
import Dialog from "@mui/material/Dialog";
import DialogContent from "@mui/material/DialogContent";
import DialogTitle from "@mui/material/DialogTitle";
import IconButton from "@mui/material/IconButton";
import TextField from "@mui/material/TextField";
import Tooltip from "@mui/material/Tooltip";
import Typography from "@mui/material/Typography";
import { useTheme } from "@mui/material/styles";
import CloseIcon from "@mui/icons-material/Close";
import DeleteIcon from "@mui/icons-material/Delete";
import RefreshIcon from "@mui/icons-material/Refresh";

import DownloadPartBars from "@/components/DownloadPartBars";
import RotatingAlert, {
	type RotatingAlertItem,
} from "@/components/RotatingAlert";
import { type DownloadQueueItem } from "@/utils/downloadQueue";
import { type DownloadPart, type DownloadTask } from "@/utils/downloader";
import { formatBytes, formatSpeed } from "@/utils/helpers";
import { DOWNLOAD_TIPS } from "@/utils/constants";

interface DownloadQueueDialogProps {
	open: boolean;
	items: DownloadQueueItem[];
	tasks: DownloadTask[];
	running: boolean;
	slow: boolean;
	concurrency: number;
	prefetching: string[];
	onClose: () => void;
	onStart: () => void;
	onStop: () => void;
	onRetry: (uuid: string) => void;
	onRemove: (uuid: string) => void;
	onClear: () => void;
	onConcurrencyChange: (value: number) => void;
	onSwitchSource: () => void;
}

const ROW_HEIGHT = 60;
const BUTTON_SX = { minWidth: 96, height: 40 } as const;
const MIN_CONCURRENCY = 1;
const MAX_CONCURRENCY = 32;

type RowTone = "error" | "success" | "fetching" | "ready" | "plain";

interface RowState {
	parts: DownloadPart[];
	fetching: boolean;
	text: string;
	tone: RowTone;
}

const percentOf = (receivedBytes: number, totalBytes: number) =>
	totalBytes > 0
		? Math.min(100, Math.round((receivedBytes / totalBytes) * 100))
		: 0;

// Row text and tone in one place: the JSX below then needs no ternary chain,
// which is what made the row height and ordering hard to reason about.
const describeRow = (
	item: DownloadQueueItem,
	task: DownloadTask | null,
	prefetching: string[],
): RowState => {
	const parts = task?.parts ?? item.parts;
	const fetching =
		task?.phase === "discovering" ||
		(item.status === "pending" && prefetching.includes(item.uuid));
	if (item.status === "done") {
		return { parts, fetching, text: "已完成", tone: "success" };
	}
	if (item.status === "failed") {
		return { parts, fetching, text: "失败", tone: "error" };
	}
	if (fetching) {
		return { parts, fetching, text: "正在获取信息…", tone: "fetching" };
	}
	if (task) {
		const percent = percentOf(task.receivedBytes, task.totalBytes);
		return {
			parts,
			fetching,
			text: `${percent}% · ${formatSpeed(task.bytesPerSecond)}`,
			tone: "plain",
		};
	}
	if (item.status === "pending" && parts.length > 0) {
		return { parts, fetching, text: "已获取信息", tone: "ready" };
	}
	return { parts, fetching, text: "等待", tone: "plain" };
};

const describeQueue = (
	tasks: DownloadTask[],
	itemCount: number,
	done: number,
	receivedBytes: number,
	totalBytes: number,
	bytesPerSecond: number,
) => {
	if (tasks.length > 0) {
		return `${formatBytes(receivedBytes)} / ${formatBytes(totalBytes)} · ${formatSpeed(bytesPerSecond)}`;
	}
	if (done > 0) {
		return `已完成 ${done} / ${itemCount} 本`;
	}
	return "当前没有进行中的下载";
};

export default function DownloadQueueDialog({
	open,
	items,
	tasks,
	running,
	slow,
	concurrency,
	prefetching,
	onClose,
	onStart,
	onStop,
	onRetry,
	onRemove,
	onClear,
	onConcurrencyChange,
	onSwitchSource,
}: DownloadQueueDialogProps) {
	const theme = useTheme();
	// Semantic text tokens instead of hard-coded grey steps: they already carry
	// the palette decision, so the light theme stays readable and a dark palette
	// needs no second branch in this file.
	const toneColor: Record<RowTone, string> = {
		error: theme.palette.error.main,
		success: theme.palette.success.main,
		fetching: theme.palette.text.secondary,
		ready: theme.palette.text.disabled,
		plain: theme.palette.text.secondary,
	};
	const scrollRef = useRef<HTMLDivElement | null>(null);
	// The concurrency field is uncontrolled: defaultValue only seeds what is
	// shown. Without this flag an unedited field would echo the stale text back
	// to the page on blur and overwrite the real concurrency.
	const concurrencyEditedRef = useRef(false);
	// Holds the DOM input so the uncontrolled field can be re-seeded when the
	// page publishes a new concurrency (e.g. after hydration) without remounting
	// the field and throwing away what the user is currently typing.
	const concurrencyInputRef = useRef<HTMLInputElement | null>(null);
	// TanStack Virtual is a headless store; the compiler cannot analyse it.
	// eslint-disable-next-line react-hooks/incompatible-library
	const virtualizer = useVirtualizer({
		count: items.length,
		getScrollElement: () => scrollRef.current,
		estimateSize: () => ROW_HEIGHT,
		overscan: 6,
	});

	useEffect(() => {
		if (!open) {
			// A closed dialog never fires onBlur, so drop any pending edit flag.
			concurrencyEditedRef.current = false;
			return;
		}
		const node = scrollRef.current;
		if (node) node.scrollTop = 0;
		virtualizer.measure();
	}, [open, virtualizer]);

	useEffect(() => {
		const input = concurrencyInputRef.current;
		if (!input || concurrencyEditedRef.current) return;
		const next = String(concurrency);
		if (input.value !== next) input.value = next;
	}, [concurrency, open]);

	const receivedBytes = tasks.reduce((sum, task) => sum + task.receivedBytes, 0);
	const totalBytes = tasks.reduce((sum, task) => sum + task.totalBytes, 0);
	const bytesPerSecond = tasks.reduce(
		(sum, task) => sum + task.bytesPerSecond,
		0,
	);
	const done = items.filter((item) => item.status === "done").length;
	const pending = items.filter((item) => item.status === "pending").length;
	const hasProgress = items.some(
		(item) =>
			item.receivedBytes > 0 ||
			item.parts.some((part) => part.receivedBytes > 0),
	);
	const headline = describeQueue(
		tasks,
		items.length,
		done,
		receivedBytes,
		totalBytes,
		bytesPerSecond,
	);

	const tipItems = useMemo<RotatingAlertItem[]>(
		() => [
			...DOWNLOAD_TIPS.map((text) => ({ text })),
			{
				text: "如果喜欢这个项目，点个 Star 支持一下",
				actionLabel: "打开 GitHub",
				onAction: () =>
					window.open(
						"https://github.com/langningchen/shanghai-textbook-server",
						"_blank",
						"noopener,noreferrer",
					),
			},
		],
		[],
	);

	const virtualItems = virtualizer.getVirtualItems();

	return (
		<Dialog
			open={open}
			onClose={onClose}
			maxWidth="xl"
			fullWidth
			slotProps={{
				paper: {
					sx: {
						display: "flex",
						flexDirection: "column",
						height: {
							xs: "calc(100dvh - 16px)",
							sm: "min(720px, calc(100dvh - 64px))",
						},
						m: { xs: 1, sm: 4 },
					},
				},
			}}
		>
			<DialogTitle
				sx={{
					display: "flex",
					justifyContent: "space-between",
					alignItems: "center",
					gap: 1,
					pb: 1.5,
					px: { xs: 2, sm: 3 },
					flexShrink: 0,
				}}
			>
				<Box>
					<Typography variant="h5" component="div" sx={{ fontWeight: 600 }}>
						下载队列
					</Typography>
					<Typography variant="subtitle2" color="text.secondary" sx={{ mt: 0.5 }}>
						{headline}
					</Typography>
				</Box>
				<IconButton aria-label="关闭下载队列" onClick={onClose}>
					<CloseIcon />
				</IconButton>
			</DialogTitle>

			{/* Fixed header row + one scroll container: the virtualizer needs a single
			    owned scroll element to measure against. */}
			<DialogContent
				dividers
				sx={{
					px: { xs: 2, sm: 3 },
					py: 2,
					display: "flex",
					flexDirection: "column",
					gap: 1.5,
					overflow: "hidden",
					minHeight: 0,
					flex: "1 1 auto",
				}}
			>
				<Box
					sx={{
						display: "flex",
						alignItems: "center",
						gap: 1.5,
						flexWrap: "wrap",
						flexShrink: 0,
					}}
				>
					<Button
						size="small"
						variant="contained"
						sx={BUTTON_SX}
						disabled={!running && pending === 0}
						onClick={running ? onStop : onStart}
					>
						{running ? "暂停下载" : hasProgress ? "继续下载" : "开始下载"}
					</Button>
					<Button
						size="small"
						variant="outlined"
						color="inherit"
						sx={BUTTON_SX}
						disabled={items.length === 0}
						onClick={onClear}
					>
						清空队列
					</Button>
					<Box sx={{ display: "flex", alignItems: "center", gap: 1.5 }}>
						<Typography
							variant="body2"
							color="text.secondary"
							sx={{ flexShrink: 0 }}
						>
							同时下载分片数
						</Typography>
						<TextField
							size="small"
							type="number"
							inputRef={concurrencyInputRef}
							defaultValue={concurrency}
							slotProps={{
								htmlInput: {
									min: MIN_CONCURRENCY,
									max: MAX_CONCURRENCY,
									// The visible label is a sibling Typography, so the input carries its
									// own accessible name.
									"aria-label": "同时下载分片数",
								},
							}}
							sx={{ width: 72 }}
							onChange={() => {
								concurrencyEditedRef.current = true;
							}}
							onBlur={(event) => {
								// Only an edited field may write back; clicking in and out again must
								// not publish the untouched display value as the concurrency.
								if (!concurrencyEditedRef.current) return;
								concurrencyEditedRef.current = false;
								const parsed = Math.round(Number(event.target.value));
								const next = Number.isFinite(parsed)
									? Math.max(MIN_CONCURRENCY, Math.min(MAX_CONCURRENCY, parsed))
									: concurrency;
								event.target.value = String(next);
								if (next !== concurrency) onConcurrencyChange(next);
							}}
							onKeyDown={(event) => {
								// Enter commits by leaving the field, so the clamp path above runs.
								if (event.key === "Enter")
									(event.target as HTMLInputElement).blur();
							}}
						/>
					</Box>
					<Box
						sx={{
							flex: "1 1 240px",
							minWidth: 240,
							height: 40,
							display: "flex",
							alignItems: "center",
							overflow: "hidden",
							whiteSpace: "nowrap",
						}}
					>
						{slow ? (
							<Alert
								severity="warning"
								sx={{
									py: 0,
									height: 40,
									width: "100%",
									alignItems: "center",
									whiteSpace: "nowrap",
									overflow: "hidden",
								}}
							>
								<Box
									sx={{
										display: "flex",
										alignItems: "center",
										gap: 1.5,
										minWidth: 0,
										overflow: "hidden",
									}}
								>
									<Typography
										variant="body2"
										noWrap
										sx={{ minWidth: 0, overflow: "hidden", textOverflow: "ellipsis" }}
									>
										当前下载速度较慢
									</Typography>
									<Button
										size="small"
										variant="outlined"
										color="warning"
										sx={{ minHeight: 28, flexShrink: 0 }}
										onClick={onSwitchSource}
									>
										切换数据源
									</Button>
								</Box>
							</Alert>
						) : (
							<RotatingAlert items={tipItems} interval={8000} />
						)}
					</Box>
				</Box>

				{items.length === 0 ? (
					<Typography color="text.secondary" sx={{ py: 6, textAlign: "center" }}>
						下载队列内目前没有任何内容，点任意一本教材的下载按钮开始下载
					</Typography>
				) : (
					<Box ref={scrollRef} sx={{ flex: "1 1 0", minHeight: 0, overflowY: "auto" }}>
						<Box
							sx={{
								height: virtualizer.getTotalSize(),
								position: "relative",
								width: "100%",
							}}
						>
							{virtualItems.map((virtualRow) => {
								const item = items[virtualRow.index];
								if (!item) return null;
								const task = tasks.find((entry) => entry.uuid === item.uuid) ?? null;
								const row = describeRow(item, task, prefetching);
								return (
									<Box
										key={item.uuid}
										sx={{
											position: "absolute",
											top: 0,
											left: 0,
											right: 0,
											height: ROW_HEIGHT,
											// One line only: every cell truncates instead of wrapping, so the
											// virtual row height can never drift away from ROW_HEIGHT.
											minWidth: 0,
											overflow: "hidden",
											transform: `translateY(${virtualRow.start}px)`,
											display: "flex",
											alignItems: "center",
											// xs row budget is ~288px: title 96 + bars 64 + two ~32px actions.
											// The column gap shrinks on xs so the action buttons stay visible
											// instead of being cut off by the row's overflow: hidden.
											columnGap: { xs: 1, sm: 2 },
											px: 1.5,
											borderRadius: 1.5,
											"&:hover": { backgroundColor: "action.hover" },
										}}
									>
										<Typography
											variant="body2"
											title={item.title}
											sx={{
												width: { xs: 96, sm: 280 },
												flexShrink: 0,
												minWidth: 0,
												whiteSpace: "nowrap",
												overflow: "hidden",
												textOverflow: "ellipsis",
											}}
										>
											{item.title}
										</Typography>
										<Box sx={{ flex: "1 1 auto", minWidth: { xs: 64, md: 96 } }}>
											<DownloadPartBars
												parts={row.parts}
												height={8}
												failed={item.status === "failed"}
												fetching={row.fetching}
											/>
										</Box>
										<Typography
											variant="caption"
											title={row.text}
											sx={{
												// minWidth, not width: "12.3 MB/s · 45%" must widen the column
												// instead of being clipped at a fixed 150px.
												minWidth: 150,
												flexShrink: 0,
												whiteSpace: "nowrap",
												color: toneColor[row.tone],
												// The status column needs 150px and only returns from md upwards: at
												// 600-899px (sm) the row cannot hold title 280 + bars 96 + status 150 +
												// actions without clipping the buttons. The per-row bar keeps showing
												// progress while the column is hidden.
												display: { xs: "none", md: "block" },
											}}
										>
											{row.text}
										</Typography>
										{item.status === "failed" && (
											<Tooltip title="重新下载这一本">
												<IconButton
													size="small"
													aria-label={`重试 ${item.title}`}
													sx={{ flexShrink: 0 }}
													onClick={() => onRetry(item.uuid)}
												>
													<RefreshIcon fontSize="small" />
												</IconButton>
											</Tooltip>
										)}
										<Tooltip title="移出队列">
											<IconButton
												size="small"
												aria-label={`从队列移除 ${item.title}`}
												sx={{ flexShrink: 0 }}
												onClick={() => onRemove(item.uuid)}
											>
												<DeleteIcon fontSize="small" />
											</IconButton>
										</Tooltip>
									</Box>
								);
							})}
						</Box>
					</Box>
				)}
			</DialogContent>
		</Dialog>
	);
}
