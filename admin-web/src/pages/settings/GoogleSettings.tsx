import { useEffect, useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import * as operationsApi from '../../api/operations';
import { Card, CardHeader } from '../../components/ui/Primitives';
import { Button } from '../../components/ui/Button';
import { Badge } from '../../components/ui/Badge';
import { Checkbox, TextInput } from '../../components/ui/Form';
import { ConfirmDialog } from '../../components/ui/Modal';
import { useToast } from '../../components/ui/Toast';
import { ErrorState, InlineLoader } from '../../components/common/States';
import { formatDateTime } from '../../utils/format';

/**
 * Google Sign-In credentials, powering "Continue with Google" on the mobile
 * app's login screen. Three IDs are needed because Google issues a separate
 * OAuth client per surface:
 *  - Web Client ID/Secret — what the backend verifies id_tokens against.
 *    Like SMTP/AWS/location keys, the secret is stored encrypted and never
 *    sent back to the browser, only a `hasWebClientSecret` flag.
 *  - Android Client ID — registered in Google Cloud Console against the
 *    app's package name + signing SHA-1. Stored here for reference only;
 *    nothing reads it back, Google Play Services matches it automatically.
 *  - iOS Client ID — passed directly to the app's native Google Sign-In SDK
 *    config, required for the flow to work on iOS at all.
 */
export function GoogleSettings() {
  const toast = useToast();
  const queryClient = useQueryClient();

  const query = useQuery({
    queryKey: ['admin', 'google-config'],
    queryFn: operationsApi.getGoogleConfig,
  });

  const [isActive, setIsActive] = useState(false);
  const [webClientId, setWebClientId] = useState('');
  const [webClientSecret, setWebClientSecret] = useState('');
  const [androidClientId, setAndroidClientId] = useState('');
  const [iosClientId, setIosClientId] = useState('');
  const [error, setError] = useState('');
  const [hydrated, setHydrated] = useState(false);
  const [clearing, setClearing] = useState(false);

  useEffect(() => {
    if (hydrated || !query.data) return;
    setIsActive(query.data.isActive);
    setWebClientId(query.data.webClientId);
    setAndroidClientId(query.data.androidClientId);
    setIosClientId(query.data.iosClientId);
    setHydrated(true);
  }, [hydrated, query.data]);

  const save = useMutation({
    mutationFn: () =>
      operationsApi.updateGoogleConfig({
        isActive,
        webClientId: webClientId.trim(),
        androidClientId: androidClientId.trim(),
        iosClientId: iosClientId.trim(),
        // Blank keeps the stored secret untouched.
        ...(webClientSecret.trim() ? { webClientSecret: webClientSecret.trim() } : {}),
      }),
    onSuccess: (result) => {
      toast.success(result.message || 'Google OAuth configuration saved');
      setWebClientSecret('');
      queryClient.invalidateQueries({ queryKey: ['admin', 'google-config'] });
    },
    onError: (error) => toast.error(error instanceof Error ? error.message : 'Could not save'),
  });

  const clear = useMutation({
    mutationFn: () => operationsApi.updateGoogleConfig({ clear: true }),
    onSuccess: (result) => {
      toast.success(result.message || 'Google OAuth configuration cleared');
      setClearing(false);
      setHydrated(false);
      setWebClientSecret('');
      queryClient.invalidateQueries({ queryKey: ['admin', 'google-config'] });
    },
    onError: (error) => toast.error(error instanceof Error ? error.message : 'Could not clear'),
  });

  if (query.isLoading) return <InlineLoader label="Loading Google OAuth configuration…" />;

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
            title="Google OAuth"
            subtitle='Powers "Continue with Google" on the app login screen'
            action={
              query.data?.hasWebClientSecret ? (
                <Badge tone="success" dot>
                  Configured
                </Badge>
              ) : (
                <Badge tone="warning">Not configured</Badge>
              )
            }
          />

          <div className="card-body">
            <TextInput
              label="Web Client ID"
              value={webClientId}
              autoComplete="off"
              placeholder="xxxxxxxxxxxx.apps.googleusercontent.com"
              hint="Used to initialize the app's Google Sign-In SDK and for backend id-token verification."
              onChange={(event) => setWebClientId(event.target.value)}
            />

            <div className="mt-6">
              <TextInput
                label="Web Client Secret"
                type="password"
                value={webClientSecret}
                error={error}
                autoComplete="off"
                placeholder={query.data?.hasWebClientSecret ? '•••••••• (saved)' : 'Paste the client secret'}
                hint={
                  query.data?.hasWebClientSecret
                    ? 'A secret is saved and encrypted at rest. Leave blank to keep it, or paste a new one to replace it.'
                    : 'No secret saved yet. Google sign-in stays unavailable until one is provided.'
                }
                onChange={(event) => {
                  setWebClientSecret(event.target.value);
                  if (error) setError('');
                }}
              />
            </div>

            <div className="mt-6">
              <TextInput
                label="Android Client ID"
                value={androidClientId}
                autoComplete="off"
                placeholder="xxxxxxxxxxxx.apps.googleusercontent.com"
                hint="Registered against the app's package name + signing SHA-1 in Google Cloud Console. Reference only — not read by the app at runtime."
                onChange={(event) => setAndroidClientId(event.target.value)}
              />
            </div>

            <div className="mt-6">
              <TextInput
                label="iOS Client ID"
                value={iosClientId}
                autoComplete="off"
                placeholder="xxxxxxxxxxxx.apps.googleusercontent.com"
                hint="Registered against the app's iOS bundle ID. Passed to the app's native Google Sign-In config — required for sign-in to work on iOS."
                onChange={(event) => setIosClientId(event.target.value)}
              />
            </div>

            <div className="mt-6">
              <Checkbox
                checked={isActive}
                label={
                  <span>
                    Enable Google sign-in
                    <span className="field-hint" style={{ display: 'block' }}>
                      When off, the app's "Continue with Google" button shows a temporarily-unavailable
                      message instead of launching sign-in.
                    </span>
                  </span>
                }
                onChange={(event) => setIsActive(event.target.checked)}
              />
            </div>

            <p className="field-hint mt-6">
              The client secret is stored encrypted by the backend and is never returned to any
              client, including this console. Client IDs are not secret and are safe to expose to
              the app.
            </p>
          </div>

          <div className="card-foot row gap-2" style={{ justifyContent: 'space-between' }}>
            <Button variant="ghost" onClick={() => setClearing(true)}>
              Clear configuration
            </Button>
            <Button
              variant="primary"
              loading={save.isPending}
              onClick={() => {
                if (isActive && !webClientId.trim()) {
                  setError('A Web Client ID is required to enable Google sign-in');
                  return;
                }
                if (isActive && !webClientSecret.trim() && !query.data?.hasWebClientSecret) {
                  setError('A Web Client Secret is required to enable Google sign-in');
                  return;
                }
                setError('');
                save.mutate();
              }}
            >
              Save configuration
            </Button>
          </div>
        </Card>
      </div>

      <div style={{ minWidth: 0 }}>
        <Card>
          <CardHeader title="Status" />
          <div className="mt-4 text-sm" style={{ display: 'grid', gap: 'var(--s-3)' }}>
            <div className="row-between">
              <span className="muted">Sign-in</span>
              <Badge tone={query.data?.isActive ? 'success' : 'neutral'}>
                {query.data?.isActive ? 'Enabled' : 'Disabled'}
              </Badge>
            </div>
            <div className="row-between">
              <span className="muted">Web client secret</span>
              <Badge tone={query.data?.hasWebClientSecret ? 'success' : 'warning'}>
                {query.data?.hasWebClientSecret ? 'Configured' : 'Missing'}
              </Badge>
            </div>
            <div className="row-between">
              <span className="muted">iOS client ID</span>
              <Badge tone={query.data?.iosClientId ? 'success' : 'warning'}>
                {query.data?.iosClientId ? 'Configured' : 'Missing'}
              </Badge>
            </div>
            <div className="row-between">
              <span className="muted">Android client ID</span>
              <Badge tone={query.data?.androidClientId ? 'success' : 'warning'}>
                {query.data?.androidClientId ? 'Configured' : 'Missing'}
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

      <ConfirmDialog
        open={clearing}
        title="Clear the Google OAuth configuration?"
        destructive
        confirmLabel="Clear configuration"
        busy={clear.isPending}
        message='The stored client IDs and secret are deleted and "Continue with Google" stops working until new credentials are saved.'
        onCancel={() => setClearing(false)}
        onConfirm={() => clear.mutate()}
      />
    </div>
  );
}
