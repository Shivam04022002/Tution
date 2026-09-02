import { Link } from 'react-router-dom';
import { Card } from '../components/ui/Primitives';
import { EmptyState } from '../components/common/States';

export function NotFoundPage() {
  return (
    <div className="page">
      <Card>
        <EmptyState
          title="Page not found"
          message="That route does not exist in the admin console. It may have been renamed, or the link may be out of date."
          action={
            <Link to="/dashboard" className="btn btn-primary">
              Back to dashboard
            </Link>
          }
        />
      </Card>
    </div>
  );
}
