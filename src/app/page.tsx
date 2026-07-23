// Copyright (C) 2025 Langning Chen
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

'use client';

import React, { useState, useEffect } from 'react';
import {
  Container,
  Typography,
  Box,
  CircularProgress,
  Alert,
  Snackbar,
  AppBar,
  Toolbar,
  Fab,
  Backdrop,
  Pagination,
  IconButton,
  Menu,
  MenuItem,
  ListItemIcon,
  ListItemText,
  Divider,
  Paper,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  Checkbox,
  ToggleButton,
  ToggleButtonGroup,
  Button,
} from '@mui/material';
import {
  School as SchoolIcon,
  KeyboardArrowUp as KeyboardArrowUpIcon,
  GitHub as GitHubIcon,
  Download as DownloadIcon,
  Info as InfoIcon,
  ViewModule as ViewModuleIcon,
  ViewList as ViewListIcon,
} from '@mui/icons-material';
import { ThemeProvider, createTheme } from '@mui/material/styles';
import CssBaseline from '@mui/material/CssBaseline';

import { Textbook, FilterOptions } from '@/types/textbook';
import { filterBooks, getGradeDisplayName, getTermDisplayName } from '@/utils/helpers';
import BookCard from '@/components/BookCard';
import BookFilter from '@/components/BookFilter';
import BookDetailDialog from '@/components/BookDetailDialog';

const theme = createTheme({
  palette: {
    primary: {
      main: '#1976d2',
    },
    secondary: {
      main: '#dc004e',
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
  const [downloading, setDownloading] = useState<string | null>(null);
  const [snackbar, setSnackbar] = useState({ open: false, message: '', severity: 'success' as 'success' | 'error' });
  const [showScrollTop, setShowScrollTop] = useState(false);
  const [anchorEl, setAnchorEl] = useState<null | HTMLElement>(null);
  const [viewMode, setViewMode] = useState<'grid' | 'list'>('grid');
  const [selectedBookIds, setSelectedBookIds] = useState<string[]>([]);
  const [detailDialogOpen, setDetailDialogOpen] = useState(false);
  const [detailBook, setDetailBook] = useState<Textbook | null>(null);
  const [detailLoading, setDetailLoading] = useState(false);

  // 简化菜单状态
  const menuOpen = Boolean(anchorEl);

  // Pagination state
  const [currentPage, setCurrentPage] = useState(1);
  const booksPerPage = 50;

  // Fetch books from API
  useEffect(() => {
    fetchBooks();
  }, []);

  // Handle scroll to show/hide scroll-to-top button
  useEffect(() => {
    const handleScroll = () => {
      setShowScrollTop(window.scrollY > 300);
    };

    window.addEventListener('scroll', handleScroll);
    return () => window.removeEventListener('scroll', handleScroll);
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
      const response = await fetch('/api/book');
      const { success, data, error } = await response.json() as { success: boolean; data?: Textbook[]; error?: string; };

      if (success && data) {
        setBooks(data);
      } else {
        setError(error || '获取数据失败');
      }
    } catch {
      setError('网络错误，请检查连接');
    } finally {
      setLoading(false);
    }
  };

  const handleDownload = (bookId: string, pdfPath: string, silent = false) => {
    setDownloading(bookId);

    const link = document.createElement('a');
    link.href = pdfPath;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);

    setDownloading(null);
    if (!silent) {
      setSnackbar({
        open: true,
        message: '下载已开始，请检查浏览器下载文件夹',
        severity: 'success'
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
    window.open(url, '_blank', 'noopener,noreferrer');
    handleMenuClose();
  };

  const handleShowDetail = async (bookId: string) => {
    setDetailDialogOpen(true);
    setDetailLoading(true);

    try {
      const response = await fetch(`/api/book/${bookId}/detail`);
      const result = await response.json() as { success: boolean; data?: Textbook; error?: string; };

      if (result.success && result.data) {
        setDetailBook(result.data);
      } else {
        setDetailBook(null);
        setSnackbar({
          open: true,
          message: result.error || '加载详情失败',
          severity: 'error',
        });
      }
    } catch {
      setDetailBook(null);
      setSnackbar({
        open: true,
        message: '加载详情失败，请稍后重试',
        severity: 'error',
      });
    } finally {
      setDetailLoading(false);
    }
  };

  const handleCloseDetail = () => {
    setDetailDialogOpen(false);
    setDetailBook(null);
  };

  const handleViewModeChange = (_event: React.MouseEvent<HTMLElement>, nextMode: 'grid' | 'list' | null) => {
    if (nextMode) {
      setViewMode(nextMode);
      setSelectedBookIds([]);
    }
  };

  const handleToggleBookSelection = (bookId: string) => {
    setSelectedBookIds((prev) => (
      prev.includes(bookId)
        ? prev.filter((id) => id !== bookId)
        : [...prev, bookId]
    ));
  };

  const handleSelectAllCurrentPage = (checked: boolean) => {
    if (checked) {
      setSelectedBookIds(currentBooks.map((book) => book.uuid));
      return;
    }
    setSelectedBookIds([]);
  };

  const handleBatchDownload = () => {
    if (selectedBookIds.length === 0) {
      setSnackbar({
        open: true,
        message: '请先选择要下载的教材',
        severity: 'error',
      });
      return;
    }

    selectedBookIds.forEach((bookId) => {
      handleDownload(bookId, `/api/book/${bookId}/pdf`, true);
    });

    setSnackbar({
      open: true,
      message: `已开始批量下载 ${selectedBookIds.length} 本教材`,
      severity: 'success',
    });
  };

  // Calculate pagination
  const totalPages = Math.ceil(filteredBooks.length / booksPerPage);
  const startIndex = (currentPage - 1) * booksPerPage;
  const endIndex = startIndex + booksPerPage;
  const currentBooks = filteredBooks.slice(startIndex, endIndex);
  const selectedCountInCurrentPage = currentBooks.filter((book) => selectedBookIds.includes(book.uuid)).length;
  const allCurrentPageSelected = currentBooks.length > 0 && selectedCountInCurrentPage === currentBooks.length;

  if (loading) {
    return (
      <ThemeProvider theme={theme}>
        <CssBaseline />
        <Box
          display="flex"
          justifyContent="center"
          alignItems="center"
          minHeight="100vh"
          flexDirection="column"
        >
          <CircularProgress size={60} />
          <Typography variant="h6" sx={{ mt: 2 }}>
            正在加载上海教科书数据...
          </Typography>
        </Box>
      </ThemeProvider>
    );
  }

  if (error) {
    return (
      <ThemeProvider theme={theme}>
        <CssBaseline />
        <Container maxWidth="md" sx={{ py: 4 }}>
          <Alert severity="error" sx={{ mb: 2 }}>
            {error}
          </Alert>
          <Typography variant="body1">
            请刷新页面重试，或检查网络连接。
          </Typography>
        </Container>
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
              <span> • 第 {currentPage} / {totalPages} 页</span>
            )}
          </Typography>

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
            transformOrigin={{ horizontal: 'right', vertical: 'top' }}
            anchorOrigin={{ horizontal: 'right', vertical: 'bottom' }}
          >
            <MenuItem onClick={() => handleGitHubOpen('https://github.com/langningchen/shanghai-textbook-server')}>
              <ListItemIcon>
                <GitHubIcon fontSize="small" />
              </ListItemIcon>
              <ListItemText
                primary="服务器仓库"
                secondary="langningchen/shanghai-textbook-server"
              />
            </MenuItem>
            <Divider />
            <MenuItem onClick={() => handleGitHubOpen('https://github.com/langningchen/shanghai-textbook-data')}>
              <ListItemIcon>
                <GitHubIcon fontSize="small" />
              </ListItemIcon>
              <ListItemText
                primary="数据仓库"
                secondary="langningchen/shanghai-textbook-data"
              />
            </MenuItem>
            <Divider />
            <MenuItem onClick={() => handleGitHubOpen('https://github.com/langningchen/shanghai-textbook')}>
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
        <Box sx={{ mb: 4, textAlign: 'center' }}>
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
          <Box sx={{ textAlign: 'center', py: 8 }}>
            <Typography variant="h6" color="text.secondary">
              没有找到符合条件的教科书
            </Typography>
            <Typography variant="body2" color="text.secondary" sx={{ mt: 1 }}>
              请调整筛选条件后重试
            </Typography>
          </Box>
        ) : (
          <>
            <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 2, gap: 2, flexWrap: 'wrap' }}>
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

              {viewMode === 'list' && (
                <Button
                  variant="contained"
                  startIcon={<DownloadIcon />}
                  onClick={handleBatchDownload}
                  disabled={selectedBookIds.length === 0}
                >
                  批量下载（{selectedBookIds.length}）
                </Button>
              )}
            </Box>

            {viewMode === 'grid' ? (
              <Box
                sx={{
                  display: 'grid',
                  gridTemplateColumns: {
                    xs: 'repeat(1, 1fr)',
                    sm: 'repeat(2, 1fr)',
                    md: 'repeat(3, 1fr)',
                    lg: 'repeat(4, 1fr)',
                  },
                  gap: 3,
                  mb: 4,
                }}
              >
                {currentBooks.map((book, index) => {
                  const uniqueKey = `${book.uuid}-${book.isbn}-${startIndex + index}`;
                  return (
                    <BookCard key={uniqueKey} book={book} onDownload={handleDownload} />
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
                          indeterminate={selectedCountInCurrentPage > 0 && !allCurrentPageSelected}
                          checked={allCurrentPageSelected}
                          onChange={(event) => handleSelectAllCurrentPage(event.target.checked)}
                          inputProps={{ 'aria-label': '选择当前页全部教材' }}
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
                              onChange={() => handleToggleBookSelection(book.uuid)}
                              inputProps={{ 'aria-label': `选择教材 ${book.title}` }}
                            />
                          </TableCell>
                          <TableCell>{book.title}</TableCell>
                          <TableCell>{getGradeDisplayName(book.grade)}</TableCell>
                          <TableCell>{getTermDisplayName(book.term)}</TableCell>
                          <TableCell>{book.subject_str}</TableCell>
                          <TableCell>{book.isbn}</TableCell>
                          <TableCell align="right">
                            <Box sx={{ display: 'flex', gap: 1, justifyContent: 'flex-end' }}>
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
                                onClick={() => handleDownload(book.uuid, `/api/book/${book.uuid}/pdf`)}
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
                <Box sx={{ display: 'flex', justifyContent: 'center', mt: 4 }}>
                  <Pagination
                    count={totalPages}
                    page={currentPage}
                    onChange={(_, value) => {
                      setCurrentPage(value);
                      window.scrollTo({ top: 0, behavior: 'smooth' });
                    }}
                    color="primary"
                    size="large"
                    showFirstButton
                    showLastButton
                    sx={{
                      '& .MuiPagination-ul': {
                        flexWrap: 'wrap',
                        justifyContent: 'center',
                      },
                    }}
                  />
                </Box>

                {/* Pagination Info */}
                <Box sx={{ textAlign: 'center', mt: 2, mb: 2 }}>
                  <Typography variant="body2" color="text.secondary">
                    显示第 {startIndex + 1} - {Math.min(endIndex, filteredBooks.length)} 本，
                    共 {filteredBooks.length} 本教科书
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

      {/* Scroll to Top */}
      {showScrollTop && (
        <Fab
          color="primary"
          size="small"
          onClick={() => window.scrollTo({ top: 0, behavior: 'smooth' })}
          sx={{
            position: 'fixed',
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
        <Box textAlign="center" color="white">
          <CircularProgress color="inherit" />
          <Typography variant="h6" sx={{ mt: 2 }}>
            正在下载...
          </Typography>
        </Box>
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
          sx={{ width: '100%' }}
        >
          {snackbar.message}
        </Alert>
      </Snackbar>
    </ThemeProvider>
  );
}
