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
    Box,
    Card,
    CardContent,
    TextField,
    Button,
    Typography,
    Autocomplete,
} from '@mui/material';
import { FilterList as FilterIcon, Clear as ClearIcon } from '@mui/icons-material';
import { FilterOptions, Textbook } from '@/types/textbook';
import {
    GRADE_OPTIONS,
    TERM_OPTIONS,
    PUBLISHER_OPTIONS,
    USE_TYPE_OPTIONS
} from '@/utils/constants';
import { getUniqueSubjects } from '@/utils/helpers';

interface BookFilterProps {
    filters: FilterOptions;
    onFiltersChange: (filters: FilterOptions) => void;
    onClearFilters: () => void;
    books: Textbook[];
}

export default function BookFilter({
    filters,
    onFiltersChange,
    onClearFilters,
    books
}: BookFilterProps) {
    const uniqueSubjects = getUniqueSubjects(books);

    const handleFilterChange = (key: keyof FilterOptions, value: string) => {
        onFiltersChange({
            ...filters,
            [key]: value || undefined,
        });
    };

    const hasActiveFilters = Object.values(filters).some(value => value);

    return (
        <Card sx={{ mb: 3 }}>
            <CardContent>
                <Box sx={{ display: 'flex', alignItems: 'center', mb: 2 }}>
                    <FilterIcon sx={{ mr: 1, color: 'primary.main' }} />
                    <Typography variant="h6" component="h2">
                        筛选条件
                    </Typography>
                    {hasActiveFilters && (
                        <Button
                            variant="outlined"
                            size="small"
                            startIcon={<ClearIcon />}
                            onClick={onClearFilters}
                            sx={{ ml: 'auto' }}
                        >
                            清除筛选
                        </Button>
                    )}
                </Box>

                <Box
                    sx={{
                        display: 'grid',
                        gridTemplateColumns: {
                            xs: 'repeat(1, 1fr)',
                            sm: 'repeat(2, 1fr)',
                            md: 'repeat(3, 1fr)',
                            lg: 'repeat(6, 1fr)',
                        },
                        gap: 2,
                    }}
                >
                    <TextField
                        fullWidth
                        label="搜索"
                        placeholder="书名、科目..."
                        value={filters.search || ''}
                        onChange={(e) => handleFilterChange('search', e.target.value)}
                        size="small"
                    />

                    <Autocomplete
                        options={GRADE_OPTIONS}
                        getOptionLabel={(option) => option.label}
                        value={GRADE_OPTIONS.find(option => option.value === filters.grade) || null}
                        onChange={(_, value) => handleFilterChange('grade', value?.value || '')}
                        renderInput={(params) => (
                            <TextField
                                {...params}
                                label="年级"
                                placeholder="选择年级"
                                size="small"
                            />
                        )}
                        size="small"
                    />

                    <Autocomplete
                        options={TERM_OPTIONS}
                        getOptionLabel={(option) => option.label}
                        value={TERM_OPTIONS.find(option => option.value === filters.term) || null}
                        onChange={(_, value) => handleFilterChange('term', value?.value || '')}
                        renderInput={(params) => (
                            <TextField
                                {...params}
                                label="学期"
                                placeholder="选择学期"
                                size="small"
                            />
                        )}
                        size="small"
                    />

                    <Autocomplete
                        options={uniqueSubjects}
                        value={filters.subject || ''}
                        onChange={(_, value) => handleFilterChange('subject', value || '')}
                        renderInput={(params) => (
                            <TextField
                                {...params}
                                label="科目"
                                placeholder="选择科目"
                                size="small"
                            />
                        )}
                        size="small"
                    />

                    <Autocomplete
                        options={PUBLISHER_OPTIONS}
                        getOptionLabel={(option) => option.label}
                        value={PUBLISHER_OPTIONS.find(option => option.value === filters.publisher) || null}
                        onChange={(_, value) => handleFilterChange('publisher', value?.value || '')}
                        renderInput={(params) => (
                            <TextField
                                {...params}
                                label="出版社"
                                placeholder="选择出版社"
                                size="small"
                            />
                        )}
                        size="small"
                    />

                    <Autocomplete
                        options={USE_TYPE_OPTIONS}
                        getOptionLabel={(option) => option.label}
                        value={USE_TYPE_OPTIONS.find(option => option.value === filters.useType) || null}
                        onChange={(_, value) => handleFilterChange('useType', value?.value || '')}
                        renderInput={(params) => (
                            <TextField
                                {...params}
                                label="用书类型"
                                placeholder="选择用书类型"
                                size="small"
                            />
                        )}
                        size="small"
                    />
                </Box>
            </CardContent>
        </Card>
    );
}
