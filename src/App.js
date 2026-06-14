import { BrowserRouter, Routes, Route } from 'react-router-dom';
import ClienteApp from './ClienteApp';
import Admin from './Admin';

function App() {
  return (
    <BrowserRouter>
      <Routes>
        <Route path="/" element={<ClienteApp />} />
        <Route path="/admin" element={<Admin />} />
      </Routes>
    </BrowserRouter>
  );
}

export default App;
