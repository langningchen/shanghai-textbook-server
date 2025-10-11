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
import { createGitHubService, createPDFService, createBookService } from '../../../../../services';
import { generateFriendlyFilename } from '../../../../../utils/helpers';

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ bookid: string }> }
) {
  try {
    const { bookid } = await params;
    
    if (!bookid) {
      return NextResponse.json(
        { error: 'Book ID is required' },
        { status: 400 }
      );
    }

    const token = process.env.GITHUB_TOKEN;
    if (!token) {
      return NextResponse.json(
        { error: 'GitHub token not configured' },
        { status: 500 }
      );
    }

    const githubService = createGitHubService(token);
    const pdfService = createPDFService(githubService);
    const bookService = createBookService(githubService);
    
    const bookDetail = await bookService.getBookDetail(bookid);
    const filename = bookDetail ? generateFriendlyFilename(bookDetail) : `${bookid}.pdf`;
    
    const pdfContent = await pdfService.getBookPDF(bookid);
    const encodedFilename = encodeURIComponent(filename);
    
    return new NextResponse(new Uint8Array(pdfContent), {
      headers: {
        'Content-Type': 'application/pdf',
        'Content-Disposition': `attachment; filename="${filename}"; filename*=UTF-8''${encodedFilename}`,
        'Cache-Control': 'public, max-age=3600',
      },
    });
  } catch (error) {
    console.error('PDF fetch error:', error);
    
    if (error instanceof Error && error.message.includes('not found')) {
      return NextResponse.json(
        { error: 'PDF file not found' },
        { status: 404 }
      );
    }
    
    return NextResponse.json(
      { error: 'Failed to fetch PDF file' },
      { status: 500 }
    );
  }
}
