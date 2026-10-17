import { createBrowserRouter } from 'react-router-dom';
import AppShell from './app/AppShell';
import LandingPage from './landing/LandingPage';
import NotFoundPage from './landing/NotFoundPage';
import { appPath, homePath } from './paths';

export const router = createBrowserRouter([
  { path: homePath, element: <LandingPage /> },
  {
    path: appPath,
    element: <AppShell />,
    children: [
      { index: true, element: null },
      { path: '*', element: null },
    ],
  },
  { path: '*', element: <NotFoundPage /> },
]);
