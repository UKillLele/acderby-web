import { createBrowserRouter, createRoutesFromElements, Route } from 'react-router';
import { Layout } from './Layout';
import { Home } from '../pages/Home';
import { NotFound } from '../pages/NotFound';
import { PeopleAdminPage } from '../pages/admin/PeopleAdminPage';
import { PersonFormPage } from '../pages/admin/PersonFormPage';
import { RequireRole } from '../auth/RequireRole';
import { UsersAdminPage } from '../pages/admin/UsersAdminPage';
import { TeamFormPage } from '../pages/admin/TeamFormPage';
import { TeamsAdminPage } from '../pages/admin/TeamsAdminPage';

export const router = createBrowserRouter(
  createRoutesFromElements(
    <Route path="/" element={<Layout />}>
      <Route index element={<Home />} />
      <Route path="admin" element={<RequireRole allowed={['admin', 'editor']} />}>
        <Route path="people" element={<PeopleAdminPage />} />
        <Route path="people/new" element={<PersonFormPage />} />
        <Route path="people/:id" element={<PersonFormPage />} />
        <Route path="teams" element={<TeamsAdminPage />} />
        <Route path="teams/new" element={<TeamFormPage />} />
        <Route path="teams/:slug" element={<TeamFormPage />} />
        <Route element={<RequireRole allowed={['admin']} />}>
          <Route path="users" element={<UsersAdminPage />} />
        </Route>
      </Route>
      <Route path="*" element={<NotFound />} />
    </Route>,
  ),
);
