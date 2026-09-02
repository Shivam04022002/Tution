import { useEffect, useState, type FormEvent } from 'react';
import { Navigate, useLocation, useNavigate } from 'react-router-dom';
import { useAuth } from '../auth/AuthContext';
import { ApiError } from '../api/client';
import { Button } from '../components/ui/Button';
import { TextInput } from '../components/ui/Form';
import { IconAlert, IconCheck } from '../components/ui/Icons';

export function LoginPage() {
  const { user, token, signIn, sessionEndReason, clearSessionEndReason } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();

  const [emailOrMobile, setEmailOrMobile] = useState('');
  const [password, setPassword] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);
  const [fieldErrors, setFieldErrors] = useState<Record<string, string>>({});

  const expired = sessionEndReason === 'expired';

  useEffect(() => {
    document.title = 'Sign in · Home Tuition Admin';
  }, []);

  if (token && user?.role === 'admin') {
    const from = (location.state as { from?: string } | null)?.from;
    return <Navigate to={from && from !== '/login' ? from : '/dashboard'} replace />;
  }

  async function onSubmit(event: FormEvent) {
    event.preventDefault();
    if (submitting) return;

    setFormError(null);
    setFieldErrors({});

    const nextFieldErrors: Record<string, string> = {};
    if (!emailOrMobile.trim()) nextFieldErrors.emailOrMobile = 'Enter your email or mobile number';
    if (!password) nextFieldErrors.password = 'Enter your password';

    if (Object.keys(nextFieldErrors).length > 0) {
      setFieldErrors(nextFieldErrors);
      return;
    }

    setSubmitting(true);
    clearSessionEndReason();

    try {
      await signIn(emailOrMobile.trim(), password);
      const from = (location.state as { from?: string } | null)?.from;
      navigate(from && from !== '/login' ? from : '/dashboard', { replace: true });
    } catch (error) {
      if (error instanceof ApiError) {
        setFormError(error.message);
        // Keep the identifier, clear the secret — standard for a failed sign-in.
        if (error.status === 401) setPassword('');
        for (const fieldError of error.fieldErrors) {
          nextFieldErrors[fieldError.field] = fieldError.message;
        }
        setFieldErrors(nextFieldErrors);
      } else {
        setFormError('Sign-in failed. Please try again.');
      }
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div className="auth-shell">
      <aside className="auth-aside">
        <div>
          <div className="row gap-3">
            <span className="brand-mark" style={{ width: 34, height: 34, fontSize: 14 }}>
              HT
            </span>
            <div>
              <div className="strong" style={{ fontSize: 14 }}>
                Home Tuition
              </div>
              <div className="text-xs" style={{ color: '#8B7FC0', letterSpacing: '.07em' }}>
                ADMIN CONSOLE
              </div>
            </div>
          </div>

          <h1 style={{ marginTop: 48 }}>
            The whole platform, on one desk.
          </h1>
          <p>
            The same accounts, courses, payments and permissions as the admin app — arranged for a
            large screen.
          </p>

          <div className="auth-points">
            {[
              'Parents, tutors and staff in dense, filterable tables',
              'Course marketplace with lesson and video management',
              'Revenue, subscriptions, credits and refunds',
              'KYC verification queue and support tickets',
            ].map((point) => (
              <div key={point} className="auth-point">
                <span className="auth-point-dot">
                  <IconCheck size={12} />
                </span>
                {point}
              </div>
            ))}
          </div>
        </div>

        <p className="text-xs" style={{ color: '#6D5FA8' }}>
          Authorised administrators only. All actions are recorded in the audit log.
        </p>
      </aside>

      <div className="auth-panel">
        <div className="auth-card">
          <h1 style={{ fontSize: 22 }}>Sign in</h1>
          <p className="muted text-sm" style={{ marginTop: 6 }}>
            Use your platform administrator credentials.
          </p>

          {expired && !formError && (
            <div className="auth-alert mt-4" role="status">
              <IconAlert size={16} style={{ flex: 'none', marginTop: 1 }} />
              <span>Your session expired. Please sign in again to continue.</span>
            </div>
          )}

          {formError && (
            <div className="auth-alert mt-4" role="alert">
              <IconAlert size={16} style={{ flex: 'none', marginTop: 1 }} />
              <span>{formError}</span>
            </div>
          )}

          <form onSubmit={onSubmit} noValidate style={{ marginTop: 20, display: 'grid', gap: 16 }}>
            <TextInput
              label="Email or mobile number"
              type="text"
              autoComplete="username"
              autoFocus
              value={emailOrMobile}
              error={fieldErrors.emailOrMobile}
              onChange={(event) => setEmailOrMobile(event.target.value)}
              disabled={submitting}
            />

            <TextInput
              label="Password"
              type="password"
              autoComplete="current-password"
              value={password}
              error={fieldErrors.password}
              onChange={(event) => setPassword(event.target.value)}
              disabled={submitting}
            />

            <Button type="submit" variant="primary" block loading={submitting}>
              {submitting ? 'Signing in…' : 'Sign in'}
            </Button>
          </form>

          <p className="dim text-xs mt-6" style={{ lineHeight: 1.6 }}>
            Password resets are handled by a super admin from the Admins & staff section. There is no
            self-service reset for administrator accounts.
          </p>
        </div>
      </div>
    </div>
  );
}
