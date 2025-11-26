/**********************
  CONFIG
***********************/
const SHEET_ID = "1J6GhI4VeM9-MfIQ7LLo1Nj7i06lxV8ZxjhZj_RGOa-s";
const API_KEY = "AIzaSyDTI3yXucHM8LHQeSXJYYJJYVzufW0R6ik";
const SHEET_PROFILES = "fixed data";   // Sheet chứa học viên
const SHEET_VOCAB = "added vocab";     // Sheet chứa từ vựng

/**********************
  UTILITIES
***********************/
const qs = (s, r=document) => r.querySelector(s);
const qsa = (s, r=document) => [...r.querySelectorAll(s)];
const state = {
  profiles: [],
  allVocab: [],
  selectedLessons: [],
  practiceIndex: 0,
  practiceList: [],
  hintedWords: [],
  testList: [],
  testIndex: 0,
  testResults: [],
  timerId: null,
  requireBoth: true,
  knownCount: 0,
  totalCount: 0
};

function shuffle(arr) {
  const a = arr.slice();
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

function debounce(fn, delay) {
  let timeout;
  return (...args) => {
    clearTimeout(timeout);
    timeout = setTimeout(() => fn(...args), delay);
  };
}

/**********************
  NAVIGATION
***********************/
qsa(".nav-btn").forEach(btn => {
  btn.addEventListener("click", () => {
    const target = btn.dataset.target;
    qsa(".page").forEach(p => p.classList.remove("active"));
    qs(`#${target}`).classList.add("active");
  });
});

// Click vào tên app để về trang chủ
qs(".topbar h1").addEventListener("click", () => {
  qsa(".page").forEach(p => p.classList.remove("active"));
  qs("#home").classList.add("active");
});

/**********************
  GOOGLE SHEETS API CALLS
***********************/
async function addProfile(name) {
  const url = `https://sheets.googleapis.com/v4/spreadsheets/${SHEET_ID}/values/${encodeURIComponent(SHEET_PROFILES)}!A:A:append?valueInputOption=RAW&key=${API_KEY}`;
  const body = { values: [[name]] };
  const res = await fetch(url, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body)
  });
  if (!res.ok) throw new Error("Không thêm được profile");
  return res.json();
}

async function getProfiles() {
  const url = `https://sheets.googleapis.com/v4/spreadsheets/${SHEET_ID}/values/${encodeURIComponent(SHEET_PROFILES)}!A:A?key=${API_KEY}`;
  const res = await fetch(url);
  const data = await res.json();
  const values = data.values || [];
  return values.flat().filter(v => v && v.trim().length > 0);
}

async function addVocabRows(rows) {
  const range = `${SHEET_VOCAB}!A:E`;
  const url = `https://sheets.googleapis.com/v4/spreadsheets/${SHEET_ID}/values/${encodeURIComponent(range)}:append?valueInputOption=RAW&key=${API_KEY}`;
  const body = { values: rows };
  const res = await fetch(url, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body)
  });
  if (!res.ok) throw new Error("Không lưu được từ vựng");
  return res.json();
}

async function getVocabByStudent(studentName) {const url = `https://sheets.googleapis.com/v4/spreadsheets/${SHEET_ID}/values/${encodeURIComponent(SHEET_VOCAB)}!A:E?key=${API_KEY}`;
  const res = await fetch(url);
  const data = await res.json();
  const values = data.values || [];
  const rows = values.filter(r => r[0] && r[0] === studentName).map(r => ({
    student: r[0],
    lesson: r[1] || "",
    english: r[2] || "",
    synonym: r[3] || "",
    meaning: r[4] || ""
  }));
  return rows;
}

/**********************
  PROFILE UI
***********************/
async function refreshProfiles() {
  try {
    state.profiles = await getProfiles();
    const ul = qs("#profilesList");
    ul.innerHTML = "";
    state.profiles.forEach(p => {
      const li = document.createElement("li");
      li.textContent = p;
      ul.appendChild(li);
    });
  } catch (e) {
    qs("#profileMsg").textContent = "Lỗi tải danh sách học viên.";
  }
}

qs("#createProfileBtn").addEventListener("click", async () => {
  const name = qs("#studentName").value.trim();
  if (!name) {
    qs("#profileMsg").textContent = "Vui lòng nhập tên học viên.";
    return;
  }
  if (state.profiles.includes(name)) {
    qs("#profileMsg").textContent = "Tên học viên đã tồn tại.";
    return;
  }
  qs("#profileMsg").textContent = "Đang tạo profile...";
  try {
    await addProfile(name);
    qs("#profileMsg").textContent = "Tạo profile thành công.";
    qs("#studentName").value = "";
    await refreshProfiles();
  } catch (e) {
    qs("#profileMsg").textContent = "Không thể tạo profile.";
  }
});

/**********************
  SEARCH COMBOBOX (Input + Review)
***********************/
function setupSearchBox(inputEl, suggestionEl, onSelect) {
  inputEl.addEventListener("input", debounce(() => {
    const query = inputEl.value.toLowerCase();
    const matches = state.profiles.filter(p => p.toLowerCase().includes(query));
    suggestionEl.innerHTML = "";
    if (matches.length === 0 || !query) {
      suggestionEl.classList.add("hidden");
      return;
    }
    matches.forEach(name => {
      const li = document.createElement("li");
      li.textContent = name;
      li.addEventListener("click", () => {
        inputEl.value = name;
        suggestionEl.classList.add("hidden");
        onSelect(name);
      });
      suggestionEl.appendChild(li);
    });
    suggestionEl.classList.remove("hidden");
  }, 200));
}

setupSearchBox(qs("#studentSearch"), qs("#studentSuggestions"), () => {});
setupSearchBox(qs("#reviewStudentSearch"), qs("#reviewStudentSuggestions"), () => {});

// Trang chủ: chọn học viên để lọc dashboard
setupSearchBox(qs("#homeStudentSearch"), qs("#homeStudentSuggestions"), (name) => {
  loadHomeDashboard(name);
});

async function loadHomeDashboard(studentName) {
  try {
    const vocab = await getVocabByStudent(studentName);

    // Tổng số từ vựng của học viên
    qs("#appVocabCount").textContent = vocab.length;

    // Tổng số test (ví dụ: số bài học)
    const lessons = [...new Set(vocab.map(v => v.lesson))];
    qs("#appTestCount").textContent = lessons.length;

    // 8 bài gần nhất
    const recentLessons = lessons.slice(-8);
    const recentWords = vocab.filter(v => recentLessons.includes(v.lesson));

    qs("#lastTotalCount").textContent = recentWords.length;

    // Số từ đã thuộc (lưu theo học viên)
    const known = JSON.parse(localStorage.getItem(`knownWords_${studentName}`) || "[]");
    qs("#lastKnownCount").textContent = known.length;

    // Test gần nhất (nếu có trong state)
    qs("#lastTestWords").textContent = state.testList.length || 0;
    qs("#lastTestCount").textContent = state.testResults.length || 0;
  } catch (e) {
    console.error(e);
  }
}

/**********************
  INPUT VOCAB UI
***********************/
function addVocabRow(initial = { english:"", synonym:"", meaning:"" }) {
  const container = qs("#vocabRows");
  const row = document.createElement("div");
  row.className = "row";
  row.innerHTML = `
    <input type="text" placeholder="Từ tiếng Anh" value="${initial.english}"/>
    <input type="text" placeholder="Đồng nghĩa" value="${initial.synonym}"/>
<input type="text" placeholder="Nghĩa tiếng Việt" value="${initial.meaning}"/>
    <button class="remove">X</button>
  `;
  container.appendChild(row);
  row.querySelector(".remove").addEventListener("click", () => {
    container.removeChild(row);
  });
}

qs("#addRowBtn").addEventListener("click", () => addVocabRow());
qs("#saveVocabBtn").addEventListener("click", async () => {
  const student = qs("#studentSearch").value.trim();
  const lesson = qs("#lessonName").value.trim();
  const msg = qs("#inputMsg");

  if (!student) { msg.textContent = "Vui lòng chọn học viên."; return; }
  if (!lesson) { msg.textContent = "Vui lòng nhập tên bài học."; return; }

  const rowsEls = qsa("#vocabRows .row");
  if (rowsEls.length === 0) { msg.textContent = "Vui lòng thêm ít nhất 1 hàng từ."; return; }

  const rows = [];
  rowsEls.forEach(r => {
    const inputs = r.querySelectorAll("input");
    const eng = inputs[0].value.trim();
    const syn = inputs[1].value.trim();
    const mean = inputs[2].value.trim();
    if (eng && (syn || mean)) {
      rows.push([student, lesson, eng, syn, mean]);
    }
  });

  if (rows.length === 0) { msg.textContent = "Không có dữ liệu hợp lệ để lưu."; return; }

  msg.textContent = "Đang lưu...";
  try {
    await addVocabRows(rows);
    msg.textContent = `Đã lưu ${rows.length} từ vào bài "${lesson}".`;
    qs("#lessonName").value = "";
    qs("#vocabRows").innerHTML = "";
    addVocabRow();
    updateHomeDashboard();
  } catch (e) {
    msg.textContent = "Lỗi khi lưu từ vựng.";
  }
});

/**********************
  REVIEW / LESSON SELECT
***********************/
qs("#loadDataBtn").addEventListener("click", async () => {
  const student = qs("#reviewStudentSearch").value.trim();
  const msg = qs("#reviewMsg");
  msg.textContent = "Đang tải dữ liệu...";
  try {
    state.allVocab = await getVocabByStudent(student);
    if (state.allVocab.length === 0) {
      msg.textContent = "Chưa có dữ liệu từ vựng.";
      qs("#lessonsContainer").innerHTML = "";
      return;
    }

    // Gom theo bài học
    const lessonMap = new Map();
    state.allVocab.forEach(r => {
      if (!lessonMap.has(r.lesson)) lessonMap.set(r.lesson, []);
      lessonMap.get(r.lesson).push(r);
    });

    // Lấy tối đa 8 bài gần nhất
    let lessons = [...lessonMap.keys()];
    lessons = lessons.slice(-8);

    const container = qs("#lessonsContainer");
    container.innerHTML = "";
    lessons.forEach(lesson => {
      const div = document.createElement("div");
      div.className = "lesson-item";
      div.innerHTML = `
        <input type="checkbox" value="${lesson}"/>
        <div><strong>${lesson}</strong></div>
      `;
      container.appendChild(div);
    });

    msg.textContent = `Đã tải ${lessons.length} bài học gần nhất. Tick chọn để ôn tập.`;
    state.selectedLessons = [];
    qs("#totalCount").textContent = 0;
  } catch (e) {qs("#reviewMsg").textContent = "Lỗi tải dữ liệu ôn tập.";
  }
});

qs("#lessonsContainer").addEventListener("change", (e) => {
  if (e.target.type === "checkbox") {
    const checks = qsa("#lessonsContainer input[type=checkbox]");
    const selected = checks.filter(c => c.checked).map(c => c.value);
    if (selected.length > 8) {
      e.target.checked = false;
      alert("Bạn chỉ được chọn tối đa 8 bài.");
      return;
    }
    state.selectedLessons = selected;
    const filtered = state.allVocab.filter(r => state.selectedLessons.includes(r.lesson));
    state.totalCount = filtered.length;
    qs("#totalCount").textContent = state.totalCount;
    updateHomeDashboard();
  }
});

/**********************
  WORD LIST PANEL
***********************/
qs("#showWordListBtn").addEventListener("click", () => {
  togglePanel("wordList");
  renderWordList();
});

function togglePanel(name) {
  ["wordList", "practice", "test"].forEach(id => {
    qs(`#${id}`).classList.toggle("hidden", id !== name);
  });
}

function renderWordList() {
  const cont = qs("#wordListContent");
  cont.innerHTML = "";
  if (state.selectedLessons.length === 0) {
    cont.innerHTML = "<p>Vui lòng chọn bài học trước.</p>";
    return;
  }

  const byLesson = {};
