/** ====== CONFIG ====== */
const CONFIG = {
  SHEET_ID: '스프레드시트_ID_여기에',         // 필수: 대상 구글시트 ID
  ROOMS_SHEET: 'Rooms',                         // 강의실 목록 시트명
  RESV_SHEET: 'Reservations',                   // 예약 시트명
  SLOTS_SHEET: 'Slots',                         // 시간 프리셋 시트명
  ADMIN_PIN_HASH: 'bcrypt_or_plain_pin_hash',   // 관리자 PIN 해시(간이 예시, 실제는 해시권장)
  HMAC_SECRET: 'long_random_secret',            // 토큰 서명용 시크릿
  CORS_ORIGIN: 'https://<your-username>.github.io', // GitHub Pages 도메인(필수)
  CACHE_TTL: 60,                                // 초단위, 조회 캐시 TTL
  TZ: 'Asia/Seoul'
};

/** ====== 유틸 ====== */
const j = (o, code=200, headers={}) => {
  headers['Content-Type'] = 'application/json; charset=utf-8';
  headers['Access-Control-Allow-Origin'] = CONFIG.CORS_ORIGIN;
  headers['Vary'] = 'Origin';
  return ContentService.createTextOutput(JSON.stringify(o))
    .setMimeType(ContentService.MimeType.JSON)
    .setHeaders(headers)
    .setStatusCode(code);
};
const txt = (s, code=200, headers={}) => {
  headers['Access-Control-Allow-Origin'] = CONFIG.CORS_ORIGIN;
  headers['Content-Type'] = 'text/plain; charset=utf-8';
  return ContentService.createTextOutput(s).setMimeType(ContentService.MimeType.TEXT).setHeaders(headers).setStatusCode(code);
};
const nowISO = () => Utilities.formatDate(new Date(), CONFIG.TZ, "yyyy-MM-dd'T'HH:mm:ssXXX");
const cache = () => CacheService.getScriptCache();
const ss = () => SpreadsheetApp.openById(CONFIG.SHEET_ID);

function allowHeaders() {
  return {
    'Access-Control-Allow-Origin': CONFIG.CORS_ORIGIN,
    'Access-Control-Allow-Methods': 'GET,POST,PATCH,DELETE,OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type,Authorization,If-None-Match'
  };
}

/** ====== 라우터 ====== */
function doOptions(e) {
  return txt('', 204, allowHeaders());
}
function doGet(e) {
  try {
    const path = (e?.parameter?.path || (e?.pathInfo || '')).replace(/^\/+/, '');
    const params = e?.parameter || {};
    if (path === 'api/health') return j({ ok:true, time: nowISO() });

    if (path === 'api/rooms')               return handleGetRooms();
    if (path === 'api/slots')               return handleGetSlots(params);
    if (path === 'api/timetable')           return handleGetTimetable(params);

    return j({ error: 'Not Found' }, 404);
  } catch (err) {
    return j({ error: String(err) }, 500);
  }
}
function doPost(e) {
  if (e?.parameter?.path === 'api/admin/login') return handleAdminLogin(e);
  // JSON 본문
  const body = parseBody(e);
  const path = (e?.parameter?.path || '').replace(/^\/+/, '');
  if (path === 'api/reservations') return handleCreateReservation(body, e);
  return j({ error: 'Not Found' }, 404);
}
function doPatch(e) {
  const body = parseBody(e);
  const path = (e?.parameter?.path || '').replace(/^\/+/, '');
  const id = e?.parameter?.id;
  if (path === 'api/reservations' && id) return handleUpdateReservation(id, body, e);
  return j({ error: 'Not Found' }, 404);
}
function doDelete(e) {
  const path = (e?.parameter?.path || '').replace(/^\/+/, '');
  const id = e?.parameter?.id;
  if (path === 'api/reservations' && id) return handleDeleteReservation(id, e);
  return j({ error: 'Not Found' }, 404);
}

/** ====== 본문 파서 ====== */
function parseBody(e) {
  try {
    return e?.postData?.type?.includes('application/json')
      ? JSON.parse(e.postData.contents || '{}')
      : {};
  } catch (_) { return {}; }
}

/** ====== 인증/권한 ====== */
function verifyBearer(e) {
  const auth = e?.headers?.Authorization || e?.parameter?.Authorization || '';
  if (!auth.startsWith('Bearer ')) return null;
  const token = auth.slice(7);
  // 간이 검증: 토큰이 HMAC 서명 포함한 JSON이라고 가정
  try {
    const payload = JSON.parse(Utilities.newBlob(Utilities.base64Decode(token)).getDataAsString());
    const sig = payload.sig; delete payload.sig;
    const check = makeHmac(JSON.stringify(payload));
    if (Utilities.base64Encode(check) !== sig) return null;
    if (payload.exp && Date.now() > payload.exp) return null;
    return payload; // { role:'admin', iat, exp }
  } catch (e2) {
    return null;
  }
}
function makeHmac(str) {
  return Utilities.computeHmacSha256Signature(str, CONFIG.HMAC_SECRET);
}
function pinOk(pinPlain) {
  // 데모: 평문 비교. 실제는 해시(BCrypt 등) 비교 권장
  return pinPlain && pinPlain === CONFIG.ADMIN_PIN_HASH;
}

/** ====== 시트 래퍼 ====== */
function getRooms() {
  const sh = ss().getSheetByName(CONFIG.ROOMS_SHEET);
  const data = sh.getDataRange().getValues();
  const header = data.shift();
  const idxName = header.indexOf('room');
  return data.filter(r => r[idxName]).map(r => ({ room: r[idxName] }));
}
function getSlotsByDate(dateISO) {
  // SLOTS 시트: start, end 컬럼 가정(고정 프리셋이면 date 무시 가능)
  const sh = ss().getSheetByName(CONFIG.SLOTS_SHEET);
  const data = sh.getDataRange().getValues();
  const header = data.shift();
  const iStart = header.indexOf('start');
  const iEnd   = header.indexOf('end');
  return data.filter(r => r[iStart] && r[iEnd]).map(r => ({ start: r[iStart], end: r[iEnd] }));
}
function getReservations(dateISO, room) {
  const sh = ss().getSheetByName(CONFIG.RESV_SHEET);
  const data = sh.getDataRange().getValues();
  const header = data.shift();
  const iId    = header.indexOf('id');
  const iDate  = header.indexOf('date');
  const iRoom  = header.indexOf('room');
  const iStart = header.indexOf('start');
  const iEnd   = header.indexOf('end');
  const iBy    = header.indexOf('by');
  const iNote  = header.indexOf('note');

  const rows = [];
  data.forEach((r, idx) => {
    if (!r[iId]) return;
    if (r[iDate] === dateISO && r[iRoom] === room) {
      rows.push({
        id: r[iId], date: r[iDate], room: r[iRoom],
        start: r[iStart], end: r[iEnd], by: r[iBy] || '', note: r[iNote] || '',
        _row: idx + 2  // 헤더가 1행이므로 실제 행
      });
    }
  });
  return { rows, headerMap:{iId,iDate,iRoom,iStart,iEnd,iBy,iNote}, sheet: sh };
}
function upsertReservation(rowObj, headerMap, sh) {
  const {iId,iDate,iRoom,iStart,iEnd,iBy,iNote} = headerMap;
  // 기존 행이 있으면 업데이트, 없으면 append
  if (rowObj._row) {
    sh.getRange(rowObj._row, iDate+1).setValue(rowObj.date);
    sh.getRange(rowObj._row, iRoom+1).setValue(rowObj.room);
    sh.getRange(rowObj._row, iStart+1).setValue(rowObj.start);
    sh.getRange(rowObj._row, iEnd+1).setValue(rowObj.end);
    sh.getRange(rowObj._row, iBy+1).setValue(rowObj.by || '');
    sh.getRange(rowObj._row, iNote+1).setValue(rowObj.note || '');
  } else {
    sh.appendRow([rowObj.id, rowObj.date, rowObj.room, rowObj.start, rowObj.end, rowObj.by||'', rowObj.note||'']);
  }
}
function deleteReservation(sheet, row) {
  sheet.deleteRow(row);
}

/** ====== ETag/캐시 ====== */
function etagForTimetable(dateISO, room) {
  const key = `etag:${dateISO}:${room}`;
  const c = cache().get(key);
  if (c) return c;
  const stamp = nowISO(); // 단순: 시각 기반. (실전: 범위값 해시)
  const etagBytes = Utilities.computeDigest(Utilities.DigestAlgorithm.MD5, `${dateISO}|${room}|${stamp}`);
  const etag = Utilities.base64Encode(etagBytes);
  cache().put(key, etag, CONFIG.CACHE_TTL);
  return etag;
}
function bumpEtag(dateISO, room) {
  const key = `etag:${dateISO}:${room}`;
  cache().remove(key);
}

/** ====== 핸들러 ====== */
function handleGetRooms() {
  const key = 'rooms:v1';
  let payload = cache().get(key);
  if (payload) return j(JSON.parse(payload));
  const rooms = getRooms();
  const res = { rooms, lastUpdated: nowISO() };
  cache().put(key, JSON.stringify(res), CONFIG.CACHE_TTL);
  return j(res);
}
function handleGetSlots(params) {
  const date = params.date || Utilities.formatDate(new Date(), CONFIG.TZ, 'yyyy-MM-dd');
  const key = `slots:${date}`;
  let payload = cache().get(key);
  if (!payload) {
    const slots = getSlotsByDate(date);
    payload = JSON.stringify({ date, slots, lastUpdated: nowISO() });
    cache().put(key, payload, CONFIG.CACHE_TTL);
  }
  return j(JSON.parse(payload));
}
function handleGetTimetable(params) {
  const date = params.date;
  const room = params.room;
  if (!date || !room) return j({ error:'date, room required' }, 400);

  const etag = etagForTimetable(date, room);
  const inm = (params['If-None-Match'] || '') || ''; // URL 파라미터로도 받음
  // Apps Script는 헤더 읽기가 제한적이므로 파라미터 fallback
  if (inm && inm === etag) {
    return j({}, 304, { 'ETag': etag });
  }

  const slots = getSlotsByDate(date);
  const resv = getReservations(date, room);
  const bookings = resv.rows.map(r => ({ start:r.start, end:r.end, status:'booked', by:r.by, id:r.id, note:r.note }));

  // 슬롯 기준 merge
  const timeline = slots.map(s => {
    const hit = bookings.find(b => b.start===s.start && b.end===s.end);
    return hit ? hit : { start:s.start, end:s.end, status:'free' };
  });

  const payload = { date, room, slots: timeline, lastUpdated: nowISO() };
  return j(payload, 200, { 'ETag': etag });
}

function handleAdminLogin(e) {
  const body = parseBody(e);
  const { pin } = body;
  if (!pin || !pinOk(pin)) return j({ ok:false }, 401);
  const payload = { role:'admin', iat: Date.now(), exp: Date.now()+ 8*60*60*1000 };
  const sig = Utilities.base64Encode(makeHmac(JSON.stringify(payload)));
  const token = Utilities.base64EncodeWebSafe(Utilities.newBlob(JSON.stringify({ ...payload, sig })).getBytes());
  return j({ ok:true, token });
}

function handleCreateReservation(body, e) {
  const auth = verifyBearer(e);
  if (!auth || auth.role!=='admin') return j({ error:'Unauthorized' }, 401);

  const { date, room, start, end, by, note } = body || {};
  if (!date || !room || !start || !end) return j({ error:'missing fields' }, 400);

  const id = `R_${date.replace(/-/g,'')}_${start.replace(':','')}_${room}`;
  const { rows, headerMap, sheet } = getReservations(date, room);
  const exist = rows.find(r => r.start===start && r.end===end);
  if (exist) return j({ error:'Slot already booked' }, 409);

  upsertReservation({ id, date, room, start, end, by: by||'', note: note||'' }, headerMap, sheet);
  bumpEtag(date, room);
  return j({ ok:true, id });
}

function handleUpdateReservation(id, body, e) {
  const auth = verifyBearer(e);
  if (!auth || auth.role!=='admin') return j({ error:'Unauthorized' }, 401);

  const { date, room, by, note } = body || {};
  if (!date || !room) return j({ error:'missing fields' }, 400);

  const { rows, headerMap, sheet } = getReservations(date, room);
  const found = rows.find(r => r.id === id);
  if (!found) return j({ error:'Not Found' }, 404);

  found.by = by ?? found.by;
  found.note = note ?? found.note;
  upsertReservation(found, headerMap, sheet);
  bumpEtag(date, room);
  return j({ ok:true });
}

function handleDeleteReservation(id, e) {
  const auth = verifyBearer(e);
  if (!auth || auth.role!=='admin') return j({ error:'Unauthorized' }, 401);

  const date = e?.parameter?.date;
  const room = e?.parameter?.room;
  if (!date || !room) return j({ error:'date, room required' }, 400);

  const { rows, sheet } = getReservations(date, room);
  const found = rows.find(r => r.id === id);
  if (!found) return j({ error:'Not Found' }, 404);

  deleteReservation(sheet, found._row);
  bumpEtag(date, room);
  return j({ ok:true });
}
