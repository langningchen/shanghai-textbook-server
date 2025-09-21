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

import React, { useState } from 'react';
import {
    Card,
    CardContent,
    CardActions,
    Typography,
    Button,
    Chip,
    Box,
    Tooltip,
} from '@mui/material';
import {
    Download as DownloadIcon,
    Info as InfoIcon,
} from '@mui/icons-material';
import { Textbook } from '@/types/textbook';
import {
    getGradeDisplayName,
    getTermDisplayName,
    getPublisherDisplayName,
    getUseTypeDisplayName
} from '@/utils/helpers';
import LazyImage from './LazyImage';
import BookDetailDialog from './BookDetailDialog';

interface BookCardProps {
    book: Textbook;
    onDownload: (bookId: string, pdfPath: string) => void;
}

export default function BookCard({ book, onDownload }: BookCardProps) {
    const [detailDialogOpen, setDetailDialogOpen] = useState(false);
    const [detailBook, setDetailBook] = useState<Textbook | null>(null);
    const [detailLoading, setDetailLoading] = useState(false);

    const handleDownload = () => {
        onDownload(book.uuid, `/api/book/${book.uuid}/pdf`);
    };

    const handleShowDetail = async () => {
        setDetailDialogOpen(true);
        setDetailLoading(true);

        try {
            const response = await fetch(`/api/book/${book.uuid}/detail`);
            const result = await response.json() as { success: boolean; data?: Textbook; error?: string; };

            if (result.success && result.data) {
                setDetailBook(result.data);
            } else {
                console.error('Failed to fetch book detail:', result.error);
                setDetailBook(null);
            }
        } catch (error) {
            console.error('Error fetching book detail:', error);
            setDetailBook(null);
        } finally {
            setDetailLoading(false);
        }
    };

    const handleCloseDetail = () => {
        setDetailDialogOpen(false);
        setDetailBook(null);
    };

    return (
        <>
            <Card
                sx={{
                    height: '100%',
                    display: 'flex',
                    flexDirection: 'column',
                    transition: 'transform 0.2s ease-in-out, box-shadow 0.2s ease-in-out',
                    cursor: 'pointer',
                    '&:hover': {
                        transform: 'translateY(-4px)',
                        boxShadow: 6,
                    }
                }}
                onClick={handleShowDetail}
            >
                <Box sx={{ position: 'relative' }}>
                    <LazyImage
                        src={`/api/book/${book.uuid}/cover`}
                        alt={book.title}
                        height={360}
                        sx={{ borderRadius: '4px 4px 0 0' }}
                    />
                    {book.is_current_term === 1 && (
                        <Chip
                            label="当前学期"
                            color="primary"
                            size="small"
                            sx={{
                                position: 'absolute',
                                top: 8,
                                right: 8,
                            }}
                        />
                    )}
                </Box>

                <CardContent sx={{ flexGrow: 1, pb: 1 }}>
                    <Tooltip title={book.title} placement="top">
                        <Typography
                            variant="h6"
                            component="h2"
                            gutterBottom
                            sx={{
                                fontSize: '1rem',
                                fontWeight: 600,
                                lineHeight: 1.3,
                                display: '-webkit-box',
                                WebkitLineClamp: 2,
                                WebkitBoxOrient: 'vertical',
                                overflow: 'hidden',
                                textOverflow: 'ellipsis',
                                minHeight: '2.6em',
                            }}
                        >
                            {book.title}
                        </Typography>
                    </Tooltip>

                    <Box sx={{ mb: 2, display: 'flex', flexWrap: 'wrap', gap: 0.5 }}>
                        <Chip
                            label={getGradeDisplayName(book.grade)}
                            size="small"
                            variant="outlined"
                            color="primary"
                        />
                        <Chip
                            label={getTermDisplayName(book.term)}
                            size="small"
                            variant="outlined"
                            color="secondary"
                        />
                        <Chip
                            label={book.subject_str}
                            size="small"
                            variant="outlined"
                        />
                    </Box>

                    <Typography variant="body2" color="text.secondary" sx={{ mb: 1 }}>
                        <strong>出版社:</strong> {book.publisher ? getPublisherDisplayName(book.publisher) : '未知'}
                    </Typography>

                    <Typography variant="body2" color="text.secondary" sx={{ mb: 1 }}>
                        <strong>用书类型:</strong> {getUseTypeDisplayName(book.use_type)}
                    </Typography>

                    <Typography variant="body2" color="text.secondary" sx={{ mb: 1 }}>
                        <strong>使用年份:</strong> {book.use_year}
                    </Typography>

                    <Typography variant="body2" color="text.secondary">
                        <strong>ISBN:</strong> {book.isbn}
                    </Typography>
                </CardContent>

                <CardActions sx={{ pt: 0, justifyContent: 'space-between', gap: 1 }}>
                    <Button
                        variant="outlined"
                        startIcon={<InfoIcon />}
                        onClick={(e) => {
                            e.stopPropagation();
                            handleShowDetail();
                        }}
                        size="small"
                        sx={{ flex: 1 }}
                    >
                        详情
                    </Button>
                    <Button
                        variant="contained"
                        startIcon={<DownloadIcon />}
                        onClick={(e) => {
                            e.stopPropagation();
                            handleDownload();
                        }}
                        size="small"
                        sx={{ flex: 1 }}
                    >
                        下载
                    </Button>
                </CardActions>
            </Card>

            <BookDetailDialog
                open={detailDialogOpen}
                onClose={handleCloseDetail}
                book={detailBook}
                loading={detailLoading}
            />
        </>
    );
}
