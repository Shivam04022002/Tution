import { useEffect, useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import * as operationsApi from '../../api/operations';
import { Card, CardHeader } from '../../components/ui/Primitives';
import { Button } from '../../components/ui/Button';
import { Badge } from '../../components/ui/Badge';
import { Checkbox, Select, TextInput } from '../../components/ui/Form';
import { ConfirmDialog, Modal } from '../../components/ui/Modal';
import { useToast } from '../../components/ui/Toast';
import { ErrorState, InlineLoader } from '../../components/common/States';
import { formatDateTime } from '../../utils/format';

/**
 * SMTP settings. The backend never returns the stored password — only a
 * `hasPassword` flag — so the field is left blank and an empty submit keeps the
 * saved secret. No credential is ever rendered into the page.
 */
export function EmailSettings() {
  const toast = useToast();
  const queryClient = useQueryClient();

  const query = useQuery({
    queryKey: ['admin', 'smtp-config'],
    queryFn: operationsApi.getSmtpConfig,
  });

  const [form, setForm] = useState({
    isActive: false,
    fromEmail: '',
    fromName: '',
    replyToEmail: '',
    host: '',
    port: '587',
    encryption: 'STARTTLS',
    authRequired: true,
    username: '',
    password: '',
  });
  const [services, setServices] = useState<Array<{ key: string; label: string; enabled: boolean }>>(
    []
  );
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [hydrated, setHydrated] = useState(false);
  const [testing, setTesting] = useState(false);
  const [clearing, setClearing] = useState(false);

  useEffect(() => {
    if (hydrated || !query.data) return;
    const config = query.data;
    setForm({
      isActive: config.isActive,
      fromEmail: config.fromEmail ?? '',
      fromName: config.fromName ?? '',
      replyToEmail: config.replyToEmail ?? '',
      host: config.host ?? '',
      port: String(config.port ?? 587),
      encryption: config.encryption ?? 'STARTTLS',
      authRequired: config.authRequired ?? true,
      username: config.username ?? '',
      password: '',
    });
    setServices(config.services ?? []);
    setHydrated(true);
  }, [hydrated, query.data]);

  const update = (key: keyof typeof form, value: string | boolean) =>
    setForm((current) => ({ ...current, [key]: value }));

  const save = useMutation({
    mutationFn: () =>
      operationsApi.updateSmtpConfig({
        isActive: form.isActive,
        fromEmail: form.fromEmail.trim(),
        fromName: form.fromName.trim(),
        replyToEmail: form.replyToEmail.trim(),
        host: form.host.trim(),
        port: Number(form.port),
        encryption: form.encryption,
        authRequired: form.authRequired,
        username: form.username.trim(),
        // Omitted when blank so the saved password is left untouched.
        ...(form.password ? { password: form.password } : {}),
        services,
      }),
    onSuccess: (result) => {
      toast.success(result.message || 'SMTP configuration saved');
      setForm((current) => ({ ...current, password: '' }));
      queryClient.invalidateQueries({ queryKey: ['admin', 'smtp-config'] });
    },
    onError: (error) => toast.error(error instanceof Error ? error.message : 'Could not save'),
  });

  const clear = useMutation({
    mutationFn: () => operationsApi.updateSmtpConfig({ clear: true }),
    onSuccess: (result) => {
      toast.success(result.message || 'SMTP configuration cleared');
      setClearing(false);
      setHydrated(false);
      queryClient.invalidateQueries({ queryKey: ['admin', 'smtp-config'] });
    },
    onError: (error) => toast.error(error instanceof Error ? error.message : 'Could not clear'),
  });

  function submit() {
    const nextErrors: Record<string, string> = {};
    if (!form.host.trim()) nextErrors.host = 'SMTP host is required';
    if (!form.fromEmail.trim()) nextErrors.fromEmail = 'A from address is required';
    else if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(form.fromEmail.trim()))
      nextErrors.fromEmail = 'Enter a valid email address';
    if (!form.fromName.trim()) nextErrors.fromName = 'A from name is required';

    const port = Number(form.port);
    if (!Number.isInteger(port) || port <= 0 || port > 65535)
      nextErrors.port = 'Enter a valid port number';

    if (form.authRequired && !form.username.trim())
      nextErrors.username = 'A username is required when authentication is enabled';

    if (form.authRequired && !form.password && !query.data?.hasPassword)
      nextErrors.password = 'A password is required — none is saved yet';

    setErrors(nextErrors);
    if (Object.keys(nextErrors).length > 0) return;
    save.mutate();
  }

  if (query.isLoading) return <InlineLoader label="Loading SMTP configuration…" />;

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
            title="SMTP server"
            subtitle="Used for transactional email sent by the platform"
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
                label="Host"
                required
                value={form.host}
                error={errors.host}
                placeholder="smtp.example.com"
                onChange={(event) => update('host', event.target.value)}
              />
              <TextInput
                label="Port"
                type="number"
                required
                value={form.port}
                error={errors.port}
                onChange={(event) => update('port', event.target.value)}
              />

              <Select
                label="Encryption"
                value={form.encryption}
                options={[
                  { value: 'STARTTLS', label: 'STARTTLS' },
                  { value: 'SSL/TLS', label: 'SSL/TLS' },
                  { value: 'none', label: 'None' },
                ]}
                onChange={(event) => update('encryption', event.target.value)}
              />

              <div className="field" style={{ justifyContent: 'flex-end' }}>
                <Checkbox
                  checked={form.authRequired}
                  label="Server requires authentication"
                  onChange={(event) => update('authRequired', event.target.checked)}
                />
              </div>

              <TextInput
                label="Username"
                value={form.username}
                error={errors.username}
                disabled={!form.authRequired}
                autoComplete="off"
                onChange={(event) => update('username', event.target.value)}
              />
              <TextInput
                label="Password"
                type="password"
                value={form.password}
                error={errors.password}
                disabled={!form.authRequired}
                autoComplete="new-password"
                placeholder={query.data?.hasPassword ? '•••••••• (saved)' : ''}
                hint={
                  query.data?.hasPassword
                    ? 'A password is saved. Leave blank to keep it, or type a new one to replace it.'
                    : 'No password saved yet.'
                }
                onChange={(event) => update('password', event.target.value)}
              />

              <TextInput
                label="From email"
                type="email"
                required
                value={form.fromEmail}
                error={errors.fromEmail}
                onChange={(event) => update('fromEmail', event.target.value)}
              />
              <TextInput
                label="From name"
                required
                value={form.fromName}
                error={errors.fromName}
                onChange={(event) => update('fromName', event.target.value)}
              />
              <TextInput
                className="span-2"
                label="Reply-to email"
                type="email"
                value={form.replyToEmail}
                error={errors.replyToEmail}
                hint="Optional. Leave blank to reply to the from address."
                onChange={(event) => update('replyToEmail', event.target.value)}
              />

              <div className="span-2">
                <Checkbox
                  checked={form.isActive}
                  label={
                    <span>
                      Enable outgoing email
                      <span className="field-hint" style={{ display: 'block' }}>
                        When off, the platform stops sending transactional email entirely.
                      </span>
                    </span>
                  }
                  onChange={(event) => update('isActive', event.target.checked)}
                />
              </div>
            </div>
          </div>

          <div className="card-foot row gap-2" style={{ justifyContent: 'space-between' }}>
            <Button variant="ghost" onClick={() => setClearing(true)}>
              Clear configuration
            </Button>
            <div className="row gap-2">
              <Button variant="secondary" onClick={() => setTesting(true)}>
                Send test email
              </Button>
              <Button variant="primary" loading={save.isPending} onClick={submit}>
                Save configuration
              </Button>
            </div>
          </div>
        </Card>
      </div>

      <div style={{ minWidth: 0 }}>
        <Card padded={false}>
          <CardHeader title="Mail services" subtitle="Which notifications go out by email" />
          <div className="card-body" style={{ display: 'grid', gap: 'var(--s-3)' }}>
            {services.length === 0 && (
              <p className="text-sm muted">No mail services are defined on this configuration.</p>
            )}
            {services.map((service) => (
              <Checkbox
                key={service.key}
                checked={service.enabled}
                label={service.label}
                onChange={(event) =>
                  setServices((current) =>
                    current.map((entry) =>
                      entry.key === service.key
                        ? { ...entry, enabled: event.target.checked }
                        : entry
                    )
                  )
                }
              />
            ))}
          </div>
          {query.data?.updatedAt && (
            <div className="card-foot">
              <span className="text-xs muted">
                Last updated {formatDateTime(query.data.updatedAt)}
              </span>
            </div>
          )}
        </Card>
      </div>

      {testing && (
        <TestEmailModal
          config={{
            host: form.host,
            port: Number(form.port),
            encryption: form.encryption,
            authRequired: form.authRequired,
            username: form.username,
            password: form.password,
            fromEmail: form.fromEmail,
            fromName: form.fromName,
            replyToEmail: form.replyToEmail,
          }}
          onClose={() => setTesting(false)}
        />
      )}

      <ConfirmDialog
        open={clearing}
        title="Clear the SMTP configuration?"
        destructive
        confirmLabel="Clear configuration"
        busy={clear.isPending}
        message="The saved server details and password are deleted and the platform stops sending email until a new configuration is saved."
        onCancel={() => setClearing(false)}
        onConfirm={() => clear.mutate()}
      />
    </div>
  );
}

interface TestConfig {
  host: string;
  port: number;
  encryption: string;
  authRequired: boolean;
  username: string;
  password: string;
  fromEmail: string;
  fromName: string;
  replyToEmail: string;
}

function TestEmailModal({ config, onClose }: { config: TestConfig; onClose: () => void }) {
  const toast = useToast();
  const [to, setTo] = useState('');
  const [error, setError] = useState('');

  // The test endpoint takes the form values so a configuration can be verified
  // before it is saved; it falls back to the stored password when none is typed.
  const run = useMutation({
    mutationFn: () =>
      operationsApi.testSmtpConfig({
        to: to.trim(),
        host: config.host,
        port: config.port,
        encryption: config.encryption,
        authRequired: config.authRequired,
        username: config.username,
        // Blank means "use the password already saved on the server".
        ...(config.password ? { password: config.password } : {}),
        fromEmail: config.fromEmail,
        fromName: config.fromName,
        replyToEmail: config.replyToEmail,
      }),
    onSuccess: (result) => {
      toast.success(result.message || `Test email sent to ${to}`);
      onClose();
    },
    onError: (error) => toast.error(error instanceof Error ? error.message : 'Test failed'),
  });

  return (
    <Modal
      open
      size="sm"
      title="Send a test email"
      busy={run.isPending}
      onClose={onClose}
      footer={
        <>
          <Button variant="secondary" onClick={onClose} disabled={run.isPending}>
            Cancel
          </Button>
          <Button
            variant="primary"
            loading={run.isPending}
            onClick={() => {
              if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(to.trim())) {
                setError('Enter a valid email address');
                return;
              }
              setError('');
              run.mutate();
            }}
          >
            Send test
          </Button>
        </>
      }
    >
      <p className="text-sm muted" style={{ lineHeight: 1.55 }}>
        A test message is sent through <strong>{config.host || 'the configured host'}</strong> using
        the details currently in the form — you can verify a change before saving it.
      </p>
      <div className="mt-4">
        <TextInput
          label="Send to"
          type="email"
          required
          value={to}
          error={error}
          placeholder="you@example.com"
          onChange={(event) => {
            setTo(event.target.value);
            if (error) setError('');
          }}
        />
      </div>
    </Modal>
  );
}
