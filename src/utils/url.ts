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

export const DEFAULT_PREFIX = "";
export const GITHUB_MIDDLE = "https://raw.githubusercontent.com/langningchen/shanghai-textbook-data/refs/heads/main/books";
export const SOURCE_PRESETS = [
    "",
    "https://777.z321.cc.cd/",
    "https://axisnow.gh-proxy.org/",
    "https://cdn.akaere.online/",
    "https://cdn.gh-proxy.org/",
    "https://down.mxw.qzz.io/",
    "https://down.mxw.xx.kg/",
    "https://fastgit.cc/",
    "https://g.blfrp.cn/",
    "https://g.z321.cc.cd/",
    "https://getgit.love8yun.eu.org/",
    "https://gg.z321.cc.cd/",
    "https://ggg.clwap.dpdns.org/",
    "https://gh-proxy.com/",
    "https://gh-proxy.org/",
    "https://gh.07150721.xyz/",
    "https://gh.198962.xyz/",
    "https://gh.1k.ink/",
    "https://gh.39.al/",
    "https://gh.996986.xyz/",
    "https://gh.acmsz.top/",
    "https://gh.chjina.com/",
    "https://gh.halonice.com/",
    "https://gh.inkchills.cn/",
    "https://gh.jjj.gv.uy/",
    "https://gh.llkk.cc/",
    "https://gh.monlor.com/",
    "https://gh.noki.eu.org/",
    "https://gh.noki.icu/",
    "https://gh.nxnow.top/",
    "https://gh.padao.fun/",
    "https://gh.qninq.cn/",
    "https://gh.sixyin.com/",
    "https://ghfast.top/",
    "https://ghfile.geekertao.top/",
    "https://ghm.078465.xyz/",
    "https://ghp.keleyaa.com/",
    "https://ghproxy.053000.xyz/",
    "https://ghproxy.imciel.com/",
    "https://ghproxy.mirror.skybyte.me/",
    "https://ghproxy.monkeyray.net/",
    "https://ghproxy.net/",
    "https://ghproxy.xzhouqd.com/",
    "https://git.669966.xyz/",
    "https://git.820828.xyz/",
    "https://git.951959483.xyz/",
    "https://git.yylx.win/",
    "https://github.1ms.xx.kg/",
    "https://github.788787.xyz/",
    "https://github.880824.xyz/",
    "https://github.boringhex.top/",
    "https://github.cnxiaobai.com/",
    "https://github.crdz.eu.org/",
    "https://github.ednovas.xyz/",
    "https://github.ihnic.com/",
    "https://github.lsdfxdk.nyc.mn/",
    "https://github.mlmle.cn/",
    "https://github.mxw.qzz.io/",
    "https://gp.871201.xyz/",
    "https://hub.ddayh.com/",
    "https://jiashu.1win.eu.org/",
    "https://js.jiangss.shop/",
    "https://proxy.baguoyuyan.com/",
    "https://tvv.tw/",
    "https://v4.gh-proxy.org/",
    "https://v6.gh-proxy.org/",
];

export function getPrefix(): string {
    return (localStorage.getItem("githubProxyPrefix") || DEFAULT_PREFIX) + GITHUB_MIDDLE;
}

export function setPrefix(newPrefix: string) {
    localStorage.setItem("githubProxyPrefix", newPrefix.trim());
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
    const testUrl = `${baseUrl}${GITHUB_MIDDLE}/bookcase.json?_t=${Date.now()}`;
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
