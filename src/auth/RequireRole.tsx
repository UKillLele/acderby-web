import { useEffect, useState } from 'react';
import { Alert, Spinner } from 'react-bootstrap';
import { Outlet } from 'react-router';
import type { AppRole } from '../models/user';
import { CurrentUser, fetchCurrentUser } from './session';

interface RequireRoleProps {
  allowed: AppRole[];
}

// Hides a screen from people whose app role is not in `allowed`. This is for display only.
// The API checks every request again.
export function RequireRole({ allowed }: RequireRoleProps) {
  const [user, setUser] = useState<CurrentUser | null | undefined>(undefined);

  useEffect(() => {
    let active = true;
    fetchCurrentUser().then((result) => {
      if (active) setUser(result);
    });
    return () => {
      active = false;
    };
  }, []);

  if (user === undefined) return <Spinner animation="border" role="status" aria-label="Checking access" />;

  if (!user) {
    return (
      <Alert variant="warning">
        Please <a href="/.auth/login/github?post_login_redirect_uri=/admin/people">sign in</a> to continue.
      </Alert>
    );
  }

  if (!user.role || !allowed.includes(user.role)) {
    return <Alert variant="danger">You do not have access to this page.</Alert>;
  }

  return <Outlet />;
}
