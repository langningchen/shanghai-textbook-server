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
import { createGitHubService, createImageService } from '../../../../../services';

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
    const githubService = createGitHubService(token);
    const imageService = createImageService(githubService);
    
    const imageResult = await imageService.getBookCover(bookid);
    
    return new NextResponse(new Uint8Array(imageResult.content), {
      status: 200,
      headers: {
        'Content-Type': imageResult.contentType,
        'Cache-Control': 'public, max-age=86400', // Cache for 24 hours
      },
    });
  } catch (error) {
    console.error('Cover image fetch error:', error);
    
    if (error instanceof Error && error.message.includes('not found')) {
      return NextResponse.json(
        { error: 'Cover image not found' },
        { status: 404 }
      );
    }
    
    return NextResponse.json(
      { error: 'Failed to fetch cover image' },
      { status: 500 }
    );
  }
}
