const { google } = require('googleapis');

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  try {
    const { calendarId, fecha, hora, clienteNombre } = req.body;

    const serviceAccount = JSON.parse(process.env.GOOGLE_SERVICE_ACCOUNT);

    const auth = new google.auth.GoogleAuth({
      credentials: serviceAccount,
      scopes: ['https://www.googleapis.com/auth/calendar'],
    });

    const calendar = google.calendar({ version: 'v3', auth });

    // Buscar el evento por fecha y hora
    const inicioStr = `${fecha}T${hora}:00`;
    const finStr = `${fecha}T${hora}:59`;

    const eventos = await calendar.events.list({
      calendarId,
      timeMin: `${inicioStr}+02:00`,
      timeMax: `${finStr}+02:00`,
      q: clienteNombre,
      singleEvents: true,
    });

    if (eventos.data.items && eventos.data.items.length > 0) {
      const eventoId = eventos.data.items[0].id;
      await calendar.events.delete({
        calendarId,
        eventId: eventoId,
      });
    }

    return res.status(200).json({ ok: true });
  } catch (error) {
    console.error('Error eliminando evento:', error);
    return res.status(500).json({ error: error.message });
  }
}