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

import { NextResponse } from 'next/server';
import { createGitHubService, createBookService } from '../../../services';

export async function GET() {
  try {
    const token = process.env.GITHUB_TOKEN;
    const githubService = createGitHubService(token);
    const bookService = createBookService(githubService);
    
    const books = await bookService.getAllBooks();
    
    return NextResponse.json({ 
      success: true, 
      data: books 
    });
  } catch (error) {
    console.error('Error fetching books:', error);
    return NextResponse.json(
      { 
        success: false, 
        error: error instanceof Error ? error.message : 'Failed to fetch books from GitHub' 
      }, 
      { status: 500 }
    );
  }
}
