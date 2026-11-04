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
    getSourcePrefix,
    changePrefix,
    testSourceLatency,
} from "@/utils/url";

interface SourceMeasurement {
    first: number;
    samples: number[];
    attempts: number;
}

const median = (samples: number[]) => {
    if (!samples.length) return -1;
    const sorted = [...samples].sort((a, b) => a - b);
    const middle = Math.floor(sorted.length / 2);
    return Math.round(
        sorted.length % 2
            ? sorted[middle]
            : (sorted[middle - 1] + sorted[middle]) / 2,
    );
};

interface SourceSwitchDialogProps {
    open: boolean;
    onClose: () => void;
}

export default function SourceSwitchDialog({
    open,
    onClose,
}: SourceSwitchDialogProps) {
    const [selectedSource, setSelectedSource] =
        useState<string>(getSourcePrefix);
    const [measurements, setMeasurements] = useState<
        Record<string, SourceMeasurement>
    >({});
    const [testingMap, setTestingMap] = useState<Record<string, boolean>>({});
    const [testingAll, setTestingAll] = useState(false);
    const runRef = useRef<AbortController | null>(null);

    const testOneSource = useCallback(
        async (
            url: string,
            controller: AbortController,
            rounds = 1,
            initial?: SourceMeasurement,
        ) => {
            if (controller.signal.aborted) return;
            setTestingMap((prev) => ({ ...prev, [url]: true }));
            const result: SourceMeasurement = initial
                ? { ...initial, samples: [...initial.samples] }
                : { first: -1, samples: [], attempts: 0 };
            for (let round = 0; round < rounds; round++) {
                const latency = await testSourceLatency(url, controller.signal);
                if (controller.signal.aborted) return;
                if (result.attempts === 0) result.first = latency;
                result.attempts++;
                if (latency >= 0) result.samples.push(latency);
            }
            if (!controller.signal.aborted) {
                setMeasurements((prev) => ({ ...prev, [url]: result }));
                setTestingMap((prev) => ({ ...prev, [url]: false }));
            }
            return result;
        },
        [],
    );

    const testAllSources = useCallback(async () => {
        runRef.current?.abort();
        const controller = new AbortController();
        runRef.current = controller;
        setMeasurements({});
        setTestingMap({});
        setTestingAll(true);
        const initialResults = new Map<string, SourceMeasurement>();
        let index = 0;
        const workers = Array.from(
            { length: Math.min(8, SOURCE_PRESETS.length) },
            async () => {
                while (
                    index < SOURCE_PRESETS.length &&
                    !controller.signal.aborted
                ) {
                    const source = SOURCE_PRESETS[index++];
                    const result = await testOneSource(source, controller);
                    if (result) initialResults.set(source, result);
                }
            },
        );
        await Promise.all(workers);
        if (controller.signal.aborted) return;
        // Retest only the fastest candidates, retaining their first-connection sample.
        const candidates = [...initialResults.entries()]
            .filter(([, result]) => result.samples.length > 0)
            .sort((a, b) => median(a[1].samples) - median(b[1].samples))
            .slice(0, 5);
        index = 0;
        await Promise.all(
            Array.from({ length: Math.min(3, candidates.length) }, async () => {
                while (
                    index < candidates.length &&
                    !controller.signal.aborted
                ) {
                    const [source, initial] = candidates[index++];
                    await testOneSource(source, controller, 2, initial);
                }
            }),
        );
        if (!controller.signal.aborted) setTestingAll(false);
    }, [testOneSource]);

    useEffect(() => {
        if (!open) return;
        // Schedule probes after mounting so Strict Mode can clean up before requests start.
        const timer = setTimeout(() => void testAllSources(), 0);
        return () => {
            clearTimeout(timer);
            runRef.current?.abort();
        };
    }, [open, testAllSources]);

    const retestSource = (url: string) => {
        if (testingAll || testingMap[url]) return;
        if (!runRef.current || runRef.current.signal.aborted)
            runRef.current = new AbortController();
        void testOneSource(url, runRef.current, 3);
    };

    const handleApply = () => {
        if (SOURCE_PRESETS.includes(selectedSource))
            changePrefix(selectedSource);
    };

    const renderLatencyChip = (url: string) => {
        const isTesting = testingMap[url];
        const measurement = measurements[url];
        const latency = measurement ? median(measurement.samples) : undefined;

        if (isTesting) {
            return <Chip size="small" label="测速中..." variant="outlined" />;
        }

        if (latency === undefined || latency === null) {
            return (
                <Chip
                    size="small"
                    label="未测速"
                    onClick={(e) => {
                        e.stopPropagation();
                        retestSource(url);
                    }}
                    disabled={testingAll}
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
                        retestSource(url);
                    }}
                    disabled={testingAll}
                    clickable
                />
            );
        }

        const color =
            latency < 300 ? "success" : latency < 800 ? "warning" : "error";

        return (
            <Tooltip
                title={`首次：${measurement!.first >= 0 ? `${measurement!.first} ms` : "失败"}；成功 ${measurement!.samples.length}/${measurement!.attempts} 次`}
            >
                <Chip
                    size="small"
                    color={color}
                    label={`${latency} ms${measurement!.attempts > 1 ? ` · ${measurement!.samples.length}/${measurement!.attempts}` : ""}`}
                    onClick={(e) => {
                        e.stopPropagation();
                        retestSource(url);
                    }}
                    disabled={testingAll}
                    clickable
                />
            </Tooltip>
        );
    };

    return (
        <Dialog
            open={open}
            onClose={onClose}
            maxWidth="xl"
            fullWidth
            slotProps={{
                paper: {
                    sx: {
                        m: { xs: 1, sm: 4 },
                        width: {
                            xs: "calc(100% - 16px)",
                            sm: "calc(100% - 64px)",
                        },
                        maxHeight: {
                            xs: "calc(100dvh - 16px)",
                            sm: "calc(100% - 64px)",
                        },
                    },
                },
            }}
        >
            <DialogTitle
                sx={{
                    display: "flex",
                    justifyContent: "space-between",
                    alignItems: "center",
                    pb: 1,
                    px: { xs: 2, sm: 3 },
                }}
            >
                <Typography
                    variant="h6"
                    component="div"
                    sx={{ fontWeight: 600 }}
                >
                    切换数据源
                </Typography>
                <IconButton
                    aria-label="关闭数据源设置"
                    onClick={onClose}
                    sx={{ color: "grey.500" }}
                >
                    <CloseIcon />
                </IconButton>
            </DialogTitle>

            <DialogContent dividers sx={{ px: { xs: 1.5, sm: 3 } }}>
                <Box
                    sx={{
                        display: "flex",
                        justifyContent: "flex-end",
                        alignItems: "center",
                        mb: 1,
                    }}
                >
                    <Tooltip title="全部重新测速">
                        <IconButton
                            size="small"
                            color="primary"
                            onClick={() => void testAllSources()}
                        >
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
                        gridTemplateColumns: {
                            xs: "minmax(0, 1fr)",
                            sm: "repeat(auto-fill, minmax(240px, 1fr))",
                        },
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
                                    borderColor: isSelected
                                        ? "primary.main"
                                        : "divider",
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
                                        flex: 1,
                                    }}
                                >
                                    <Radio
                                        checked={isSelected}
                                        value={preset}
                                        name="source-radio"
                                        slotProps={{
                                            input: { "aria-label": labelText },
                                        }}
                                        size="small"
                                    />
                                    <Tooltip
                                        title={labelText}
                                        disableInteractive
                                    >
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

            <DialogActions
                sx={{
                    px: { xs: 1.5, sm: 3 },
                    py: 2,
                    pb: "max(16px, env(safe-area-inset-bottom))",
                    "& .MuiButton-root": {
                        minHeight: { xs: 44, sm: "auto" },
                        flex: { xs: 1, sm: "initial" },
                    },
                }}
            >
                <Button onClick={onClose} variant="outlined" color="inherit">
                    取消
                </Button>
                <Button onClick={handleApply} variant="contained">
                    切换
                </Button>
            </DialogActions>
        </Dialog>
    );
}
