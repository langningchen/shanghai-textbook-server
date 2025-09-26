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
    Dialog,
    DialogTitle,
    DialogContent,
    DialogActions,
    Typography,
    Button,
    Box,
    Paper,
    Chip,
    IconButton,
    Link as MuiLink,
    Divider,
    CircularProgress,
} from '@mui/material';
import {
    Close as CloseIcon,
    OpenInNew as OpenInNewIcon,
    GitHub as GitHubIcon,
    CloudDownload as CloudDownloadIcon,
} from '@mui/icons-material';
import { Textbook } from '@/types/textbook';
import {
    getGradeDisplayName,
    getTermDisplayName,
    getUseTypeDisplayName
} from '@/utils/helpers';
import LazyImage from './LazyImage';

interface BookDetailDialogProps {
    open: boolean;
    onClose: () => void;
    book: Textbook | null;
    loading: boolean;
}

const formatUpdateTime = (updateTime: string) => {
    try {
        const date = new Date(updateTime);
        return date.toLocaleString('zh-CN', {
            year: 'numeric',
            month: '2-digit',
            day: '2-digit',
            hour: '2-digit',
            minute: '2-digit',
            second: '2-digit',
        });
    } catch {
        return updateTime;
    }
};

const getGitHubUrl = (bookId: string) => {
    return `https://github.com/langningchen/shanghai-textbook-data/blob/main/${bookId}.json`;
};

const getTextbookMaterialTypeDisplay = (type: string) => {
    const typeMap: Record<string, string> = {
        'BASIC': '基础教材',
        'REFERENCE': '参考资料',
        'EXERCISE': '练习册',
        'OTHER': '其他',
    };
    return typeMap[type] || type;
};

export default function BookDetailDialog({ open, onClose, book, loading }: BookDetailDialogProps) {
    if (!open) return null;

    return (
        <Dialog
            open={open}
            onClose={onClose}
            maxWidth="xl"
            fullWidth
            scroll="paper"
            PaperProps={{
                sx: {
                    maxHeight: '95vh',
                    minHeight: '80vh',
                }
            }}
        >
            <DialogTitle sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', pb: 1 }}>
                <Typography variant="h6" component="div" sx={{ fontWeight: 600 }}>
                    课本详细信息
                </Typography>
                <IconButton onClick={onClose} size="small" sx={{ color: 'grey.500' }}>
                    <CloseIcon />
                </IconButton>
            </DialogTitle>

            <DialogContent sx={{ pt: 1 }}>
                {loading ? (
                    <Box sx={{ display: 'flex', justifyContent: 'center', py: 4 }}>
                        <CircularProgress />
                    </Box>
                ) : book ? (
                    <Box sx={{ display: 'flex', flexDirection: 'column', gap: 3 }}>
                        {/* 书籍封面和基本信息 */}
                        <Box sx={{
                            display: 'flex',
                            flexDirection: { xs: 'column', md: 'row' },
                            gap: 3,
                            alignItems: 'stretch'
                        }}>
                            {/* 封面 */}
                            <Box sx={{ flex: '0 0 auto', textAlign: 'center' }}>
                                <Paper sx={{ p: 2, display: 'flex', flexDirection: 'column', alignItems: 'center', height: '100%' }}>
                                    <Box sx={{
                                        width: 200,
                                        height: 300,
                                        position: 'relative',
                                        display: 'flex',
                                        alignItems: 'center',
                                        justifyContent: 'center'
                                    }}>
                                        <LazyImage
                                            src={`/api/book/${book.uuid}/cover`}
                                            alt={book.title}
                                            width={200}
                                            height={300}
                                            sx={{ borderRadius: 1 }}
                                        />
                                    </Box>
                                    <Typography variant="caption" color="text.secondary" sx={{ mt: 1, textAlign: 'center' }}>
                                        课本封面
                                    </Typography>
                                </Paper>
                            </Box>

                            {/* 基本信息 */}
                            <Box sx={{ flex: 1 }}>
                                <Paper sx={{ p: 2, height: '100%', display: 'flex', flexDirection: 'column' }}>
                                    <Typography variant="h6" gutterBottom sx={{ fontWeight: 600, color: 'primary.main' }}>
                                        基本信息
                                    </Typography>
                                    <Divider sx={{ mb: 2 }} />

                                    <Box sx={{ mb: 2 }}>
                                        <Typography variant="body2" color="text.secondary" gutterBottom>
                                            <strong>书名：</strong>
                                        </Typography>
                                        <Typography variant="body1" sx={{ mb: 1 }}>
                                            {book.title}
                                        </Typography>
                                    </Box>

                                    <Box sx={{ mb: 2 }}>
                                        <Typography variant="body2" color="text.secondary" gutterBottom>
                                            <strong>简称：</strong>
                                        </Typography>
                                        <Typography variant="body1" sx={{ mb: 1 }}>
                                            {book.short_title}
                                        </Typography>
                                    </Box>

                                    <Box sx={{ mb: 2, display: 'flex', flexWrap: 'wrap', gap: 1 }}>
                                        <Chip
                                            label={getGradeDisplayName(book.grade)}
                                            size="small"
                                            color="primary"
                                            variant="outlined"
                                        />
                                        <Chip
                                            label={getTermDisplayName(book.term)}
                                            size="small"
                                            color="secondary"
                                            variant="outlined"
                                        />
                                        <Chip
                                            label={book.subject_str}
                                            size="small"
                                            variant="outlined"
                                        />
                                        {book.is_current_term === 1 && (
                                            <Chip
                                                label="当前学期"
                                                size="small"
                                                color="success"
                                            />
                                        )}
                                    </Box>

                                    <Box sx={{
                                        display: 'grid',
                                        gridTemplateColumns: { xs: '1fr', sm: '1fr 1fr' },
                                        gap: 2
                                    }}>
                                        <Typography variant="body2" color="text.secondary">
                                            <strong>使用年份：</strong> {book.use_year}
                                        </Typography>
                                        <Typography variant="body2" color="text.secondary">
                                            <strong>ISBN：</strong> {book.isbn}
                                        </Typography>
                                        <Typography variant="body2" color="text.secondary">
                                            <strong>用书类型：</strong> {getUseTypeDisplayName(book.use_type)}
                                        </Typography>
                                        <Typography variant="body2" color="text.secondary">
                                            <strong>教材类型：</strong> {getTextbookMaterialTypeDisplay(book.textbook_material_type)}
                                        </Typography>
                                        <Typography variant="body2" color="text.secondary">
                                            <strong>正文起始页：</strong> {book.text_start_page}
                                        </Typography>
                                        <Typography variant="body2" color="text.secondary">
                                            <strong>状态：</strong> {book.status === '1' ? '可用' : '不可用'}
                                        </Typography>
                                    </Box>
                                </Paper>
                            </Box>
                        </Box>

                        {/* 使用年级学期 */}
                        {book.used_grade_semesters && book.used_grade_semesters.length > 0 && (
                            <Paper sx={{ p: 2 }}>
                                <Typography variant="h6" gutterBottom sx={{ fontWeight: 600, color: 'primary.main' }}>
                                    适用年级学期
                                </Typography>
                                <Divider sx={{ mb: 2 }} />
                                {book.used_grade_semesters.map((gradeSemester, index) => (
                                    <Box key={index} sx={{ mb: 2 }}>
                                        <Typography variant="body1" sx={{ fontWeight: 500, mb: 1 }}>
                                            {gradeSemester.grade_level_str} ({gradeSemester.grade_level_code})
                                        </Typography>
                                        <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 1 }}>
                                            {gradeSemester.used_semester_phases.map((phase, phaseIndex) => (
                                                <Chip
                                                    key={phaseIndex}
                                                    label={`${phase.semester_phase_str} (${phase.semester_phase_code})`}
                                                    size="small"
                                                    variant="outlined"
                                                    color="info"
                                                />
                                            ))}
                                        </Box>
                                    </Box>
                                ))}
                            </Paper>
                        )}

                        {/* 技术信息 */}
                        <Paper sx={{ p: 2 }}>
                            <Typography variant="h6" gutterBottom sx={{ fontWeight: 600, color: 'primary.main' }}>
                                技术信息
                            </Typography>
                            <Divider sx={{ mb: 2 }} />
                            <Box sx={{
                                display: 'grid',
                                gridTemplateColumns: {
                                    xs: '1fr',
                                    sm: '1fr 1fr',
                                    md: '1fr 1fr 1fr',
                                    lg: '1fr 1fr 1fr 1fr'
                                },
                                gap: 2
                            }}>
                                <Typography variant="body2" color="text.secondary">
                                    <strong>UUID：</strong>
                                    <Box component="span" sx={{ fontFamily: 'monospace', fontSize: '0.85em' }}>
                                        {book.uuid}
                                    </Box>
                                </Typography>
                                <Typography variant="body2" color="text.secondary">
                                    <strong>文件 MD5：</strong>
                                    <Box component="span" sx={{ fontFamily: 'monospace', fontSize: '0.85em' }}>
                                        {book.file_md5}
                                    </Box>
                                </Typography>
                                <Typography variant="body2" color="text.secondary">
                                    <strong>学科代码：</strong> {book.subject}
                                </Typography>
                                <Typography variant="body2" color="text.secondary">
                                    <strong>学科名称：</strong> {book.subject_str}
                                </Typography>
                                <Typography variant="body2" color="text.secondary">
                                    <strong>年级代码：</strong> {book.grade}
                                </Typography>
                                <Typography variant="body2" color="text.secondary">
                                    <strong>学期代码：</strong> {book.term}
                                </Typography>
                                <Typography variant="body2" color="text.secondary">
                                    <strong>教材类型：</strong> {book.textbook_material_type}
                                </Typography>
                                <Typography variant="body2" color="text.secondary">
                                    <strong>用书类型：</strong> {book.use_type}
                                </Typography>
                                <Typography variant="body2" color="text.secondary">
                                    <strong>当前学期：</strong> {book.is_current_term === 1 ? '是' : '否'}
                                </Typography>
                                <Typography variant="body2" color="text.secondary">
                                    <strong>状态代码：</strong> {book.status}
                                </Typography>
                                <Typography variant="body2" color="text.secondary">
                                    <strong>正文起始页：</strong> {book.text_start_page}
                                </Typography>
                                <Typography variant="body2" color="text.secondary">
                                    <strong>更新时间：</strong> {formatUpdateTime(book.update_time)}
                                </Typography>
                            </Box>
                        </Paper>

                        {/* 文件链接 */}
                        <Paper sx={{ p: 2 }}>
                            <Typography variant="h6" gutterBottom sx={{ fontWeight: 600, color: 'primary.main' }}>
                                相关链接
                            </Typography>
                            <Divider sx={{ mb: 2 }} />
                            <Box sx={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
                                <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                                    <CloudDownloadIcon color="primary" />
                                    <Typography variant="body2" sx={{ mr: 1 }}>
                                        <strong>课本数据文件：</strong>
                                    </Typography>
                                    <MuiLink
                                        href={book.file_path}
                                        target="_blank"
                                        rel="noopener noreferrer"
                                        sx={{
                                            display: 'flex',
                                            alignItems: 'center',
                                            gap: 0.5,
                                            wordBreak: 'break-all',
                                            flex: 1
                                        }}
                                    >
                                        {book.file_path}
                                        <OpenInNewIcon fontSize="small" />
                                    </MuiLink>
                                </Box>

                                <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                                    <CloudDownloadIcon color="primary" />
                                    <Typography variant="body2" sx={{ mr: 1 }}>
                                        <strong>封面图片：</strong>
                                    </Typography>
                                    <MuiLink
                                        href={book.cover_path}
                                        target="_blank"
                                        rel="noopener noreferrer"
                                        sx={{
                                            display: 'flex',
                                            alignItems: 'center',
                                            gap: 0.5,
                                            wordBreak: 'break-all',
                                            flex: 1
                                        }}
                                    >
                                        {book.cover_path}
                                        <OpenInNewIcon fontSize="small" />
                                    </MuiLink>
                                </Box>

                                <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                                    <GitHubIcon color="primary" />
                                    <Typography variant="body2" sx={{ mr: 1 }}>
                                        <strong>GitHub 源文件：</strong>
                                    </Typography>
                                    <MuiLink
                                        href={getGitHubUrl(book.uuid)}
                                        target="_blank"
                                        rel="noopener noreferrer"
                                        sx={{
                                            display: 'flex',
                                            alignItems: 'center',
                                            gap: 0.5,
                                            wordBreak: 'break-all',
                                            flex: 1
                                        }}
                                    >
                                        {getGitHubUrl(book.uuid)}
                                        <OpenInNewIcon fontSize="small" />
                                    </MuiLink>
                                </Box>
                            </Box>
                        </Paper>
                    </Box>
                ) : (
                    <Box sx={{ textAlign: 'center', py: 4 }}>
                        <Typography variant="body1" color="text.secondary">
                            无法加载课本详细信息
                        </Typography>
                    </Box>
                )}
            </DialogContent>

            <DialogActions sx={{ px: 3, pb: 2 }}>
                <Button onClick={onClose} variant="outlined">
                    关闭
                </Button>
            </DialogActions>
        </Dialog>
    );
}
