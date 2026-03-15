import { useState, useMemo } from 'react';
import { Link } from 'react-router-dom';
import {
  useReactTable,
  getCoreRowModel,
  getSortedRowModel,
  getFilteredRowModel,
  getPaginationRowModel,
  flexRender,
  createColumnHelper,
  type SortingState,
  type ColumnFiltersState,
} from '@tanstack/react-table';
import type { Dependency } from '../api/client';
import LicenseBadge from './LicenseBadge';

interface DependencyTableProps {
  dependencies: Dependency[];
  analysisId: string;
}

const columnHelper = createColumnHelper<Dependency>();

export default function DependencyTable({
  dependencies,
  analysisId,
}: DependencyTableProps) {
  const [sorting, setSorting] = useState<SortingState>([]);
  const [columnFilters, setColumnFilters] = useState<ColumnFiltersState>([]);
  const [globalFilter, setGlobalFilter] = useState('');

  const ecosystems = useMemo(() => {
    const set = new Set(dependencies.map((d) => d.ecosystem));
    return Array.from(set).sort();
  }, [dependencies]);

  const columns = useMemo(
    () => [
      columnHelper.accessor('name', {
        header: 'Name',
        cell: (info) => (
          <Link
            to={`/analysis/${analysisId}/dependency/${info.row.original.id}`}
            className="text-indigo-600 hover:text-indigo-800 font-medium hover:underline"
          >
            {info.getValue()}
          </Link>
        ),
      }),
      columnHelper.accessor('version', {
        header: 'Version',
        cell: (info) => (
          <span className="text-slate-600 font-mono text-sm">
            {info.getValue()}
          </span>
        ),
      }),
      columnHelper.accessor('ecosystem', {
        header: 'Ecosystem',
        cell: (info) => (
          <span className="capitalize text-slate-700">{info.getValue()}</span>
        ),
        filterFn: 'equals',
      }),
      columnHelper.accessor('licenseSpdx', {
        header: 'License',
        cell: (info) => (
          <span className="text-slate-700 font-mono text-sm">
            {info.getValue() || 'N/A'}
          </span>
        ),
      }),
      columnHelper.accessor('licenseCategory', {
        header: 'Category',
        cell: (info) => (
          <LicenseBadge category={info.getValue()} />
        ),
        filterFn: 'equals',
      }),
      columnHelper.accessor('isDirect', {
        header: 'Type',
        cell: (info) => (
          <span
            className={`inline-flex px-2 py-0.5 rounded text-xs font-medium ${
              info.getValue()
                ? 'bg-blue-100 text-blue-800'
                : 'bg-slate-100 text-slate-600'
            }`}
          >
            {info.getValue() ? 'Direct' : 'Transitive'}
          </span>
        ),
      }),
      columnHelper.display({
        id: 'actions',
        header: 'Actions',
        cell: (info) => (
          <Link
            to={`/analysis/${analysisId}/dependency/${info.row.original.id}`}
            className="text-sm text-indigo-600 hover:text-indigo-800 hover:underline"
          >
            Details
          </Link>
        ),
      }),
    ],
    [analysisId],
  );

  const table = useReactTable({
    data: dependencies,
    columns,
    state: {
      sorting,
      columnFilters,
      globalFilter,
    },
    onSortingChange: setSorting,
    onColumnFiltersChange: setColumnFilters,
    onGlobalFilterChange: setGlobalFilter,
    getCoreRowModel: getCoreRowModel(),
    getSortedRowModel: getSortedRowModel(),
    getFilteredRowModel: getFilteredRowModel(),
    getPaginationRowModel: getPaginationRowModel(),
    initialState: {
      pagination: {
        pageSize: 25,
      },
    },
  });

  const currentEcosystemFilter =
    (columnFilters.find((f) => f.id === 'ecosystem')?.value as string) || '';
  const currentCategoryFilter =
    (columnFilters.find((f) => f.id === 'licenseCategory')?.value as string) || '';

  return (
    <div className="space-y-4">
      {/* Filters */}
      <div className="flex flex-wrap gap-4 items-end">
        <div className="flex-1 min-w-[200px]">
          <label className="block text-sm font-medium text-slate-700 mb-1">
            Search
          </label>
          <input
            type="text"
            value={globalFilter}
            onChange={(e) => setGlobalFilter(e.target.value)}
            placeholder="Filter dependencies..."
            className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 bg-white"
          />
        </div>
        <div>
          <label className="block text-sm font-medium text-slate-700 mb-1">
            Ecosystem
          </label>
          <select
            value={currentEcosystemFilter}
            onChange={(e) => {
              const val = e.target.value;
              setColumnFilters((prev) => {
                const without = prev.filter((f) => f.id !== 'ecosystem');
                return val ? [...without, { id: 'ecosystem', value: val }] : without;
              });
            }}
            className="px-3 py-2 border border-slate-300 rounded-lg text-sm focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 bg-white"
          >
            <option value="">All</option>
            {ecosystems.map((eco) => (
              <option key={eco} value={eco}>
                {eco}
              </option>
            ))}
          </select>
        </div>
        <div>
          <label className="block text-sm font-medium text-slate-700 mb-1">
            Category
          </label>
          <select
            value={currentCategoryFilter}
            onChange={(e) => {
              const val = e.target.value;
              setColumnFilters((prev) => {
                const without = prev.filter((f) => f.id !== 'licenseCategory');
                return val
                  ? [...without, { id: 'licenseCategory', value: val }]
                  : without;
              });
            }}
            className="px-3 py-2 border border-slate-300 rounded-lg text-sm focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 bg-white"
          >
            <option value="">All</option>
            <option value="permissive">Permissive</option>
            <option value="weak-copyleft">Weak Copyleft</option>
            <option value="strong-copyleft">Strong Copyleft</option>
            <option value="unknown">Unknown</option>
          </select>
        </div>
      </div>

      {/* Row count */}
      <div className="text-sm text-slate-500">
        Showing {table.getRowModel().rows.length} of{' '}
        {table.getFilteredRowModel().rows.length} dependencies
      </div>

      {/* Table */}
      <div className="overflow-x-auto rounded-lg border border-slate-200 shadow-sm">
        <table className="w-full text-sm table-striped">
          <thead className="bg-slate-50 border-b border-slate-200">
            {table.getHeaderGroups().map((headerGroup) => (
              <tr key={headerGroup.id}>
                {headerGroup.headers.map((header) => (
                  <th
                    key={header.id}
                    className="px-4 py-3 text-left font-semibold text-slate-700 whitespace-nowrap select-none"
                    onClick={header.column.getCanSort() ? header.column.getToggleSortingHandler() : undefined}
                    style={{
                      cursor: header.column.getCanSort() ? 'pointer' : 'default',
                    }}
                  >
                    <div className="flex items-center gap-1">
                      {header.isPlaceholder
                        ? null
                        : flexRender(
                            header.column.columnDef.header,
                            header.getContext(),
                          )}
                      {header.column.getIsSorted() === 'asc' && (
                        <span className="text-indigo-500">&#9650;</span>
                      )}
                      {header.column.getIsSorted() === 'desc' && (
                        <span className="text-indigo-500">&#9660;</span>
                      )}
                    </div>
                  </th>
                ))}
              </tr>
            ))}
          </thead>
          <tbody className="bg-white divide-y divide-slate-100">
            {table.getRowModel().rows.map((row) => (
              <tr key={row.id} className="hover:bg-slate-50">
                {row.getVisibleCells().map((cell) => (
                  <td key={cell.id} className="px-4 py-3 whitespace-nowrap">
                    {flexRender(cell.column.columnDef.cell, cell.getContext())}
                  </td>
                ))}
              </tr>
            ))}
            {table.getRowModel().rows.length === 0 && (
              <tr>
                <td
                  colSpan={columns.length}
                  className="px-4 py-8 text-center text-slate-500"
                >
                  No dependencies found.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>

      {/* Pagination */}
      <div className="flex items-center justify-between">
        <span className="text-sm text-slate-600">
          Page {table.getState().pagination.pageIndex + 1} of{' '}
          {table.getPageCount() || 1}
        </span>
        <div className="flex items-center gap-2">
          <button
            onClick={() => table.previousPage()}
            disabled={!table.getCanPreviousPage()}
            className="px-3 py-1.5 text-sm font-medium rounded-lg border border-slate-300 bg-white text-slate-700 hover:bg-slate-50 disabled:opacity-50 disabled:cursor-not-allowed"
          >
            Previous
          </button>
          <button
            onClick={() => table.nextPage()}
            disabled={!table.getCanNextPage()}
            className="px-3 py-1.5 text-sm font-medium rounded-lg border border-slate-300 bg-white text-slate-700 hover:bg-slate-50 disabled:opacity-50 disabled:cursor-not-allowed"
          >
            Next
          </button>
        </div>
      </div>
    </div>
  );
}
