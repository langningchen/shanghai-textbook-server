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
import { Octokit } from '@octokit/rest';

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ bookId: string; part?: string }> }
) {
  try {
    const { bookId, part } = await params;
    
    // 获取 GitHub token
    const token = process.env.GITHUB_TOKEN;
    if (!token) {
      return NextResponse.json(
        { error: 'GitHub token not configured' },
        { status: 500 }
      );
    }

    const octokit = new Octokit({ auth: token });
    let pdfContent: Buffer | null = null;
    const filename = part ? `${bookId}.pdf.${part}` : `${bookId}.pdf`;
    const path = part ? `books/${bookId}.pdf.${part}` : `books/${bookId}.pdf`;
    try {
      const { data } = await octokit.rest.repos.getContent({
        owner: 'langningchen',
        repo: 'shanghai-textbook',
        path,
      });
      if ('content' in data && data.content && data.encoding === 'base64') {
        pdfContent = Buffer.from(data.content, 'base64');
      } else if ('download_url' in data && data.download_url) {
        const response = await fetch(data.download_url);
        if (!response.ok) {
          throw new Error('PDF not found');
        }
        const arrayBuffer = await response.arrayBuffer();
        pdfContent = Buffer.from(arrayBuffer);
      } else {
        throw new Error('Unable to get PDF content');
      }
    } catch {
      return NextResponse.json(
        { error: 'PDF not found' },
        { status: 404 }
      );
    }

    return new NextResponse(new Uint8Array(pdfContent), {
      headers: {
        'Content-Type': 'application/pdf',
        'Content-Disposition': `attachment; filename="${filename}"`,
        'Cache-Control': 'public, max-age=3600', // Cache for 1 hour
      },
    });
  } catch (error) {
    console.error('PDF proxy error:', error);
    return NextResponse.json(
      { error: 'Failed to fetch PDF' },
      { status: 500 }
    );
  }
}
