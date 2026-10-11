import { FormEvent, useEffect, useState } from 'react';
import { Alert, Badge, Button, Col, Form, Row, Spinner, Table } from 'react-bootstrap';
import { usersApi } from '../../api/client';
import { CurrentUser, fetchCurrentUser } from '../../auth/session';
import type { AppRole, AppUser } from '../../models/user';
import { messageFor } from './PeopleAdminPage';

const PROVIDER = 'github';

const keyOf = (user: AppUser) => `${user.identityProvider}:${user.userId}`;

export function UsersAdminPage() {
  const [users, setUsers] = useState<AppUser[] | null>(null);
  const [me, setMe] = useState<CurrentUser | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [adding, setAdding] = useState(false);
  const [newUserId, setNewUserId] = useState('');
  const [newName, setNewName] = useState('');
  const [newRole, setNewRole] = useState<AppRole>('editor');
  const [editingKey, setEditingKey] = useState<string | null>(null);
  const [draftName, setDraftName] = useState('');

  useEffect(() => {
    let active = true;
    Promise.all([usersApi.list(), fetchCurrentUser()])
      .then(([list, current]) => {
        if (!active) return;
        setUsers(list);
        setMe(current);
      })
      .catch((err: unknown) => {
        if (active) setError(messageFor(err));
      });
    return () => {
      active = false;
    };
  }, []);

  const isSelf = (user: AppUser) => me?.identityProvider === user.identityProvider && me.userId === user.userId;

  function replace(updated: AppUser) {
    setUsers((current) =>
      current?.map((u) => (u.identityProvider === updated.identityProvider && u.userId === updated.userId ? updated : u)) ??
      null,
    );
  }

  async function addUser(event: FormEvent) {
    event.preventDefault();
    setError(null);
    setAdding(true);
    try {
      const created = await usersApi.create({
        identityProvider: PROVIDER,
        userId: newUserId.trim(),
        role: newRole,
        displayName: newName.trim(),
      });
      setUsers((current) => [...(current ?? []), created].sort((a, b) => a.userId.localeCompare(b.userId)));
      setNewUserId('');
      setNewName('');
      setNewRole('editor');
    } catch (err) {
      setError(messageFor(err));
    } finally {
      setAdding(false);
    }
  }

  async function changeRole(user: AppUser, role: AppRole) {
    setError(null);
    try {
      replace(await usersApi.update(user.identityProvider, user.userId, { role, displayName: user.displayName }));
    } catch (err) {
      setError(messageFor(err));
    }
  }

  function startEditing(user: AppUser) {
    setError(null);
    setEditingKey(keyOf(user));
    setDraftName(user.displayName);
  }

  async function saveName(user: AppUser) {
    setError(null);
    try {
      const updated = await usersApi.update(user.identityProvider, user.userId, {
        role: user.role,
        displayName: draftName.trim(),
      });
      replace(updated);
      setEditingKey(null);
    } catch (err) {
      setError(messageFor(err));
    }
  }

  async function removeUser(user: AppUser) {
    if (!window.confirm(`Remove access for ${user.displayName || user.userId}?`)) return;
    setError(null);
    try {
      await usersApi.remove(user.identityProvider, user.userId);
      setUsers((current) => current?.filter((u) => u.userId !== user.userId) ?? null);
    } catch (err) {
      setError(messageFor(err));
    }
  }

  return (
    <section>
      <h1 className="h2 mb-3">Users</h1>
      <p className="text-muted">
        Admins can manage everything. Editors can change people, teams and content. Users sign in with GitHub, so add
        their numeric GitHub user id.
      </p>
      {error && <Alert variant="danger">{error}</Alert>}

      <Form onSubmit={addUser} className="border rounded p-3 mb-4">
        <h2 className="h5">Add user</h2>
        <Row className="g-2 align-items-end">
          <Col md={3}>
            <Form.Group controlId="new-user-id">
              <Form.Label>GitHub user id</Form.Label>
              <Form.Control
                inputMode="numeric"
                value={newUserId}
                onChange={(e) => setNewUserId(e.target.value)}
                required
              />
            </Form.Group>
          </Col>
          <Col md={4}>
            <Form.Group controlId="new-user-name">
              <Form.Label>Display name</Form.Label>
              <Form.Control value={newName} onChange={(e) => setNewName(e.target.value)} />
            </Form.Group>
          </Col>
          <Col md={3}>
            <Form.Group controlId="new-user-role">
              <Form.Label>Role</Form.Label>
              <Form.Select
                aria-label="Role for new user"
                value={newRole}
                onChange={(e) => setNewRole(e.target.value as AppRole)}
              >
                <option value="editor">Editor</option>
                <option value="admin">Admin</option>
              </Form.Select>
            </Form.Group>
          </Col>
          <Col md={2}>
            <Button type="submit" variant="primary" disabled={adding || !newUserId.trim()} className="w-100">
              {adding ? 'Adding…' : 'Add user'}
            </Button>
          </Col>
        </Row>
      </Form>

      {!users && !error && <Spinner animation="border" role="status" aria-label="Loading users" />}

      {users && (
        <Table striped responsive>
          <thead>
            <tr>
              <th scope="col">Name</th>
              <th scope="col">GitHub id</th>
              <th scope="col">Role</th>
              <th scope="col">
                <span className="visually-hidden">Actions</span>
              </th>
            </tr>
          </thead>
          <tbody>
            {users.map((user) => (
              <tr key={keyOf(user)}>
                <td>
                  {editingKey === keyOf(user) ? (
                    <Form
                      className="d-flex gap-2"
                      onSubmit={(event: FormEvent) => {
                        event.preventDefault();
                        void saveName(user);
                      }}
                    >
                      <Form.Control
                        size="sm"
                        aria-label={`Display name for ${user.userId}`}
                        value={draftName}
                        onChange={(e) => setDraftName(e.target.value)}
                        maxLength={100}
                        autoFocus
                      />
                      <Button type="submit" size="sm" variant="primary">
                        Save
                      </Button>
                      <Button size="sm" variant="outline-secondary" onClick={() => setEditingKey(null)}>
                        Cancel
                      </Button>
                    </Form>
                  ) : (
                    <>
                      {user.displayName || <span className="text-muted">No name</span>}
                      {isSelf(user) && (
                        <Badge bg="dark" className="ms-2">
                          you
                        </Badge>
                      )}
                      <Button
                        size="sm"
                        variant="link"
                        className="ms-2 p-0"
                        aria-label={`Edit name for ${user.userId}`}
                        onClick={() => startEditing(user)}
                      >
                        Edit name
                      </Button>
                    </>
                  )}
                </td>
                <td>{user.userId}</td>
                <td>
                  {isSelf(user) ? (
                    <span>{user.role}</span>
                  ) : (
                    <Form.Select
                      size="sm"
                      aria-label={`Role for ${user.userId}`}
                      value={user.role}
                      onChange={(e) => changeRole(user, e.target.value as AppRole)}
                      style={{ maxWidth: '10rem' }}
                    >
                      <option value="editor">Editor</option>
                      <option value="admin">Admin</option>
                    </Form.Select>
                  )}
                </td>
                <td className="text-end">
                  <Button
                    size="sm"
                    variant="outline-danger"
                    disabled={isSelf(user)}
                    onClick={() => removeUser(user)}
                  >
                    Remove
                  </Button>
                </td>
              </tr>
            ))}
          </tbody>
        </Table>
      )}
    </section>
  );
}
