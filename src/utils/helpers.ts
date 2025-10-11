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

import { Textbook, FilterOptions } from '@/types/textbook';
import { GRADE_MAPPINGS, TERM_MAPPINGS, PUBLISHER_MAPPINGS, USE_TYPE_MAPPINGS } from './constants';

// Get display name for grade
export function getGradeDisplayName(grade: string): string {
  return GRADE_MAPPINGS[grade as keyof typeof GRADE_MAPPINGS] || '未知';
}

// Get display name for term
export function getTermDisplayName(term: string): string {
  return TERM_MAPPINGS[term as keyof typeof TERM_MAPPINGS] || '未知';
}

// Get display name for publisher
export function getPublisherDisplayName(publisher: string): string {
  return PUBLISHER_MAPPINGS[publisher as keyof typeof PUBLISHER_MAPPINGS] || '未知';
}

// Get display name for use type
export function getUseTypeDisplayName(useType: string): string {
  return USE_TYPE_MAPPINGS[useType as keyof typeof USE_TYPE_MAPPINGS] || '未知';
}

// Filter books based on criteria
export function filterBooks(books: Textbook[], filters: FilterOptions): Textbook[] {
  return books.filter(book => {
    // Grade filter
    if (filters.grade && book.grade !== filters.grade) {
      return false;
    }
    
    // Term filter
    if (filters.term && book.term !== filters.term) {
      return false;
    }
    
    // Subject filter
    if (filters.subject && !book.subject_str.includes(filters.subject)) {
      return false;
    }
    
    // Publisher filter
    if (filters.publisher && book.publisher !== filters.publisher) {
      return false;
    }
    
    // Use type filter
    if (filters.useType && book.use_type !== filters.useType) {
      return false;
    }
    
    // Search filter (searches in title, short_title, and subject_str)
    if (filters.search) {
      const searchTerm = filters.search.toLowerCase();
      const searchableText = `${book.title} ${book.short_title} ${book.subject_str}`.toLowerCase();
      if (!searchableText.includes(searchTerm)) {
        return false;
      }
    }
    
    return true;
  });
}

// Get unique subjects from books
export function getUniqueSubjects(books: Textbook[]): string[] {
  const subjects = new Set(books.map(book => book.subject_str));
  return Array.from(subjects).sort();
}

// Generate a friendly filename for a book PDF
export function generateFriendlyFilename(book: Textbook): string {
  const sanitize = (str: string) => {
    return str
      .replace(/[<>:"/\\|?*\x00-\x1F]/g, '')
      .replace(/\s+/g, ' ')
      .trim();
  };

  const title = sanitize(book.title);
  const publisher = book.publisher ? sanitize(getPublisherDisplayName(book.publisher)) : '';
  
  let filename = publisher ? `${title} - ${publisher}` : title;
  
  if (filename.length > 200) {
    filename = filename.substring(0, 200).trim();
  }
  
  return `${filename}.pdf`;
}
