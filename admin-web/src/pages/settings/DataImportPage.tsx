import { useRef, useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import * as operationsApi from '../../api/operations';
import { Card, CardHeader } from '../../components/ui/Primitives';
import { Button } from '../../components/ui/Button';
import { Badge } from '../../components/ui/Badge';
import { EmptyState, ErrorState, InlineLoader } from '../../components/common/States';
import { TableWrap } from '../../components/ui/Table';
import { useToast } from '../../components/ui/Toast';
import { IconUpload } from '../../components/ui/Icons';
import { formatBytes, formatDateTime, formatNumber, humanize } from '../../utils/format';

type ImportKind = 'parents' | 'teachers';

/** Bulk Excel import, using the existing `/admin/import/*` endpoints. */
export function DataImportPage() {
  const queryClient = useQueryClient();

  const history = useQuery({
    queryKey: ['admin', 'import-history'],
    queryFn: () => operationsApi.getImportHistory({ page: 1, limit: 20 }),
  });

  const records = history.data?.data ?? [];

  return (
    <>
      <div className="grid grid-2">
        <ImportCard
          kind="parents"
          title="Import parents"
          description="Creates parent accounts from a spreadsheet. Rows that fail validation are reported individually and the rest still import."
          onImported={() => queryClient.invalidateQueries({ queryKey: ['admin'] })}
        />
        <ImportCard
          kind="teachers"
          title="Import tutors"
          description="Creates tutor accounts and profiles. Imported tutors still go through the normal verification flow."
          onImported={() => queryClient.invalidateQueries({ queryKey: ['admin'] })}
        />
      </div>

      <Card padded={false} className="mt-6">
        <CardHeader title="Import history" subtitle="Previous bulk imports and their outcome" />

        {history.isLoading && <InlineLoader />}
        {history.isError && <ErrorState error={history.error} onRetry={() => history.refetch()} />}

        {history.isSuccess && records.length === 0 && (
          <EmptyState
            title="No imports yet"
            message="Uploaded spreadsheets and their results will be listed here."
          />
        )}

        {history.isSuccess && records.length > 0 && (
          <TableWrap>
            <table className="tbl">
              <thead>
                <tr>
                  <th>File</th>
                  <th>Type</th>
                  <th className="num">Rows</th>
                  <th className="num">Imported</th>
                  <th className="num">Failed</th>
                  <th>When</th>
                </tr>
              </thead>
              <tbody>
                {records.map((record: any, index: number) => (
                  <tr key={record._id ?? index}>
                    <td className="cell-primary truncate" style={{ maxWidth: 240 }}>
                      {record.fileName ?? record.filename ?? '—'}
                    </td>
                    <td>
                      <Badge tone="neutral">{humanize(record.importType ?? record.type)}</Badge>
                    </td>
                    <td className="num">{formatNumber(record.totalRows)}</td>
                    <td className="num" style={{ color: 'var(--c-success)' }}>
                      {formatNumber(record.successCount ?? record.imported)}
                    </td>
                    <td
                      className="num"
                      style={{
                        color: (record.failureCount ?? record.failed) > 0
                          ? 'var(--c-error)'
                          : undefined,
                      }}
                    >
                      {formatNumber(record.failureCount ?? record.failed ?? 0)}
                    </td>
                    <td className="muted nowrap">{formatDateTime(record.createdAt)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </TableWrap>
        )}
      </Card>
    </>
  );
}

function ImportCard({
  kind,
  title,
  description,
  onImported,
}: {
  kind: ImportKind;
  title: string;
  description: string;
  onImported: () => void;
}) {
  const toast = useToast();
  const inputRef = useRef<HTMLInputElement>(null);
  const [file, setFile] = useState<File | null>(null);
  const [result, setResult] = useState<operationsApi.ImportResult | null>(null);

  const run = useMutation({
    mutationFn: () =>
      kind === 'parents'
        ? operationsApi.importParents(file!)
        : operationsApi.importTeachers(file!),
    onSuccess: (response) => {
      setResult(response.data ?? null);
      toast.success(response.message || 'Import finished');
      setFile(null);
      onImported();
    },
    onError: (error) => toast.error(error instanceof Error ? error.message : 'Import failed'),
  });

  return (
    <Card padded={false}>
      <CardHeader title={title} />
      <div className="card-body">
        <p className="text-sm muted" style={{ lineHeight: 1.6 }}>
          {description}
        </p>

        <input
          ref={inputRef}
          type="file"
          className="sr-only"
          accept=".xlsx,.xls,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet,application/vnd.ms-excel"
          onChange={(event) => {
            const selected = event.target.files?.[0] ?? null;
            event.target.value = '';
            setFile(selected);
            setResult(null);
          }}
        />

        <div
          className="mt-4 row gap-3 wrap"
          style={{
            padding: 'var(--s-4)',
            border: '1px dashed var(--c-border-dark)',
            borderRadius: 'var(--r-md)',
            alignItems: 'center',
          }}
        >
          <span style={{ color: 'var(--c-text-3)', flex: 'none' }}>
            <IconUpload size={18} />
          </span>
          <div className="grow" style={{ minWidth: 140 }}>
            {file ? (
              <>
                <p className="text-sm strong truncate">{file.name}</p>
                <p className="field-hint">{formatBytes(file.size)}</p>
              </>
            ) : (
              <p className="text-sm muted">No file selected — Excel (.xlsx or .xls)</p>
            )}
          </div>
          <Button variant="secondary" size="sm" onClick={() => inputRef.current?.click()}>
            {file ? 'Change file' : 'Choose file'}
          </Button>
        </div>

        {result && (
          <div className="mt-4">
            <div className="row gap-3 wrap">
              <Badge tone="neutral">{formatNumber(result.totalRows)} rows</Badge>
              <Badge tone="success">{formatNumber(result.successCount)} imported</Badge>
              {(result.failureCount ?? 0) > 0 && (
                <Badge tone="error">{formatNumber(result.failureCount)} failed</Badge>
              )}
            </div>

            {result.errors && result.errors.length > 0 && (
              <div
                className="mt-4"
                style={{
                  maxHeight: 200,
                  overflowY: 'auto',
                  border: '1px solid var(--c-border)',
                  borderRadius: 'var(--r-md)',
                }}
              >
                <table className="tbl">
                  <thead>
                    <tr>
                      <th style={{ width: 70 }}>Row</th>
                      <th>Problem</th>
                    </tr>
                  </thead>
                  <tbody>
                    {result.errors.map((rowError, index) => (
                      <tr key={index}>
                        <td className="num dim">{rowError.row}</td>
                        <td className="text-xs">
                          {rowError.field ? <strong>{rowError.field}: </strong> : null}
                          {rowError.message}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        )}
      </div>

      <div className="card-foot row" style={{ justifyContent: 'flex-end' }}>
        <Button
          variant="primary"
          disabled={!file}
          loading={run.isPending}
          onClick={() => run.mutate()}
        >
          {run.isPending ? 'Importing…' : 'Start import'}
        </Button>
      </div>
    </Card>
  );
}
