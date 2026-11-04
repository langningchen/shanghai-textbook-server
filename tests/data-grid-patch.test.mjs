import assert from "node:assert/strict";
import { createRequire } from "node:module";
import path from "node:path";
import { pathToFileURL } from "node:url";
import test from "node:test";
import React from "react";
import { renderToStaticMarkup } from "react-dom/server";

const require = createRequire(import.meta.url);
const gridRoot = path.dirname(require.resolve("@mui/x-data-grid/package.json"));

for (const extension of ["js", "mjs"]) {
	const load = (file) =>
		import(pathToFileURL(path.join(gridRoot, `${file}.${extension}`)));
	await test(`${extension}: 250/500-row pages work and retain correct page counts`, async () => {
		const pagination = await load(
			"hooks/features/pagination/gridPaginationUtils",
		);
		for (const pageSize of [250, 500]) {
			assert.doesNotThrow(() =>
				pagination.throwIfPageSizeExceedsTheLimit(pageSize, "DataGrid"),
			);
			assert.equal(
				pagination.getPageCount(1251, pageSize, 0),
				Math.ceil(1251 / pageSize),
			);
		}
		assert.throws(() =>
			pagination.throwIfPageSizeExceedsTheLimit(501, "DataGrid"),
		);
	});

	await test(`${extension}: grid preserves multiple filter rules`, async () => {
		const { useDataGridProps } = await load("DataGrid/useDataGridProps");
		const { sanitizeFilterModel } = await load(
			"hooks/features/filter/gridFilterUtils",
		);
		const rules = {
			items: [
				{ id: "year", field: "use_year", operator: "equals", value: "2024" },
				{
					id: "subject",
					field: "subject_str",
					operator: "equals",
					value: "数学",
				},
			],
			logicOperator: "and",
		};
		function Probe() {
			const props = useDataGridProps({});
			const result = sanitizeFilterModel(
				rules,
				props.disableMultipleColumnsFiltering,
				{ current: {} },
			);
			return React.createElement("span", null, JSON.stringify(result));
		}
		const markup = renderToStaticMarkup(React.createElement(Probe));
		assert.match(markup, /use_year/);
		assert.match(markup, /subject_str/);
	});
}
