import { google } from 'googleapis';
import { promises as fs } from 'fs';
import path from 'path';

// 환경변수로부터 서비스 계정 정보 로드
async function getAuth() {
  const credentials = JSON.parse(process.env.GOOGLE_SERVICE_ACCOUNT);
  const scopes = ['https://www.googleapis.com/auth/spreadsheets'];
  return new google.auth.GoogleAuth({
    credentials,
    scopes,
  });
}

// 스프레드시트 ID (공유된 시트의 ID로 교체 필요)
const SPREADSHEET_ID = '여기에_스프레드시트_ID_입력';

export default async function handler(req, res) {
  try {
    const auth = await getAuth();
    const sheets = google.sheets({ version: 'v4', auth });

    const mode = req.query.mode || 'reservations';

    // 1. 전체 예약 데이터 가져오기
    if (mode === 'reservations') {
      const range = 'Reservations!A2:G'; // 헤더 제외
      const response = await sheets.spreadsheets.values.get({
        spreadsheetId: SPREADSHEET_ID,
        range,
      });
      const reservations = response.data.values || [];
      return res.status(200).json({ reservations });
    }

    // 2. 강의실 목록 가져오기
    if (mode === 'rooms') {
      const range = 'Rooms!A2:A';
      const response = await sheets.spreadsheets.values.get({
        spreadsheetId: SPREADSHEET_ID,
        range,
      });
      const rooms = (response.data.values || []).flat().filter(Boolean);
      return res.status(200).json({ rooms });
    }

    // ⏳ 앞으로 여기에 slots, schedule, reserve, cancel 등의 처리 추가 예정

    // 알 수 없는 mode
    return res.status(400).json({ error: 'Invalid mode specified.' });

  } catch (error) {
    console.error('[API ERROR]', error);
    return res.status(500).json({ error: 'Internal Server Error', details: error.message });
  }
}
