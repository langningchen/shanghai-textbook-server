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

// Grade level mappings
export const GRADE_MAPPINGS = {
  FIRST_GRADE: "01_一年级",
  SECOND_GRADE: "02_二年级",
  THIRD_GRADE: "03_三年级",
  FOURTH_GRADE: "04_四年级",
  FIFTH_GRADE: "05_五年级",
  SIXTH_GRADE: "06_六年级",
  SEVENTH_GRADE: "07_七年级",
  EIGHTH_GRADE: "08_八年级",
  NINTH_GRADE: "09_九年级",
  TENTH_GRADE: "10_高一",
  ELEVENTH_GRADE: "11_高二",
  TWELFTH_GRADE: "12_高三",
  PRIMARY_PHASE: "13_小学阶段",
  JUNIOR_PHASE: "14_初中阶段",
  SENIOR_PHASE: "15_高中阶段",
} as const;

// Term mappings
export const TERM_MAPPINGS = {
  ALL: "全学年",
  FIRST_SEMESTER: "01_上学期",
  SECOND_SEMESTER: "02_下学期",
} as const;

// Publisher mappings
export const PUBLISHER_MAPPINGS = {
  SHJY: "上海教育出版社",
  SHWJ: "上海外语教育出版社",
  ZGDT: "中国地图出版社",
  ZHDT: "中华地图学社",
  SHKJ: "上海科技教育出版社",
  HDSD: "华东师范大学出版社",
  SHSH: "上海书画出版社",
  SHYD: "上海远东出版社",
  SNET: "少年儿童出版社",
  SHYY: "上海音乐出版社",
  RJVV: "人民教育出版社",
  SHCS: "上海辞书出版社",
} as const;

// Use type mappings
export const USE_TYPE_MAPPINGS = {
  XSYS: "学生用书",
  LXC: "练习册",
  HDSC: "活动手册",
  SYC: "实验册",
  JSYS: "教师用书",
} as const;

// Common grade options for filtering
export const GRADE_OPTIONS = [
  { value: 'FIRST_GRADE', label: '一年级' },
  { value: 'SECOND_GRADE', label: '二年级' },
  { value: 'THIRD_GRADE', label: '三年级' },
  { value: 'FOURTH_GRADE', label: '四年级' },
  { value: 'FIFTH_GRADE', label: '五年级' },
  { value: 'SIXTH_GRADE', label: '六年级' },
  { value: 'SEVENTH_GRADE', label: '七年级' },
  { value: 'EIGHTH_GRADE', label: '八年级' },
  { value: 'NINTH_GRADE', label: '九年级' },
  { value: 'TENTH_GRADE', label: '高一' },
  { value: 'ELEVENTH_GRADE', label: '高二' },
  { value: 'TWELFTH_GRADE', label: '高三' },
];

// Term options for filtering
export const TERM_OPTIONS = [
  { value: 'FIRST_SEMESTER', label: '上学期' },
  { value: 'SECOND_SEMESTER', label: '下学期' },
  { value: 'ALL', label: '全学年' },
];

// Publisher options for filtering
export const PUBLISHER_OPTIONS = Object.entries(PUBLISHER_MAPPINGS).map(([value, label]) => ({
  value,
  label,
}));

// Use type options for filtering
export const USE_TYPE_OPTIONS = Object.entries(USE_TYPE_MAPPINGS).map(([value, label]) => ({
  value,
  label,
}));
