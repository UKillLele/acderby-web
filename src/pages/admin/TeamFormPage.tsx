import { FormEvent, useEffect, useState } from 'react';
import { Alert, Button, Col, Form, Row, Spinner } from 'react-bootstrap';
import { useNavigate, useParams } from 'react-router';
import { teamsApi } from '../../api/client';
import type { Team, TeamInput } from '../../models/team';
import { messageFor } from './PeopleAdminPage';

// Text fields for the form. Numbers are kept as text while typing and converted on save.
interface FormState {
  name: string;
  description: string;
  color: string;
  type: string;
  seasonWins: string;
  seasonLosses: string;
  ranking: string;
  imageUrl: string;
  logoUrl: string;
  defaultSkaterImage: string;
}

const EMPTY: FormState = {
  name: '',
  description: '',
  color: '#000000',
  type: '',
  seasonWins: '0',
  seasonLosses: '0',
  ranking: '0',
  imageUrl: '',
  logoUrl: '',
  defaultSkaterImage: '',
};

const toForm = (team: Team): FormState => ({
  name: team.name,
  description: team.description,
  color: team.color || '#000000',
  type: team.type,
  seasonWins: String(team.seasonWins),
  seasonLosses: String(team.seasonLosses),
  ranking: String(team.ranking),
  imageUrl: team.imageUrl,
  logoUrl: team.logoUrl,
  defaultSkaterImage: team.defaultSkaterImage,
});

const toCount = (value: string) => {
  const n = Math.trunc(Number(value));
  return Number.isFinite(n) && n >= 0 ? n : 0;
};

export function TeamFormPage() {
  const { slug } = useParams();
  const navigate = useNavigate();
  const editing = Boolean(slug);

  const [form, setForm] = useState<FormState>(EMPTY);
  const [currentSlug, setCurrentSlug] = useState<string>('');
  const [loading, setLoading] = useState(editing);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!editing) return;
    let active = true;
    teamsApi
      .get(slug!)
      .then((team) => {
        if (!active) return;
        setForm(toForm(team));
        setCurrentSlug(team.slug);
      })
      .catch((err: unknown) => {
        if (active) setError(messageFor(err));
      })
      .finally(() => {
        if (active) setLoading(false);
      });
    return () => {
      active = false;
    };
  }, [editing, slug]);

  const set = (field: keyof FormState) => (e: { target: { value: string } }) =>
    setForm((current) => ({ ...current, [field]: e.target.value }));

  async function submit(event: FormEvent) {
    event.preventDefault();
    setError(null);

    if (!form.name.trim()) {
      setError('Name is required.');
      return;
    }

    const input: TeamInput = {
      name: form.name.trim(),
      description: form.description.trim(),
      color: form.color,
      type: form.type.trim(),
      seasonWins: toCount(form.seasonWins),
      seasonLosses: toCount(form.seasonLosses),
      ranking: toCount(form.ranking),
      imageUrl: form.imageUrl.trim(),
      logoUrl: form.logoUrl.trim(),
      defaultSkaterImage: form.defaultSkaterImage.trim(),
    };

    setSaving(true);
    try {
      if (editing) await teamsApi.update(slug!, input);
      else await teamsApi.create(input);
      navigate('/admin/teams');
    } catch (err) {
      setError(messageFor(err));
    } finally {
      setSaving(false);
    }
  }

  if (loading) return <Spinner animation="border" role="status" aria-label="Loading team" />;

  return (
    <section>
      <h1 className="h2 mb-1">{editing ? 'Edit team' : 'Add team'}</h1>
      {editing && <p className="text-muted mb-3">Slug: {currentSlug} (fixed once the team is created)</p>}
      {error && <Alert variant="danger">{error}</Alert>}

      <Form onSubmit={submit} noValidate>
        <Row className="g-3">
          <Col md={6}>
            <Form.Group controlId="team-name">
              <Form.Label>Name</Form.Label>
              <Form.Control value={form.name} onChange={set('name')} required />
            </Form.Group>
          </Col>
          <Col md={3}>
            <Form.Group controlId="team-type">
              <Form.Label>Type</Form.Label>
              <Form.Control value={form.type} onChange={set('type')} placeholder="Home, Travel, Misc…" />
            </Form.Group>
          </Col>
          <Col md={3}>
            <Form.Group controlId="team-color">
              <Form.Label>Colour</Form.Label>
              <Form.Control type="color" value={form.color} onChange={set('color')} title="Team colour" />
            </Form.Group>
          </Col>

          <Col xs={12}>
            <Form.Group controlId="team-description">
              <Form.Label>Description</Form.Label>
              <Form.Control as="textarea" rows={3} value={form.description} onChange={set('description')} />
            </Form.Group>
          </Col>

          <Col md={4}>
            <Form.Group controlId="team-wins">
              <Form.Label>Season wins</Form.Label>
              <Form.Control type="number" min={0} value={form.seasonWins} onChange={set('seasonWins')} />
            </Form.Group>
          </Col>
          <Col md={4}>
            <Form.Group controlId="team-losses">
              <Form.Label>Season losses</Form.Label>
              <Form.Control type="number" min={0} value={form.seasonLosses} onChange={set('seasonLosses')} />
            </Form.Group>
          </Col>
          <Col md={4}>
            <Form.Group controlId="team-ranking">
              <Form.Label>Ranking</Form.Label>
              <Form.Control type="number" min={0} value={form.ranking} onChange={set('ranking')} />
            </Form.Group>
          </Col>

          <Col md={4}>
            <Form.Group controlId="team-image">
              <Form.Label>Team photo URL</Form.Label>
              <Form.Control type="url" placeholder="https://" value={form.imageUrl} onChange={set('imageUrl')} />
            </Form.Group>
          </Col>
          <Col md={4}>
            <Form.Group controlId="team-logo">
              <Form.Label>Logo URL</Form.Label>
              <Form.Control type="url" placeholder="https://" value={form.logoUrl} onChange={set('logoUrl')} />
            </Form.Group>
          </Col>
          <Col md={4}>
            <Form.Group controlId="team-skater">
              <Form.Label>Default skater photo URL</Form.Label>
              <Form.Control
                type="url"
                placeholder="https://"
                value={form.defaultSkaterImage}
                onChange={set('defaultSkaterImage')}
              />
              <Form.Text>Photo upload is not available yet. Paste an existing photo link.</Form.Text>
            </Form.Group>
          </Col>
        </Row>

        <div className="mt-4 d-flex gap-2">
          <Button type="submit" variant="primary" disabled={saving}>
            {saving ? 'Saving…' : 'Save'}
          </Button>
          <Button variant="outline-secondary" onClick={() => navigate('/admin/teams')}>
            Cancel
          </Button>
        </div>
      </Form>
    </section>
  );
}
