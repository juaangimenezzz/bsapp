const { google } = require('googleapis');

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  try {
    const { calendarId, fecha, hora, clienteNombre, servicio, duracion } = req.body;

    const serviceAccount = JSON.parse(process.env.GOOGLE_SERVICE_ACCOUNT);

    const auth = new google.auth.GoogleAuth({
      credentials: serviceAccount,
      scopes: ['https://www.googleapis.com/auth/calendar'],
    });

    const calendar = google.calendar({ version: 'v3', auth });

    const [horas, minutos] = hora.split(':').map(Number);
    const inicioStr = `${fecha}T${String(horas).padStart(2,'0')}:${String(minutos).padStart(2,'0')}:00`;
    
    const inicioDate = new Date(`${inicioStr}+02:00`);
    const finDate = new Date(inicioDate.getTime() + duracion * 60000);

    await calendar.events.insert({
      calendarId: calendarId,
      requestBody: {
        summary: `${servicio} - ${clienteNombre}`,
        description: `Reserva de ${clienteNombre} para ${servicio}`,
        start: { dateTime: inicioStr, timeZone: 'Europe/Madrid' },
        end: { dateTime: `${fecha}T${String(horas + Math.floor((minutos + duracion) / 60)).padStart(2,'0')}:${String((minutos + duracion) % 60).padStart(2,'0')}:00`, timeZone: 'Europe/Madrid' },
      },
    });

    return res.status(200).json({ ok: true });
  } catch (error) {
    console.error('Error creando evento:', error);
    return res.status(500).json({ error: error.message });
  }
}