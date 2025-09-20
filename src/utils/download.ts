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

export async function downloadFiles(bookId: string, pdfPaths: string[]): Promise<void> {
  try {
    let foundFile = false;
    
    for (let i = 0; i < pdfPaths.length; i++) {
      const url = pdfPaths[i];
      
      try {
        // Check if file exists by making a HEAD request
        const response = await fetch(url, { method: 'HEAD' });
        
        if (response.ok) {
          foundFile = true;
          // File exists, create download link
          const link = document.createElement('a');
          link.href = url;
          link.download = ''; // Let server determine filename
          link.style.display = 'none';
          
          document.body.appendChild(link);
          link.click();
          document.body.removeChild(link);
          
          // Add small delay between downloads
          if (i < pdfPaths.length - 1) {
            await new Promise(resolve => setTimeout(resolve, 500));
          }
        }
      } catch {
        // File doesn't exist or network error, continue to next
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
