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

import { useMemo, useState } from "react";
import Box from "@mui/material/Box";
import Button from "@mui/material/Button";
import IconButton from "@mui/material/IconButton";
import Tooltip from "@mui/material/Tooltip";
import Typography from "@mui/material/Typography";
import useMediaQuery from "@mui/material/useMediaQuery";
import { useTheme } from "@mui/material/styles";
import InfoIcon from "@mui/icons-material/Info";
import DownloadIcon from "@mui/icons-material/Download";
import {
	DataGrid,
	type GridColDef,
	type GridColumnVisibilityModel,
	type GridPaginationModel,
} from "@mui/x-data-grid";
import { zhCN } from "@mui/x-data-grid/locales";
import { Textbook } from "@/types/textbook";
import {
	getGradeDisplayName,
	getTermDisplayName,
	getPublisherDisplayName,
	getUseTypeDisplayName,
} from "@/utils/helpers";

interface BookListProps {
	books: Textbook[];
	selectedBookIds: string[];
	onSelectionChange: (ids: string[]) => void;
	onShowDetail: (id: string) => void;
	onDownload: (id: string) => void;
}

const collator = new Intl.Collator("zh-CN", { numeric: true });
const getBookId = (book: Textbook) => book.uuid;
const getRowHeight = () => "auto" as const;

export default function BookList({
	books,
	selectedBookIds,
	onSelectionChange,
	onShowDetail,
	onDownload,
}: BookListProps) {
	const isMobile = useMediaQuery(useTheme().breakpoints.down("sm"));
	const [pagination, setPagination] = useState<GridPaginationModel>({
		page: 0,
		pageSize: 50,
	});
	const [visibility, setVisibility] = useState<GridColumnVisibilityModel>({});
	const selection = useMemo(
		() => ({ type: "include" as const, ids: new Set(selectedBookIds) }),
		[selectedBookIds],
	);

	const columns = useMemo<GridColDef<Textbook>[]>(
		() => [
			{
				field: "title",
				headerName: "书名",
				flex: 1,
				minWidth: isMobile ? 170 : 250,
				sortComparator: (a, b) => collator.compare(a ?? "", b ?? ""),
				renderCell: ({ value }) => (
					<Typography
						variant="body2"
						sx={{ py: 1, whiteSpace: "normal", overflowWrap: "anywhere" }}
					>
						{value}
					</Typography>
				),
			},
			{
				field: "grade",
				headerName: "年级",
				width: 130,
				valueGetter: (_, book) => getGradeDisplayName(book.grade),
				sortComparator: (a, b) => collator.compare(a, b),
			},
			{
				field: "term",
				headerName: "学期",
				width: 120,
				valueGetter: (_, book) => getTermDisplayName(book.term),
			},
			{ field: "subject_str", headerName: "科目", width: 110 },
			{
				field: "use_year",
				headerName: "使用年份",
				width: 110,
				valueFormatter: (value) => value || "未知",
				getSortComparator: (direction) => (a, b) => {
					const left = String(a ?? "").trim();
					const right = String(b ?? "").trim();
					if (!left || !right) return left ? -1 : right ? 1 : 0;
					return collator.compare(left, right) * (direction === "asc" ? 1 : -1);
				},
			},
			{ field: "isbn", headerName: "ISBN", width: 160 },
			{ field: "short_title", headerName: "简称", width: 260 },
			{ field: "uuid", headerName: "UUID", width: 300 },
			{ field: "file_path", headerName: "课本文件地址", width: 320 },
			{ field: "file_md5", headerName: "文件 MD5", width: 300 },
			{ field: "cover_path", headerName: "封面地址", width: 320 },
			{
				field: "is_current_term",
				headerName: "当前学期",
				type: "boolean",
				width: 130,
				valueGetter: (_, book) => book.is_current_term === 1,
			},
			{
				field: "text_start_page",
				headerName: "正文起始页",
				type: "number",
				width: 140,
			},
			{ field: "update_time", headerName: "更新时间", width: 190 },
			{ field: "subject", headerName: "学科代码", width: 120 },
			{
				field: "used_grade_semesters",
				headerName: "适用年级学期",
				width: 360,
				valueGetter: (_, book) =>
					JSON.stringify(book.used_grade_semesters ?? []),
			},
			{ field: "textbook_material_type", headerName: "教材类型", width: 150 },
			{
				field: "publisher",
				headerName: "出版社",
				width: 200,
				valueGetter: (_, book) =>
					book.publisher ? getPublisherDisplayName(book.publisher) : "",
			},
			{
				field: "use_type",
				headerName: "用书类型",
				width: 150,
				valueGetter: (_, book) => getUseTypeDisplayName(book.use_type),
			},
			{
				field: "status",
				headerName: "状态",
				type: "singleSelect",
				width: 120,
				valueOptions: [
					{ value: "1", label: "可用" },
					{ value: "0", label: "不可用" },
				],
			},

			{
				field: "actions",
				headerName: "操作",
				width: isMobile ? 96 : 176,
				sortable: false,
				filterable: false,
				disableColumnMenu: true,
				disableExport: true,
				display: "flex",
				renderCell: ({ row }) => (
					<Box sx={{ display: "flex", gap: 1 }}>
						{isMobile ? (
							<>
								<Tooltip title="详情">
									<IconButton
										aria-label={`查看 ${row.title} 详情`}
										size="small"
										onClick={() => onShowDetail(row.uuid)}
									>
										<InfoIcon fontSize="small" />
									</IconButton>
								</Tooltip>
								<Tooltip title="下载">
									<IconButton
										aria-label={`下载 ${row.title}`}
										color="primary"
										size="small"
										onClick={() => onDownload(row.uuid)}
									>
										<DownloadIcon fontSize="small" />
									</IconButton>
								</Tooltip>
							</>
						) : (
							<>
								<Button
									size="small"
									variant="outlined"
									startIcon={<InfoIcon />}
									onClick={() => onShowDetail(row.uuid)}
								>
									详情
								</Button>
								<Button
									size="small"
									variant="contained"
									startIcon={<DownloadIcon />}
									onClick={() => onDownload(row.uuid)}
								>
									下载
								</Button>
							</>
						)}
					</Box>
				),
			},
		],
		[isMobile, onShowDetail, onDownload],
	);

	const resetPageAndSelection = () => {
		setPagination((prev) => ({ ...prev, page: 0 }));
		onSelectionChange([]);
	};

	return (
		<Box
			sx={{
				height: "85dvh",
				minHeight: { xs: 500, sm: 800 },
				width: "100%",
				minWidth: 0,
				mb: 3,
			}}
		>
			<DataGrid
				label="教科书列表"
				rows={books}
				columns={columns}
				getRowId={getBookId}
				getRowHeight={getRowHeight}
				density="compact"
				localeText={zhCN.components.MuiDataGrid.defaultProps.localeText}
				slotProps={{
					filterPanel: {
						sx: {
							width: { xs: "calc(100vw - 32px)", sm: "auto" },
							maxHeight: "70dvh",
							overflowY: "auto",
							"& .MuiDataGrid-filterForm": {
								flexWrap: { xs: "wrap", sm: "nowrap" },
							},
							"& .MuiDataGrid-filterForm > .MuiFormControl-root": {
								flex: { xs: "1 1 120px", sm: "initial" },
								minWidth: 0,
							},
							"& .MuiDataGrid-filterFormColumnInput, & .MuiDataGrid-filterFormOperatorInput":
								{ width: { xs: "100%", sm: 150 } },
							"& .MuiDataGrid-filterFormValueInput": {
								width: { xs: "100%", sm: 190 },
							},
						},
					},
				}}
				showToolbar
				checkboxSelection
				disableRowSelectionOnClick
				disableRowSelectionExcludeModel
				rowSelectionModel={selection}
				onRowSelectionModelChange={(model) =>
					onSelectionChange(
						model.type === "include"
							? Array.from(model.ids, String)
							: books
									.filter((book) => !model.ids.has(book.uuid))
									.map(getBookId),
					)
				}
				paginationModel={pagination}
				onPaginationModelChange={(model) =>
					setPagination((previous) => ({
						...model,
						page: model.pageSize === previous.pageSize ? model.page : 0,
					}))
				}
				pageSizeOptions={[10, 20, 25, 50, 75, 100, 250, 500]}
				onSortModelChange={resetPageAndSelection}
				onFilterModelChange={resetPageAndSelection}
				columnVisibilityModel={{
					...Object.fromEntries(
						columns.map(({ field }) => [
							field,
							(isMobile
								? ["title", "use_year", "actions"]
								: [
										"title",
										"grade",
										"term",
										"subject_str",
										"use_year",
										"actions",
									]
							).includes(field),
						]),
					),
					...visibility,
				}}
				onColumnVisibilityModelChange={setVisibility}
				sx={{
					"& .MuiDataGrid-cell": { display: "flex", alignItems: "center" },
					"& .MuiDataGrid-cell[data-field='actions']": { py: 0.5 },
					"& .MuiDataGrid-toolbarLabel": {
						display: { xs: "none", sm: "block" },
					},
					"& .MuiTablePagination-selectLabel": {
						display: { xs: "none", sm: "block" },
					},
					"& .MuiTablePagination-toolbar": { px: { xs: 0.5, sm: 2 } },
					"& .MuiTablePagination-spacer": {
						display: { xs: "none", sm: "block" },
					},
					"& .MuiTablePagination-input": { mx: { xs: 0.5, sm: 1 } },
					"& .MuiTablePagination-actions": { ml: { xs: 0.5, sm: 2 } },
					"& .MuiDataGrid-selectedRowCount": {
						display: { xs: "none", sm: "block" },
					},
				}}
			/>
		</Box>
	);
}
