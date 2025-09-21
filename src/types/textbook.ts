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

export interface SemesterPhase {
  semester_phase: string;
  semester_phase_str: string;
  semester_phase_code: string;
}

export interface GradeSemester {
  grade_level: string;
  used_semester_phases: SemesterPhase[];
  grade_level_code: string;
  grade_level_str: string;
}

export interface Textbook {
  uuid: string;
  file_path: string;
  file_md5: string;
  title: string;
  cover_path: string;
  is_current_term: number;
  use_year: string;
  text_start_page: number;
  short_title: string;
  update_time: string;
  subject: string;
  used_grade_semesters: GradeSemester[];
  textbook_material_type: string;
  publisher?: string; // Made optional as it might not be in detail API
  grade: string;
  term: string;
  use_type: string;
  isbn: string;
  status: string;
  subject_str: string;
}

export interface FilterOptions {
  grade?: string;
  term?: string;
  subject?: string;
  publisher?: string;
  useType?: string;
  search?: string;
}
