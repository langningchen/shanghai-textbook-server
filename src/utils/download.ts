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

import { Octokit } from '@octokit/rest';

export async function downloadFiles(bookId: string, pdfPaths: string[]): Promise<void> {
  try {
    let foundFile = false;
    const token = process.env.GITHUB_TOKEN;
    if (!token) {
      throw new Error('GitHub token not configured');
    }
    const octokit = new Octokit({ auth: token });

    for (let i = 0; i < pdfPaths.length; i++) {
      // pdfPaths[i] 形如 /api/pdf/xxx 或 /api/pdf/xxx/part
      // 这里假设 pdfPaths[i] 末尾为 /books/xxx.pdf 或 /books/xxx.pdf.part
      // 解析出文件名
      const match = pdfPaths[i].match(/books\/(.+)$/);
      if (!match) continue;
      const filePath = `books/${match[1]}`;
      try {
        const { data } = await octokit.rest.repos.getContent({
          owner: 'langningchen',
          repo: 'shanghai-textbook',
          path: filePath,
        });
        let downloadUrl = '';
        if ('download_url' in data && data.download_url) {
          downloadUrl = data.download_url;
        } else if ('content' in data && data.content && data.encoding === 'base64') {
          // 需要将 base64 内容转为 blob 下载
          const blob = new Blob([Uint8Array.from(Buffer.from(data.content, 'base64'))], { type: 'application/pdf' });
          const url = URL.createObjectURL(blob);
          foundFile = true;
          const link = document.createElement('a');
          link.href = url;
          link.download = match[1];
          link.style.display = 'none';
          document.body.appendChild(link);
          link.click();
          document.body.removeChild(link);
          URL.revokeObjectURL(url);
          if (i < pdfPaths.length - 1) {
            await new Promise(resolve => setTimeout(resolve, 500));
          }
          continue;
        } else {
          continue;
        }
        if (downloadUrl) {
          foundFile = true;
          const link = document.createElement('a');
          link.href = downloadUrl;
          link.download = match[1];
          link.style.display = 'none';
          document.body.appendChild(link);
          link.click();
          document.body.removeChild(link);
          if (i < pdfPaths.length - 1) {
            await new Promise(resolve => setTimeout(resolve, 500));
          }
        }
      } catch {
        continue;
      }
    }
    if (!foundFile) {
      throw new Error('没有找到可下载的PDF文件');
    }
  } catch (error) {
    console.error('Download error:', error);
    throw error instanceof Error ? error : new Error('下载失败，请稍后重试');
  }
}
