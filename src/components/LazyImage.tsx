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
import { useInView } from 'react-intersection-observer';
import { Box, Skeleton } from '@mui/material';
import { SxProps, Theme } from '@mui/material/styles';
import Image from 'next/image';

interface LazyImageProps {
    src: string;
    alt: string;
    width?: number | string;
    height?: number | string;
    sx?: SxProps<Theme>;
}

export default function LazyImage({ src, alt, width = '100%', height = 320, sx = {} }: LazyImageProps) {
    const [imageLoaded, setImageLoaded] = useState(false);
    const [imageError, setImageError] = useState(false);

    const { ref, inView } = useInView({
        threshold: 0.1,
        triggerOnce: true,
    });

    const handleImageLoad = () => {
        setImageLoaded(true);
    };

    const handleImageError = () => {
        setImageError(true);
    };

    return (
        <Box
            ref={ref}
            sx={{
                width,
                height,
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                backgroundColor: 'grey.100',
                borderRadius: 1,
                overflow: 'hidden',
                position: 'relative', // Required for Next.js Image with fill
                ...sx,
            }}
        >
            {!inView ? (
                <Skeleton
                    variant="rectangular"
                    width="100%"
                    height="100%"
                    animation="wave"
                />
            ) : imageError ? (
                <Box
                    sx={{
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        width: '100%',
                        height: '100%',
                        color: 'text.secondary',
                        fontSize: '0.875rem',
                    }}
                >
                    暂无封面
                </Box>
            ) : (
                <>
                    {/* Skeleton 作为覆盖层，图片始终渲染，不用 display:none 隐藏图片 */}
                    <Image
                        src={src}
                        alt={alt}
                        fill
                        style={{
                            objectFit: 'contain',
                        }}
                        onLoad={handleImageLoad}
                        onError={handleImageError}
                        unoptimized
                    />
                    {!imageLoaded && (
                        <Skeleton
                            variant="rectangular"
                            width="100%"
                            height="100%"
                            animation="wave"
                            sx={{ position: 'absolute', top: 0, left: 0, zIndex: 2 }}
                        />
                    )}
                </>
            )}
        </Box>
    );
}
