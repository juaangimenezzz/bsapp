import { useState, useEffect, useRef } from 'react';
import { supabase } from './supabase';
import Login from './Login';
import './Admin.css';

const DIAS_SEMANA = ['Lunes', 'Martes', 'Miércoles', 'Jueves', 'Viernes', 'Sábado', 'Domingo'];
const HORAS_DISPONIBLES = [
  '09:00', '09:30', '10:00', '10:30', '11:00', '11:30',
  '12:00', '12:30', '13:00', '13:30', '16:00', '16:30',
  '17:00', '17:30', '18:00', '18:30', '19:00', '19:30',
  '20:00', '20:30', '21:00', '21:30',
];

function Admin() {
  const [seccion, setSeccion] = useState('dashboard');
  const [reservas, setReservas] = useState([]);
  const [cargando, setCargando] = useState(true);
  const [sesion, setSesion] = useState(null);
  const [sesionCargada, setSesionCargada] = useState(false);
  const [barberoIdReal, setBarberoIdReal] = useState(null);
  const [barberoSlug, setBarberoSlug] = useState('');

  const [servicios, setServicios] = useState([]);
  const [editandoServicio, setEditandoServicio] = useState(null);
  const [servicioEditado, setServicioEditado] = useState({});
  const [guardandoServicio, setGuardandoServicio] = useState(false);
  const [mensajeServicio, setMensajeServicio] = useState(null);

  const [perfilNombre, setPerfilNombre] = useState('');
  const [perfilCiudad, setPerfilCiudad] = useState('');
  const [perfilTelefono, setPerfilTelefono] = useState('');
  const [perfilAvatarUrl, setPerfilAvatarUrl] = useState(null);
  const [guardandoPerfil, setGuardandoPerfil] = useState(false);
  const [mensajePerfil, setMensajePerfil] = useState(null);
  const [subiendoFoto, setSubiendoFoto] = useState(false);
  const inputFotoRef = useRef(null);

  const [disponibilidad, setDisponibilidad] = useState({});
  const [guardandoHorario, setGuardandoHorario] = useState(false);
  const [mensajeHorario, setMensajeHorario] = useState(null);

  useEffect(() => {
    supabase.auth.getSession().then(({ data: { session } }) => {
      setSesion(session);
      setSesionCargada(true);
    });
    supabase.auth.onAuthStateChange((_event, session) => {
      setSesion(session);
      setSesionCargada(true);
    });
  }, []);

  useEffect(() => {
    if (sesion) cargarDatos();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [sesion]);

  const cargarDatos = async () => {
    setCargando(true);
    const { data: barbero } = await supabase
      .from('barberos').select('*').eq('email', sesion.user.email).single();

    if (barbero) {
      setBarberoIdReal(barbero.id);
      setBarberoSlug(barbero.slug || '');
      setPerfilNombre(barbero.nombre || '');
      setPerfilCiudad(barbero.ciudad || '');
      setPerfilTelefono(barbero.telefono || '');
      setPerfilAvatarUrl(barbero.avatar_url || null);

      const { data: reservasData, error: reservasError } = await supabase
        .from('reservas').select('*').eq('barbero_id', barbero.id).order('hora', { ascending: true });
      if (!reservasError) setReservas(reservasData);

      const { data: serviciosData } = await supabase
        .from('servicios').select('*').eq('barbero_id', barbero.id).order('created_at', { ascending: true });
      if (serviciosData) {
        setServicios(serviciosData.map(s => ({
          id: s.id, nombre: s.nombre, duracion: `${s.duracion} min`, precio: `${s.precio}€`,
        })));
      }

      const { data: disp } = await supabase.from('disponibilidad').select('*').eq('barbero_id', barbero.id);
      if (disp && disp.length > 0) {
        const dispMap = {};
        DIAS_SEMANA.forEach(dia => { dispMap[dia] = { activo: false, horas: [] }; });
        disp.forEach(d => {
          if (!dispMap[d.dia_semana]) dispMap[d.dia_semana] = { activo: false, horas: [] };
          dispMap[d.dia_semana].activo = true;
          if (d.activo) dispMap[d.dia_semana].horas.push(d.hora);
        });
        setDisponibilidad(dispMap);
      } else {
        const dispMap = {};
        DIAS_SEMANA.forEach(dia => { dispMap[dia] = { activo: false, horas: [] }; });
        setDisponibilidad(dispMap);
      }
    }
    setCargando(false);
  };

  const handleSubirFoto = async (e) => {
    const archivo = e.target.files[0];
    if (!archivo) return;
    setSubiendoFoto(true);
    setMensajePerfil(null);
    const extension = archivo.name.split('.').pop();
    const nombreArchivo = `${barberoIdReal}.${extension}`;
    const { error: uploadError } = await supabase.storage.from('avatares').upload(nombreArchivo, archivo, { upsert: true });
    if (uploadError) { setMensajePerfil({ tipo: 'error', texto: 'Error al subir la foto.' }); setSubiendoFoto(false); return; }
    const { data: urlData } = supabase.storage.from('avatares').getPublicUrl(nombreArchivo);
    const avatarUrl = urlData.publicUrl;
    const { error: updateError } = await supabase.from('barberos').update({ avatar_url: avatarUrl }).eq('id', barberoIdReal);
    if (updateError) { setMensajePerfil({ tipo: 'error', texto: 'Error al guardar la foto.' }); }
    else { setPerfilAvatarUrl(avatarUrl); setMensajePerfil({ tipo: 'ok', texto: '¡Foto actualizada correctamente!' }); }
    setSubiendoFoto(false);
  };

  const guardarServicio = async (index) => {
    setGuardandoServicio(true);
    setMensajeServicio(null);
    const s = servicios[index];
    const duracionNum = parseInt(servicioEditado.duracion?.replace(' min', ''), 10);
    const precioNum = parseInt(servicioEditado.precio?.replace('€', ''), 10);
    const { error } = await supabase.from('servicios').update({ nombre: servicioEditado.nombre, duracion: duracionNum, precio: precioNum }).eq('id', s.id);
    if (error) { setMensajeServicio({ tipo: 'error', texto: 'Error al guardar.' }); }
    else {
      const nuevos = [...servicios];
      nuevos[index] = { ...s, nombre: servicioEditado.nombre, duracion: servicioEditado.duracion, precio: servicioEditado.precio };
      setServicios(nuevos);
      setMensajeServicio({ tipo: 'ok', texto: '¡Servicio actualizado correctamente!' });
    }
    setEditandoServicio(null);
    setServicioEditado({});
    setGuardandoServicio(false);
  };

  const añadirServicio = async () => {
    const { data, error } = await supabase.from('servicios').insert([{ barbero_id: barberoIdReal, nombre: 'Nuevo servicio', duracion: 30, precio: 10 }]).select().single();
    if (!error && data) {
      setServicios(prev => [...prev, { id: data.id, nombre: data.nombre, duracion: `${data.duracion} min`, precio: `${data.precio}€` }]);
      setEditandoServicio(servicios.length);
      setServicioEditado({ nombre: data.nombre, duracion: `${data.duracion} min`, precio: `${data.precio}€` });
    }
  };

  const eliminarServicio = async (index) => {
    const s = servicios[index];
    const { error } = await supabase.from('servicios').delete().eq('id', s.id);
    if (!error) { setServicios(prev => prev.filter((_, i) => i !== index)); setEditandoServicio(null); }
  };

  const toggleDia = (dia) => {
    setDisponibilidad(prev => ({ ...prev, [dia]: { ...prev[dia], activo: !prev[dia].activo } }));
  };

  const toggleHora = (dia, hora) => {
    setDisponibilidad(prev => {
      const horas = prev[dia].horas.includes(hora) ? prev[dia].horas.filter(h => h !== hora) : [...prev[dia].horas, hora];
      return { ...prev, [dia]: { ...prev[dia], horas } };
    });
  };

  const guardarHorario = async () => {
    setGuardandoHorario(true);
    setMensajeHorario(null);
    await supabase.from('disponibilidad').delete().eq('barbero_id', barberoIdReal);
    const filas = [];
    DIAS_SEMANA.forEach(dia => {
      if (disponibilidad[dia]?.activo) {
        disponibilidad[dia].horas.forEach(hora => { filas.push({ barbero_id: barberoIdReal, dia_semana: dia, hora, activo: true }); });
      }
    });
    if (filas.length > 0) {
      const { error } = await supabase.from('disponibilidad').insert(filas);
      if (error) { setMensajeHorario({ tipo: 'error', texto: 'Error al guardar.' }); setGuardandoHorario(false); return; }
    }
    setGuardandoHorario(false);
    setMensajeHorario({ tipo: 'ok', texto: '¡Horario guardado correctamente!' });
  };

  const cambiarEstado = async (id, nuevoEstado) => {
    const { error } = await supabase.from('reservas').update({ estado: nuevoEstado }).eq('id', id);
    if (!error) cargarDatos();
  };

  const guardarPerfil = async () => {
    setGuardandoPerfil(true);
    setMensajePerfil(null);
    const { error } = await supabase.from('barberos')
      .update({ nombre: perfilNombre, ciudad: perfilCiudad, telefono: perfilTelefono })
      .eq('id', barberoIdReal);
    setGuardandoPerfil(false);
    if (error) { setMensajePerfil({ tipo: 'error', texto: 'Error al guardar.' }); }
    else { setMensajePerfil({ tipo: 'ok', texto: '¡Perfil actualizado correctamente!' }); }
  };

  const handleLogout = async () => { await supabase.auth.signOut(); };

  const copiarEnlace = () => {
    const url = barberoSlug
      ? `https://bsapp-xi.vercel.app/b/${barberoSlug}`
      : 'https://bsapp-xi.vercel.app';
    if (navigator.clipboard && window.isSecureContext) {
      navigator.clipboard.writeText(url).then(() => setMensajePerfil({ tipo: 'ok', texto: '¡Enlace copiado al portapapeles!' }));
    } else {
      const el = document.createElement('textarea');
      el.value = url; document.body.appendChild(el); el.select(); document.execCommand('copy'); document.body.removeChild(el);
      setMensajePerfil({ tipo: 'ok', texto: '¡Enlace copiado al portapapeles!' });
    }
  };

  if (!sesionCargada) return <div style={{display:'flex',alignItems:'center',justifyContent:'center',height:'100vh',color:'#000',fontSize:'18px'}}>Cargando...</div>;
  if (!sesion) return <Login />;

  const reservasActivas = reservas.filter(r => r.estado !== 'cancelada');
  const confirmadas = reservas.filter(r => r.estado === 'confirmada').length;
  const ingresos = reservasActivas.reduce((total, r) => total + (r.precio || 0), 0);

  return (
    <div className="admin">
      <header className="admin-header">
        <div className="admin-header-left"><h1>BSAPP</h1></div>
        <div className="admin-perfil">
          <div className="admin-avatar">
            {perfilAvatarUrl
              ? <img src={perfilAvatarUrl} alt="avatar" style={{width:'36px',height:'36px',borderRadius:'50%',objectFit:'cover'}} />
              : (perfilNombre ? perfilNombre[0].toUpperCase() : 'B')
            }
          </div>
          <span>{perfilNombre || sesion.user.email}</span>
          <button onClick={handleLogout} style={{background:'rgba(255,255,255,0.2)',border:'none',color:'white',padding:'6px 12px',borderRadius:'8px',cursor:'pointer',fontSize:'13px',marginLeft:'8px'}}>Salir</button>
        </div>
      </header>

      <nav className="admin-nav">
        <button className={seccion === 'dashboard' ? 'activo' : ''} onClick={() => setSeccion('dashboard')}>Dashboard</button>
        <button className={seccion === 'citas' ? 'activo' : ''} onClick={() => setSeccion('citas')}>Citas</button>
        <button className={seccion === 'horario' ? 'activo' : ''} onClick={() => setSeccion('horario')}>Horario</button>
        <button className={seccion === 'servicios' ? 'activo' : ''} onClick={() => setSeccion('servicios')}>Servicios</button>
        <button className={seccion === 'perfil' ? 'activo' : ''} onClick={() => setSeccion('perfil')}>Perfil</button>
      </nav>

      {seccion === 'dashboard' && (
        <div className="admin-contenido">
          <h2>Resumen de hoy</h2>
          <div className="metricas">
            <div className="metrica"><p className="metrica-label">Citas totales</p><p className="metrica-valor purple">{reservasActivas.length}</p></div>
            <div className="metrica"><p className="metrica-label">Confirmadas</p><p className="metrica-valor purple">{confirmadas}</p></div>
            <div className="metrica"><p className="metrica-label">Pendientes</p><p className="metrica-valor">{reservas.filter(r => r.estado === 'pendiente').length}</p></div>
            <div className="metrica"><p className="metrica-label">Ingresos est.</p><p className="metrica-valor green">{ingresos}€</p></div>
          </div>
          <h3 style={{marginTop:'24px',marginBottom:'12px'}}>Últimas reservas</h3>
          {cargando ? <p style={{color:'#888',fontSize:'14px'}}>Cargando reservas...</p> : reservas.length === 0 ? <p style={{color:'#888',fontSize:'14px'}}>No hay reservas todavía.</p> : (
            <div className="citas-lista">
              {reservas.slice(0,5).map((r) => (
                <div key={r.id} className={`cita-row ${r.estado}`}>
                  <span className="cita-hora">{r.hora?.slice(0,5)}</span>
                  <div className="cita-info"><p className="cita-nombre">{r.cliente_nombre}</p><p className="cita-servicio">{r.fecha}</p></div>
                  <span className={`cita-estado ${r.estado}`}>{r.estado === 'confirmada' ? '✓ Confirmada' : r.estado === 'pendiente' ? '⏳ Pendiente' : r.estado}</span>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {seccion === 'citas' && (
        <div className="admin-contenido">
          <h2>Todas las reservas</h2>
          {cargando ? <p style={{color:'#888',fontSize:'14px'}}>Cargando...</p> : reservas.length === 0 ? <p style={{color:'#888',fontSize:'14px'}}>No hay reservas todavía.</p> : (
            <div className="citas-lista">
              {reservas.map((r) => (
                <div key={r.id} className={`cita-row ${r.estado}`}>
                  <span className="cita-hora">{r.hora?.slice(0,5)}</span>
                  <div className="cita-info"><p className="cita-nombre">{r.cliente_nombre}</p><p className="cita-servicio">{r.fecha} · {r.cliente_telefono}</p></div>
                  <div className="cita-acciones">
                    {r.estado === 'pendiente' && (<><button className="btn-confirmar" onClick={() => cambiarEstado(r.id, 'confirmada')}>✓</button><button className="btn-cancelar" onClick={() => cambiarEstado(r.id, 'cancelada')}>✗</button></>)}
                    {r.estado === 'confirmada' && <span className="cita-estado confirmada">✓ Confirmada</span>}
                    {r.estado === 'cancelada' && <span className="cita-estado cancelada">Cancelada</span>}
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {seccion === 'horario' && (
        <div className="admin-contenido">
          <h2>Mi horario</h2>
          <p style={{color:'#888',fontSize:'14px',marginBottom:'20px'}}>Activa los días que trabajas y selecciona las horas disponibles para cada uno.</p>
          <div style={{display:'flex',flexDirection:'column',gap:'12px'}}>
            {DIAS_SEMANA.map(dia => (
              <div key={dia} style={{background:'white',borderRadius:'12px',padding:'16px'}}>
                <div style={{display:'flex',alignItems:'center',justifyContent:'space-between',marginBottom: disponibilidad[dia]?.activo ? '14px' : '0'}}>
                  <p style={{fontWeight:'600',fontSize:'15px',color:'#1a1a2e'}}>{dia}</p>
                  <button onClick={() => toggleDia(dia)} style={{padding:'6px 16px',borderRadius:'8px',border:'1.5px solid #000',background: disponibilidad[dia]?.activo ? '#000' : 'transparent',color: disponibilidad[dia]?.activo ? 'white' : '#000',fontSize:'13px',fontWeight:'600',cursor:'pointer'}}>
                    {disponibilidad[dia]?.activo ? 'Activo' : 'Desactivado'}
                  </button>
                </div>
                {disponibilidad[dia]?.activo && (
                  <div style={{display:'flex',flexWrap:'wrap',gap:'8px'}}>
                    {HORAS_DISPONIBLES.map(hora => (
                      <button key={hora} onClick={() => toggleHora(dia, hora)} style={{padding:'6px 12px',borderRadius:'8px',border:'1.5px solid #000',background: disponibilidad[dia]?.horas.includes(hora) ? '#000' : 'transparent',color: disponibilidad[dia]?.horas.includes(hora) ? 'white' : '#000',fontSize:'13px',cursor:'pointer'}}>
                        {hora}
                      </button>
                    ))}
                  </div>
                )}
              </div>
            ))}
          </div>
          {mensajeHorario && <p style={{padding:'10px 14px',borderRadius:'8px',fontSize:'14px',marginTop:'16px',background: mensajeHorario.tipo === 'ok' ? '#EAF3DE' : '#FEE2E2',color: mensajeHorario.tipo === 'ok' ? '#2D7D46' : '#EF4444'}}>{mensajeHorario.texto}</p>}
          <button className="btn-guardar" onClick={guardarHorario} disabled={guardandoHorario} style={{marginTop:'20px'}}>{guardandoHorario ? 'Guardando...' : 'Guardar horario'}</button>
        </div>
      )}

      {seccion === 'servicios' && (
        <div className="admin-contenido">
          <h2>Mis servicios</h2>
          {mensajeServicio && <p style={{padding:'10px 14px',borderRadius:'8px',fontSize:'14px',marginBottom:'12px',background: mensajeServicio.tipo === 'ok' ? '#EAF3DE' : '#FEE2E2',color: mensajeServicio.tipo === 'ok' ? '#2D7D46' : '#EF4444'}}>{mensajeServicio.texto}</p>}
          <div className="servicios-lista">
            {servicios.map((s, i) => (
              <div key={s.id} className="servicio-admin">
                {editandoServicio === i ? (
                  <div style={{flex:1,display:'flex',flexDirection:'column',gap:'8px'}}>
                    <input className="input-editar" value={servicioEditado.nombre || ''} onChange={e => setServicioEditado({...servicioEditado, nombre: e.target.value})} placeholder="Nombre del servicio" />
                    <div style={{display:'flex',gap:'8px'}}>
                      <div style={{flex:1,display:'flex',alignItems:'center',border:'1.5px solid #000',borderRadius:'8px',overflow:'hidden'}}>
                        <input className="input-editar" style={{border:'none',flex:1,borderRadius:'0'}} value={servicioEditado.duracion ? servicioEditado.duracion.replace(' min','') : ''} onChange={e => setServicioEditado({...servicioEditado, duracion: e.target.value.replace(/\D/g,'') + ' min'})} placeholder="30" inputMode="numeric" />
                        <span style={{padding:'0 10px',color:'#888',fontSize:'14px',background:'#f4f4f8',height:'100%',display:'flex',alignItems:'center'}}>min</span>
                      </div>
                      <div style={{flex:1,display:'flex',alignItems:'center',border:'1.5px solid #000',borderRadius:'8px',overflow:'hidden'}}>
                        <input className="input-editar" style={{border:'none',flex:1,borderRadius:'0'}} value={servicioEditado.precio ? servicioEditado.precio.replace('€','') : ''} onChange={e => setServicioEditado({...servicioEditado, precio: e.target.value.replace(/\D/g,'') + '€'})} placeholder="12" inputMode="numeric" />
                        <span style={{padding:'0 10px',color:'#888',fontSize:'14px',background:'#f4f4f8',height:'100%',display:'flex',alignItems:'center'}}>€</span>
                      </div>
                    </div>
                    <div style={{display:'flex',gap:'8px'}}>
                      <button className="btn-guardar-servicio" onClick={() => guardarServicio(i)} disabled={guardandoServicio}>{guardandoServicio ? 'Guardando...' : 'Guardar'}</button>
                      <button className="btn-cancelar-servicio" onClick={() => { setEditandoServicio(null); setServicioEditado({}); }}>Cancelar</button>
                      <button onClick={() => eliminarServicio(i)} style={{padding:'8px 16px',borderRadius:'8px',border:'none',background:'#FEE2E2',color:'#EF4444',fontSize:'13px',cursor:'pointer'}}>Eliminar</button>
                    </div>
                  </div>
                ) : (
                  <>
                    <div><p className="servicio-nombre">{s.nombre}</p><p className="servicio-meta">⏱ {s.duracion}</p></div>
                    <div className="servicio-derecha">
                      <span className="servicio-precio">{s.precio}</span>
                      <button className="btn-editar" onClick={() => { setEditandoServicio(i); setServicioEditado({...s}); }}>Editar</button>
                    </div>
                  </>
                )}
              </div>
            ))}
          </div>
          <button className="btn-añadir" onClick={añadirServicio}>+ Añadir servicio</button>
        </div>
      )}

      {seccion === 'perfil' && (
        <div className="admin-contenido">
          <h2>Mi perfil</h2>
          <div className="perfil-form">
            <div style={{display:'flex',flexDirection:'column',alignItems:'center',gap:'10px',marginBottom:'8px'}}>
              <div className="perfil-avatar-grande" onClick={() => inputFotoRef.current.click()} style={{cursor:'pointer',position:'relative',overflow:'hidden'}}>
                {perfilAvatarUrl
                  ? <img src={perfilAvatarUrl} alt="avatar" style={{width:'100%',height:'100%',objectFit:'cover',borderRadius:'50%'}} />
                  : (perfilNombre ? perfilNombre[0].toUpperCase() : 'B')
                }
                <div style={{position:'absolute',bottom:0,left:0,right:0,background:'rgba(0,0,0,0.5)',color:'white',fontSize:'11px',textAlign:'center',padding:'4px 0'}}>
                  {subiendoFoto ? 'Subiendo...' : 'Cambiar'}
                </div>
              </div>
              <input ref={inputFotoRef} type="file" accept="image/*" style={{display:'none'}} onChange={handleSubirFoto} />
              <p style={{fontSize:'12px',color:'#888'}}>Haz clic en la foto para cambiarla</p>
            </div>
            <div className="campo-admin"><label>Email</label><input type="email" value={sesion.user.email} disabled style={{background:'#f4f4f8',color:'#888'}} /></div>
            <div className="campo-admin"><label>Nombre</label><input type="text" value={perfilNombre} onChange={e => setPerfilNombre(e.target.value)} placeholder="Tu nombre o nombre del negocio" /></div>
            <div className="campo-admin"><label>Ciudad</label><input type="text" value={perfilCiudad} onChange={e => setPerfilCiudad(e.target.value)} placeholder="Tu ciudad" /></div>
            <div className="campo-admin">
              <label>Teléfono WhatsApp</label>
              <input type="tel" value={perfilTelefono} onChange={e => setPerfilTelefono(e.target.value.replace(/\D/g, '').slice(0, 9))} placeholder="Ej: 612345678" inputMode="numeric" maxLength={9} />
              <p style={{fontSize:'11px',color:'#888',marginTop:'4px'}}>Los clientes te enviarán la confirmación a este número</p>
            </div>
            <div className="campo-admin">
              <label>Tu enlace de reservas</label>
              <div className="enlace-box">
                <span style={{color:'#EF4444',fontSize:'13px'}}>
                  {barberoSlug ? `bsapp-xi.vercel.app/b/${barberoSlug}` : 'bsapp-xi.vercel.app'}
                </span>
                <button className="btn-copiar" onClick={copiarEnlace}>Copiar</button>
              </div>
            </div>
            {mensajePerfil && <p style={{padding:'10px 14px',borderRadius:'8px',fontSize:'14px',background: mensajePerfil.tipo === 'ok' ? '#EAF3DE' : '#FEE2E2',color: mensajePerfil.tipo === 'ok' ? '#2D7D46' : '#EF4444'}}>{mensajePerfil.texto}</p>}
            <button className="btn-guardar" onClick={guardarPerfil} disabled={guardandoPerfil}>{guardandoPerfil ? 'Guardando...' : 'Guardar cambios'}</button>
          </div>
        </div>
      )}
    </div>
  );
}

export default Admin;