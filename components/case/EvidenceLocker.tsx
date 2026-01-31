'use client';

import React, { useState } from 'react';
import { FileNode } from '@/lib/github/client';
import { fetchFileContent } from '@/app/case/actions';
import { Folder, FileText, FileWarning, ArrowLeft, Loader2, ChevronRight, ChevronDown } from 'lucide-react';
import { Highlight, themes } from 'prism-react-renderer';

// Map file extensions to Prism language identifiers
const getLanguageFromPath = (path: string): string => {
  const ext = path.split('.').pop()?.toLowerCase() || '';
  const langMap: Record<string, string> = {
    // JavaScript/TypeScript
    'js': 'javascript',
    'jsx': 'jsx',
    'ts': 'typescript',
    'tsx': 'tsx',
    'mjs': 'javascript',
    'cjs': 'javascript',
    // Web
    'html': 'markup',
    'htm': 'markup',
    'xml': 'markup',
    'svg': 'markup',
    'css': 'css',
    'scss': 'scss',
    'sass': 'sass',
    'less': 'less',
    // Data formats
    'json': 'json',
    'yaml': 'yaml',
    'yml': 'yaml',
    'toml': 'toml',
    // Backend
    'py': 'python',
    'rb': 'ruby',
    'go': 'go',
    'rs': 'rust',
    'java': 'java',
    'kt': 'kotlin',
    'scala': 'scala',
    'cs': 'csharp',
    'php': 'php',
    'swift': 'swift',
    // Shell
    'sh': 'bash',
    'bash': 'bash',
    'zsh': 'bash',
    'fish': 'bash',
    'ps1': 'powershell',
    // Config
    'dockerfile': 'docker',
    'makefile': 'makefile',
    'md': 'markdown',
    'mdx': 'markdown',
    // SQL
    'sql': 'sql',
    // C/C++
    'c': 'c',
    'h': 'c',
    'cpp': 'cpp',
    'cc': 'cpp',
    'hpp': 'cpp',
    // Other
    'graphql': 'graphql',
    'gql': 'graphql',
    'lua': 'lua',
    'r': 'r',
    'diff': 'diff',
  };
  
  // Check for special filenames
  const filename = path.split('/').pop()?.toLowerCase() || '';
  if (filename === 'dockerfile') return 'docker';
  if (filename === 'makefile') return 'makefile';
  if (filename.startsWith('.env')) return 'bash';
  if (filename === '.gitignore' || filename === '.dockerignore') return 'git';
  
  return langMap[ext] || 'plaintext';
};

interface EvidenceLockerProps {
  files: FileNode[];
  owner: string;
  repo: string;
  totalFiles: number;
}

interface TreeNode {
  name: string;
  path: string;
  type: 'file' | 'dir';
  children: TreeNode[];
}

function buildTree(files: FileNode[]): TreeNode[] {
  const rootObj: { children: TreeNode[] } = { children: [] };
  
  const getChild = (children: TreeNode[], name: string): TreeNode | undefined => 
      children.find(c => c.name === name);

  for (const file of files) {
      const parts = file.path.split('/');
      let currentLevel = rootObj.children;
      
      for (let i = 0; i < parts.length; i++) {
          const part = parts[i];
          const isLast = i === parts.length - 1;
          
          const existing = getChild(currentLevel, part);
          
          if (!existing) {
              const newPath = parts.slice(0, i + 1).join('/');
              const newNode: TreeNode = {
                  name: part,
                  path: newPath,
                  type: isLast ? file.type : 'dir',
                  children: []
              };
              currentLevel.push(newNode);
              currentLevel = newNode.children;
          } else {
              if (isLast) {
                  existing.type = file.type;
              }
              currentLevel = existing.children;
          }
      }
  }

  const sortTree = (nodes: TreeNode[]) => {
      nodes.sort((a, b) => {
          if (a.type === b.type) return a.name.localeCompare(b.name);
          return a.type === 'dir' ? -1 : 1;
      });
      nodes.forEach(n => {
          if (n.children.length > 0) sortTree(n.children);
      });
  };

  sortTree(rootObj.children);
  return rootObj.children;
}

const FileTreeItem = ({ 
  node, 
  depth = 0, 
  onSelect,
  selectedPath
}: { 
  node: TreeNode, 
  depth?: number, 
  onSelect: (node: TreeNode) => void,
  selectedPath?: string
}) => {
  const [expanded, setExpanded] = useState(false);
  const isDir = node.type === 'dir';
  const isSelected = node.path === selectedPath;

  const handleClick = (e: React.MouseEvent) => {
    e.stopPropagation();
    if (isDir) {
      setExpanded(!expanded);
    } else {
      onSelect(node);
    }
  };

  return (
    <div>
      <div 
        onClick={handleClick}
        className={`flex items-center gap-1 py-1 cursor-pointer select-none transition-colors text-xs
          ${isSelected ? 'bg-red-900/20 text-red-200' : 'hover:bg-zinc-900/50 text-zinc-600'}
        `}
        style={{ paddingLeft: `${depth * 12 + 8}px` }}
      >
        <span className="shrink-0 relative top-px opacity-70">
           {isDir ? (
             expanded ? <ChevronDown className="w-3 h-3" /> : <ChevronRight className="w-3 h-3" />
           ) : <span className="w-3 h-3 inline-block" />} 
        </span>
        
        {isDir ? (
           <Folder className={`w-3 h-3 ${expanded ? 'text-zinc-400' : 'text-zinc-600'} shrink-0`} />
        ) : (
           <FileText className={`w-3 h-3 shrink-0 ${isSelected ? 'text-red-400' : 'text-zinc-700'}`} />
        )}
        
        <span className={`truncate ${isDir ? 'text-zinc-400 font-medium' : isSelected ? 'text-red-200' : 'text-zinc-500'}`}>
          {node.name}
        </span>
      </div>
      
      {isDir && expanded && (
        <div>
          {node.children.map(child => (
            <FileTreeItem 
              key={child.path} 
              node={child} 
              depth={depth + 1} 
              onSelect={onSelect} 
              selectedPath={selectedPath}
            />
          ))}
        </div>
      )}
    </div>
  );
};

export default function EvidenceLocker({ files, owner, repo, totalFiles }: EvidenceLockerProps) {
  const [selectedFile, setSelectedFile] = useState<FileNode | null>(null);
  const [fileContent, setFileContent] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const fileTree = React.useMemo(() => buildTree(files), [files]);

  const handleNodeSelect = async (node: TreeNode) => {
    if (node.type === 'dir') return;

    // Convert TreeNode to FileNode for state
    const file: FileNode = { path: node.path, type: 'file' }; 
    setSelectedFile(file);
    setLoading(true);
    setError(null);
    setFileContent(null);

    try {
      const result = await fetchFileContent(owner, repo, file.path);
      if (result.success && result.content) {
        setFileContent(result.content);
      } else {
        setError('Failed to decrypt file content.');
      }
    } catch {
      setError('Connection lost during retrieval.');
    } finally {
      setLoading(false);
    }
  };

  const handleBack = () => {
    setSelectedFile(null);
    setFileContent(null);
    setError(null);
  };

  return (
    <div className="h-full flex flex-col bg-[#0a0a0a] border border-zinc-800 shadow-2xl relative overflow-hidden">
      {/* Coffee Stain Overlay */}
      <div className="absolute top-10 right-10 w-32 h-32 rounded-full border-16 border-[#3f2e18]/10 opacity-40 pointer-events-none blur-sm transform scale-110"></div>

      <div className="p-4 border-b border-zinc-800 bg-[#0f0f0f] flex justify-between items-center sticky top-0 z-20 shadow-md shrink-0">
        <h2 className="text-sm font-bold text-zinc-400 flex items-center gap-2 uppercase tracking-widest font-typewriter">
          <Folder className="w-4 h-4" /> Evidence Locker
        </h2>
        <span className="text-xs text-zinc-600 font-mono bg-black/20 px-2 py-1 rounded">
          {selectedFile ? 'EVIDENCE VIEW' : `INDEX: ${totalFiles} FILES`}
        </span>
      </div>

      <div className="flex-1 min-h-0 overflow-hidden p-0 font-mono text-xs relative z-10 flex flex-col">
         {/* Sidebar Tree View - Always Visible on Larger Screens or Toggleable? 
             For now keeping user's modal-like interaction but with better list. 
             If selectedFile is active, maybe show side-by-side or overlay?
             The original code replaced the view. Let's keep that behavior but improve the list.
         */}
         
        {selectedFile ? (
          <div className="flex flex-col h-full w-full p-6">
            <button 
              onClick={handleBack}
              className="flex items-center gap-2 text-zinc-500 hover:text-zinc-300 mb-4 transition-colors uppercase tracking-widest font-bold text-[10px] shrink-0"
            >
              <ArrowLeft className="w-3 h-3" /> Return to Index
            </button>
            
            <div className="border border-zinc-800 bg-[#050505] p-4 rounded-sm relative flex-1 min-h-0 flex flex-col">
              <div className="absolute top-0 right-0 px-2 py-1 bg-zinc-900 text-zinc-500 text-[10px] border-b border-l border-zinc-800 font-typewriter z-10">
                {selectedFile.path}
              </div>
              
              {loading ? (
                <div className="flex flex-col items-center justify-center h-full text-zinc-600 gap-2">
                  <Loader2 className="w-8 h-8 animate-spin" />
                  <span className="animate-pulse font-typewriter">DECRYPTING...</span>
                </div>
              ) : error ? (
                <div className="flex flex-col items-center justify-center h-full text-red-900/70 gap-2">
                  <FileWarning className="w-8 h-8" />
                  <span className="font-typewriter">{error}</span>
                </div>
              ) : (
                <div className="absolute inset-0 top-8 overflow-auto custom-scrollbar">
                  <Highlight
                    theme={themes.nightOwl}
                    code={fileContent || ''}
                    language={getLanguageFromPath(selectedFile.path)}
                  >
                    {({ style, tokens, getLineProps, getTokenProps }) => (
                      <pre 
                        className="font-mono text-xs leading-relaxed p-4"
                        style={{ ...style, background: 'transparent', margin: 0 }}
                      >
                        {tokens.map((line, i) => (
                          <div key={i} {...getLineProps({ line })} className="table-row">
                            <span className="table-cell text-right pr-4 select-none text-zinc-700 w-8">
                              {i + 1}
                            </span>
                            <span className="table-cell">
                              {line.map((token, key) => (
                                <span key={key} {...getTokenProps({ token })} />
                              ))}
                            </span>
                          </div>
                        ))}
                      </pre>
                    )}
                  </Highlight>
                </div>
              )}
            </div>
          </div>
        ) : (
          /* Tree Index View */
          files.length > 0 ? (
            <div className="flex flex-col h-full w-full p-6">
              <div className="border border-zinc-800 bg-[#050505] rounded-sm relative flex-1 min-h-0 flex flex-col">
                <div className="absolute top-0 right-0 px-2 py-1 bg-zinc-900 text-zinc-500 text-[10px] border-b border-l border-zinc-800 font-typewriter z-10">
                  FILE INDEX
                </div>
                <div className="absolute inset-0 top-8 overflow-auto custom-scrollbar p-4">
                  {fileTree.map((node) => (
                    <FileTreeItem 
                      key={node.path} 
                      node={node} 
                      onSelect={handleNodeSelect}
                      selectedPath={selectedFile ? (selectedFile as FileNode).path : undefined}
                    />
                  ))}
                </div>
              </div>
            </div>
          ) : (
            <div className="w-full text-center py-20 text-zinc-600">
              <FileWarning className="w-12 h-12 mx-auto mb-4 opacity-20" />
              <p className="uppercase tracking-widest font-typewriter">Evidence Locked</p>
            </div>
          )
        )}
      </div>
    </div>
  );
}
