// App.jsx
import { Routes, Route, Navigate } from 'react-router-dom'
import { supabase } from './utils/supabaseClient'
import Map from './components/Map/Map'
import LoginForm from './components/LoginForm/LoginForm'
import Dashboard from './components/Dashboard/Dashboard'
import { useEffect, useState } from 'react'
import AddClient from './components/Dashboard/AddClient'
import ClientList from './components/Dashboard/ClientList'
import EditClient from './components/Dashboard/EditClient'

function App() {
  const [session, setSession] = useState(null)
  useEffect(() => {
    supabase.auth.getSession().then(({ data: { session } }) => {
      setSession(session)
    })
    supabase.auth.onAuthStateChange((_event, session) => {
      setSession(session)
    })
  }, [])
  return (
    <Routes>
      <Route path="/" element={<Map />} />
      <Route path="/login" element={!session ? <LoginForm /> : <Navigate to="/dashboard" />} />
      <Route path="/dashboard" element={session ? <Dashboard /> : <Navigate to="/login" />}>
        <Route path="clients" element={<ClientList />} />
        <Route path="add-client" element={<AddClient />} />
        <Route path="edit-client/:id" element={<EditClient />} />
        <Route index element={<Navigate to="clients" />} />
      </Route>
      <Route path="*" element={<Navigate to="/" />} />
    </Routes>
  )
}
export default App;