import { google } from 'googleapis';

const SCOPES = ['https://www.googleapis.com/auth/spreadsheets'];
const SPREADSHEET_ID = '1J7eKTtYFJG79LGIBB60o1FFcZvdQpo3e8WnvZ-iz8Rk';

export default async function handler(req, res) {
  // ✅ CORS 설정
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET,POST,OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

  // ✅ Preflight 처리
  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }

  try {
    const serviceAccount = JSON.parse(process.env.GOOGLE_SERVICE_ACCOUNT || '{}');
    const auth = new google.auth.GoogleAuth({
      credentials: serviceAccount,
      scopes: SCOPES,
    });

    const sheets = google.sheets({ version: 'v4', auth });

    const { method, query, body } = req;
    const { mode, date, room } = query;

    // ✅ GET 요청
    if (method === 'GET') {
      // 전체 예약 조회
      if (!mode || mode === 'reservations') {
        const result = await sheets.spreadsheets.values.get({
          spreadsheetId: SPREADSHEET_ID,
          range: 'Reservations!A2:G',
        });
        return res.status(200).json({ reservations: result.data.values || [] });
      }

      // ✅ 강의실 목록 조회 - 한 열짜리 구조 대응
      if (mode === 'rooms') {
        const result = await sheets.spreadsheets.values.get({
          spreadsheetId: SPREADSHEET_ID,
          range: 'Rooms!A2:A', // A열만 가져옴
        });
        const rooms = result.data.values?.flat() || [];
        return res.status(200).json({ rooms });
      }

      // 시간 구간 목록 조회
      if (mode === 'slots') {
        const result = await sheets.spreadsheets.values.get({
          spreadsheetId: SPREADSHEET_ID,
          range: 'Slots!A2:B',
        });
        return res.status(200).json({ slots: result.data.values || [] });
      }

      // 특정 날짜/강의실 예약 현황 조회
      if (mode === 'schedule') {
        if (!date || !room) {
          return res.status(400).json({ error: 'Missing date or room parameter.' });
        }

        const result = await sheets.spreadsheets.values.get({
          spreadsheetId: SPREADSHEET_ID,
          range: 'Reservations!A2:G',
        });
        const filtered = (result.data.values || []).filter(row => row[1] === date && row[2] === room);
        return res.status(200).json({ reservations: filtered });
      }

      return res.status(400).json({ error: 'Invalid mode parameter.' });
    }

    // ✅ POST 요청 - 예약 추가
    if (method === 'POST') {
      const { date, room, start, end, by, note } = body || {};
      if (!date || !room || !start || !end || !by || !title) {
        return res.status(400).json({ error: 'Missing required fields.' });
      }

      const resvRes = await sheets.spreadsheets.values.get({
        spreadsheetId: SPREADSHEET_ID,
        range: 'Reservations!A2:G',
      });
      const reservations = resvRes.data.values || [];
      const lastId = reservations.length > 0 ? parseInt(reservations[reservations.length - 1][0]) : 0;
      const newId = lastId + 1;

      const newRow = [newId.toString(), date, room, start, end, by, note || ''];

      await sheets.spreadsheets.values.append({
        spreadsheetId: SPREADSHEET_ID,
        range: 'Reservations!A2:G',
        valueInputOption: 'RAW',
        insertDataOption: 'INSERT_ROWS',
        requestBody: { values: [newRow] }
      });

      return res.status(200).json({ success: true, message: 'Reservation added.' });
    }

    // 허용되지 않은 메서드
    return res.status(405).json({ error: 'Method Not Allowed' });

  } catch (error) {
    console.error('API Error:', error);
    return res.status(500).json({ error: 'Internal Server Error', details: error.message });
  }
}
