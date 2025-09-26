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

import { Octokit } from '@octokit/rest';

export interface GitHubConfig {
  owner: string;
  repo: string;
  token?: string;
}

export class GitHubService {
  private octokit: Octokit;
  private config: GitHubConfig;

  constructor(config: GitHubConfig) {
    this.config = config;
    this.octokit = new Octokit({ auth: config.token });
  }

  /**
   * Get file content from GitHub repository
   */
  async getFileContent(path: string): Promise<Buffer> {
    try {
      const { data } = await this.octokit.rest.repos.getContent({
        owner: this.config.owner,
        repo: this.config.repo,
        path,
      });

      if ('content' in data && data.content && data.encoding === 'base64') {
        return Buffer.from(data.content, 'base64');
      } else if ('download_url' in data && data.download_url) {
        const response = await fetch(data.download_url);
        if (!response.ok) {
          throw new Error(`Failed to fetch file: ${response.statusText}`);
        }
        const arrayBuffer = await response.arrayBuffer();
        return Buffer.from(arrayBuffer);
      } else {
        throw new Error('Unable to get file content');
      }
    } catch (error) {
      throw new Error(`Failed to fetch file ${path}: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  /**
   * Get text file content from GitHub repository
   */
  async getTextFileContent(path: string): Promise<string> {
    const buffer = await this.getFileContent(path);
    return buffer.toString('utf-8');
  }

  /**
   * Check if a file exists in the repository
   */
  async fileExists(path: string): Promise<boolean> {
    try {
      await this.octokit.rest.repos.getContent({
        owner: this.config.owner,
        repo: this.config.repo,
        path,
      });
      return true;
    } catch {
      return false;
    }
  }

  /**
   * Get the first available file from a list of possible paths
   */
  async getFirstAvailableFile(paths: string[]): Promise<{ path: string; content: Buffer } | null> {
    for (const path of paths) {
      try {
        const content = await this.getFileContent(path);
        return { path, content };
      } catch {
        continue;
      }
    }
    return null;
  }

  /**
   * Get all available files from a list of possible paths
   */
  async getAllAvailableFiles(paths: string[]): Promise<Array<{ path: string; content: Buffer }>> {
    const results: Array<{ path: string; content: Buffer }> = [];
    
    for (const path of paths) {
      try {
        const content = await this.getFileContent(path);
        results.push({ path, content });
      } catch {
        continue;
      }
    }
    
    return results;
  }
}

// Default GitHub service instance
export const createGitHubService = (token?: string): GitHubService => {
  return new GitHubService({
    owner: 'langningchen',
    repo: 'shanghai-textbook-data',
    token,
  });
};
