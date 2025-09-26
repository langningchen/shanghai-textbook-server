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
import { Textbook } from '@/types/textbook';

export class BookService {
  constructor(private githubService: GitHubService) {}

  /**
   * Get all books from the repository
   */
  async getAllBooks(): Promise<Textbook[]> {
    try {
      const content = await this.githubService.getTextFileContent('bookcase.json');
      const books: Textbook[] = JSON.parse(content);
      return books;
    } catch (error) {
      throw new Error(`Failed to fetch books: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  /**
   * Get a specific book by ID
   */
  async getBookById(bookId: string): Promise<Textbook | null> {
    const books = await this.getAllBooks();
    return books.find(book => book.uuid === bookId) || null;
  }

  /**
   * Get detailed information for a specific book by ID
   */
  async getBookDetail(bookId: string): Promise<Textbook | null> {
    try {
      const content = await this.githubService.getTextFileContent(`${bookId.charAt(0)}/${bookId}.json`);
      const book: Textbook = JSON.parse(content);
      return book;
    } catch (error) {
      console.error(`Failed to fetch book detail for ${bookId}:`, error);
      return null;
    }
  }
}

export const createBookService = (githubService: GitHubService): BookService => {
  return new BookService(githubService);
};
