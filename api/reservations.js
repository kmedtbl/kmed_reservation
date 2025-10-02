import { google } from 'googleapis';

const SCOPES = ['https://www.googleapis.com/auth/spreadsheets'];
const SPREADSHEET_ID = '1J7eKTtYFJG79LGIBB60o1FFcZvdQpo3e8WnvZ-iz8Rk';

export default async function handler(req, res) {
  try {
    const serviceAccount = JSON.parse(process.env.GOOGLE_SERVICE_ACCOUNT || '{}');
    const auth = new google.auth.GoogleAuth({
      credentials: serviceAccount,
      scopes: SCOPES,
    });

    const sheets = google.sheets({ version: 'v4', auth });

    // GET 요청 처리
    if (req.method === 'GET') {
      const { mode, date, room } = req.query;

      // 전체 예약 조회
      if (!mode || mode === 'reservations') {
        const result = await sheets.spreadsheets.values.get({
          spreadsheetId: SPREADSHEET_ID,
          range: 'Reservations!A2:G',
        });
        return res.status(200).json({ reservations: result.data.values || [] });
      }

      // 강의실 목록 조회
      if (mode === 'rooms') {
        const result = await sheets.spreadsheets.values.get({
          spreadsheetId: SPREADSHEET_ID,
          range: 'Rooms!A2:A',
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
        const slots = result.data.values || [];
        return res.status(200).json({ slots });
      }

      // 특정 날짜/강의실의 예약 현황 조회
      if (mode === 'schedule') {
        if (!date || !room) {
          return res.status(400).json({ error: 'Missing date or room parameter.' });
        }

        const result = await sheets.spreadsheets.values.get({
          spreadsheetId: SPREADSHEET_ID,
          range: 'Reservations!A2:G',
        });
        const reservations = result.data.values || [];
        const filtered = reservations.filter(row =>
          row[1] === date && row[2] === room
        );
        return res.status(200).json({ reservations: filtered });
      }

      // 알 수 없는 모드
      return res.status(400).json({ error: 'Invalid mode parameter.' });
    }

    // 예약 추가 (POST)
    if (req.method === 'POST') {
      const { date, room, start, end, by, note } = req.body || {};

      if (!date || !room || !start || !end || !by) {
        return res.status(400).json({ error: 'Missing required fields.' });
      }

      // 기존 예약 목록 가져오기
      const resvRes = await sheets.spreadsheets.values.get({
        spreadsheetId: SPREADSHEET_ID,
        range: 'Reservations!A2:G',
      });
      const reservations = resvRes.data.values || [];

      // ID는 마지막 ID + 1
      const lastId = reservations.length > 0 ? parseInt(reservations[reservations.length - 1][0]) : 0;
      const newId = lastId + 1;

      // 추가할 행 구성
      const newRow = [
        newId.toString(),
        date,
        room,
        start,
        end,
        by,
        note || ''
      ];

      await sheets.spreadsheets.values.append({
        spreadsheetId: SPREADSHEET_ID,
        range: 'Reservations!A2:G',
        valueInputOption: 'RAW',
        insertDataOption: 'INSERT_ROWS',
        requestBody: { values: [newRow] }
      });

      return res.status(200).json({ success: true, message: 'Reservation added.' });
    }

    // 지원하지 않는 메서드
    return res.status(405).json({ error: 'Method Not Allowed' });
  } catch (error) {
    console.error('API Error:', error);
    return res.status(500).json({ error: 'Internal Server Error', details: error.message });
  }
}
