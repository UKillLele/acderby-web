import { FormEvent, useEffect, useState } from 'react';
import { Alert, Button, Col, Form, Row, Spinner } from 'react-bootstrap';
import { useNavigate, useParams } from 'react-router';
import { peopleApi, teamsApi } from '../../api/client';
import { PersonInput, POSITION_LABELS, PositionType, TeamSummary } from '../../models/person';
import { messageFor } from './PeopleAdminPage';

interface TeamRow {
  teamId: string;
  positionType: PositionType;
}

interface FormState {
  name: string;
  number: string;
  imageUrl: string;
  portfolioUrl: string;
  teams: TeamRow[];
}

const EMPTY: FormState = { name: '', number: '', imageUrl: '', portfolioUrl: '', teams: [] };

export function PersonFormPage() {
  const { id } = useParams();
  const navigate = useNavigate();
  const editing = Boolean(id);

  const [form, setForm] = useState<FormState>(EMPTY);
  const [teams, setTeams] = useState<TeamSummary[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let active = true;
    const load = async () => {
      try {
        const [teamList, person] = await Promise.all([teamsApi.list(), editing ? peopleApi.get(id!) : null]);
        if (!active) return;
        setTeams(teamList);
        if (person) {
          setForm({
            name: person.name,
            number: person.number,
            imageUrl: person.imageUrl,
            portfolioUrl: person.portfolioUrl,
            teams: person.teams.map((t) => ({ teamId: t.id, positionType: t.positionType })),
          });
        }
      } catch (err) {
        if (active) setError(messageFor(err));
      } finally {
        if (active) setLoading(false);
      }
    };
    void load();
    return () => {
      active = false;
    };
  }, [editing, id]);

  function updateTeamRow(index: number, patch: Partial<TeamRow>) {
    setForm((current) => ({
      ...current,
      teams: current.teams.map((row, i) => (i === index ? { ...row, ...patch } : row)),
    }));
  }

  async function submit(event: FormEvent) {
    event.preventDefault();
    setError(null);

    if (!form.name.trim()) {
      setError('Name is required.');
      return;
    }

    const input: PersonInput = {
      name: form.name.trim(),
      number: form.number.trim(),
      imageUrl: form.imageUrl.trim(),
      portfolioUrl: form.portfolioUrl.trim(),
      teams: form.teams.filter((row) => row.teamId).map((row) => ({ id: row.teamId, positionType: row.positionType })),
    };

    setSaving(true);
    try {
      if (editing) await peopleApi.update(id!, input);
      else await peopleApi.create(input);
      navigate('/admin/people');
    } catch (err) {
      setError(messageFor(err));
    } finally {
      setSaving(false);
    }
  }

  if (loading) return <Spinner animation="border" role="status" aria-label="Loading person" />;

  return (
    <section>
      <h1 className="h2 mb-3">{editing ? 'Edit person' : 'Add person'}</h1>
      {error && <Alert variant="danger">{error}</Alert>}

      <Form onSubmit={submit} noValidate>
        <Row className="g-3">
          <Col md={6}>
            <Form.Group controlId="person-name">
              <Form.Label>Name</Form.Label>
              <Form.Control value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} required />
            </Form.Group>
          </Col>
          <Col md={3}>
            <Form.Group controlId="person-number">
              <Form.Label>Number</Form.Label>
              <Form.Control value={form.number} onChange={(e) => setForm({ ...form, number: e.target.value })} />
            </Form.Group>
          </Col>

          <Col md={6}>
            <Form.Group controlId="person-portfolio">
              <Form.Label>Portfolio link</Form.Label>
              <Form.Control
                type="url"
                placeholder="https://"
                value={form.portfolioUrl}
                onChange={(e) => setForm({ ...form, portfolioUrl: e.target.value })}
              />
              <Form.Text>Photographers only. Must start with https://</Form.Text>
            </Form.Group>
          </Col>
          <Col md={6}>
            <Form.Group controlId="person-image">
              <Form.Label>Photo URL</Form.Label>
              <Form.Control
                type="url"
                placeholder="https://"
                value={form.imageUrl}
                onChange={(e) => setForm({ ...form, imageUrl: e.target.value })}
              />
              <Form.Text>Photo upload is not available yet. Paste an existing photo link.</Form.Text>
            </Form.Group>
          </Col>

          <Col xs={12}>
            <h2 className="h5">Team positions</h2>
            <Form.Text className="d-block mb-2">Photographers are members of the Photographers team.</Form.Text>
            {form.teams.map((row, index) => (
              <Row key={index} className="g-2 mb-2 align-items-center">
                <Col sm={6}>
                  <Form.Select
                    aria-label="Team"
                    value={row.teamId}
                    onChange={(e) => updateTeamRow(index, { teamId: e.target.value })}
                  >
                    <option value="">Choose a team</option>
                    {teams.map((team) => (
                      <option key={team.id} value={team.id}>
                        {team.name}
                      </option>
                    ))}
                  </Form.Select>
                </Col>
                <Col sm={4}>
                  <Form.Select
                    aria-label="Position"
                    value={row.positionType}
                    onChange={(e) => updateTeamRow(index, { positionType: Number(e.target.value) as PositionType })}
                  >
                    {Object.entries(POSITION_LABELS).map(([value, label]) => (
                      <option key={value} value={value}>
                        {label}
                      </option>
                    ))}
                  </Form.Select>
                </Col>
                <Col sm={2}>
                  <Button
                    variant="outline-danger"
                    size="sm"
                    onClick={() => setForm({ ...form, teams: form.teams.filter((_, i) => i !== index) })}
                  >
                    Remove
                  </Button>
                </Col>
              </Row>
            ))}
            <Button
              variant="outline-secondary"
              size="sm"
              onClick={() =>
                setForm({ ...form, teams: [...form.teams, { teamId: '', positionType: PositionType.member }] })
              }
            >
              Add team position
            </Button>
          </Col>
        </Row>

        <div className="mt-4 d-flex gap-2">
          <Button type="submit" variant="primary" disabled={saving}>
            {saving ? 'Saving…' : 'Save'}
          </Button>
          <Button variant="outline-secondary" onClick={() => navigate('/admin/people')}>
            Cancel
          </Button>
        </div>
      </Form>
    </section>
  );
}
