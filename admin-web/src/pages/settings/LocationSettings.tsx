import { useEffect, useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import * as operationsApi from '../../api/operations';
import { Card, CardHeader } from '../../components/ui/Primitives';
import { Button } from '../../components/ui/Button';
import { Badge } from '../../components/ui/Badge';
import { Checkbox, TextInput } from '../../components/ui/Form';
import { ConfirmDialog, Modal } from '../../components/ui/Modal';
import { useToast } from '../../components/ui/Toast';
import { ErrorState, InlineLoader } from '../../components/common/States';
import { formatDateTime } from '../../utils/format';

/**
 * Geocoding / location service credentials. Like SMTP, the backend stores the
 * API key encrypted and returns only a `hasApiKey` flag — the key itself is
 * never sent to the browser and is never displayed.
 */
export function LocationSettings() {
  const toast = useToast();
  const queryClient = useQueryClient();

  const query = useQuery({
    queryKey: ['admin', 'location-config'],
    queryFn: operationsApi.getLocationConfig,
  });

  const [isActive, setIsActive] = useState(false);
  const [apiKey, setApiKey] = useState('');
  const [error, setError] = useState('');
  const [hydrated, setHydrated] = useState(false);
  const [testing, setTesting] = useState(false);
  const [clearing, setClearing] = useState(false);

  useEffect(() => {
    if (hydrated || !query.data) return;
    setIsActive(query.data.isActive);
    setHydrated(true);
  }, [hydrated, query.data]);

  const save = useMutation({
    mutationFn: () =>
      operationsApi.updateLocationConfig({
        isActive,
        // Blank keeps the stored key untouched.
        ...(apiKey.trim() ? { apiKey: apiKey.trim() } : {}),
      }),
    onSuccess: (result) => {
      toast.success(result.message || 'Location configuration saved');
      setApiKey('');
      queryClient.invalidateQueries({ queryKey: ['admin', 'location-config'] });
    },
    onError: (error) => toast.error(error instanceof Error ? error.message : 'Could not save'),
  });

  const clear = useMutation({
    mutationFn: () => operationsApi.updateLocationConfig({ clear: true }),
    onSuccess: (result) => {
      toast.success(result.message || 'Location configuration cleared');
      setClearing(false);
      setHydrated(false);
      queryClient.invalidateQueries({ queryKey: ['admin', 'location-config'] });
    },
    onError: (error) => toast.error(error instanceof Error ? error.message : 'Could not clear'),
  });

  if (query.isLoading) return <InlineLoader label="Loading location configuration…" />;

  if (query.isError) {
    return (
      <Card>
        <ErrorState error={query.error} onRetry={() => query.refetch()} />
      </Card>
    );
  }

  return (
    <div className="grid grid-3">
      <div style={{ gridColumn: 'span 2', minWidth: 0 }}>
        <Card padded={false}>
          <CardHeader
            title="Location services"
            subtitle="Powers address geocoding and distance-based tutor matching"
            action={
              query.data?.hasApiKey ? (
                <Badge tone="success" dot>
                  Key saved
                </Badge>
              ) : (
                <Badge tone="warning">No key</Badge>
              )
            }
          />

          <div className="card-body">
            <TextInput
              label="API key"
              type="password"
              value={apiKey}
              error={error}
              autoComplete="off"
              placeholder={query.data?.hasApiKey ? '•••••••• (saved)' : 'Paste the API key'}
              hint={
                query.data?.hasApiKey
                  ? 'A key is saved and encrypted at rest. Leave blank to keep it, or paste a new one to replace it.'
                  : 'No key saved yet. Geocoding stays unavailable until one is provided.'
              }
              onChange={(event) => {
                setApiKey(event.target.value);
                if (error) setError('');
              }}
            />

            <div className="mt-6">
              <Checkbox
                checked={isActive}
                label={
                  <span>
                    Enable location services
                    <span className="field-hint" style={{ display: 'block' }}>
                      When off, address geocoding and distance-based matching are disabled platform
                      wide.
                    </span>
                  </span>
                }
                onChange={(event) => setIsActive(event.target.checked)}
              />
            </div>

            <p className="field-hint mt-6">
              The key is stored encrypted by the backend and is never returned to any client,
              including this console.
            </p>
          </div>

          <div className="card-foot row gap-2" style={{ justifyContent: 'space-between' }}>
            <Button variant="ghost" onClick={() => setClearing(true)}>
              Clear configuration
            </Button>
            <div className="row gap-2">
              <Button variant="secondary" onClick={() => setTesting(true)}>
                Test key
              </Button>
              <Button
                variant="primary"
                loading={save.isPending}
                onClick={() => {
                  if (isActive && !apiKey.trim() && !query.data?.hasApiKey) {
                    setError('An API key is required to enable location services');
                    return;
                  }
                  setError('');
                  save.mutate();
                }}
              >
                Save configuration
              </Button>
            </div>
          </div>
        </Card>
      </div>

      <div style={{ minWidth: 0 }}>
        <Card>
          <CardHeader title="Status" />
          <div className="mt-4 text-sm" style={{ display: 'grid', gap: 'var(--s-3)' }}>
            <div className="row-between">
              <span className="muted">Service</span>
              <Badge tone={query.data?.isActive ? 'success' : 'neutral'}>
                {query.data?.isActive ? 'Enabled' : 'Disabled'}
              </Badge>
            </div>
            <div className="row-between">
              <span className="muted">API key</span>
              <Badge tone={query.data?.hasApiKey ? 'success' : 'warning'}>
                {query.data?.hasApiKey ? 'Configured' : 'Missing'}
              </Badge>
            </div>
            {query.data?.updatedAt && (
              <div className="row-between">
                <span className="muted">Updated</span>
                <span>{formatDateTime(query.data.updatedAt)}</span>
              </div>
            )}
          </div>
        </Card>
      </div>

      {testing && <TestKeyModal apiKey={apiKey} onClose={() => setTesting(false)} />}

      <ConfirmDialog
        open={clearing}
        title="Clear the location configuration?"
        destructive
        confirmLabel="Clear configuration"
        busy={clear.isPending}
        message="The stored API key is deleted and geocoding stops working until a new key is saved."
        onCancel={() => setClearing(false)}
        onConfirm={() => clear.mutate()}
      />
    </div>
  );
}

function TestKeyModal({ apiKey, onClose }: { apiKey: string; onClose: () => void }) {
  const toast = useToast();
  const [result, setResult] = useState<unknown>(null);

  const run = useMutation({
    mutationFn: () => operationsApi.testLocationConfig(apiKey.trim() || undefined),
    onSuccess: (response) => {
      setResult(response.data ?? response.message);
      toast.success(response.message || 'Key verified');
    },
    onError: (error) => toast.error(error instanceof Error ? error.message : 'Test failed'),
  });

  return (
    <Modal
      open
      size="sm"
      title="Test the location API key"
      busy={run.isPending}
      onClose={onClose}
      footer={
        <>
          <Button variant="secondary" onClick={onClose} disabled={run.isPending}>
            Close
          </Button>
          <Button variant="primary" loading={run.isPending} onClick={() => run.mutate()}>
            Run test
          </Button>
        </>
      }
    >
      <p className="text-sm muted" style={{ lineHeight: 1.55 }}>
        {apiKey.trim()
          ? 'The key typed in the form is tested, so you can verify it before saving it.'
          : 'The key already saved on the server is tested.'}{' '}
        The backend geocodes its own sample address and reports what came back.
      </p>

      {result !== null && (
        <pre
          className="mono mt-4"
          style={{
            padding: 'var(--s-3)',
            background: 'var(--c-bg-2)',
            borderRadius: 'var(--r-md)',
            fontSize: 11.5,
            overflowX: 'auto',
            margin: 0,
          }}
        >
          {typeof result === 'string' ? result : JSON.stringify(result, null, 2)}
        </pre>
      )}
    </Modal>
  );
}
