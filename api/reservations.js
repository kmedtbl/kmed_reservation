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
      if (!mode || mode === 'reservations') {
        const result = await sheets.spreadsheets.values.get({
          spreadsheetId: SPREADSHEET_ID,
          range: 'Reservations!A2:G',
        });
        return res.status(200).json({ reservations: result.data.values || [] });
      }

      if (mode === 'rooms') {
        const result = await sheets.spreadsheets.values.get({
          spreadsheetId: SPREADSHEET_ID,
          range: 'Rooms!A2:A',
        });
        const rooms = result.data.values?.flat() || [];
        return res.status(200).json({ rooms });
      }

      if (mode === 'slots') {
        const result = await sheets.spreadsheets.values.get({
          spreadsheetId: SPREADSHEET_ID,
          range: 'Slots!A2:B',
        });
        return res.status(200).json({ slots: result.data.values || [] });
      }

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
      if (!date || !room || !start || !end || !by || !note) {
        return res.status(400).json({ error: 'Missing required fields.' });
      }

      const resvRes = await sheets.spreadsheets.values.get({
        spreadsheetId: SPREADSHEET_ID,
        range: 'Reservations!A2:G',
      });
      const reservations = resvRes.data.values || [];
      const lastId = reservations.length > 0 ? parseInt(reservations[reservations.length - 1][0]) : 0;
      const newId = lastId + 1;

      // ✅ G열 값은 공백으로, note는 아래에서 설정
      const newRow = [newId.toString(), date, room, start, end, by, ''];

      await sheets.spreadsheets.values.append({
        spreadsheetId: SPREADSHEET_ID,
        range: 'Reservations!A2:G',
        valueInputOption: 'RAW',
        insertDataOption: 'INSERT_ROWS',
        requestBody: { values: [newRow] }
      });

      // ✅ G열 note에만 note 저장 (값은 그대로 두고 note만 설정)
      const lastRow = reservations.length + 2; // header 제외 + 1-based
      await sheets.spreadsheets.batchUpdate({
        spreadsheetId: SPREADSHEET_ID,
        requestBody: {
          requests: [{
            updateCells: {
              range: {
                sheetId: 0, // ⚠️ Reservations 시트의 실제 sheetId로 교체 필요
                startRowIndex: lastRow - 1,
                endRowIndex: lastRow,
                startColumnIndex: 6,
                endColumnIndex: 7
              },
              rows: [{
                values: [{
                  note: note
                }]
              }],
              fields: 'note'
            }
          }]
        }
      });

      return res.status(200).json({ success: true, message: 'Reservation added.' });
    }

    return res.status(405).json({ error: 'Method Not Allowed' });

  } catch (error) {
    console.error('API Error:', error);
    return res.status(500).json({ error: 'Internal Server Error', details: error.message });
  }
}
