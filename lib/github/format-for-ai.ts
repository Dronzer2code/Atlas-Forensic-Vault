import 'server-only';
import type { SelectedFiles, FileMetadata } from './file-selector';
import type { GitHubRepo, FileNode } from './client';

/**
 * Formatted repository structure for AI consumption
 */
export interface FormattedRepo {
  metadata: string;
  summary: string;
  codeChunks: CodeChunk[];
  fullContent: string;
  tokenEstimate: number;
}

/**
 * Semantic code chunk for vectorization and analysis
 */
export interface CodeChunk {
  id: string;
  path: string;
  content: string;
  type: 'function' | 'class' | 'comment' | 'import' | 'config' | 'component' | 'hook' | 'type';
  metadata: {
    startLine: number;
    endLine: number;
    language: string;
    tokens: number;
    name?: string;
    exportType?: 'default' | 'named' | 'none';
  };
}

/**
 * Extended file with content for formatting
 */
interface FileWithContent extends FileNode {
  content?: string;
  language?: string;
  category?: string;
}

/**
 * Format a repository for AI consumption
 * Creates structured content optimized for LLM processing
 */
export function formatRepoForAI(
  selectedFiles: SelectedFiles,
  metadata: GitHubRepo,
  filesWithContent?: FileWithContent[]
): FormattedRepo {
  // Build header with metadata
  let fullContent = `# Repository: ${metadata.name}\n`;
  fullContent += `Owner: ${metadata.owner}\n`;
  fullContent += `Description: ${metadata.description || 'No description'}\n`;
  fullContent += `Language: ${metadata.language}\n`;
  fullContent += `Stars: ${metadata.stars}\n`;
  fullContent += `Topics: ${metadata.topics?.join(', ') || 'None'}\n\n`;
  fullContent += `---\n\n`;

  const codeChunks: CodeChunk[] = [];

  // Use filesWithContent if provided, otherwise fall back to selectedFiles
  const filesToProcess = filesWithContent || selectedFiles.files;

  // Group files by category for better organization
  const categorizedFiles = groupFilesByCategory(filesToProcess);

  // Process critical files first
  if (categorizedFiles.critical.length > 0) {
    fullContent += `## 📌 Critical Files\n\n`;
    for (const file of categorizedFiles.critical) {
      fullContent += formatFileContent(file);
      if ((file as FileWithContent).content) {
        const chunks = extractSemanticChunks(file as FileWithContent);
        codeChunks.push(...chunks);
      }
    }
  }

  // Process entry points
  if (categorizedFiles['entry-point'].length > 0) {
    fullContent += `## 🚀 Entry Points\n\n`;
    for (const file of categorizedFiles['entry-point']) {
      fullContent += formatFileContent(file);
      if ((file as FileWithContent).content) {
        const chunks = extractSemanticChunks(file as FileWithContent);
        codeChunks.push(...chunks);
      }
    }
  }

  // Process config files
  if (categorizedFiles.config.length > 0) {
    fullContent += `## ⚙️ Configuration\n\n`;
    for (const file of categorizedFiles.config) {
      fullContent += formatFileContent(file);
      if ((file as FileWithContent).content) {
        const chunks = extractSemanticChunks(file as FileWithContent);
        codeChunks.push(...chunks);
      }
    }
  }

  // Process high complexity files
  if (categorizedFiles['high-complexity'].length > 0) {
    fullContent += `## 🔥 High Complexity Files\n\n`;
    for (const file of categorizedFiles['high-complexity']) {
      fullContent += formatFileContent(file);
      if ((file as FileWithContent).content) {
        const chunks = extractSemanticChunks(file as FileWithContent);
        codeChunks.push(...chunks);
      }
    }
  }

  // Process remaining files
  if (categorizedFiles.standard.length > 0) {
    fullContent += `## 📁 Source Files\n\n`;
    for (const file of categorizedFiles.standard) {
      fullContent += formatFileContent(file);
      if ((file as FileWithContent).content) {
        const chunks = extractSemanticChunks(file as FileWithContent);
        codeChunks.push(...chunks);
      }
    }
  }

  // Estimate tokens (rough approximation: ~4 chars per token)
  const tokenEstimate = Math.ceil(fullContent.length / 4);

  return {
    metadata: `${metadata.name} by ${metadata.owner}`,
    summary: createRepoSummary(selectedFiles, filesWithContent),
    codeChunks,
    fullContent,
    tokenEstimate,
  };
}

/**
 * Group files by their category
 */
interface FileWithCategory {
  category?: string;
}

function groupFilesByCategory(files: (FileMetadata | FileWithContent)[]): Record<string, (FileMetadata | FileWithContent)[]> {
  const groups: Record<string, (FileMetadata | FileWithContent)[]> = {
    'critical': [],
    'entry-point': [],
    'config': [],
    'high-complexity': [],
    'recently-modified': [],
    'standard': [],
  };

  for (const file of files) {
    const category = (file as FileWithCategory).category || 'standard';
    if (groups[category]) {
      groups[category].push(file);
    } else {
      groups.standard.push(file);
    }
  }

  return groups;
}

/**
 * Format a single file's content for AI consumption
 */
function formatFileContent(file: FileMetadata | FileWithContent): string {
  const fileWithContent = file as FileWithContent;
  const language = fileWithContent.language || detectLanguageFromPath(file.path);
  
  let output = `### ${file.path}\n`;
  
  if (fileWithContent.content) {
    output += `\`\`\`${language}\n`;
    output += fileWithContent.content;
    if (!fileWithContent.content.endsWith('\n')) {
      output += '\n';
    }
    output += `\`\`\`\n\n`;
  } else {
    output += `*[Binary or unavailable file]*\n\n`;
  }

  return output;
}

/**
 * Detect language from file path
 */
function detectLanguageFromPath(path: string): string {
  const ext = path.split('.').pop()?.toLowerCase();
  const languageMap: Record<string, string> = {
    'ts': 'typescript',
    'tsx': 'tsx',
    'js': 'javascript',
    'jsx': 'jsx',
    'py': 'python',
    'rs': 'rust',
    'go': 'go',
    'java': 'java',
    'rb': 'ruby',
    'php': 'php',
    'c': 'c',
    'cpp': 'cpp',
    'cs': 'csharp',
    'swift': 'swift',
    'kt': 'kotlin',
    'md': 'markdown',
    'json': 'json',
    'yaml': 'yaml',
    'yml': 'yaml',
    'toml': 'toml',
    'xml': 'xml',
    'html': 'html',
    'css': 'css',
    'scss': 'scss',
    'sql': 'sql',
    'sh': 'bash',
    'bash': 'bash',
    'dockerfile': 'dockerfile',
  };
  return languageMap[ext || ''] || 'text';
}

/**
 * Extract semantic chunks from file content for vectorization
 */
function extractSemanticChunks(file: FileWithContent): CodeChunk[] {
  const chunks: CodeChunk[] = [];
  const content = file.content!;
  const lines = content.split('\n');
  const language = file.language || detectLanguageFromPath(file.path);

  // Extract functions and classes
  const functionChunks = extractFunctions(file.path, content, lines, language);
  chunks.push(...functionChunks);

  // Extract React components and hooks
  if (['tsx', 'jsx', 'typescript', 'javascript'].includes(language)) {
    const componentChunks = extractReactPatterns(file.path, content, lines, language);
    chunks.push(...componentChunks);
  }

  // Extract type definitions (TypeScript)
  if (['ts', 'tsx', 'typescript'].includes(language)) {
    const typeChunks = extractTypeDefinitions(file.path, content, lines, language);
    chunks.push(...typeChunks);
  }

  // Extract imports (useful for dependency analysis)
  const importChunks = extractImports(file.path, content, lines, language);
  chunks.push(...importChunks);

  // Extract TODO/FIXME/BUG comments
  const commentChunks = extractInterestingComments(file.path, content, lines, language);
  chunks.push(...commentChunks);

  // For config files, treat entire file as a chunk
  if (isConfigFile(file.path)) {
    chunks.push({
      id: `${file.path}:config`,
      path: file.path,
      content: content,
      type: 'config',
      metadata: {
        startLine: 1,
        endLine: lines.length,
        language,
        tokens: estimateTokens(content),
      },
    });
  }

  return chunks;
}

/**
 * Extract function and class definitions
 */
function extractFunctions(
  filePath: string,
  content: string,
  lines: string[],
  language: string
): CodeChunk[] {
  const chunks: CodeChunk[] = [];

  // JavaScript/TypeScript patterns
  const patterns = [
    // Regular functions
    /(?:export\s+)?(?:async\s+)?function\s+(\w+)\s*\(/g,
    // Arrow functions assigned to const/let
    /(?:export\s+)?(?:const|let|var)\s+(\w+)\s*=\s*(?:async\s*)?\([^)]*\)\s*(?::\s*[^=]+)?\s*=>/g,
    // Arrow functions with single param
    /(?:export\s+)?(?:const|let|var)\s+(\w+)\s*=\s*(?:async\s*)?\w+\s*=>/g,
    // Class definitions
    /(?:export\s+)?(?:abstract\s+)?class\s+(\w+)/g,
    // Method definitions in classes
    /^\s*(?:async\s+)?(\w+)\s*\([^)]*\)\s*(?::\s*[^{]+)?\s*\{/gm,
  ];

  for (const pattern of patterns) {
    let match;
    while ((match = pattern.exec(content)) !== null) {
      const name = match[1];
      if (!name || name.length < 2) continue;

      const startLine = content.substring(0, match.index).split('\n').length;
      const { body, endLine } = extractFunctionBody(lines, startLine - 1);

      if (body.trim().length > 10) {
        chunks.push({
          id: `${filePath}:${name}:${startLine}`,
          path: filePath,
          content: body.trim(),
          type: match[0].includes('class') ? 'class' : 'function',
          metadata: {
            startLine,
            endLine,
            language,
            tokens: estimateTokens(body),
            name,
            exportType: match[0].startsWith('export') 
              ? (match[0].includes('default') ? 'default' : 'named') 
              : 'none',
          },
        });
      }
    }
  }

  return chunks;
}

/**
 * Extract function body by counting braces
 */
function extractFunctionBody(
  lines: string[],
  startIndex: number,
  maxLines: number = 100
): { body: string; endLine: number } {
  let braceCount = 0;
  let body = '';
  let foundOpenBrace = false;
  let endLine = startIndex + 1;

  for (let i = startIndex; i < Math.min(lines.length, startIndex + maxLines); i++) {
    const line = lines[i];
    body += line + '\n';

    // Count braces (naive - doesn't handle strings/comments perfectly)
    for (const char of line) {
      if (char === '{') {
        braceCount++;
        foundOpenBrace = true;
      } else if (char === '}') {
        braceCount--;
      }
    }

    if (foundOpenBrace && braceCount === 0) {
      endLine = i + 1;
      break;
    }
  }

  return { body, endLine };
}

/**
 * Extract React components and hooks
 */
function extractReactPatterns(
  filePath: string,
  content: string,
  lines: string[],
  language: string
): CodeChunk[] {
  const chunks: CodeChunk[] = [];

  // React component patterns
  const componentPatterns = [
    // Function components
    /(?:export\s+)?(?:const|function)\s+([A-Z]\w+)\s*(?::\s*React\.FC)?[=\s]*(?:\([^)]*\)|[^=]*)\s*(?:=>)?\s*\{?\s*(?:return\s*)?\(/g,
    // forwardRef components
    /(?:export\s+)?(?:const|let)\s+(\w+)\s*=\s*(?:React\.)?forwardRef/g,
    // memo components
    /(?:export\s+)?(?:const|let)\s+(\w+)\s*=\s*(?:React\.)?memo/g,
  ];

  for (const pattern of componentPatterns) {
    let match;
    while ((match = pattern.exec(content)) !== null) {
      const name = match[1];
      const startLine = content.substring(0, match.index).split('\n').length;
      const { body, endLine } = extractFunctionBody(lines, startLine - 1);

      if (body.trim().length > 20) {
        chunks.push({
          id: `${filePath}:component:${name}`,
          path: filePath,
          content: body.trim(),
          type: 'component',
          metadata: {
            startLine,
            endLine,
            language,
            tokens: estimateTokens(body),
            name,
          },
        });
      }
    }
  }

  // Custom hooks
  const hookPattern = /(?:export\s+)?(?:const|function)\s+(use[A-Z]\w+)/g;
  let hookMatch;
  while ((hookMatch = hookPattern.exec(content)) !== null) {
    const name = hookMatch[1];
    const startLine = content.substring(0, hookMatch.index).split('\n').length;
    const { body, endLine } = extractFunctionBody(lines, startLine - 1);

    if (body.trim().length > 20) {
      chunks.push({
        id: `${filePath}:hook:${name}`,
        path: filePath,
        content: body.trim(),
        type: 'hook',
        metadata: {
          startLine,
          endLine,
          language,
          tokens: estimateTokens(body),
          name,
        },
      });
    }
  }

  return chunks;
}

/**
 * Extract TypeScript type definitions
 */
function extractTypeDefinitions(
  filePath: string,
  content: string,
  lines: string[],
  language: string
): CodeChunk[] {
  const chunks: CodeChunk[] = [];

  // Type and interface patterns
  const typePatterns = [
    /(?:export\s+)?interface\s+(\w+)/g,
    /(?:export\s+)?type\s+(\w+)\s*=/g,
    /(?:export\s+)?enum\s+(\w+)/g,
  ];

  for (const pattern of typePatterns) {
    let match;
    while ((match = pattern.exec(content)) !== null) {
      const name = match[1];
      const startLine = content.substring(0, match.index).split('\n').length;
      const { body, endLine } = extractTypeBody(lines, startLine - 1);

      if (body.trim().length > 10) {
        chunks.push({
          id: `${filePath}:type:${name}`,
          path: filePath,
          content: body.trim(),
          type: 'type',
          metadata: {
            startLine,
            endLine,
            language,
            tokens: estimateTokens(body),
            name,
          },
        });
      }
    }
  }

  return chunks;
}

/**
 * Extract type definition body
 */
function extractTypeBody(
  lines: string[],
  startIndex: number,
  maxLines: number = 50
): { body: string; endLine: number } {
  let braceCount = 0;
  let body = '';
  let foundOpenBrace = false;
  let endLine = startIndex + 1;

  for (let i = startIndex; i < Math.min(lines.length, startIndex + maxLines); i++) {
    const line = lines[i];
    body += line + '\n';

    for (const char of line) {
      if (char === '{') {
        braceCount++;
        foundOpenBrace = true;
      } else if (char === '}') {
        braceCount--;
      }
    }

    // For type aliases without braces (type X = string | number)
    if (!foundOpenBrace && (line.includes(';') || (i > startIndex && !line.trim().startsWith('|') && !line.trim().startsWith('&')))) {
      endLine = i + 1;
      break;
    }

    if (foundOpenBrace && braceCount === 0) {
      endLine = i + 1;
      break;
    }
  }

  return { body, endLine };
}

/**
 * Extract import statements
 */
function extractImports(
  filePath: string,
  content: string,
  lines: string[],
  language: string
): CodeChunk[] {
  const chunks: CodeChunk[] = [];
  const importLines: string[] = [];
  let startLine = 0;
  let endLine = 0;

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i].trim();
    if (line.startsWith('import ') || line.startsWith('from ') || 
        (importLines.length > 0 && (line.startsWith('}') || line.includes(' from ')))) {
      if (importLines.length === 0) {
        startLine = i + 1;
      }
      importLines.push(lines[i]);
      endLine = i + 1;
    } else if (importLines.length > 0 && line.length > 0 && !line.startsWith('//')) {
      // End of imports block
      break;
    }
  }

  if (importLines.length > 0) {
    const importContent = importLines.join('\n');
    chunks.push({
      id: `${filePath}:imports`,
      path: filePath,
      content: importContent,
      type: 'import',
      metadata: {
        startLine,
        endLine,
        language,
        tokens: estimateTokens(importContent),
      },
    });
  }

  return chunks;
}

/**
 * Extract interesting comments (TODO, FIXME, BUG, HACK)
 */
function extractInterestingComments(
  filePath: string,
  content: string,
  lines: string[],
  language: string
): CodeChunk[] {
  const chunks: CodeChunk[] = [];

  // Single line comments
  const singleLinePattern = /\/\/\s*(TODO|FIXME|BUG|HACK|XXX|OPTIMIZE|NOTE|WARNING):?\s*(.+)/gi;
  let match;
  
  while ((match = singleLinePattern.exec(content)) !== null) {
    const lineNum = content.substring(0, match.index).split('\n').length;
    chunks.push({
      id: `${filePath}:comment:${lineNum}`,
      path: filePath,
      content: match[0].trim(),
      type: 'comment',
      metadata: {
        startLine: lineNum,
        endLine: lineNum,
        language,
        tokens: estimateTokens(match[0]),
        name: match[1].toUpperCase(),
      },
    });
  }

  // Multi-line comments with TODO/FIXME
  const multiLinePattern = /\/\*[\s\S]*?(TODO|FIXME|BUG|HACK)[\s\S]*?\*\//gi;
  while ((match = multiLinePattern.exec(content)) !== null) {
    const lineNum = content.substring(0, match.index).split('\n').length;
    const endLineNum = lineNum + (match[0].match(/\n/g) || []).length;
    
    chunks.push({
      id: `${filePath}:multicomment:${lineNum}`,
      path: filePath,
      content: match[0].trim(),
      type: 'comment',
      metadata: {
        startLine: lineNum,
        endLine: endLineNum,
        language,
        tokens: estimateTokens(match[0]),
      },
    });
  }

  return chunks;
}

/**
 * Check if file is a config file
 */
function isConfigFile(path: string): boolean {
  const configPatterns = [
    /package\.json$/,
    /tsconfig.*\.json$/,
    /\.env\.example$/,
    /webpack\.config\./,
    /vite\.config\./,
    /next\.config\./,
    /tailwind\.config\./,
    /postcss\.config\./,
    /babel\.config\./,
    /jest\.config\./,
    /eslint.*\.(js|json|cjs)$/,
    /prettier.*\.(js|json|cjs)$/,
    /\.prettierrc/,
    /\.eslintrc/,
    /Cargo\.toml$/,
    /go\.mod$/,
    /requirements\.txt$/,
    /pyproject\.toml$/,
    /Gemfile$/,
    /composer\.json$/,
  ];

  return configPatterns.some(pattern => pattern.test(path));
}

/**
 * Estimate token count (rough approximation)
 */
function estimateTokens(text: string): number {
  // Rough estimate: ~4 characters per token for code
  return Math.ceil(text.length / 4);
}

/**
 * Create a summary of the repository
 */
export function createRepoSummary(
  selectedFiles: SelectedFiles,
  filesWithContent?: FileWithContent[]
): string {
  const snippets = extractInterestingSnippets(
    filesWithContent || (selectedFiles.files as unknown as FileWithContent[])
  );

  const categoryBreakdown = selectedFiles.summary.categoryBreakdown;
  const categories = Object.entries(categoryBreakdown)
    .filter(([, count]) => count > 0)
    .map(([cat, count]) => `${cat}: ${count}`)
    .join(', ');

  return `
Repository Analysis Summary
===========================

📊 File Statistics:
- Total files scanned: ${selectedFiles.summary.totalFiles}
- Files selected for analysis: ${selectedFiles.summary.selectedFiles}
- Total size: ${formatBytes(selectedFiles.summary.totalSize)}

💻 Languages Detected:
${selectedFiles.summary.languages.map(l => `- ${l}`).join('\n')}

🚀 Entry Points:
${selectedFiles.summary.entryPoints.length > 0 
  ? selectedFiles.summary.entryPoints.map(e => `- ${e}`).join('\n')
  : '- None detected'}

📁 File Categories:
${categories}

🔍 Interesting Findings:
${snippets.length > 0 
  ? snippets.slice(0, 15).map(s => `- ${s}`).join('\n')
  : '- No notable patterns detected'}

📌 Priority Files:
${selectedFiles.summary.priorityFiles.slice(0, 10).map(f => `- ${f}`).join('\n')}
  `.trim();
}

/**
 * Extract interesting snippets from files
 */
function extractInterestingSnippets(files: FileWithContent[]): string[] {
  const snippets: string[] = [];

  for (const file of files) {
    if (!file.content) continue;

    // Find TODO/FIXME/BUG comments
    const todoMatches = file.content.match(/\/\/\s*(TODO|FIXME|BUG|HACK):?\s*.{10,80}/gi);
    if (todoMatches) {
      snippets.push(...todoMatches.slice(0, 2).map(m => `${file.path}: ${m.trim()}`));
    }

    // Find exported functions/classes
    const exportMatches = file.content.match(
      /export\s+(?:default\s+)?(?:async\s+)?(?:function|class|const)\s+(\w+)/g
    );
    if (exportMatches) {
      snippets.push(...exportMatches.slice(0, 2).map(m => `${file.path}: ${m}`));
    }

    // Find API endpoints
    const apiMatches = file.content.match(
      /(?:app|router)\.(get|post|put|delete|patch)\s*\(\s*['"`]([^'"`]+)/gi
    );
    if (apiMatches) {
      snippets.push(...apiMatches.slice(0, 2).map(m => `${file.path}: ${m}`));
    }
  }

  // Deduplicate and limit
  return [...new Set(snippets)].slice(0, 25);
}

/**
 * Format bytes to human readable string
 */
function formatBytes(bytes: number): string {
  if (bytes === 0) return '0 Bytes';
  const k = 1024;
  const sizes = ['Bytes', 'KB', 'MB', 'GB'];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
}

/**
 * Get formatted content optimized for specific AI models
 */
export function formatForModel(
  formattedRepo: FormattedRepo,
  model: 'gemini' | 'gpt4' | 'claude' | 'llama'
): string {
  const maxTokens: Record<string, number> = {
    'gemini': 1000000, // Gemini 1.5 Pro
    'gpt4': 128000,    // GPT-4 Turbo
    'claude': 200000,  // Claude 3
    'llama': 32000,    // Llama 2
  };

  const limit = maxTokens[model] || 32000;

  if (formattedRepo.tokenEstimate <= limit) {
    return formattedRepo.fullContent;
  }

  // Truncate if needed, keeping summary and critical sections
  let truncated = formattedRepo.summary + '\n\n---\n\n';
  truncated += '# Key Code Sections\n\n';

  // Add most important chunks
  const sortedChunks = [...formattedRepo.codeChunks].sort((a, b) => {
    const priority: Record<string, number> = {
      'config': 5,
      'component': 4,
      'hook': 4,
      'function': 3,
      'class': 3,
      'type': 2,
      'import': 1,
      'comment': 1,
    };
    return (priority[b.type] || 0) - (priority[a.type] || 0);
  });

  let currentTokens = estimateTokens(truncated);
  for (const chunk of sortedChunks) {
    if (currentTokens + chunk.metadata.tokens > limit * 0.9) break;
    
    truncated += `### ${chunk.path} - ${chunk.type}${chunk.metadata.name ? ` (${chunk.metadata.name})` : ''}\n`;
    truncated += `\`\`\`${chunk.metadata.language}\n${chunk.content}\n\`\`\`\n\n`;
    currentTokens += chunk.metadata.tokens + 20; // Account for markdown
  }

  return truncated;
}

// Export singleton functions
export function getFormatter() {
  return {
    formatRepoForAI,
    createRepoSummary,
    formatForModel,
    extractSemanticChunks,
  };
}
