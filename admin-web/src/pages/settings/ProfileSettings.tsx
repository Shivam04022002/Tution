import { useState } from 'react';
import { useMutation } from '@tanstack/react-query';
import * as authApi from '../../api/auth';
import { ApiError } from '../../api/client';
import { useAuth } from '../../auth/AuthContext';
import { PERMISSIONS } from '../../auth/permissions';
import { Avatar, Card, CardHeader, DefinitionList } from '../../components/ui/Primitives';
import { Button } from '../../components/ui/Button';
import { Badge } from '../../components/ui/Badge';
import { TextInput } from '../../components/ui/Form';
import { useToast } from '../../components/ui/Toast';
import { API_URL, ENVIRONMENT } from '../../config/env';
import { fullName } from '../../utils/format';

export function ProfileSettings() {
  const { user, can, signOut } = useAuth();
  const toast = useToast();

  const [firstName, setFirstName] = useState(user?.profile?.firstName ?? '');
  const [lastName, setLastName] = useState(user?.profile?.lastName ?? '');
  const [errors, setErrors] = useState<Record<string, string>>({});

  const save = useMutation({
    mutationFn: () =>
      authApi.updateProfile({
        'profile.firstName': firstName.trim(),
        'profile.lastName': lastName.trim(),
      }),
    onSuccess: () => {
      // The stored session keeps the old name until the next `/auth/me`, so the
      // page is reloaded to pick the update up everywhere at once.
      toast.success('Profile updated. Reloading…');
      window.setTimeout(() => window.location.reload(), 800);
    },
    onError: (error) => {
      if (error instanceof ApiError) {
        setErrors(
          Object.fromEntries(error.fieldErrors.map((fieldError) => [fieldError.field, fieldError.message]))
        );
        toast.error(error.message);
      } else {
        toast.error('Could not update your profile.');
      }
    },
  });

  function submit() {
    const nextErrors: Record<string, string> = {};
    // Backend validation: 2–50 characters when present.
    if (firstName.trim().length < 2 || firstName.trim().length > 50)
      nextErrors.firstName = 'First name must be between 2 and 50 characters';
    if (lastName.trim() && (lastName.trim().length < 2 || lastName.trim().length > 50))
      nextErrors.lastName = 'Last name must be between 2 and 50 characters';

    setErrors(nextErrors);
    if (Object.keys(nextErrors).length > 0) return;
    save.mutate();
  }

  const grantedPermissions = Object.values(PERMISSIONS).filter((permission) => can(permission));

  return (
    <div className="grid grid-3">
      <div style={{ gridColumn: 'span 2', minWidth: 0 }}>
        <Card padded={false}>
          <CardHeader title="Your profile" subtitle="Name shown beside your actions in the audit log" />
          <div className="card-body">
            <div className="row gap-4 mb-4">
              <Avatar name={fullName(user?.profile)} src={user?.profile?.profileImage} large />
              <div>
                <p className="strong">{fullName(user?.profile)}</p>
                <p className="muted text-sm">{user?.email}</p>
              </div>
            </div>

            <div className="form-grid">
              <TextInput
                label="First name"
                required
                value={firstName}
                error={errors.firstName}
                onChange={(event) => setFirstName(event.target.value)}
              />
              <TextInput
                label="Last name"
                value={lastName}
                error={errors.lastName}
                onChange={(event) => setLastName(event.target.value)}
              />
            </div>

            <p className="field-hint mt-4">
              Email, phone number and role are identity fields on your account and cannot be changed
              from here. Ask a super admin if one of them is wrong.
            </p>
          </div>

          <div className="card-foot row gap-2" style={{ justifyContent: 'flex-end' }}>
            <Button variant="primary" loading={save.isPending} onClick={submit}>
              Save profile
            </Button>
          </div>
        </Card>

        <Card className="mt-6">
          <CardHeader title="Security" />
          <p className="text-sm muted mt-4" style={{ lineHeight: 1.6 }}>
            Administrator sign-in uses the platform's shared credential login. There is no
            self-service password change endpoint for admin accounts — a super admin resets staff
            passwords from <strong>Admins &amp; staff</strong>, and admin passwords are managed
            through the backend's seeding scripts.
          </p>
          <p className="text-sm muted mt-4" style={{ lineHeight: 1.6 }}>
            Your session token is held in this browser only and is cleared when you sign out. Signing
            out here does not affect your mobile app session.
          </p>
          <div className="row gap-2 mt-6">
            <Button variant="secondary" onClick={signOut}>
              Sign out of this browser
            </Button>
          </div>
        </Card>
      </div>

      <div style={{ minWidth: 0 }}>
        <Card>
          <CardHeader title="Access" />
          <div style={{ paddingTop: 'var(--s-4)' }}>
            <DefinitionList
              items={[
                ['Role', user?.role ?? '—'],
                ['Staff role', user?.staffRole || '—'],
                ['Account ID', <span className="mono text-xs">{user?.id}</span>],
              ]}
            />

            <p className="label mt-6">Console sections</p>
            <div className="row gap-2 wrap mt-2">
              {grantedPermissions.map((permission) => (
                <Badge key={permission} tone="brand">
                  {permission.split('.')[0]}
                </Badge>
              ))}
            </div>
            <p className="field-hint mt-4">
              These control what the menu shows. The backend enforces the real check on every
              request, so a hidden section is still refused server-side.
            </p>
          </div>
        </Card>

        <Card className="mt-6">
          <CardHeader title="Connection" />
          <div style={{ paddingTop: 'var(--s-4)' }}>
            <DefinitionList
              items={[
                ['API', <span className="mono text-xs">{API_URL}</span>],
                ['Environment', ENVIRONMENT],
              ]}
            />
            <p className="field-hint mt-4">
              This console talks to the same backend as the mobile app. No separate database or admin
              service is involved.
            </p>
          </div>
        </Card>
      </div>
    </div>
  );
}
