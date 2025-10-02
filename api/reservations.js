export default async function handler(req, res) {
  try {
    const { GOOGLE_SERVICE_ACCOUNT, SHEET_ID, ADMIN_PIN } = process.env;

    if (!GOOGLE_SERVICE_ACCOUNT || !SHEET_ID) {
      return res.status(500).json({ error: "Missing environment variables" });
    }

    const creds = JSON.parse(GOOGLE_SERVICE_ACCOUNT);
    const { google } = await import('googleapis');

    const auth = new google.auth.GoogleAuth({
      credentials: creds,
      scopes: ['https://www.googleapis.com/auth/spreadsheets'],
    });

    const sheets = google.sheets({ version: 'v4', auth });

    if (req.method === 'GET') {
      const response = await sheets.spreadsheets.values.get({
        spreadsheetId: SHEET_ID,
        range: 'Reservations!A2:F',
      });

      const rows = response.data.values || [];
      return res.status(200).json({ reservations: rows });
    }

    if (req.method === 'POST') {
      const { date, room, slot, name, purpose, pin } = req.body;

      if (pin !== ADMIN_PIN) {
        return res.status(401).json({ error: "Invalid PIN" });
      }

      const newRow = [date, room, slot, name, purpose, new Date().toISOString()];
      await sheets.spreadsheets.values.append({
        spreadsheetId: SHEET_ID,
        range: 'Reservations!A2',
        valueInputOption: 'RAW',
        insertDataOption: 'INSERT_ROWS',
        requestBody: {
          values: [newRow],
        },
      });

      return res.status(200).json({ message: 'Reservation added' });
    }

    return res.status(405).json({ error: "Method not allowed" });

  } catch (err) {
    console.error("🔥 Error occurred:", err); // 꼭 필요
    return res.status(500).json({ error: err.message });
  }
}
