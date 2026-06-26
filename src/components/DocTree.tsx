import { useEffect, useRef, useState } from 'react';
import type { DocNode } from '../api';
import './DocTree.css';

export type DocAction = 'rename' | 'delete';

interface DocTreeProps {
  nodes: DocNode[];
  activePath: string;
  onSelect: (node: DocNode) => void;
  onAction: (action: DocAction, node: DocNode) => void;
  showActions?: boolean;
}

interface TreeItemProps {
  node: DocNode;
  depth: number;
  activePath: string;
  onSelect: (node: DocNode) => void;
  onAction: (action: DocAction, node: DocNode) => void;
  showActions: boolean;
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

function MoreIcon() {
  return (
    <svg width="14" height="14" viewBox="0 0 16 16" fill="none" aria-hidden>
      <circle cx="3" cy="8" r="1.3" fill="currentColor" />
      <circle cx="8" cy="8" r="1.3" fill="currentColor" />
      <circle cx="13" cy="8" r="1.3" fill="currentColor" />
    </svg>
  );
}

function TreeItem({ node, depth, activePath, onSelect, onAction, showActions }: TreeItemProps) {
  const [expanded, setExpanded] = useState(true);
  const [menuOpen, setMenuOpen] = useState(false);
  const menuRef = useRef<HTMLDivElement>(null);
  const isActive = node.path === activePath;
  const isFolder = node.type === 'folder';

  useEffect(() => {
    if (!menuOpen) return;
    const onClick = (e: MouseEvent) => {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) {
        setMenuOpen(false);
      }
    };
    document.addEventListener('mousedown', onClick);
    return () => document.removeEventListener('mousedown', onClick);
  }, [menuOpen]);

  const handleClick = () => {
    if (isFolder) {
      setExpanded((v) => !v);
    } else {
      onSelect(node);
    }
  };

  const runAction = (action: DocAction) => {
    setMenuOpen(false);
    onAction(action, node);
  };

  return (
    <div className="tomo-tree-item">
      <div className={`tomo-tree-row-wrap ${isActive ? 'is-active' : ''}`}>
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

        {!isFolder && showActions && (
          <div className="tomo-tree-menu" ref={menuRef}>
            <button
              className="tomo-tree-more"
              type="button"
              title="更多操作"
              onClick={(e) => {
                e.stopPropagation();
                setMenuOpen((v) => !v);
              }}
            >
              <MoreIcon />
            </button>
            {menuOpen && (
              <div className="tomo-tree-dropdown">
                <button type="button" onClick={() => runAction('rename')}>
                  重命名 / 移动
                </button>
                <button
                  type="button"
                  className="is-danger"
                  onClick={() => runAction('delete')}
                >
                  删除
                </button>
              </div>
            )}
          </div>
        )}
      </div>

      {isFolder && expanded && node.children && (
        <div className="tomo-tree-children">
          {node.children.map((child) => (
            <TreeItem
              key={child.path}
              node={child}
              depth={depth + 1}
              activePath={activePath}
              onSelect={onSelect}
              onAction={onAction}
              showActions={showActions}
            />
          ))}
        </div>
      )}
    </div>
  );
}

export default function DocTree({
  nodes,
  activePath,
  onSelect,
  onAction,
  showActions = false,
}: DocTreeProps) {
  return (
    <nav className="tomo-tree">
      {nodes.map((node) => (
        <TreeItem
          key={node.path}
          node={node}
          depth={0}
          activePath={activePath}
          onSelect={onSelect}
          onAction={onAction}
          showActions={showActions}
        />
      ))}
    </nav>
  );
}
