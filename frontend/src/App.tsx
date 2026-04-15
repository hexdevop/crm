import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom'
import { useEffect } from 'react'
import { useAuthStore } from '@/store/auth.store'
import { authApi } from '@/api/auth'

// Layouts
import AuthLayout from '@/layouts/AuthLayout'
import AppLayout from '@/layouts/AppLayout'

// Auth pages
import LoginPage from '@/pages/auth/LoginPage'
import RegisterPage from '@/pages/auth/RegisterPage'

// App pages
import DashboardPage from '@/pages/dashboard/DashboardPage'
import UsersPage from '@/pages/users/UsersPage'
import UserDetailPage from '@/pages/users/UserDetailPage'
import RolesPage from '@/pages/roles/RolesPage'
import RoleDetailPage from '@/pages/roles/RoleDetailPage'
import EntitiesPage from '@/pages/entities/EntitiesPage'
import EntityBuilderPage from '@/pages/entities/EntityBuilderPage'
import RecordsPage from '@/pages/records/RecordsPage'
import RecordFormPage from '@/pages/records/RecordFormPage'
import SettingsPage from '@/pages/settings/SettingsPage'
import NotFoundPage from '@/pages/errors/NotFoundPage'

// Guards
import ProtectedRoute from '@/router/ProtectedRoute'

function App() {
  const { isAuthenticated, setUser } = useAuthStore()

  // Restore user on page reload
  useEffect(() => {
    if (isAuthenticated) {
      authApi.me().then(setUser).catch(() => useAuthStore.getState().logout())
    }
  }, [])

  return (
    <BrowserRouter>
      <Routes>
        {/* Public routes */}
        <Route element={<AuthLayout />}>
          <Route path="/login" element={<LoginPage />} />
          <Route path="/register" element={<RegisterPage />} />
        </Route>

        {/* Protected app routes */}
        <Route element={<ProtectedRoute />}>
          <Route element={<AppLayout />}>
            <Route index element={<Navigate to="/dashboard" replace />} />
            <Route path="/dashboard" element={<DashboardPage />} />

            <Route path="/users" element={<UsersPage />} />
            <Route path="/users/:id" element={<UserDetailPage />} />

            <Route path="/roles" element={<RolesPage />} />
            <Route path="/roles/:id" element={<RoleDetailPage />} />

            <Route path="/entities" element={<EntitiesPage />} />
            <Route path="/entities/new" element={<EntityBuilderPage />} />
            <Route path="/entities/:id/edit" element={<EntityBuilderPage />} />
            <Route path="/entities/:entityId/records" element={<RecordsPage />} />
            <Route path="/entities/:entityId/records/new" element={<RecordFormPage />} />
            <Route path="/entities/:entityId/records/:recordId/edit" element={<RecordFormPage />} />

            <Route path="/settings" element={<SettingsPage />} />
          </Route>
        </Route>

        <Route path="*" element={<NotFoundPage />} />
      </Routes>
    </BrowserRouter>
  )
}

export default App
