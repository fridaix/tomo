import { generateHTML, type JSONContent, type MarkdownRendererHelpers } from '@tiptap/core';
import { Image } from '@tiptap/extension-image';
import { Table, renderTableToMarkdown } from '@tiptap/extension-table';
import { TaskItem } from '@tiptap/extension-task-item';
import { TaskList } from '@tiptap/extension-task-list';
import StarterKit from '@tiptap/starter-kit';

type TableCellAttrs = {
  colspan?: number;
  rowspan?: number;
  colwidth?: number[] | null;
  align?: string | null;
};

const CELL_CONTENT_EXTENSIONS = [
  StarterKit,
  TaskList,
  TaskItem.configure({ nested: true }),
  Image.configure({ inline: false }),
];

function cellHasSpan(cell: JSONContent): boolean {
  const attrs = cell.attrs as TableCellAttrs | undefined;
  return Number(attrs?.colspan ?? 1) > 1 || Number(attrs?.rowspan ?? 1) > 1;
}

function tableHasMergedCells(node: JSONContent): boolean {
  return Boolean(
    node.content?.some((row) => row.content?.some((cell) => cellHasSpan(cell)))
  );
}

function escapeHtml(value: string): string {
  return value
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

function renderCellAttributes(attrs: TableCellAttrs | undefined): string {
  const parts: string[] = [];
  const colspan = Number(attrs?.colspan ?? 1);
  const rowspan = Number(attrs?.rowspan ?? 1);

  if (colspan > 1) parts.push(`colspan="${colspan}"`);
  if (rowspan > 1) parts.push(`rowspan="${rowspan}"`);
  if (attrs?.align) parts.push(`style="text-align: ${escapeHtml(attrs.align)}"`);
  if (attrs?.colwidth?.length) parts.push(`colwidth="${attrs.colwidth.join(',')}"`);

  return parts.length > 0 ? ` ${parts.join(' ')}` : '';
}

function renderCellContent(cell: JSONContent, h: MarkdownRendererHelpers): string {
  const content = cell.content ?? [];

  try {
    return generateHTML({ type: 'doc', content }, CELL_CONTENT_EXTENSIONS);
  } catch {
    return escapeHtml(h.renderChildren(content, '\n\n')).replace(/\n/g, '<br>');
  }
}

function renderMergedTableToHtml(node: JSONContent, h: MarkdownRendererHelpers): string {
  const rows =
    node.content?.map((row) => {
      const cells =
        row.content?.map((cell) => {
          const tag = cell.type === 'tableHeader' ? 'th' : 'td';
          const attrs = renderCellAttributes(cell.attrs as TableCellAttrs | undefined);
          const content = renderCellContent(cell, h);
          return `    <${tag}${attrs}>${content}</${tag}>`;
        }) ?? [];

      return `  <tr>\n${cells.join('\n')}\n  </tr>`;
    }) ?? [];

  return `\n<table>\n<tbody>\n${rows.join('\n')}\n</tbody>\n</table>\n`;
}

export const RichTable = Table.extend({
  renderMarkdown: (node, h) => {
    if (tableHasMergedCells(node)) {
      return renderMergedTableToHtml(node, h);
    }

    return renderTableToMarkdown(node, h);
  },
});
