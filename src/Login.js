import { useState } from 'react';
import { supabase } from './supabase';
import './Login.css';

function Login() {
  const [modo, setModo] = useState('login'); // 'login' o 'registro'
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [cargando, setCargando] = useState(false);
  const [error, setError] = useState(null);
  const [mensaje, setMensaje] = useState(null);

  const handleLogin = async () => {
    if (!email || !password) return;
    setCargando(true);
    setError(null);

    const { error } = await supabase.auth.signInWithPassword({ email, password });

    if (error) {
      setError('Email o contraseña incorrectos.');
    }
    setCargando(false);
  };

  const handleRegistro = async () => {
    if (!email || !password) return;
    setCargando(true);
    setError(null);

    const { error } = await supabase.auth.signUp({ email, password });

    if (error) {
      setError('Error al registrarse. Inténtalo de nuevo.');
    } else {
      setMensaje('¡Cuenta creada! Revisa tu email para confirmarla.');
    }
    setCargando(false);
  };

  return (
    <div className="login-fondo">
      <div className="login-caja">
        <div className="login-header">
          <h1>BSAPP</h1>
          <p>Panel del barbero</p>
        </div>

        <div className="login-tabs">
          <button
            className={modo === 'login' ? 'activo' : ''}
            onClick={() => { setModo('login'); setError(null); setMensaje(null); }}
          >
            Iniciar sesión
          </button>
          <button
            className={modo === 'registro' ? 'activo' : ''}
            onClick={() => { setModo('registro'); setError(null); setMensaje(null); }}
          >
            Crear cuenta
          </button>
        </div>

        <div className="login-form">
          <div className="campo-login">
            <label>Email</label>
            <input
              type="email"
              placeholder="tu@email.com"
              value={email}
              onChange={e => setEmail(e.target.value)}
            />
          </div>
          <div className="campo-login">
            <label>Contraseña</label>
            <input
              type="password"
              placeholder="Mínimo 6 caracteres"
              value={password}
              onChange={e => setPassword(e.target.value)}
            />
          </div>

          {error && <p className="login-error">{error}</p>}
          {mensaje && <p className="login-mensaje">{mensaje}</p>}

          <button
            className="btn-login"
            onClick={modo === 'login' ? handleLogin : handleRegistro}
            disabled={cargando}
          >
            {cargando ? 'Cargando...' : modo === 'login' ? 'Entrar' : 'Crear cuenta'}
          </button>
        </div>
      </div>
    </div>
  );
}

export default Login;