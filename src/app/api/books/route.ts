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
import { Octokit } from '@octokit/rest';
import { Textbook } from '@/types/textbook';

const octokit = new Octokit();

export async function GET() {
  try {
    const { data } = await octokit.rest.repos.getContent({
      owner: 'langningchen',
      repo: 'ShanghaiTextbook',
      path: 'books/bookcase.json',
    });

    let content: string;
    
    if ('content' in data && data.content && data.encoding === 'base64') {
      // For smaller files, GitHub returns base64 encoded content
      content = Buffer.from(data.content, 'base64').toString('utf-8');
    } else if ('download_url' in data && data.download_url) {
      // For larger files, use the download_url to fetch the raw content
      const response = await fetch(data.download_url);
      if (!response.ok) {
        throw new Error(`Failed to fetch file: ${response.statusText}`);
      }
      content = await response.text();
    } else {
      throw new Error('Unable to get file content');
    }

    const books: Textbook[] = JSON.parse(content);
    
    return NextResponse.json({ 
      success: true, 
      data: books 
    });
  } catch (error) {
    console.error('Error fetching books:', error);
    return NextResponse.json(
      { 
        success: false, 
        error: 'Failed to fetch books from GitHub' 
      }, 
      { status: 500 }
    );
  }
}
