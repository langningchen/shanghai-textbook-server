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

export interface SourcePreset {
    id: string;
    name: string;
    url: string;
}

export const DEFAULT_PREFIX =
    "https://raw.githubusercontent.com/langningchen/shanghai-textbook-data/refs/heads/main/books";

export const SOURCE_PRESETS: SourcePreset[] = [
    {
        id: "github-raw",
        name: "GitHub 官方源",
        url: "https://raw.githubusercontent.com/langningchen/shanghai-textbook-data/refs/heads/main/books",
    },
    {
        id: "jsdelivr",
        name: "jsDelivr CDN",
        url: "https://cdn.jsdelivr.net/gh/langningchen/shanghai-textbook-data@main/books",
    },
    {
        id: "jsdelivr-fastly",
        name: "jsDelivr CDN (Fastly)",
        url: "https://fastly.jsdelivr.net/gh/langningchen/shanghai-textbook-data@main/books",
    },
    {
        id: "jsdelivr-cloudflare",
        name: "jsDelivr CDN (Cloudflare)",
        url: "https://testingcf.jsdelivr.net/gh/langningchen/shanghai-textbook-data@main/books",
    },
    {
        id: "ghproxy",
        name: "GHProxy",
        url: "https://ghfast.top/https://raw.githubusercontent.com/langningchen/shanghai-textbook-data/refs/heads/main/books",
    },
];

export function getPrefix(): string {
    return localStorage.getItem("githubPrefix") || DEFAULT_PREFIX;
}

export function setPrefix(newPrefix: string) {
    localStorage.setItem("githubPrefix", newPrefix.trim());
}

export function changePrefix(newPrefix: string) {
    setPrefix(newPrefix);
    window.location.reload();
}

const getGitHubUrl = (file: string) => {
    return `${getPrefix()}/${file}`;
};

export const getIndexUrl = () =>
    getGitHubUrl(`bookcase.json`);

export const getJsonUrl = (uuid: string) =>
    getGitHubUrl(`${uuid.slice(0, 2)}/${uuid}.json`);

export const getPdfPrefix = (uuid: string) =>
    getGitHubUrl(`${uuid.slice(0, 2)}/${uuid}.pdf`);

export function getCoverUrls(uuid: string) {
    return [
        getGitHubUrl(`${uuid.slice(0, 2)}/${uuid}.jpg`),
        getGitHubUrl(`${uuid.slice(0, 2)}/${uuid}.png`),
    ];
}

export async function testSourceLatency(baseUrl: string): Promise<number> {
    const testUrl = `${baseUrl}/bookcase.json?_t=${Date.now()}`;
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 6000);
    const startTime = performance.now();

    try {
        const response = await fetch(testUrl, {
            method: "GET",
            signal: controller.signal,
        });
        clearTimeout(timeoutId);

        if (!response.ok) return -1;

        const reader = response.body?.getReader();
        if (reader) {
            await reader.read();
            reader.cancel();
        }
        return Math.round(performance.now() - startTime);
    } catch {
        clearTimeout(timeoutId);
        return -1;
    }
}
