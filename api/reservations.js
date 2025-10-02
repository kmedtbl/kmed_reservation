import { google } from 'googleapis';

export default async function handler(req, res) {
  // 서비스 계정 인증 준비
  const auth = new google.auth.GoogleAuth({
    credentials: JSON.parse(process.env.GOOGLE_SERVICE_ACCOUNT),
    scopes: ['https://www.googleapis.com/auth/spreadsheets'],
  });

  const sheets = google.sheets({ version: 'v4', auth });
  const spreadsheetId = process.env.SHEET_ID;

  if (req.method === 'GET') {
    // GET 요청: 예약 목록 조회
    try {
      const response = await sheets.spreadsheets.values.get({
        spreadsheetId,
        range: 'Reservations!A2:F', // A열~F열까지 조회 (제목 제외)
      });

      const rows = response.data.values || [];
      res.status(200).json(rows);
    } catch (error) {
      res.status(500).json({ error: error.message });
    }
  }

  else if (req.method === 'POST') {
    // POST 요청: 예약 추가
    const { date, room, slot, name, purpose, pin } = req.body;

    if (!date || !room || !slot || !name || !purpose || !pin) {
      return res.status(400).json({ error: 'Missing fields' });
    }

    // 간단한 관리자 인증 (PIN 체크)
    if (pin !== process.env.ADMIN_PIN) {
      return res.status(403).json({ error: 'Invalid PIN' });
    }

    try {
      await sheets.spreadsheets.values.append({
        spreadsheetId,
        range: 'Reservations!A2:F',
        valueInputOption: 'USER_ENTERED',
        requestBody: {
          values: [[date, room, slot, name, purpose, new Date().toISOString()]],
        },
      });

      res.status(200).json({ message: 'Reservation added' });
    } catch (error) {
      res.status(500).json({ error: error.message });
    }
  }

  else {
    // 허용되지 않은 메서드
    res.status(405).json({ error: 'Method not allowed' });
  }
}
