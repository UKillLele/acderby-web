import { useEffect, useState } from 'react';
import { Alert, Spinner, Table } from 'react-bootstrap';
import { Link } from 'react-router';
import { teamsApi } from '../../api/client';
import type { Team } from '../../models/team';
import { messageFor } from './PeopleAdminPage';

export function TeamsAdminPage() {
  const [teams, setTeams] = useState<Team[] | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let active = true;
    teamsApi
      .list()
      .then((list) => {
        if (active) setTeams([...list].sort((a, b) => a.name.localeCompare(b.name)));
      })
      .catch((err: unknown) => {
        if (active) setError(messageFor(err));
      });
    return () => {
      active = false;
    };
  }, []);

  return (
    <section>
      <div className="d-flex justify-content-between align-items-center mb-3">
        <h1 className="h2 mb-0">Teams</h1>
        <Link to="/admin/teams/new" className="btn btn-primary">
          Add team
        </Link>
      </div>

      {error && <Alert variant="danger">{error}</Alert>}
      {!teams && !error && <Spinner animation="border" role="status" aria-label="Loading teams" />}
      {teams && teams.length === 0 && <p>No teams yet.</p>}

      {teams && teams.length > 0 && (
        <Table striped hover responsive>
          <thead>
            <tr>
              <th scope="col">Name</th>
              <th scope="col">Type</th>
              <th scope="col">Season W–L</th>
              <th scope="col">Ranking</th>
              <th scope="col">
                <span className="visually-hidden">Actions</span>
              </th>
            </tr>
          </thead>
          <tbody>
            {teams.map((team) => (
              <tr key={team.id}>
                <td>
                  <span className="me-2 d-inline-block rounded-circle" style={{ width: '0.75rem', height: '0.75rem', background: team.color || '#999' }} aria-hidden="true" />
                  {team.name}
                </td>
                <td>{team.type}</td>
                <td>
                  {team.seasonWins}–{team.seasonLosses}
                </td>
                <td>{team.ranking}</td>
                <td className="text-end">
                  <Link to={`/admin/teams/${team.slug}`} className="btn btn-sm btn-outline-primary">
                    Edit
                  </Link>
                </td>
              </tr>
            ))}
          </tbody>
        </Table>
      )}
    </section>
  );
}
