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

import { GitHubService } from './github';

export interface ImageResult {
  content: Buffer;
  contentType: string;
  extension: string;
}

export class ImageService {
  constructor(private githubService: GitHubService) {}

  /**
   * Get book cover image, automatically checking for different formats
   * Returns the first available format (jpg or png)
   */
  async getBookCover(bookId: string): Promise<ImageResult> {
    const possiblePaths = [
      { path: `books/${bookId}.jpg`, contentType: 'image/jpeg', extension: 'jpg' },
      { path: `books/${bookId}.png`, contentType: 'image/png', extension: 'png' },
    ];

    for (const { path, contentType, extension } of possiblePaths) {
      try {
        const content = await this.githubService.getFileContent(path);
        return { content, contentType, extension };
      } catch {
        continue;
      }
    }

    throw new Error(`Cover image not found for book ${bookId}`);
  }

  /**
   * Get image with specific format
   */
  async getImage(bookId: string, extension: string): Promise<ImageResult> {
    if (!['jpg', 'png'].includes(extension)) {
      throw new Error(`Invalid image format: ${extension}`);
    }

    const path = `books/${bookId}.${extension}`;
    const contentType = extension === 'jpg' ? 'image/jpeg' : 'image/png';

    try {
      const content = await this.githubService.getFileContent(path);
      return { content, contentType, extension };
    } catch {
      throw new Error(`Image not found: ${path}`);
    }
  }
}

export const createImageService = (githubService: GitHubService): ImageService => {
  return new ImageService(githubService);
};
