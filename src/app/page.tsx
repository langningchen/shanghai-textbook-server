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
import Backdrop from "@mui/material/Backdrop";
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

import { Textbook, FilterOptions } from "@/types/textbook";
import { filterBooks, generateFriendlyFilename } from "@/utils/helpers";
import { getIndexUrl, getPdfPrefix } from "@/utils/url";
import BookCard from "@/components/BookCard";
import BookList from "@/components/BookList";
import { fetchTextbookDetail } from "@/utils/textbook";
import BookFilter from "@/components/BookFilter";
import BookDetailDialog from "@/components/BookDetailDialog";
import SourceSwitchDialog from "@/components/SourceSwitchDialog";
import { Card, CardContent, LinearProgress } from "@mui/material";

interface BatchProgress {
	current: number;
	total: number;
}
interface DownloadingData {
	title: string;
	progress: {
		current: number;
		batch?: BatchProgress;
	};
}

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
	const [downloading, setDownloading] = useState<DownloadingData | null>(null);
	const [snackbar, setSnackbar] = useState({
		open: false,
		message: "",
		severity: "success" as "success" | "error",
	});
	const [showScrollTop, setShowScrollTop] = useState(false);
	const [anchorEl, setAnchorEl] = useState<null | HTMLElement>(null);
	const [viewMode, setViewMode] = useState<"grid" | "list">("grid");
	const visibleBooks = viewMode === "grid" ? filteredBooks : books;
	const [selectedBookIds, setSelectedBookIds] = useState<string[]>([]);
	const [detailDialogOpen, setDetailDialogOpen] = useState(false);
	const [detailBook, setDetailBook] = useState<Textbook | null>(null);
	const [detailLoading, setDetailLoading] = useState(false);
	const [sourceDialogOpen, setSourceDialogOpen] = useState(false);
	const [loadingTimeout, setLoadingTimeout] = useState(false);
	const [downloadSlow, setDownloadSlow] = useState(false);
	const downloadController = useRef<AbortController | null>(null);
	const detailController = useRef<AbortController | null>(null);
	useEffect(() => () => detailController.current?.abort(), []);
	useEffect(() => () => downloadController.current?.abort(), []);

	const handleDownloadSourceSwitch = () => {
		downloadController.current?.abort();
		setDownloading(null);
		setDownloadSlow(false);
		setSourceDialogOpen(true);
	};

	const menuOpen = Boolean(anchorEl);

	// Pagination state
	const [currentPage, setCurrentPage] = useState(1);
	const booksPerPage = 50;

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

	const handleDownload = useCallback(
		async (bookId: string, batch?: BatchProgress): Promise<boolean> => {
			// One controller covers discovery, all parts, and cancellation of a batch item.
			if (downloadController.current) return false;
			const controller = new AbortController();
			downloadController.current = controller;
			setDownloadSlow(false);
			let receivedBytes = 0;
			let sampledBytes = 0;
			let sampledAt = performance.now();
			const speedTimer = setInterval(() => {
				const now = performance.now();
				const bytesPerSecond =
					(receivedBytes - sampledBytes) / ((now - sampledAt) / 1000);
				setDownloadSlow(bytesPerSecond < 128 * 1024);
				sampledBytes = receivedBytes;
				sampledAt = now;
			}, 8000);

			try {
				const book = books.find((b) => b.uuid === bookId);
				if (!book) throw new Error("下载失败，教材不存在");
				setDownloading({ title: book.title, progress: { current: 0, batch } });
				const prefix = getPdfPrefix(bookId);
				const tryFetchUrl = async (suffix = ""): Promise<string | null> => {
					const url = `${prefix}${suffix}`;
					try {
						const response = await fetch(url, {
							method: "HEAD",
							signal: controller.signal,
						});
						return response.ok ? url : null;
					} catch {
						controller.signal.throwIfAborted();
						return null;
					}
				};
				const urls: string[] = [];
				const firstUrl = await tryFetchUrl();
				if (firstUrl) urls.push(firstUrl);
				for (let index = 1; ; index++) {
					const partUrl = await tryFetchUrl(`.${index}`);
					if (!partUrl) break;
					urls.push(partUrl);
				}
				if (!urls.length)
					throw new Error("下载失败，文件不存在或数据源不可访问，请尝试换源");

				const parts: Blob[] = [];
				for (let i = 0; i < urls.length; i++) {
					const response = await fetch(urls[i], { signal: controller.signal });
					if (!response.ok)
						throw new Error("下载失败，文件不可访问，请尝试换源");
					const totalBytes =
						Number(response.headers.get("content-length")) || 0;
					const reader = response.body?.getReader();
					if (!reader) {
						const blob = await response.blob();
						receivedBytes += blob.size;
						parts.push(blob);
					} else {
						const chunks: Uint8Array[] = [];
						let partBytes = 0;
						let lastUpdateTime = 0;
						while (true) {
							const { done, value } = await reader.read();
							if (done) break;
							chunks.push(value);
							partBytes += value.length;
							receivedBytes += value.length;
							const now = performance.now();
							if (now - lastUpdateTime > 200) {
								lastUpdateTime = now;
								setDownloading({
									title: book.title,
									progress: {
										current:
											(i +
												(totalBytes > 0
													? Math.min(partBytes / totalBytes, 1)
													: 0)) /
											urls.length,
										batch,
									},
								});
							}
						}
						parts.push(new Blob(chunks as BlobPart[]));
					}
					setDownloading({
						title: book.title,
						progress: { current: (i + 1) / urls.length, batch },
					});
				}
				controller.signal.throwIfAborted();
				const url = URL.createObjectURL(
					new Blob(parts, { type: "application/pdf" }),
				);
				const link = document.createElement("a");
				link.href = url;
				link.download = generateFriendlyFilename(book);
				document.body.appendChild(link);
				link.click();
				link.remove();
				URL.revokeObjectURL(url);
				if (!batch)
					setSnackbar({
						open: true,
						message: "下载已开始，请检查浏览器下载文件夹",
						severity: "success",
					});
				return true;
			} catch (error) {
				if (!controller.signal.aborted)
					setSnackbar({
						open: true,
						message:
							error instanceof Error
								? error.message
								: "下载失败，网络错误，请尝试换源",
						severity: "error",
					});
				return false;
			} finally {
				clearInterval(speedTimer);
				if (downloadController.current === controller) {
					downloadController.current = null;
					setDownloading(null);
					setDownloadSlow(false);
				}
			}
		},
		[books],
	);

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

	const handleBatchDownload = async () => {
		if (selectedBookIds.length === 0) {
			setSnackbar({
				open: true,
				message: "请先选择要下载的教材",
				severity: "error",
			});
			return;
		}
		const batch: BatchProgress = {
			current: 0,
			total: selectedBookIds.length,
		};

		for (let i = 0; i < selectedBookIds.length; i++) {
			if (
				!(await handleDownload(selectedBookIds[i], {
					...batch,
					current: i + 1,
				}))
			)
				break;
		}
	};

	// Calculate pagination
	const totalPages = Math.ceil(filteredBooks.length / booksPerPage);
	const startIndex = (currentPage - 1) * booksPerPage;
	const endIndex = startIndex + booksPerPage;
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
							onClick={handleBatchDownload}
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
											onDownload={handleDownload}
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
								onDownload={handleDownload}
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
				onDownload={handleDownload}
			/>

			{sourceDialogOpen && (
				<SourceSwitchDialog
					open={sourceDialogOpen}
					onClose={() => setSourceDialogOpen(false)}
				/>
			)}

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

			{/* Download Backdrop */}
			<Backdrop open={downloading !== null} sx={{ zIndex: 9999 }}>
				{downloading && (
					<Card
						elevation={8}
						sx={{
							width: { xs: "calc(100% - 32px)", sm: "80%", md: "50%" },
							maxWidth: 640,
							borderRadius: 3,
							textAlign: "center",
						}}
					>
						<CardContent sx={{ p: 3, "&:last-child": { pb: 3 } }}>
							<Typography
								variant="h6"
								component="div"
								sx={{
									fontWeight: 600,
									mb: 2,
									overflow: "hidden",
									textOverflow: "ellipsis",
									whiteSpace: { xs: "normal", sm: "nowrap" },
									overflowWrap: "anywhere",
								}}
								title={downloading.title}
							>
								正在下载 {downloading.title}
							</Typography>

							{downloadSlow && (
								<Alert severity="warning" sx={{ mb: 2, textAlign: "left" }}>
									下载较慢或暂时没有响应，可以换个数据源试试。停止并换源后，需要重新下载；批量任务也会停止。
									<Button
										variant="outlined"
										color="warning"
										startIcon={<SwapHorizIcon />}
										onClick={handleDownloadSourceSwitch}
										sx={{ mt: 1, display: "flex" }}
									>
										停止下载并换源
									</Button>
								</Alert>
							)}

							<Box sx={{ width: "100%", mt: 1 }}>
								<Box
									sx={{
										display: "flex",
										justifyContent: "space-between",
										mb: 0.5,
									}}
								>
									<Typography variant="body2" color="text.secondary">
										下载进度
									</Typography>
									<Typography
										variant="body2"
										sx={{ fontWeight: "bold", color: "primary.main" }}
									>
										{Math.round(downloading.progress.current * 100)}%
									</Typography>
								</Box>
								<LinearProgress
									variant="determinate"
									value={downloading.progress.current * 100}
									sx={{ height: 6, borderRadius: 3 }}
								/>
							</Box>

							{downloading.progress.batch && (
								<Box sx={{ width: "100%", mt: 2 }}>
									<Box
										sx={{
											display: "flex",
											justifyContent: "space-between",
											mb: 0.5,
										}}
									>
										<Typography variant="body2" color="text.secondary">
											批量进度
										</Typography>
										<Typography
											variant="body2"
											sx={{ fontWeight: "bold", color: "primary.main" }}
										>
											{downloading.progress.batch.current} /{" "}
											{downloading.progress.batch.total}
										</Typography>
									</Box>
									<LinearProgress
										variant="determinate"
										value={
											(downloading.progress.batch.current /
												downloading.progress.batch.total) *
											100
										}
										sx={{ height: 6, borderRadius: 3 }}
									/>
								</Box>
							)}
						</CardContent>
					</Card>
				)}
			</Backdrop>

			{/* Snackbar */}
			<Snackbar
				open={snackbar.open}
				autoHideDuration={6000}
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
