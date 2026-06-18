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
    const inicio = new Date(`${fecha}T${hora}:00`);
    const fin = new Date(inicio.getTime() + duracion * 60000);

    const formatear = (date) => date.toISOString();

    await calendar.events.insert({
      calendarId: calendarId,
      requestBody: {
        summary: `${servicio} - ${clienteNombre}`,
        description: `Reserva de ${clienteNombre} para ${servicio}`,
        start: { dateTime: formatear(inicio), timeZone: 'Europe/Madrid' },
        end: { dateTime: formatear(fin), timeZone: 'Europe/Madrid' },
      },
    });

    return res.status(200).json({ ok: true });
  } catch (error) {
    console.error('Error creando evento:', error);
    return res.status(500).json({ error: error.message });
  }
}