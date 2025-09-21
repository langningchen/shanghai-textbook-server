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

import { NextRequest, NextResponse } from 'next/server';
import { createGitHubService, createBookService } from '../../../../../services';

interface RouteParams {
  params: {
    bookid: string;
  };
}

export async function GET(request: NextRequest, { params }: RouteParams) {
  try {
    const { bookid } = params;

    if (!bookid) {
      return NextResponse.json(
        { 
          success: false, 
          error: 'Book ID is required' 
        }, 
        { status: 400 }
      );
    }

    const token = process.env.GITHUB_TOKEN;
    const githubService = createGitHubService(token);
    const bookService = createBookService(githubService);
    
    const bookDetail = await bookService.getBookDetail(bookid);
    
    if (!bookDetail) {
      return NextResponse.json(
        { 
          success: false, 
          error: 'Book not found' 
        }, 
        { status: 404 }
      );
    }
    
    return NextResponse.json({ 
      success: true, 
      data: bookDetail 
    });
  } catch (error) {
    console.error('Error fetching book detail:', error);
    return NextResponse.json(
      { 
        success: false, 
        error: error instanceof Error ? error.message : 'Failed to fetch book detail' 
      }, 
      { status: 500 }
    );
  }
}
