import { useState } from 'react';
import type { DocNode } from '../api';
import './DocTree.css';

interface DocTreeProps {
  nodes: DocNode[];
  activePath: string;
  onSelect: (node: DocNode) => void;
}

interface TreeItemProps {
  node: DocNode;
  depth: number;
  activePath: string;
  onSelect: (node: DocNode) => void;
}

function Chevron({ open }: { open: boolean }) {
  return (
    <svg
      className={`tomo-chevron ${open ? 'is-open' : ''}`}
      width="12"
      height="12"
      viewBox="0 0 12 12"
      fill="none"
      aria-hidden
    >
      <path
        d="M4.5 3l3 3-3 3"
        stroke="currentColor"
        strokeWidth="1.5"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}

function TreeItem({ node, depth, activePath, onSelect }: TreeItemProps) {
  const [expanded, setExpanded] = useState(true);
  const isActive = node.path === activePath;
  const isFolder = node.type === 'folder';

  const handleClick = () => {
    if (isFolder) {
      setExpanded((v) => !v);
    } else {
      onSelect(node);
    }
  };

  return (
    <div className="tomo-tree-item">
      <button
        className={`tomo-tree-row ${isActive ? 'is-active' : ''} ${isFolder ? 'is-folder' : ''}`}
        style={{ paddingLeft: `${10 + depth * 14}px` }}
        onClick={handleClick}
        type="button"
      >
        <span className="tomo-tree-disclosure">
          {isFolder ? <Chevron open={expanded} /> : null}
        </span>
        <span className="tomo-tree-label">{node.name.replace(/\.md$/, '')}</span>
      </button>
      {isFolder && expanded && node.children && (
        <div className="tomo-tree-children">
          {node.children.map((child) => (
            <TreeItem
              key={child.path}
              node={child}
              depth={depth + 1}
              activePath={activePath}
              onSelect={onSelect}
            />
          ))}
        </div>
      )}
    </div>
  );
}

export default function DocTree({ nodes, activePath, onSelect }: DocTreeProps) {
  return (
    <nav className="tomo-tree">
      {nodes.map((node) => (
        <TreeItem
          key={node.path}
          node={node}
          depth={0}
          activePath={activePath}
          onSelect={onSelect}
        />
      ))}
    </nav>
  );
}
