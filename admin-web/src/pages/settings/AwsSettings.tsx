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
 * AWS S3 credentials that power course lesson video storage. Like SMTP and
 * location services, the backend stores the secret access key encrypted and
 * returns only a `hasSecretKey` flag — the value itself is never sent to the
 * browser. A saved change applies immediately, no backend restart needed.
 */
export function AwsSettings() {
  const toast = useToast();
  const queryClient = useQueryClient();

  const query = useQuery({
    queryKey: ['admin', 'aws-config'],
    queryFn: operationsApi.getAwsConfig,
  });

  const [form, setForm] = useState({
    isActive: false,
    region: 'ap-south-1',
    bucket: '',
    accessKeyId: '',
    secretAccessKey: '',
  });
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [hydrated, setHydrated] = useState(false);
  const [testing, setTesting] = useState(false);
  const [clearing, setClearing] = useState(false);

  useEffect(() => {
    if (hydrated || !query.data) return;
    const config = query.data;
    setForm({
      isActive: config.isActive,
      region: config.region || 'ap-south-1',
      bucket: config.bucket ?? '',
      accessKeyId: config.accessKeyId ?? '',
      secretAccessKey: '',
    });
    setHydrated(true);
  }, [hydrated, query.data]);

  const update = (key: keyof typeof form, value: string | boolean) =>
    setForm((current) => ({ ...current, [key]: value }));

  const save = useMutation({
    mutationFn: () =>
      operationsApi.updateAwsConfig({
        isActive: form.isActive,
        region: form.region.trim(),
        bucket: form.bucket.trim(),
        accessKeyId: form.accessKeyId.trim(),
        // Omitted when blank so the saved secret is left untouched.
        ...(form.secretAccessKey ? { secretAccessKey: form.secretAccessKey } : {}),
      }),
    onSuccess: (result) => {
      toast.success(result.message || 'AWS S3 configuration saved');
      setForm((current) => ({ ...current, secretAccessKey: '' }));
      queryClient.invalidateQueries({ queryKey: ['admin', 'aws-config'] });
    },
    onError: (error) => toast.error(error instanceof Error ? error.message : 'Could not save'),
  });

  const clear = useMutation({
    mutationFn: () => operationsApi.updateAwsConfig({ clear: true }),
    onSuccess: (result) => {
      toast.success(result.message || 'AWS S3 configuration cleared');
      setClearing(false);
      setHydrated(false);
      queryClient.invalidateQueries({ queryKey: ['admin', 'aws-config'] });
    },
    onError: (error) => toast.error(error instanceof Error ? error.message : 'Could not clear'),
  });

  function submit() {
    const nextErrors: Record<string, string> = {};
    if (!form.bucket.trim()) nextErrors.bucket = 'A bucket name is required';
    if (!form.accessKeyId.trim()) nextErrors.accessKeyId = 'An access key ID is required';
    if (!form.secretAccessKey && !query.data?.hasSecretKey)
      nextErrors.secretAccessKey = 'A secret access key is required — none is saved yet';

    setErrors(nextErrors);
    if (Object.keys(nextErrors).length > 0) return;
    save.mutate();
  }

  if (query.isLoading) return <InlineLoader label="Loading AWS S3 configuration…" />;

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
            title="AWS S3 storage"
            subtitle="Used to store and stream course lesson videos"
            action={
              form.isActive ? (
                <Badge tone="success" dot>
                  Active
                </Badge>
              ) : (
                <Badge tone="neutral">Inactive</Badge>
              )
            }
          />

          <div className="card-body">
            <div className="form-grid">
              <TextInput
                label="Bucket"
                required
                value={form.bucket}
                error={errors.bucket}
                placeholder="tuition-app-media"
                onChange={(event) => update('bucket', event.target.value)}
              />
              <TextInput
                label="Region"
                value={form.region}
                placeholder="ap-south-1"
                onChange={(event) => update('region', event.target.value)}
              />

              <TextInput
                label="Access key ID"
                required
                value={form.accessKeyId}
                error={errors.accessKeyId}
                autoComplete="off"
                onChange={(event) => update('accessKeyId', event.target.value)}
              />
              <TextInput
                label="Secret access key"
                type="password"
                value={form.secretAccessKey}
                error={errors.secretAccessKey}
                autoComplete="new-password"
                placeholder={query.data?.hasSecretKey ? '•••••••• (saved)' : ''}
                hint={
                  query.data?.hasSecretKey
                    ? 'A key is saved and encrypted at rest. Leave blank to keep it, or paste a new one to replace it.'
                    : 'No secret key saved yet.'
                }
                onChange={(event) => update('secretAccessKey', event.target.value)}
              />

              <div className="span-2">
                <Checkbox
                  checked={form.isActive}
                  label={
                    <span>
                      Enable AWS S3 storage
                      <span className="field-hint" style={{ display: 'block' }}>
                        When off, course video uploads fail with "Video storage is not configured"
                        until this is enabled with valid credentials.
                      </span>
                    </span>
                  }
                  onChange={(event) => update('isActive', event.target.checked)}
                />
              </div>
            </div>

            <p className="field-hint mt-6">
              The secret key is stored encrypted by the backend and is never returned to any
              client, including this console. Saving takes effect immediately — no restart needed.
            </p>
          </div>

          <div className="card-foot row gap-2" style={{ justifyContent: 'space-between' }}>
            <Button variant="ghost" onClick={() => setClearing(true)}>
              Clear configuration
            </Button>
            <div className="row gap-2">
              <Button variant="secondary" onClick={() => setTesting(true)}>
                Test connection
              </Button>
              <Button variant="primary" loading={save.isPending} onClick={submit}>
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
              <span className="muted">Storage</span>
              <Badge tone={query.data?.isActive ? 'success' : 'neutral'}>
                {query.data?.isActive ? 'Enabled' : 'Disabled'}
              </Badge>
            </div>
            <div className="row-between">
              <span className="muted">Secret key</span>
              <Badge tone={query.data?.hasSecretKey ? 'success' : 'warning'}>
                {query.data?.hasSecretKey ? 'Configured' : 'Missing'}
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

      {testing && (
        <TestConnectionModal
          config={{
            region: form.region,
            bucket: form.bucket,
            accessKeyId: form.accessKeyId,
            secretAccessKey: form.secretAccessKey,
          }}
          onClose={() => setTesting(false)}
        />
      )}

      <ConfirmDialog
        open={clearing}
        title="Clear the AWS S3 configuration?"
        destructive
        confirmLabel="Clear configuration"
        busy={clear.isPending}
        message="The saved credentials are deleted and course video uploads stop working until a new configuration is saved (or matching AWS_* environment variables are set)."
        onCancel={() => setClearing(false)}
        onConfirm={() => clear.mutate()}
      />
    </div>
  );
}

interface TestConfig {
  region: string;
  bucket: string;
  accessKeyId: string;
  secretAccessKey: string;
}

function TestConnectionModal({ config, onClose }: { config: TestConfig; onClose: () => void }) {
  const toast = useToast();

  // The test endpoint takes the form values so a configuration can be
  // verified before it is saved; it falls back to the stored secret key when
  // none is typed.
  const run = useMutation({
    mutationFn: () =>
      operationsApi.testAwsConfig({
        region: config.region,
        bucket: config.bucket,
        accessKeyId: config.accessKeyId,
        // Blank means "use the secret key already saved on the server".
        ...(config.secretAccessKey ? { secretAccessKey: config.secretAccessKey } : {}),
      }),
    onSuccess: (result) => {
      toast.success(result.message || 'Connected successfully');
      onClose();
    },
    onError: (error) => toast.error(error instanceof Error ? error.message : 'Test failed'),
  });

  return (
    <Modal
      open
      size="sm"
      title="Test the S3 connection"
      busy={run.isPending}
      onClose={onClose}
      footer={
        <>
          <Button variant="secondary" onClick={onClose} disabled={run.isPending}>
            Cancel
          </Button>
          <Button variant="primary" loading={run.isPending} onClick={() => run.mutate()}>
            Run test
          </Button>
        </>
      }
    >
      <p className="text-sm muted" style={{ lineHeight: 1.55 }}>
        The backend attempts to reach bucket <strong>{config.bucket || '(not set)'}</strong> with
        these credentials and reports whether it succeeded — nothing is uploaded or changed.
      </p>
    </Modal>
  );
}
