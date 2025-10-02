import { google } from 'googleapis';

export default async function handler(req, res) {
  const SCOPES = ['https://www.googleapis.com/auth/spreadsheets'];
  const sheetId = '👉 여기에 구글시트 ID 입력';

  // 환경변수에서 서비스 계정 정보 불러오기
  const serviceAccount = JSON.parse(process.env.GOOGLE_SERVICE_ACCOUNT);

  // JWT 인증 객체 생성
  const auth = new google.auth.JWT(
    serviceAccount.client_email,
    null,
    serviceAccount.private_key,
    SCOPES
  );

  // Google Sheets API 클라이언트 생성
  const sheets = google.sheets({ version: 'v4', auth });

  if (req.method === 'GET') {
    try {
      // 예약 시트에서 A2:F 범위의 데이터 가져오기
      const response = await sheets.spreadsheets.values.get({
        spreadsheetId: sheetId,
        range: 'Reservations!A2:F',
      });
      res.status(200).json(response.data.values || []);
    } catch (error) {
      res.status(500).json({ error: error.message });
    }
  }

  else if (req.method === 'POST') {
    try {
      const { date, room, start, end, by, note } = req.body;
      const values = [[date, room, start, end, by, note]];

      await sheets.spreadsheets.values.append({
        spreadsheetId: sheetId,
        range: 'Reservations!A2:F',
        valueInputOption: 'RAW',
        insertDataOption: 'INSERT_ROWS',
        requestBody: { values },
      });

      res.status(201).json({ message: '예약이 등록되었습니다.' });
    } catch (error) {
      res.status(500).json({ error: error.message });
    }
  }

  else {
    res.status(405).send('Method Not Allowed');
  }
}
