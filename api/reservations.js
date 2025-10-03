import { google } from 'googleapis';

const SCOPES = ['https://www.googleapis.com/auth/spreadsheets'];
const SPREADSHEET_ID = '1J7eKTtYFJG79LGIBB60o1FFcZvdQpo3e8WnvZ-iz8Rk';
const ADMIN_PIN = '1030'; // ✅ 관리자 PIN 하드코딩

export default async function handler(req, res) {
  // CORS
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET,POST,OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

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

    // ---------- GET ----------
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

    // ---------- POST ----------
    if (method === 'POST') {
      // ✅ PIN 체크: 모든 POST 요청에 공통 적용
      if (body?.pin !== ADMIN_PIN) {
        return res.status(403).json({ error: 'Invalid PIN' });
      }
      
      // 1) 삭제
      if (body?.mode === 'delete') {
        const { id, date, room, start, end, by, note } = body || {};

        // id 있으면 id로 1차 삭제(가장 안전)
        const spreadsheetMeta = await sheets.spreadsheets.get({ spreadsheetId: SPREADSHEET_ID });
        const reservationsSheet = spreadsheetMeta.data.sheets?.find(s => s.properties?.title === 'Reservations');
        const sheetId = reservationsSheet?.properties?.sheetId;
        if (sheetId == null) {
          return res.status(500).json({ error: 'Reservations sheetId not found.' });
        }

        // 먼저 전체 행 로드
        const resvRes = await sheets.spreadsheets.values.get({
          spreadsheetId: SPREADSHEET_ID,
          range: 'Reservations!A2:G',
        });
        const rows = resvRes.data.values || [];

        let targetIndex = -1;

        if (id != null && id !== '') {
          // A열(id)만 빠르게 확인
          targetIndex = rows.findIndex(r => (r[0] || '').toString() === id.toString());
        }

        if (targetIndex === -1) {
          // id 매칭 실패 시, 전체 필드 매칭으로 보조 탐색
          targetIndex = rows.findIndex(r =>
            (r[1] === date) &&
            (r[2] === room) &&
            (r[3] === start) &&
            (r[4] === end) &&
            (r[5] === by) &&
            (r[6] === note)
          );
        }

        if (targetIndex === -1) {
          return res.status(404).json({ error: 'Reservation not found.' });
        }

        // A2가 실제 2행이므로 +2
        const rowNumber = targetIndex + 2;

        await sheets.spreadsheets.batchUpdate({
          spreadsheetId: SPREADSHEET_ID,
          requestBody: {
            requests: [{
              deleteDimension: {
                range: {
                  sheetId,
                  dimension: 'ROWS',
                  startIndex: rowNumber - 1, // 0-based
                  endIndex: rowNumber       // exclusive
                }
              }
            }]
          }
        });

        return res.status(200).json({ success: true, message: 'Reservation deleted.' });
      }

      // 2) 추가
      const { date, room, start, end, by, note } = body || {};
      if (!date || !room || !start || !end || !by || !note) {
        return res.status(400).json({ error: 'Missing required fields.' });
      }

      const resvRes = await sheets.spreadsheets.values.get({
        spreadsheetId: SPREADSHEET_ID,
        range: 'Reservations!A2:G',
      });
      const reservations = resvRes.data.values || [];
      let lastId = 0;
for (let i = reservations.length - 1; i >= 0; i--) {
  const id = parseInt(reservations[i][0]);
  if (Number.isFinite(id)) {
    lastId = id;
    break;
  }
}
const newId = lastId + 1;

      const newRow = [newId.toString(), date, room, start, end, by, note];

      await sheets.spreadsheets.values.append({
        spreadsheetId: SPREADSHEET_ID,
        range: 'Reservations!A2:G',
        valueInputOption: 'RAW',
        insertDataOption: 'INSERT_ROWS',
        requestBody: { values: [newRow] }
      });

      return res.status(200).json({ success: true, message: 'Reservation added.' });
    }

    return res.status(405).json({ error: 'Method Not Allowed' });

  } catch (error) {
    console.error('API Error:', error);
    return res.status(500).json({ error: 'Internal Server Error', details: error.message });
  }
}
