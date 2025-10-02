import { google } from 'googleapis';

// 환경변수에서 서비스 계정 인증
async function getAuth() {
  const credentials = JSON.parse(process.env.GOOGLE_SERVICE_ACCOUNT);
  const scopes = ['https://www.googleapis.com/auth/spreadsheets'];
  return new google.auth.GoogleAuth({ credentials, scopes });
}

// 스프레드시트 ID
const SPREADSHEET_ID = '1J7eKTtYFJG79LGIBB60o1FFcZvdQpo3e8WnvZ-iz8Rk';

export default async function handler(req, res) {
  try {
    const auth = await getAuth();
    const sheets = google.sheets({ version: 'v4', auth });

    const mode = req.query.mode || 'reservations';

    // 1. 예약 목록
    if (mode === 'reservations') {
      const range = 'Reservations!A2:G';
      const response = await sheets.spreadsheets.values.get({
        spreadsheetId: SPREADSHEET_ID,
        range,
      });
      const reservations = response.data.values || [];
      return res.status(200).json({ reservations });
    }

    // 2. 강의실 목록
    if (mode === 'rooms') {
      const range = 'Rooms!A2:A';
      const response = await sheets.spreadsheets.values.get({
        spreadsheetId: SPREADSHEET_ID,
        range,
      });
      const rooms = (response.data.values || []).flat().filter(Boolean);
      return res.status(200).json({ rooms });
    }

    // 3. 슬롯 목록
    if (mode === 'slots') {
      const range = 'Slots!A2:B';
      const response = await sheets.spreadsheets.values.get({
        spreadsheetId: SPREADSHEET_ID,
        range,
      });
      const rows = response.data.values || [];
      const slots = rows
        .filter(r => r[0] && r[1])
        .map(r => ({ start: r[0], end: r[1] }));
      return res.status(200).json({ slots });
    }

    return res.status(400).json({ error: 'Invalid mode specified.' });

  } catch (error) {
    console.error('[API ERROR]', error);
    return res.status(500).json({ error: 'Internal Server Error', details: error.message });
  }
}
