import { google } from 'googleapis';

async function getAuth() {
  const credentials = JSON.parse(process.env.GOOGLE_SERVICE_ACCOUNT);
  const scopes = ['https://www.googleapis.com/auth/spreadsheets'];
  return new google.auth.GoogleAuth({ credentials, scopes });
}

const SPREADSHEET_ID = '1J7eKTtYFJG79LGIBB60o1FFcZvdQpo3e8WnvZ-iz8Rk';

export default async function handler(req, res) {
  try {
    const auth = await getAuth();
    const sheets = google.sheets({ version: 'v4', auth });

    const mode = req.query.mode || 'reservations';

    // 1. 예약 목록 전체 조회
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

    // 4. 특정 날짜+강의실 예약 현황
    if (mode === 'schedule') {
      const date = req.query.date;
      const room = req.query.room;

      if (!date || !room) {
        return res.status(400).json({ error: 'Missing date or room' });
      }

      // 슬롯 목록 불러오기
      const slotRange = 'Slots!A2:B';
      const slotRes = await sheets.spreadsheets.values.get({
        spreadsheetId: SPREADSHEET_ID,
        range: slotRange,
      });
      const slotRows = slotRes.data.values || [];
      const slots = slotRows
        .filter(r => r[0] && r[1])
        .map(r => ({ start: r[0], end: r[1] }));

      // 예약 목록 불러오기
      const resvRange = 'Reservations!A2:G';
      const resvRes = await sheets.spreadsheets.values.get({
        spreadsheetId: SPREADSHEET_ID,
        range: resvRange,
      });
      const reservations = resvRes.data.values || [];

      // 필터링: 날짜 + 강의실
      const matching = reservations.filter(r => r[1] === date && r[2] === room);

      // 슬롯별로 예약 유무 확인
      const schedule = slots.map(slot => {
        const reserved = matching.some(r =>
          r[3] === slot.start && r[4] === slot.end
        );
        return { ...slot, reserved };
      });

      return res.status(200).json({ schedule });
    }

    return res.status(400).json({ error: 'Invalid mode specified.' });

  } catch (error) {
    console.error('[API ERROR]', error);
    return res.status(500).json({ error: 'Internal Server Error', details: error.message });
  }
}
