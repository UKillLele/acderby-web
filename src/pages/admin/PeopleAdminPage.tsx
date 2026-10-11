import { useEffect, useState } from 'react';
import { Alert, Badge, Button, Spinner, Table } from 'react-bootstrap';
import { Link } from 'react-router';
import { ApiError, peopleApi, teamsApi } from '../../api/client';
import type { Person, TeamSummary } from '../../models/person';

export function PeopleAdminPage() {
  const [people, setPeople] = useState<Person[] | null>(null);
  const [teams, setTeams] = useState<TeamSummary[]>([]);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let active = true;
    Promise.all([peopleApi.list(), teamsApi.list()])
      .then(([list, teamList]) => {
        if (!active) return;
        setPeople(list);
        setTeams(teamList);
      })
      .catch((err: unknown) => {
        if (active) setError(messageFor(err));
      });
    return () => {
      active = false;
    };
  }, []);

  async function remove(person: Person) {
    if (!window.confirm(`Delete ${person.name}? This cannot be undone.`)) return;
    try {
      await peopleApi.remove(person.id);
      setPeople((current) => current?.filter((p) => p.id !== person.id) ?? null);
    } catch (err) {
      setError(messageFor(err));
    }
  }

  return (
    <section>
      <div className="d-flex justify-content-between align-items-center mb-3">
        <h1 className="h2 mb-0">People</h1>
        <Link to="/admin/people/new" className="btn btn-primary">
          Add person
        </Link>
      </div>

      {error && <Alert variant="danger">{error}</Alert>}
      {!people && !error && <Spinner animation="border" role="status" aria-label="Loading people" />}

      {people && people.length === 0 && <p>No people yet.</p>}

      {people && people.length > 0 && (
        <Table striped hover responsive>
          <thead>
            <tr>
              <th scope="col">Name</th>
              <th scope="col">Number</th>
              <th scope="col">Teams</th>
              <th scope="col">
                <span className="visually-hidden">Actions</span>
              </th>
            </tr>
          </thead>
          <tbody>
            {people.map((person) => (
              <tr key={person.id}>
                <td>{person.name}</td>
                <td>{person.number}</td>
                <td>
                  {person.teams.map((position) => (
                    <Badge key={position.id} bg="secondary" className="me-1">
                      {teamName(teams, position.id)}
                    </Badge>
                  ))}
                </td>
                <td className="text-end text-nowrap">
                  <Link to={`/admin/people/${person.id}`} className="btn btn-sm btn-outline-primary me-2">
                    Edit
                  </Link>
                  <Button size="sm" variant="outline-danger" onClick={() => remove(person)}>
                    Delete
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

// Falls back to the id if the team list has not loaded or the team was removed.
function teamName(teams: TeamSummary[], teamId: string): string {
  return teams.find((team) => team.id === teamId)?.name ?? teamId;
}

// Shows the API's validation details when there are some, otherwise the error message.
export function messageFor(err: unknown): string {
  if (err instanceof ApiError) {
    if (err.details.length) return `${err.message}: ${err.details.join('; ')}`;
    return err.message;
  }
  return 'Something went wrong. Please try again.';
}
