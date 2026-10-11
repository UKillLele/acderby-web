import { createBrowserRouter, createRoutesFromElements, Route } from 'react-router';
import { Layout } from './Layout';
import { Home } from '../pages/Home';
import { NotFound } from '../pages/NotFound';
import { PeopleAdminPage } from '../pages/admin/PeopleAdminPage';
import { PersonFormPage } from '../pages/admin/PersonFormPage';
import { RequireEditor } from '../auth/RequireEditor';

export const router = createBrowserRouter(
  createRoutesFromElements(
    <Route path="/" element={<Layout />}>
      <Route index element={<Home />} />
      <Route path="admin" element={<RequireEditor />}>
        <Route path="people" element={<PeopleAdminPage />} />
        <Route path="people/new" element={<PersonFormPage />} />
        <Route path="people/:id" element={<PersonFormPage />} />
      </Route>
      <Route path="*" element={<NotFound />} />
    </Route>,
  ),
);
