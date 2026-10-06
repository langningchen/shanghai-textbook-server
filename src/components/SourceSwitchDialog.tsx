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

import { useState, useEffect, useCallback, useRef } from "react";
import Dialog from "@mui/material/Dialog";
import DialogTitle from "@mui/material/DialogTitle";
import DialogContent from "@mui/material/DialogContent";
import DialogActions from "@mui/material/DialogActions";
import Typography from "@mui/material/Typography";
import Button from "@mui/material/Button";
import Box from "@mui/material/Box";
import Radio from "@mui/material/Radio";
import RadioGroup from "@mui/material/RadioGroup";
import Chip from "@mui/material/Chip";
import IconButton from "@mui/material/IconButton";
import Tooltip from "@mui/material/Tooltip";
import Paper from "@mui/material/Paper";
import CloseIcon from "@mui/icons-material/Close";
import RefreshIcon from "@mui/icons-material/Refresh";

import {
    SOURCE_PRESETS,
    getPrefix,
    changePrefix,
    testSourceLatency,
} from "@/utils/url";

interface SourceSwitchDialogProps {
    open: boolean;
    onClose: () => void;
}

export default function SourceSwitchDialog({
    open,
    onClose,
}: SourceSwitchDialogProps) {
    const [selectedSource, setSelectedSource] = useState<string>("");
    const [latencies, setLatencies] = useState<Record<string, number | null>>({});
    const [testingMap, setTestingMap] = useState<Record<string, boolean>>({});

    const abortRef = useRef<boolean>(false);

    const testOneSource = useCallback(async (url: string) => {
        setTestingMap((prev) => ({ ...prev, [url]: true }));
        try {
            const latency = await testSourceLatency(url);
            if (!abortRef.current) {
                setLatencies((prev) => ({ ...prev, [url]: latency }));
            }
        } finally {
            if (!abortRef.current) {
                setTestingMap((prev) => ({ ...prev, [url]: false }));
            }
        }
    }, []);

    const testAllSources = useCallback(async () => {
        abortRef.current = true;
        await Promise.resolve();
        abortRef.current = false;
        setLatencies({});
        setTestingMap({});
        let index = 0;
        const workerCount = Math.min(3, SOURCE_PRESETS.length);
        const workers = Array.from({ length: workerCount }, async () => {
            while (index < SOURCE_PRESETS.length) {
                const preset = SOURCE_PRESETS[index++];
                if (abortRef.current) return;
                await testOneSource(preset);
            }
        });
        await Promise.all(workers);
    }, [testOneSource]);

    useEffect(() => {
        if (open) {
            abortRef.current = false;
            const current = getPrefix();
            setSelectedSource(current);
            testAllSources();
        } else {
            abortRef.current = true;
        }
    }, [open, testAllSources]);

    const handleApply = () => {
        if (!selectedSource) return;
        changePrefix(selectedSource);
    };

    const renderLatencyChip = (url: string) => {
        const isTesting = testingMap[url];
        const latency = latencies[url];

        if (isTesting) {
            return (
                <Chip
                    size="small"
                    label="测速中..."
                    variant="outlined"
                />
            );
        }

        if (latency === undefined || latency === null) {
            return (
                <Chip
                    size="small"
                    label="未测速"
                    onClick={(e) => {
                        e.stopPropagation();
                        testOneSource(url);
                    }}
                    clickable
                />
            );
        }

        if (latency < 0) {
            return (
                <Chip
                    size="small"
                    color="error"
                    label="不可用"
                    onClick={(e) => {
                        e.stopPropagation();
                        testOneSource(url);
                    }}
                    clickable
                />
            );
        }

        const color =
            latency < 300 ? "success" : latency < 800 ? "warning" : "error";

        return (
            <Chip
                size="small"
                color={color}
                label={`${latency} ms`}
                onClick={(e) => {
                    e.stopPropagation();
                    testOneSource(url);
                }}
                clickable
            />
        );
    };

    return (
        <Dialog open={open} onClose={onClose} maxWidth="xl" fullWidth>
            <DialogTitle
                sx={{
                    display: "flex",
                    justifyContent: "space-between",
                    alignItems: "center",
                    pb: 1,
                }}
            >
                <Typography variant="h6" component="div" sx={{ fontWeight: 600 }}>
                    切换数据源
                </Typography>
                <IconButton onClick={onClose} size="small" sx={{ color: "grey.500" }}>
                    <CloseIcon />
                </IconButton>
            </DialogTitle>

            <DialogContent dividers>
                <Box
                    sx={{
                        display: "flex",
                        justifyContent: "space-between",
                        alignItems: "center",
                        mb: 2,
                    }}
                >
                    <Typography variant="body2" color="text.secondary">
                        若下载慢或封面加载失败，请切换至延迟更低的源。
                    </Typography>
                    <Tooltip title="全部重新测速">
                        <IconButton size="small" color="primary" onClick={testAllSources}>
                            <RefreshIcon />
                        </IconButton>
                    </Tooltip>
                </Box>

                <RadioGroup
                    value={
                        SOURCE_PRESETS.some((p) => p === selectedSource)
                            ? selectedSource
                            : "custom"
                    }
                    onChange={(e) => setSelectedSource(e.target.value)}
                    sx={{
                        display: "grid",
                        gridTemplateColumns: "repeat(auto-fill, minmax(240px, 1fr))",
                        gap: 1,
                    }}
                >
                    {SOURCE_PRESETS.map((preset) => {
                        const isSelected = selectedSource === preset;
                        const labelText = preset || "GitHub 官方";
                        return (
                            <Paper
                                key={preset}
                                variant="outlined"
                                sx={{
                                    borderRadius: 2,
                                    borderColor: isSelected ? "primary.main" : "divider",
                                    backgroundColor: isSelected
                                        ? "action.selected"
                                        : "background.paper",
                                    cursor: "pointer",
                                    display: "flex",
                                    alignItems: "center",
                                    justifyContent: "space-between",
                                }}
                                onClick={() => setSelectedSource(preset)}
                            >
                                <Box
                                    sx={{
                                        display: "flex",
                                        alignItems: "center",
                                        minWidth: 0,
                                    }}
                                >
                                    <Radio
                                        checked={isSelected}
                                        value={preset}
                                        name="source-radio"
                                        size="small"
                                    />
                                    <Tooltip title={labelText} disableInteractive>
                                        <Typography
                                            variant="subtitle2"
                                            noWrap
                                            sx={{
                                                fontWeight: "bold",
                                                overflow: "hidden",
                                                textOverflow: "ellipsis",
                                                whiteSpace: "nowrap",
                                            }}
                                        >
                                            {labelText}
                                        </Typography>
                                    </Tooltip>
                                </Box>
                                <Box sx={{ mx: 1, flexShrink: 0 }}>
                                    {renderLatencyChip(preset)}
                                </Box>
                            </Paper>
                        );
                    })}
                </RadioGroup>
            </DialogContent>

            <DialogActions sx={{ px: 3, py: 2 }}>
                <Button onClick={onClose} variant="outlined" color="inherit">
                    取消
                </Button>
                <Button
                    onClick={handleApply}
                    variant="contained"
                >
                    切换
                </Button>
            </DialogActions>
        </Dialog>
    );
}
