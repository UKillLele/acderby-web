import { Link, Outlet } from 'react-router';
import { Container, Navbar } from 'react-bootstrap';

export function Layout() {
  return (
    <>
      <Navbar bg="dark" data-bs-theme="dark" expand="md">
        <Container>
          <Navbar.Brand as={Link} to="/">
            ACDerby
          </Navbar.Brand>
        </Container>
      </Navbar>
      <Container className="py-4">
        <Outlet />
      </Container>
    </>
  );
}
