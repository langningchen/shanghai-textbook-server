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

import { useState, useEffect } from "react";
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
import Paper from "@mui/material/Paper";
import Table from "@mui/material/Table";
import TableBody from "@mui/material/TableBody";
import TableCell from "@mui/material/TableCell";
import TableContainer from "@mui/material/TableContainer";
import TableHead from "@mui/material/TableHead";
import TableRow from "@mui/material/TableRow";
import Checkbox from "@mui/material/Checkbox";
import ToggleButton from "@mui/material/ToggleButton";
import ToggleButtonGroup from "@mui/material/ToggleButtonGroup";
import Button from "@mui/material/Button";
import Tooltip from "@mui/material/Tooltip";
import SchoolIcon from "@mui/icons-material/School";
import KeyboardArrowUpIcon from "@mui/icons-material/KeyboardArrowUp";
import GitHubIcon from "@mui/icons-material/GitHub";
import DownloadIcon from "@mui/icons-material/Download";
import InfoIcon from "@mui/icons-material/Info";
import ViewModuleIcon from "@mui/icons-material/ViewModule";
import ViewListIcon from "@mui/icons-material/ViewList";
import SwapHorizIcon from "@mui/icons-material/SwapHoriz";
import SpeedIcon from "@mui/icons-material/Speed";
import { ThemeProvider, createTheme } from "@mui/material/styles";
import CssBaseline from "@mui/material/CssBaseline";

import { Textbook, FilterOptions } from "@/types/textbook";
import {
	filterBooks,
	generateFriendlyFilename,
	getGradeDisplayName,
	getTermDisplayName,
} from "@/utils/helpers";
import {
	getIndexUrl,
	getJsonUrl,
	getPdfPrefix
} from '@/utils/url';
import BookCard from "@/components/BookCard";
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
	const [books, setBooks] = useState<Textbook[]>([]);
	const [filteredBooks, setFilteredBooks] = useState<Textbook[]>([]);
	const [filters, setFilters] = useState<FilterOptions>({});
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
	const [selectedBookIds, setSelectedBookIds] = useState<string[]>([]);
	const [detailDialogOpen, setDetailDialogOpen] = useState(false);
	const [detailBook, setDetailBook] = useState<Textbook | null>(null);
	const [detailLoading, setDetailLoading] = useState(false);
	const [sourceDialogOpen, setSourceDialogOpen] = useState(false);
	const [loadingTimeout, setLoadingTimeout] = useState(false);

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
		} else {
			setLoadingTimeout(false);
		}
	}, [loading]);

	// Fetch books from API
	useEffect(() => {
		fetchBooks();
	}, []);

	// Handle scroll to show/hide scroll-to-top button
	useEffect(() => {
		const handleScroll = () => {
			setShowScrollTop(window.scrollY > 300);
		};

		window.addEventListener("scroll", handleScroll);
		return () => window.removeEventListener("scroll", handleScroll);
	}, []);

	// Filter books when filters change and reset to page 1
	useEffect(() => {
		const filtered = filterBooks(books, filters);
		setFilteredBooks(filtered);
		setCurrentPage(1); // Reset to first page when filters change
		setSelectedBookIds([]);
	}, [books, filters]);

	const fetchBooks = async () => {
		try {
			setLoading(true);
			setError(null);
			const response = await fetch(getIndexUrl());
			if (!response.ok) {
				throw new Error("HTTP error " + response.status);
			}
			setBooks(await response.json());
		} catch {
			setError("网络错误或数据源不可访问，请检查连接或更换源");
		} finally {
			setLoading(false);
		}
	};

	const handleDownload = async (bookId: string, batch?: BatchProgress) => {
		const downloadFailed = (message: string) => {
			setDownloading(null);
			setSnackbar({ open: true, message, severity: "error", });
		};

		const book = books.find((b) => b.uuid === bookId);
		if (!book) {
			return downloadFailed("下载失败，教材不存在");
		}

		setDownloading({ title: book.title, progress: { current: 0, batch } });
		const prefix = getPdfPrefix(bookId);
		const tryFetchUrls = async (suffix?: string): Promise<string | null> => {
			const url = `${prefix}${suffix || ""}`;
			try {
				const response = await fetch(url, { method: "HEAD" });
				if (response.ok) {
					return url;
				}
			} catch {
				return null;
			}
			return null;
		};

		const urls: string[] = [];
		const firstUrl = await tryFetchUrls();
		if (firstUrl) {
			urls.push(firstUrl);
		}
		let index = 1;
		while (true) {
			const partUrl = await tryFetchUrls(`.${index}`);
			if (partUrl) {
				urls.push(partUrl);
				index++;
			} else {
				break;
			}
		}
		if (urls.length === 0) {
			return downloadFailed("下载失败，文件不存在");
		}

		setDownloading({ title: book.title, progress: { current: 0, batch } });
		const parts: Blob[] = [];
		for (let i = 0; i < urls.length; i++) {
			const url = urls[i];
			try {
				const response = await fetch(url);
				if (!response.ok) {
					return downloadFailed(`下载失败，文件不存在: ${url}`);
				}

				const contentLength = response.headers.get("content-length");
				const totalBytes = contentLength ? parseInt(contentLength, 10) : 0;

				const reader = response.body?.getReader();
				if (!reader) {
					const blob = await response.blob();
					parts.push(blob);
					continue;
				}

				const chunks: Uint8Array[] = [];
				let receivedBytes = 0;
				let lastUpdateTime = 0;

				while (true) {
					const { done, value } = await reader.read();
					if (done) break;

					chunks.push(value);
					receivedBytes += value.length;

					const now = performance.now();
					if (now - lastUpdateTime > 200) {
						lastUpdateTime = now;
						const currentProgress = totalBytes > 0 ? receivedBytes / totalBytes : 0;
						setDownloading({
							title: book.title,
							progress: {
								current: (i + currentProgress) / urls.length,
								batch,
							},
						});
					}
				}

				setDownloading({
					title: book.title,
					progress: {
						current: (i + 1) / urls.length,
						batch,
					},
				});

				const partBlob = new Blob(chunks as BlobPart[]);
				parts.push(partBlob);
			} catch {
				return downloadFailed(`下载失败，网络错误: ${url}`);
			}
		}

		const combinedBlob = new Blob(parts, { type: "application/pdf" });
		const url = URL.createObjectURL(combinedBlob);
		const link = document.createElement("a");
		link.href = url;
		link.download = generateFriendlyFilename(book);
		document.body.appendChild(link);
		link.click();
		document.body.removeChild(link);
		URL.revokeObjectURL(url);

		setDownloading(null);
		if (!batch) {
			setSnackbar({
				open: true,
				message: "下载已开始，请检查浏览器下载文件夹",
				severity: "success",
			});
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

	const handleShowDetail = async (bookId: string) => {
		setDetailDialogOpen(true);
		setDetailLoading(true);

		try {
			const response = await fetch(getJsonUrl(bookId));
			const result = (await response.json()) as {
				success: boolean;
				data?: Textbook;
				error?: string;
			};

			if (result.success && result.data) {
				setDetailBook(result.data);
			} else {
				setDetailBook(null);
				setSnackbar({
					open: true,
					message: result.error || "加载详情失败",
					severity: "error",
				});
			}
		} catch {
			setDetailBook(null);
			setSnackbar({
				open: true,
				message: "加载详情失败，请稍后重试",
				severity: "error",
			});
		} finally {
			setDetailLoading(false);
		}
	};

	const handleCloseDetail = () => {
		setDetailDialogOpen(false);
		setDetailBook(null);
	};

	const handleViewModeChange = (
		_event: React.MouseEvent<HTMLElement>,
		nextMode: "grid" | "list" | null,
	) => {
		if (nextMode) {
			setViewMode(nextMode);
			setSelectedBookIds([]);
		}
	};

	const handleToggleBookSelection = (bookId: string) => {
		setSelectedBookIds((prev) =>
			prev.includes(bookId)
				? prev.filter((id) => id !== bookId)
				: [...prev, bookId],
		);
	};

	const handleSelectAllCurrentPage = (checked: boolean) => {
		if (checked) {
			setSelectedBookIds(currentBooks.map((book) => book.uuid));
			return;
		}
		setSelectedBookIds([]);
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
			await handleDownload(selectedBookIds[i], { ...batch, current: i + 1 });
		}
	};

	// Calculate pagination
	const totalPages = Math.ceil(filteredBooks.length / booksPerPage);
	const startIndex = (currentPage - 1) * booksPerPage;
	const endIndex = startIndex + booksPerPage;
	const currentBooks = filteredBooks.slice(startIndex, endIndex);
	const selectedCountInCurrentPage = currentBooks.filter((book) =>
		selectedBookIds.includes(book.uuid),
	).length;
	const allCurrentPageSelected =
		currentBooks.length > 0 &&
		selectedCountInCurrentPage === currentBooks.length;

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
				<SourceSwitchDialog
					open={sourceDialogOpen}
					onClose={() => setSourceDialogOpen(false)}
				/>
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
				<SourceSwitchDialog
					open={sourceDialogOpen}
					onClose={() => setSourceDialogOpen(false)}
				/>
			</ThemeProvider>
		);
	}

	return (
		<ThemeProvider theme={theme}>
			<CssBaseline />

			{/* App Bar */}
			<AppBar position="sticky" elevation={2}>
				<Toolbar>
					<SchoolIcon sx={{ mr: 2 }} />
					<Typography variant="h6" component="div" sx={{ flexGrow: 1 }}>
						上海教科书资源库
					</Typography>
					<Typography variant="body2" sx={{ mr: 2 }}>
						共 {filteredBooks.length} 本教科书
						{totalPages > 1 && (
							<span>
								{" "}• 第 {currentPage} / {totalPages} 页
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
								mr: 1.5,
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
			<Container maxWidth="xl" sx={{ py: 3 }}>
				{/* Header */}
				<Box sx={{ mb: 4, textAlign: "center" }}>
					<Typography variant="h4" component="h1" gutterBottom>
						上海教科书资源库
					</Typography>
					<Typography variant="body1" color="text.secondary">
						提供上海地区各年级、各学科教科书的在线浏览和下载服务
					</Typography>
				</Box>

				{/* Filters */}
				<BookFilter
					filters={filters}
					onFiltersChange={setFilters}
					onClearFilters={() => {
						setFilters({});
						setCurrentPage(1);
					}}
					books={books}
				/>

				{/* Results */}
				{filteredBooks.length === 0 ? (
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
									startIcon={<DownloadIcon />}
									onClick={handleBatchDownload}
									disabled={selectedBookIds.length === 0}
								>
									批量下载 {selectedBookIds.length} 本
								</Button>
							)}
						</Box>

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
									gap: 3,
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
										/>
									);
								})}
							</Box>
						) : (
							<TableContainer component={Paper} sx={{ mb: 4 }}>
								<Table size="small">
									<TableHead>
										<TableRow>
											<TableCell padding="checkbox">
												<Checkbox
													indeterminate={
														selectedCountInCurrentPage > 0 &&
														!allCurrentPageSelected
													}
													checked={allCurrentPageSelected}
													onChange={(event) =>
														handleSelectAllCurrentPage(event.target.checked)
													}
													slotProps={{
														input: { "aria-label": "选择当前页全部教材" },
													}}
												/>
											</TableCell>
											<TableCell>书名</TableCell>
											<TableCell>年级</TableCell>
											<TableCell>学期</TableCell>
											<TableCell>科目</TableCell>
											<TableCell>ISBN</TableCell>
											<TableCell align="right">操作</TableCell>
										</TableRow>
									</TableHead>
									<TableBody>
										{currentBooks.map((book) => {
											const isSelected = selectedBookIds.includes(book.uuid);
											return (
												<TableRow key={book.uuid} hover selected={isSelected}>
													<TableCell padding="checkbox">
														<Checkbox
															checked={isSelected}
															onChange={() =>
																handleToggleBookSelection(book.uuid)
															}
															slotProps={{
																input: {
																	"aria-label": `选择教材 ${book.title}`,
																},
															}}
														/>
													</TableCell>
													<TableCell>{book.title}</TableCell>
													<TableCell>
														{getGradeDisplayName(book.grade)}
													</TableCell>
													<TableCell>{getTermDisplayName(book.term)}</TableCell>
													<TableCell>{book.subject_str}</TableCell>
													<TableCell>{book.isbn}</TableCell>
													<TableCell align="right">
														<Box
															sx={{
																display: "flex",
																gap: 1,
																justifyContent: "flex-end",
															}}
														>
															<Button
																size="small"
																startIcon={<InfoIcon />}
																variant="outlined"
																onClick={() => handleShowDetail(book.uuid)}
															>
																详情
															</Button>
															<Button
																size="small"
																startIcon={<DownloadIcon />}
																variant="contained"
																onClick={() => handleDownload(book.uuid)}
															>
																下载
															</Button>
														</Box>
													</TableCell>
												</TableRow>
											);
										})}
									</TableBody>
								</Table>
							</TableContainer>
						)}

						{/* Pagination */}
						{totalPages > 1 && (
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
										size="large"
										showFirstButton
										showLastButton
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

			<SourceSwitchDialog
				open={sourceDialogOpen}
				onClose={() => setSourceDialogOpen(false)}
			/>

			{/* Scroll to Top */}
			{showScrollTop && (
				<Fab
					color="primary"
					size="small"
					onClick={() => window.scrollTo({ top: 0, behavior: "smooth" })}
					sx={{
						position: "fixed",
						bottom: 16,
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
							width: "50%",
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
									whiteSpace: "nowrap",
								}}
								title={downloading.title}
							>
								正在下载 {downloading.title}
							</Typography>

							<Box sx={{ width: "100%", mt: 1 }}>
								<Box sx={{ display: "flex", justifyContent: "space-between", mb: 0.5 }}>
									<Typography variant="body2" color="text.secondary">
										下载进度
									</Typography>
									<Typography variant="body2" sx={{ fontWeight: "bold", color: "primary.main" }}>
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
									<Box sx={{ display: "flex", justifyContent: "space-between", mb: 0.5 }}>
										<Typography variant="body2" color="text.secondary">
											批量进度
										</Typography>
										<Typography variant="body2" sx={{ fontWeight: "bold", color: "primary.main" }}>
											{downloading.progress.batch.current} / {downloading.progress.batch.total}
										</Typography>
									</Box>
									<LinearProgress
										variant="determinate"
										value={
											(downloading.progress.batch.current / downloading.progress.batch.total) * 100
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
};
