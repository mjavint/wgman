import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom'
import Layout from './components/Layout'
import Login from './pages/Login'
import Clients from './pages/Clients'
import Server from './pages/Server'
import Status from './pages/Status'
import Settings from './pages/Settings'
import ClientConfig from './pages/ClientConfig'

function App() {
  return (
    <BrowserRouter>
      <Routes>
        <Route path="/login" element={<Login />} />
        <Route path="/client" element={<ClientConfig />} />
        <Route path="/" element={<Layout />}>
          <Route index element={<Navigate to="/clients" replace />} />
          <Route path="clients" element={<Clients />} />
          <Route path="server" element={<Server />} />
          <Route path="status" element={<Status />} />
          <Route path="settings" element={<Settings />} />
        </Route>
      </Routes>
    </BrowserRouter>
  )
}

export default App