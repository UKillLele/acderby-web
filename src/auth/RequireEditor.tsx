import { useEffect, useState } from 'react';
import { Alert, Spinner } from 'react-bootstrap';
import { Outlet } from 'react-router';
import { CurrentUser, fetchCurrentUser } from './session';

// Hides admin screens from people who are not admins or editors. This is for display only.
export function RequireEditor() {
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

  if (!user.role) {
    return <Alert variant="danger">You do not have access to this page.</Alert>;
  }

  return <Outlet />;
}
