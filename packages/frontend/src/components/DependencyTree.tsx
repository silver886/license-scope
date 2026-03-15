import { useState, useCallback } from 'react';
import type { Dependency } from '../api/client';
import LicenseBadge from './LicenseBadge';

interface TreeNode {
  dep: Dependency;
  children: TreeNode[];
}

interface DependencyTreeProps {
  root: Dependency;
  allDeps: Dependency[];
}

function buildTree(root: Dependency, allDeps: Dependency[]): TreeNode {
  const childDeps = allDeps.filter((d) => d.parentDepId === root.id);
  return {
    dep: root,
    children: childDeps.map((child) => buildTree(child, allDeps)),
  };
}

function collectNodeIds(node: TreeNode): string[] {
  const ids = [node.dep.id];
  for (const child of node.children) {
    ids.push(...collectNodeIds(child));
  }
  return ids;
}

interface TreeNodeViewProps {
  node: TreeNode;
  depth: number;
  expanded: Set<string>;
  toggleExpand: (id: string) => void;
}

function TreeNodeView({ node, depth, expanded, toggleExpand }: TreeNodeViewProps) {
  const hasChildren = node.children.length > 0;
  const isExpanded = expanded.has(node.dep.id);

  return (
    <div>
      <div
        className="flex items-center gap-2 py-1.5 px-2 rounded hover:bg-slate-50"
        style={{ paddingLeft: `${depth * 24 + 8}px` }}
      >
        {hasChildren ? (
          <button
            onClick={() => toggleExpand(node.dep.id)}
            className="w-5 h-5 flex items-center justify-center text-slate-400 hover:text-slate-600 flex-shrink-0"
          >
            <span
              className={`inline-block transform transition-transform text-xs ${
                isExpanded ? 'rotate-90' : ''
              }`}
            >
              &#9654;
            </span>
          </button>
        ) : (
          <span className="w-5 h-5 flex items-center justify-center text-slate-300 flex-shrink-0">
            &#8226;
          </span>
        )}

        <span className="font-medium text-sm text-slate-800">
          {node.dep.name}
        </span>
        <span className="text-xs text-slate-500 font-mono">
          {node.dep.version}
        </span>
        <LicenseBadge category={node.dep.licenseCategory} />
      </div>

      {hasChildren && isExpanded && (
        <div>
          {node.children.map((child) => (
            <TreeNodeView
              key={child.dep.id}
              node={child}
              depth={depth + 1}
              expanded={expanded}
              toggleExpand={toggleExpand}
            />
          ))}
        </div>
      )}
    </div>
  );
}

export default function DependencyTree({ root, allDeps }: DependencyTreeProps) {
  const tree = buildTree(root, allDeps);
  const allIds = collectNodeIds(tree);

  const [expanded, setExpanded] = useState<Set<string>>(new Set([root.id]));

  const toggleExpand = useCallback((id: string) => {
    setExpanded((prev) => {
      const next = new Set(prev);
      if (next.has(id)) {
        next.delete(id);
      } else {
        next.add(id);
      }
      return next;
    });
  }, []);

  const expandAll = useCallback(() => {
    setExpanded(new Set(allIds));
  }, [allIds]);

  const collapseAll = useCallback(() => {
    setExpanded(new Set());
  }, []);

  return (
    <div className="bg-white rounded-xl shadow-sm border border-slate-200 p-4">
      <div className="flex items-center justify-between mb-3">
        <h3 className="text-sm font-semibold text-slate-700">
          Dependency Tree
        </h3>
        <div className="flex gap-2">
          <button
            onClick={expandAll}
            className="text-xs text-indigo-600 hover:text-indigo-800 font-medium"
          >
            Expand All
          </button>
          <button
            onClick={collapseAll}
            className="text-xs text-indigo-600 hover:text-indigo-800 font-medium"
          >
            Collapse All
          </button>
        </div>
      </div>

      {tree.children.length === 0 && (
        <p className="text-sm text-slate-500 py-2">
          No transitive dependencies.
        </p>
      )}

      <TreeNodeView
        node={tree}
        depth={0}
        expanded={expanded}
        toggleExpand={toggleExpand}
      />
    </div>
  );
}
