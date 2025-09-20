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
  { params }: { params: Promise<{ bookId: string; part?: string }> }
) {
  try {
    const { bookId, part } = await params;
    
    // Construct PDF URL
    let pdfUrl = `https://raw.githubusercontent.com/langningchen/shanghai-textbook/main/books/${bookId}.pdf`;
    if (part) {
      pdfUrl += `.${part}`;
    }
    
    const response = await fetch(pdfUrl);
    
    if (!response.ok) {
      return NextResponse.json(
        { error: 'PDF not found' },
        { status: 404 }
      );
    }

    const pdfBuffer = await response.arrayBuffer();
    
    // Generate filename
    const filename = part ? `${bookId}.pdf.${part}` : `${bookId}.pdf`;
    
    return new NextResponse(pdfBuffer, {
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
