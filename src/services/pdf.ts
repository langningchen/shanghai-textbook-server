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

export class PDFService {
  constructor(private githubService: GitHubService) {}

  /**
   * Get PDF file for a book, handling both single files and multi-part files
   * Returns the concatenated PDF content
   */
  async getBookPDF(bookId: string): Promise<Buffer> {
    // First try to get the main PDF file
    const mainPdfPath = `${bookId.charAt(0)}/${bookId}.pdf`;
    
    try {
      const mainPdf = await this.githubService.getFileContent(mainPdfPath);
      
      // Check if there are additional parts
      const additionalParts = await this.getAdditionalPDFParts(bookId);
      
      if (additionalParts.length === 0) {
        return mainPdf;
      }
      
      // Concatenate all parts
      return this.concatenatePDFs([mainPdf, ...additionalParts]);
    } catch {
      // If main PDF doesn't exist, try to get parts only
      const parts = await this.getPDFParts(bookId);
      if (parts.length === 0) {
        throw new Error(`PDF file not found for book ${bookId}`);
      }
      
      return this.concatenatePDFs(parts);
    }
  }

  /**
   * Get additional PDF parts for a book (e.g., .pdf.1, .pdf.2, etc.)
   */
  private async getAdditionalPDFParts(bookId: string): Promise<Buffer[]> {
    const parts: Buffer[] = [];
    
    // Check for up to 10 parts
    for (let i = 1; i <= 10; i++) {
      const partPath = `${bookId.charAt(0)}/${bookId}.pdf.${i}`;
      try {
        const partContent = await this.githubService.getFileContent(partPath);
        parts.push(partContent);
      } catch {
        // If a part doesn't exist, stop looking for more parts
        break;
      }
    }
    
    return parts;
  }

  /**
   * Get all PDF parts for a book (starting from .pdf.1)
   */
  private async getPDFParts(bookId: string): Promise<Buffer[]> {
    const parts: Buffer[] = [];
    
    // Check for up to 10 parts starting from .1
    for (let i = 1; i <= 10; i++) {
      const partPath = `${bookId.charAt(0)}/${bookId}.pdf.${i}`;
      try {
        const partContent = await this.githubService.getFileContent(partPath);
        parts.push(partContent);
      } catch {
        // If a part doesn't exist, stop looking for more parts
        break;
      }
    }
    
    return parts;
  }

  /**
   * Concatenate multiple PDF buffers into a single buffer
   * Note: This is a simple concatenation. For proper PDF merging,
   * you might want to use a library like pdf-lib in the future.
   */
  private concatenatePDFs(pdfBuffers: Buffer[]): Buffer {
    if (pdfBuffers.length === 0) {
      throw new Error('No PDF buffers to concatenate');
    }
    
    if (pdfBuffers.length === 1) {
      return pdfBuffers[0];
    }
    
    // Simple concatenation - this works for most cases where PDFs are split
    return Buffer.concat(pdfBuffers);
  }
}

export const createPDFService = (githubService: GitHubService): PDFService => {
  return new PDFService(githubService);
};
