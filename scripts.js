// === 설정 ===
const API_BASE = 'https://your-vercel-project-name.vercel.app/api/reservations'; // 실제 주소로 바꿔야 함

// === 유틸 ===
function $(id) {
  return document.getElementById(id);
}

// === 공통: 오늘 날짜 기본값 설정 ===
window.addEventListener("DOMContentLoaded", () => {
  const dateInput = $("date");
  if (dateInput) {
    const today = new Date().toISOString().split("T")[0];
    dateInput.value = today;
  }

  loadRooms();
});

// === 강의실 목록 불러오기 ===
async function loadRooms() {
  try {
    const res = await fetch(`${API_BASE}?mode=rooms`);
    const data = await res.json();

    const roomSelect = $("room");
    if (!roomSelect || !data.rooms) return;

    roomSelect.innerHTML = `<option value="">선택하세요</option>`;
    data.rooms.forEach(room => {
      const option = document.createElement("option");
      option.value = room;
      option.textContent = room;
      roomSelect.appendChild(option);
    });
  } catch (err) {
    alert("강의실 정보를 불러오지 못했습니다.");
    console.error(err);
  }
}

// === 예약 현황 불러오기 ===
if ($("loadBtn")) {
  $("loadBtn").addEventListener("click", async () => {
    const date = $("date").value;
    const room = $("room").value;

    if (!date || !room) {
      alert("날짜와 강의실을 모두 선택하세요.");
      return;
    }

    try {
      const res = await fetch(`${API_BASE}?mode=schedule&date=${date}&room=${room}`);
      const data = await res.json();

      renderSchedule(data.reservations || []);
    } catch (err) {
      alert("예약 현황을 불러오는 데 실패했습니다.");
      console.error(err);
    }
  });
}

// === 예약 현황 테이블 렌더링 ===
function renderSchedule(data) {
  const area = $("scheduleArea");
  const body = $("scheduleBody");
  area.style.display = "block";
  body.innerHTML = "";

  if (data.length === 0) {
    body.innerHTML = `<tr><td colspan="3">예약 없음</td></tr>`;
    return;
  }

  data.forEach(row => {
    const [_, __, ___, start, end, by, note] = row;
    const tr = document.createElement("tr");
    tr.innerHTML = `
      <td>${start} ~ ${end}</td>
      <td>${by || '-'}</td>
      <td>${note || ''}</td>
    `;
    body.appendChild(tr);
  });
}
