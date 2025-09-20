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

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ bookId: string; part: string }> }
) {
  try {
    const { bookId, part } = await params;
    
    const pdfUrl = `https://raw.githubusercontent.com/langningchen/ShanghaiTextbook/main/books/${bookId}.pdf.${part}`;
    
    const response = await fetch(pdfUrl);
    
    if (!response.ok) {
      return NextResponse.json(
        { error: 'PDF part not found' },
        { status: 404 }
      );
    }

    const pdfBuffer = await response.arrayBuffer();
    
    return new NextResponse(pdfBuffer, {
      headers: {
        'Content-Type': 'application/pdf',
        'Content-Disposition': `attachment; filename="${bookId}.pdf.${part}"`,
        'Cache-Control': 'public, max-age=3600', // Cache for 1 hour
      },
    });
  } catch (error) {
    console.error('PDF part proxy error:', error);
    return NextResponse.json(
      { error: 'Failed to fetch PDF part' },
      { status: 500 }
    );
  }
}
