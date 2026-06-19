import { useState, useEffect } from 'react';
import { useParams } from 'react-router-dom';
import { supabase } from './supabase';
import './App.css';

const DIAS_SEMANA = ['Lunes', 'Martes', 'Miércoles', 'Jueves', 'Viernes', 'Sábado', 'Domingo'];

function ClienteApp() {
  const { slug } = useParams();
  const [paso, setPaso] = useState(1);
  const [servicios, setServicios] = useState([]);
  const [servicioSeleccionado, setServicioSeleccionado] = useState(null);
  const [diaSeleccionado, setDiaSeleccionado] = useState(null);
  const [horaSeleccionada, setHoraSeleccionada] = useState(null);
  const [nombre, setNombre] = useState('');
  const [telefono, setTelefono] = useState('');
  const [guardando, setGuardando] = useState(false);
  const [error, setError] = useState(null);
  const [horasOcupadas, setHorasOcupadas] = useState([]);
  const [diasDisponibles, setDiasDisponibles] = useState([]);
  const [horasPorDia, setHorasPorDia] = useState({});
  const [cargando, setCargando] = useState(true);
  const [barberoId, setBarberoId] = useState(null);
  const [barbero, setBarbero] = useState({ nombre: '', ciudad: '', avatar_url: null, calendar_id: null });

  // Estados para cancelación
  const [mostrarCancelacion, setMostrarCancelacion] = useState(false);
  const [telefonoCancelacion, setTelefonoCancelacion] = useState('');
  const [reservasCliente, setReservasCliente] = useState([]);
  const [buscandoReservas, setBuscandoReservas] = useState(false);
  const [cancelando, setCancelando] = useState(null);
  const [mensajeCancelacion, setMensajeCancelacion] = useState(null);

  const servicioInfo = servicios.find(s => s.nombre === servicioSeleccionado);

  const obtenerFecha = (nombreDia) => {
    const hoy = new Date();
    const indiceDia = DIAS_SEMANA.indexOf(nombreDia);
    const indiceHoy = hoy.getDay() === 0 ? 6 : hoy.getDay() - 1;
    let diff = indiceDia - indiceHoy;
    if (diff <= 0) diff += 7;
    const fecha = new Date(hoy);
    fecha.setDate(hoy.getDate() + diff);
    return fecha;
  };

  const formatearFecha = (fecha) => {
    return fecha.toISOString().split('T')[0];
  };

  useEffect(() => {
    const cargarDatos = async () => {
      setCargando(true);

      let query = supabase.from('barberos').select('*');
      if (slug) {
        query = query.eq('slug', slug);
      }
      const { data: barberoData } = await query.single();

      if (!barberoData) {
        setCargando(false);
        return;
      }

      setBarbero(barberoData);
      setBarberoId(barberoData.id);

      const { data: serviciosData } = await supabase
        .from('servicios')
        .select('*')
        .eq('barbero_id', barberoData.id)
        .order('created_at', { ascending: true });

      if (serviciosData && serviciosData.length > 0) {
        const serviciosFormateados = serviciosData.map(s => ({
          id: s.id,
          nombre: s.nombre,
          duracion: s.duracion,
          duracionTexto: `${s.duracion} min`,
          precio: `${s.precio}€`,
        }));
        setServicios(serviciosFormateados);
        setServicioSeleccionado(serviciosFormateados[0].nombre);
      }

      const { data: dispData } = await supabase
        .from('disponibilidad')
        .select('*')
        .eq('barbero_id', barberoData.id)
        .eq('activo', true);

      if (dispData && dispData.length > 0) {
        const porDia = {};
        dispData.forEach(d => {
          if (!porDia[d.dia_semana]) porDia[d.dia_semana] = [];
          porDia[d.dia_semana].push(d.hora);
        });
        setHorasPorDia(porDia);
        const dias = Object.keys(porDia);
        setDiasDisponibles(dias);
        if (dias.length > 0) setDiaSeleccionado(dias[0]);
      }

      setCargando(false);
    };
    cargarDatos();
  }, [slug]);

  useEffect(() => {
    if (!diaSeleccionado || !barberoId) return;
    const cargarHorasOcupadas = async () => {
      const fecha = formatearFecha(obtenerFecha(diaSeleccionado));
      const { data, error } = await supabase
        .from('reservas')
        .select('hora')
        .eq('fecha', fecha)
        .eq('barbero_id', barberoId)
        .neq('estado', 'cancelada');
      if (!error && data) {
        setHorasOcupadas(data.map(r => r.hora.slice(0, 5)));
      }
    };
    cargarHorasOcupadas();
    setHoraSeleccionada(null);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [diaSeleccionado, barberoId]);

  const horas = diaSeleccionado
    ? (horasPorDia[diaSeleccionado] || []).sort().map(hora => ({
        hora,
        ocupada: horasOcupadas.includes(hora),
      }))
    : [];

  const handleTelefono = (e) => {
    const valor = e.target.value.replace(/\D/g, '').slice(0, 9);
    setTelefono(valor);
  };

  const handleSiguiente = () => {
    if (horaSeleccionada) setPaso(2);
  };

  const handleConfirmar = async () => {
    if (!nombre.trim() || telefono.length !== 9) return;

    setGuardando(true);
    setError(null);

    const precioNumerico = parseInt(servicioInfo.precio.replace('€', ''), 10);
    const fecha = formatearFecha(obtenerFecha(diaSeleccionado));

    const { error: errorReserva } = await supabase
      .from('reservas')
      .insert([{
        barbero_id: barberoId,
        servicio_id: null,
        cliente_nombre: nombre,
        cliente_telefono: telefono,
        fecha,
        hora: horaSeleccionada,
        estado: 'pendiente',
        precio: precioNumerico
      }]);

    if (errorReserva) {
      setError('Ha habido un error al guardar la reserva. Inténtalo de nuevo.');
      setGuardando(false);
      return;
    }

    if (barbero.calendar_id) {
      try {
        await fetch('/api/crear-evento-calendar', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            calendarId: barbero.calendar_id,
            fecha,
            hora: horaSeleccionada,
            clienteNombre: nombre,
            servicio: servicioSeleccionado,
            duracion: servicioInfo.duracion,
          }),
        });
      } catch (e) {
        console.error('Error creando evento en calendar:', e);
      }
    }

    setGuardando(false);
    setPaso(3);
  };

  const buscarReservas = async () => {
    if (telefonoCancelacion.length !== 9) return;
    setBuscandoReservas(true);
    setMensajeCancelacion(null);
    const hoy = new Date().toISOString().split('T')[0];
    const { data, error } = await supabase
      .from('reservas')
      .select('*')
      .eq('cliente_telefono', telefonoCancelacion)
      .eq('barbero_id', barberoId)
      .neq('estado', 'cancelada')
      .gte('fecha', hoy)
      .order('fecha', { ascending: true });
    if (!error) setReservasCliente(data || []);
    setBuscandoReservas(false);
  };

  const cancelarReserva = async (reserva) => {
    setCancelando(reserva.id);
    const { error } = await supabase
      .from('reservas')
      .update({ estado: 'cancelada' })
      .eq('id', reserva.id);

    if (!error) {
      if (barbero.calendar_id) {
        try {
          await fetch('/api/eliminar-evento-calendar', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              calendarId: barbero.calendar_id,
              fecha: reserva.fecha,
              hora: reserva.hora.slice(0, 5),
              clienteNombre: reserva.cliente_nombre,
            }),
          });
        } catch (e) {
          console.error('Error eliminando evento:', e);
        }
      }
      setReservasCliente(prev => prev.filter(r => r.id !== reserva.id));
      setMensajeCancelacion({ tipo: 'ok', texto: '¡Cita cancelada correctamente!' });
    } else {
      setMensajeCancelacion({ tipo: 'error', texto: 'Error al cancelar. Inténtalo de nuevo.' });
    }
    setCancelando(null);
  };

  if (cargando) {
    return (
      <div className="app">
        <header className="header">
          <h1>BSAPP</h1>
          <p>Reserva tu cita de la manera más sencilla</p>
        </header>
        <div style={{padding:'40px',textAlign:'center',color:'#888'}}>Cargando...</div>
      </div>
    );
  }

  if (!barbero.nombre) {
    return (
      <div className="app">
        <header className="header">
          <h1>BSAPP</h1>
          <p>Reserva tu cita de la manera más sencilla</p>
        </header>
        <div style={{padding:'40px',textAlign:'center',color:'#888'}}>Barbero no encontrado.</div>
      </div>
    );
  }

  if (mostrarCancelacion) {
    return (
      <div className="app">
        <header className="header">
          <h1>BSAPP</h1>
          <p>Reserva tu cita de la manera más sencilla</p>
        </header>
        <div className="seccion">
          <button className="btn-volver" onClick={() => { setMostrarCancelacion(false); setTelefonoCancelacion(''); setReservasCliente([]); setMensajeCancelacion(null); }}>← Volver</button>
          <h3 style={{marginTop:'12px'}}>Cancelar mi cita</h3>
          <p style={{color:'#888',fontSize:'14px',marginBottom:'16px'}}>Introduce tu número de teléfono para ver tus reservas activas.</p>
          <div className="formulario">
            <div className="campo">
              <label>Tu teléfono</label>
              <input
                type="tel"
                placeholder="Ej: 612345678"
                value={telefonoCancelacion}
                onChange={e => setTelefonoCancelacion(e.target.value.replace(/\D/g, '').slice(0, 9))}
                inputMode="numeric"
                maxLength={9}
              />
            </div>
          </div>
          <button
            className={`btn-reservar ${telefonoCancelacion.length !== 9 ? 'deshabilitado' : ''}`}
            onClick={buscarReservas}
            disabled={telefonoCancelacion.length !== 9 || buscandoReservas}
            style={{marginTop:'16px'}}
          >
            {buscandoReservas ? 'Buscando...' : 'Buscar mis citas'}
          </button>

          {mensajeCancelacion && (
            <p style={{
              padding:'10px 14px',borderRadius:'8px',fontSize:'14px',marginTop:'16px',
              background: mensajeCancelacion.tipo === 'ok' ? '#EAF3DE' : '#FEE2E2',
              color: mensajeCancelacion.tipo === 'ok' ? '#2D7D46' : '#EF4444'
            }}>{mensajeCancelacion.texto}</p>
          )}

          {reservasCliente.length > 0 && (
            <div style={{marginTop:'20px',display:'flex',flexDirection:'column',gap:'12px'}}>
              <h3>Tus citas activas</h3>
              {reservasCliente.map(r => (
                <div key={r.id} style={{background:'white',borderRadius:'12px',padding:'16px',display:'flex',justifyContent:'space-between',alignItems:'center'}}>
                  <div>
                    <p style={{fontWeight:'600',fontSize:'15px',color:'#1a1a2e'}}>{r.fecha}</p>
                    <p style={{fontSize:'13px',color:'#888',marginTop:'4px'}}>{r.hora?.slice(0,5)} · {r.cliente_nombre}</p>
                    <p style={{fontSize:'12px',color:'#aaa',marginTop:'2px',textTransform:'capitalize'}}>{r.estado}</p>
                  </div>
                  <button
                    onClick={() => cancelarReserva(r)}
                    disabled={cancelando === r.id}
                    style={{
                      padding:'8px 16px',borderRadius:'8px',border:'none',
                      background:'#EF4444',color:'white',fontSize:'13px',
                      fontWeight:'600',cursor:'pointer'
                    }}
                  >
                    {cancelando === r.id ? 'Cancelando...' : 'Cancelar'}
                  </button>
                </div>
              ))}
            </div>
          )}

          {!buscandoReservas && reservasCliente.length === 0 && telefonoCancelacion.length === 9 && mensajeCancelacion === null && (
            <p style={{color:'#888',fontSize:'14px',marginTop:'16px',textAlign:'center'}}>No se han encontrado citas activas con este número.</p>
          )}
        </div>
      </div>
    );
  }

  if (paso === 3) {
    return (
      <div className="app">
        <header className="header">
          <h1>BSAPP</h1>
          <p>Reserva tu cita de la manera más sencilla</p>
        </header>
        <div className="confirmacion-pantalla">
          <div className="confirmacion-icono">✅</div>
          <h2>¡Reserva confirmada!</h2>
          <p className="confirmacion-nombre">Hola, <strong>{nombre}</strong></p>
          <div className="confirmacion-detalle">
            <div className="detalle-fila">
              <span className="detalle-label">Barbero</span>
              <span className="detalle-valor">{barbero.nombre}</span>
            </div>
            <div className="detalle-fila">
              <span className="detalle-label">Servicio</span>
              <span className="detalle-valor">{servicioSeleccionado}</span>
            </div>
            <div className="detalle-fila">
              <span className="detalle-label">Día</span>
              <span className="detalle-valor" style={{textTransform:'capitalize'}}>{diaSeleccionado}</span>
            </div>
            <div className="detalle-fila">
              <span className="detalle-label">Hora</span>
              <span className="detalle-valor">{horaSeleccionada}</span>
            </div>
            <div className="detalle-fila">
              <span className="detalle-label">Precio</span>
              <span className="detalle-valor precio-final">{servicioInfo.precio}</span>
            </div>
          </div>
          <p className="confirmacion-sub">¡Hasta pronto!</p>
          <button className="btn-reservar" onClick={() => { setPaso(1); setHoraSeleccionada(null); setNombre(''); setTelefono(''); }}>
            Hacer otra reserva
          </button>
        </div>
      </div>
    );
  }

  if (paso === 2) {
    return (
      <div className="app">
        <header className="header">
          <h1>BSAPP</h1>
          <p>Reserva tu cita de la manera más sencilla</p>
        </header>
        <div className="seccion">
          <button className="btn-volver" onClick={() => setPaso(1)}>← Volver</button>
          <h3 style={{marginTop: '12px'}}>Resumen de tu reserva</h3>
          <div className="resumen">
            <div className="detalle-fila">
              <span className="detalle-label">Servicio</span>
              <span className="detalle-valor">{servicioSeleccionado}</span>
            </div>
            <div className="detalle-fila">
              <span className="detalle-label">Día</span>
              <span className="detalle-valor" style={{textTransform:'capitalize'}}>{diaSeleccionado}</span>
            </div>
            <div className="detalle-fila">
              <span className="detalle-label">Hora</span>
              <span className="detalle-valor">{horaSeleccionada}</span>
            </div>
            <div className="detalle-fila">
              <span className="detalle-label">Precio</span>
              <span className="detalle-valor precio-final">{servicioInfo.precio}</span>
            </div>
          </div>
        </div>
        <div className="seccion">
          <h3>Tus datos</h3>
          <div className="formulario">
            <div className="campo">
              <label>Nombre completo</label>
              <input
                type="text"
                placeholder="Ej: Carlos García"
                value={nombre}
                onChange={e => setNombre(e.target.value)}
                maxLength={30}
              />
            </div>
            <div className="campo">
              <label>Teléfono</label>
              <input
                type="tel"
                placeholder="Ej: 612345678"
                value={telefono}
                onChange={handleTelefono}
                maxLength={9}
                inputMode="numeric"
              />
            </div>
          </div>
          {error && <p style={{color: 'red', fontSize: '14px', marginTop: '10px'}}>{error}</p>}
          <button
            className={`btn-reservar ${(!nombre.trim() || telefono.length !== 9) ? 'deshabilitado' : ''}`}
            onClick={handleConfirmar}
            style={{marginTop: '20px'}}
            disabled={guardando}
          >
            {guardando ? 'Guardando...' : 'Confirmar reserva'}
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="app">
      <header className="header">
        <h1>BSAPP</h1>
        <p>Reserva tu cita de la manera más sencilla</p>
      </header>
      <div className="perfil">
        <div className="avatar">
          {barbero.avatar_url
            ? <img src={barbero.avatar_url} alt="avatar" style={{width:'60px',height:'60px',borderRadius:'50%',objectFit:'cover'}} />
            : (barbero.nombre ? barbero.nombre[0].toUpperCase() : 'B')
          }
        </div>
        <div className="perfil-info">
          <h2>{barbero.nombre || 'Cargando...'}</h2>
          <p>📍 {barbero.ciudad || ''}</p>
        </div>
        <button
          onClick={() => setMostrarCancelacion(true)}
          style={{
            marginLeft:'auto',padding:'8px 16px',borderRadius:'8px',
            border:'none',background:'#EF4444',color:'white',
            fontSize:'13px',fontWeight:'600',cursor:'pointer',whiteSpace:'nowrap'
          }}
        >
          Cancelar cita
        </button>
      </div>

      <div className="seccion">
        <h3>Elige tu servicio</h3>
        {servicios.length === 0 ? (
          <p style={{color:'#888',fontSize:'14px'}}>No hay servicios disponibles.</p>
        ) : (
          <div className="servicios">
            {servicios.map((s) => (
              <div
                key={s.id}
                className={`servicio ${servicioSeleccionado === s.nombre ? 'activo' : ''}`}
                onClick={() => setServicioSeleccionado(s.nombre)}
              >
                <div>
                  <p className="nombre">{s.nombre}</p>
                  <p className="duracion">⏱ {s.duracionTexto}</p>
                </div>
                <p className="precio">{s.precio}</p>
              </div>
            ))}
          </div>
        )}
      </div>

      <div className="seccion">
        <h3>Elige el día</h3>
        {diasDisponibles.length === 0 ? (
          <p style={{color:'#888',fontSize:'14px'}}>No hay días disponibles por el momento.</p>
        ) : (
          <div className="dias">
            {diasDisponibles.map((dia) => {
              const fecha = obtenerFecha(dia);
              const numero = fecha.getDate();
              const nombreCorto = dia.slice(0, 3);
              return (
                <div
                  key={dia}
                  className={`dia ${diaSeleccionado === dia ? 'activo' : ''}`}
                  onClick={() => setDiaSeleccionado(dia)}
                >
                  <p className="dia-nombre">{nombreCorto}</p>
                  <p className="dia-numero">{numero}</p>
                </div>
              );
            })}
          </div>
        )}
      </div>

      <div className="seccion">
        <h3>Elige la hora</h3>
        {horas.length === 0 ? (
          <p style={{color:'#888',fontSize:'14px'}}>Selecciona un día para ver las horas disponibles.</p>
        ) : (
          <div className="horas">
            {horas.map((h) => (
              <div
                key={h.hora}
                className={`hora ${horaSeleccionada === h.hora ? 'activo' : ''} ${h.ocupada ? 'ocupada' : ''}`}
                onClick={() => !h.ocupada && setHoraSeleccionada(h.hora)}
              >
                {h.hora}
              </div>
            ))}
          </div>
        )}
      </div>

      <div className="seccion">
        <button
          className={`btn-reservar ${!horaSeleccionada ? 'deshabilitado' : ''}`}
          onClick={handleSiguiente}
        >
          {horaSeleccionada
            ? `Continuar · ${servicioSeleccionado} · ${horaSeleccionada}`
            : 'Selecciona una hora para continuar'}
        </button>
      </div>
    </div>
  );
}

export default ClienteApp;