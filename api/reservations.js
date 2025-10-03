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
      const newRow = [newId.toString(), date, room, start, end, by, note];

      await sheets.spreadsheets.values.append({
        spreadsheetId: SPREADSHEET_ID,
        range: 'Reservations!A2:G',
        valueInputOption: 'RAW',
        insertDataOption: 'INSERT_ROWS',
        requestBody: { values: [newRow] }
      });

      // ✅ G열 note에만 note 저장 (값은 그대로 두고 note만 설정)
      const lastRow = reservations.length + 2; // header 제외 + 1-based
      

      return res.status(200).json({ success: true, message: 'Reservation added.' });
    }

  // ✅ POST 요청 - 예약 삭제
  if (method === 'POST' && body.mode === 'delete') {
  const { date, room, start, end, by, note } = body || {};
  if (!date || !room || !start || !end || !by || !note) {
    return res.status(400).json({ error: 'Missing required fields for delete.' });
  }

  // 현재 데이터 불러오기
  const resvRes = await sheets.spreadsheets.values.get({
    spreadsheetId: SPREADSHEET_ID,
    range: 'Reservations!A2:G',
  });
  const reservations = resvRes.data.values || [];

  // 삭제할 행 찾기
  const targetIndex = reservations.findIndex(r =>
    r[1] === date && r[2] === room && r[3] === start && r[4] === end && r[5] === by && r[6] === note
  );

  if (targetIndex === -1) {
    return res.status(404).json({ error: 'Reservation not found.' });
  }

  // 실제 행 번호 (A2부터 시작했으므로 +2)
  const rowNumber = targetIndex + 2;

  // 행 삭제 요청
  await sheets.spreadsheets.batchUpdate({
    spreadsheetId: SPREADSHEET_ID,
    requestBody: {
      requests: [{
        deleteDimension: {
          range: {
            sheetId: 0, // ⚠️ Reservations 시트의 실제 sheetId 필요
            dimension: 'ROWS',
            startIndex: rowNumber - 1,
            endIndex: rowNumber
          }
        }
      }]
    }
  });

  return res.status(200).json({ success: true, message: 'Reservation deleted.' });
}

    
    return res.status(405).json({ error: 'Method Not Allowed' });

  } catch (error) {
    console.error('API Error:', error);
    return res.status(500).json({ error: 'Internal Server Error', details: error.message });
  }
}
