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

import { useEffect, useState } from "react";

import Alert from "@mui/material/Alert";
import Box from "@mui/material/Box";
import Button from "@mui/material/Button";
import Typography from "@mui/material/Typography";

export interface RotatingAlertItem {
	text: string;
	actionLabel?: string;
	onAction?: () => void;
}

interface RotatingAlertProps {
	items: RotatingAlertItem[];
	interval?: number;
}

export default function RotatingAlert({
	items,
	interval = 8000,
}: RotatingAlertProps) {
	const [step, setStep] = useState(0);
	const itemCount = items.length;

	// The timer only advances an index; the render below clamps it, so a
	// shrinking item list can never read past the end.
	useEffect(() => {
		if (itemCount < 2) return;
		const timer = setInterval(
			() => setStep((previous) => (previous + 1) % itemCount),
			interval,
		);
		return () => clearInterval(timer);
	}, [itemCount, interval]);

	const item = items[step % Math.max(itemCount, 1)];
	if (!item) return null;

	return (
		<Alert
			severity="info"
			sx={{
				py: 0,
				height: 40,
				width: "100%",
				alignItems: "center",
				whiteSpace: "nowrap",
				overflow: "hidden",
			}}
		>
			<Box
				sx={{
					display: "flex",
					alignItems: "center",
					gap: 1.5,
					width: "100%",
					minWidth: 0,
					overflow: "hidden",
				}}
			>
				<Typography
					variant="body2"
					noWrap
					title={item.text}
					sx={{ minWidth: 0, overflow: "hidden", textOverflow: "ellipsis" }}
				>
					{item.text}
				</Typography>
				{item.actionLabel && item.onAction && (
					<Button
						size="small"
						variant="outlined"
						sx={{ minHeight: 26, flexShrink: 0 }}
						onClick={item.onAction}
					>
						{item.actionLabel}
					</Button>
				)}
			</Box>
		</Alert>
	);
}
