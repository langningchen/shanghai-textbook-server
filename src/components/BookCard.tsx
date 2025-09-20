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

import React from 'react';
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
} from '@mui/icons-material';
import { Textbook } from '@/types/textbook';
import {
    getGradeDisplayName,
    getTermDisplayName,
    getPublisherDisplayName,
    getUseTypeDisplayName,
    getBookCoverPath,
    getBookPdfPaths
} from '@/utils/helpers';
import LazyImage from './LazyImage';

interface BookCardProps {
    book: Textbook;
    onDownload: (bookId: string, pdfPaths: string[]) => void;
}

export default function BookCard({ book, onDownload }: BookCardProps) {
    const coverPaths = getBookCoverPath(book.uuid);
    const pdfPaths = getBookPdfPaths(book.uuid);

    const handleDownload = () => {
        onDownload(book.uuid, pdfPaths);
    };

    return (
        <Card
            sx={{
                height: '100%',
                display: 'flex',
                flexDirection: 'column',
                transition: 'transform 0.2s ease-in-out, box-shadow 0.2s ease-in-out',
                '&:hover': {
                    transform: 'translateY(-4px)',
                    boxShadow: 6,
                }
            }}
        >
            <Box sx={{ position: 'relative' }}>
                <LazyImage
                    src={coverPaths}
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
                    <strong>出版社:</strong> {getPublisherDisplayName(book.publisher)}
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

            <CardActions sx={{ pt: 0, justifyContent: 'space-between' }}>
                <Button
                    variant="contained"
                    startIcon={<DownloadIcon />}
                    onClick={handleDownload}
                    size="small"
                    fullWidth
                >
                    下载 PDF
                </Button>
            </CardActions>
        </Card>
    );
}
