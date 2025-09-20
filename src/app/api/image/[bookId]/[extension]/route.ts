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
  { params }: { params: Promise<{ bookId: string; extension: string }> }
) {
  try {
    const { bookId, extension } = await params;
    
    if (!['jpg', 'png'].includes(extension)) {
      return NextResponse.json(
        { error: 'Invalid image format' },
        { status: 400 }
      );
    }

    // 获取 GitHub token
    const token = process.env.GITHUB_TOKEN;
    if (!token) {
      return NextResponse.json(
        { error: 'GitHub token not configured' },
        { status: 500 }
      );
    }

    const octokit = new Octokit({ auth: token });
    let imageContent: Buffer | null = null;
    let contentType = '';
    try {
      const { data } = await octokit.rest.repos.getContent({
        owner: 'langningchen',
        repo: 'shanghai-textbook',
        path: `books/${bookId}.${extension}`,
      });
      if ('content' in data && data.content && data.encoding === 'base64') {
        imageContent = Buffer.from(data.content, 'base64');
        contentType = extension === 'jpg' ? 'image/jpeg' : 'image/png';
      } else if ('download_url' in data && data.download_url) {
        // fallback: fetch raw file
        const response = await fetch(data.download_url);
        if (!response.ok) {
          throw new Error('Image not found');
        }
        const arrayBuffer = await response.arrayBuffer();
        imageContent = Buffer.from(arrayBuffer);
        contentType = extension === 'jpg' ? 'image/jpeg' : 'image/png';
      } else {
        throw new Error('Unable to get image content');
      }
    } catch (err) {
      return NextResponse.json(
        { error: 'Image not found' },
        { status: 404 }
      );
    }

    // NextResponse 需要 ArrayBuffer/Uint8Array 作为 body
    return new NextResponse(new Uint8Array(imageContent), {
      status: 200,
      headers: {
        'Content-Type': contentType,
        'Cache-Control': 'public, max-age=86400', // Cache for 24 hours
      },
    });
  } catch (error) {
    console.error('Image proxy error:', error);
    return NextResponse.json(
      { error: 'Failed to fetch image' },
      { status: 500 }
    );
  }
}
