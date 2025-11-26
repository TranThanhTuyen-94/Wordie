/**********************
  CONFIG
***********************/
const SHEET_ID = "1J6GhI4VeM9-MfIQ7LLo1Nj7i06lxV8ZxjhZj_RGOa-s";
const API_KEY = "AIzaSyDTI3yXucHM8LHQeSXJYYJJYVzufW0R6ik";
const SHEET_PROFILES = "fixed data";    // Sheet chứa học viên
const SHEET_VOCAB = "added vocab";      // Sheet chứa từ vựng
const TEST_DURATION_SECONDS = 6;        // Thời gian cho mỗi câu kiểm tra

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

function clearState() {
    state.selectedLessons = [];
    state.practiceIndex = 0;
    state.practiceList = [];
    state.hintedWords = [];
    state.testList = [];
    state.testIndex = 0;
    state.testResults = [];
    state.knownCount = 0;
    state.totalCount = 0;
    clearInterval(state.timerId);
}

/**********************
  NAVIGATION
***********************/
qsa(".nav-btn").forEach(btn => {
  btn.addEventListener("click", () => {
    const target = btn.dataset.target;
    qsa(".page").forEach(p => p.classList.remove("active"));
    qs(`#${target}`).classList.add("active");
    if (target === 'home') updateHomeDashboard();
  });
});

// Click vào tên app để về trang chủ
qs(".topbar h1").addEventListener("click", () => {
  qsa(".page").forEach(p => p.classList.remove("active"));
  qs("#home").classList.add("active");
  updateHomeDashboard();
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

async function getVocabByStudent(studentName) {
  const url = `https://sheets.googleapis.com/v4/spreadsheets/${SHEET_ID}/values/${encodeURIComponent(SHEET_VOCAB)}!A:E?key=${API_KEY}`;
  const res = await fetch(url);
  const data = await res.json();
  const values = data.values || [];
  // Bỏ qua hàng tiêu đề nếu có (giả sử hàng tiêu đề không có studentName)
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
setupSearchBox(qs("#reviewStudentSearch"), qs("#reviewStudentSuggestions"), clearState);

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
    const lessons = [...new Set(vocab.map(v => v.lesson))].filter(l => l);
    qs("#appTestCount").textContent = lessons.length;

    // 8 bài gần nhất
    const recentLessons = lessons.slice(-8);
    const recentWords = vocab.filter(v => recentLessons.includes(v.lesson));

    qs("#lastTotalCount").textContent = recentWords.length;

    // Số từ đã thuộc (lưu theo học viên)
    const known = JSON.parse(localStorage.getItem(`knownWords_${studentName}`) || "[]");
    qs("#lastKnownCount").textContent = known.length;

    // Test gần nhất (cập nhật từ state)
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
    updateHomeDashboard(); // Cập nhật Dashboard sau khi lưu
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
  clearState(); // Xóa trạng thái ôn tập/kiểm tra cũ
  
  if (!student) { msg.textContent = "Vui lòng chọn học viên."; return; }
  
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
    let lessons = [...lessonMap.keys()].filter(l => l); // Lọc bỏ lesson rỗng
    lessons = lessons.slice(-8);

    const container = qs("#lessonsContainer");
    container.innerHTML = "";
    lessons.forEach(lesson => {
      const div = document.createElement("div");
      div.className = "lesson-item";
      div.innerHTML = `
        <input type="checkbox" value="${lesson}"/>
        <div><strong>${lesson}</strong> (${lessonMap.get(lesson).length} từ)</div>
      `;
      container.appendChild(div);
    });

    msg.textContent = `Đã tải ${lessons.length} bài học gần nhất. Tick chọn để ôn tập.`;
  } catch (e) {
    qs("#reviewMsg").textContent = "Lỗi tải dữ liệu ôn tập.";
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
    qs("#reviewMsg").textContent = `Tổng ${state.totalCount} từ được chọn.`;
    
    // reset panel khi chọn lại bài học
    togglePanel(null);
  }
});

/**********************
  WORD LIST PANEL
***********************/
qs("#showWordListBtn").addEventListener("click", () => {
  if (state.selectedLessons.length === 0) { alert("Vui lòng chọn bài học trước."); return; }
  togglePanel("wordList");
  renderWordList();
});

function togglePanel(name) {
  clearInterval(state.timerId); // Dừng timer khi chuyển panel
  ["wordList", "practice", "test"].forEach(id => {
    qs(`#${id}`).classList.toggle("hidden", id !== name);
  });
}

function renderWordList() {
  const cont = qs("#wordListContent");
  cont.innerHTML = "";

  const byLesson = {};
  state.selectedLessons.forEach(lesson => {
    byLesson[lesson] = state.allVocab.filter(r => r.lesson === lesson);
  });

  // Hiển thị theo từng bài
  Object.keys(byLesson).forEach(lesson => {
    const block = document.createElement("div");
    block.className = "lesson-block";
    const title = document.createElement("h4");
    title.textContent = lesson;
    block.appendChild(title);

    const ul = document.createElement("ul");
    ul.className = "list";
    byLesson[lesson].forEach(item => {
      const li = document.createElement("li");
      li.textContent = `${item.english} — ${item.synonym || "-"} — ${item.meaning || "-"}`;
      ul.appendChild(li);
    });
    block.appendChild(ul);
    cont.appendChild(block);
  });
}

/* -------------------------
    Hỗ trợ: cập nhật dashboard
    ------------------------- */
function updateHomeDashboard() {
  try {
    const homeInput = qs("#homeStudentSearch");
    const name = homeInput ? homeInput.value.trim() : "";
    if (name) {
      loadHomeDashboard(name).catch(() => {});
      return;
    }
    
    // Fallback: cập nhật từ state
    if (qs("#appVocabCount")) qs("#appVocabCount").textContent = state.allVocab.length || 0;
    if (qs("#appTestCount")) {
      const lessons = [...new Set(state.allVocab.map(v => v.lesson))].filter(l => l);
      qs("#appTestCount").textContent = lessons.length || 0;
    }
    if (qs("#lastTotalCount")) qs("#lastTotalCount").textContent = state.totalCount || 0;
    if (qs("#lastKnownCount")) qs("#lastKnownCount").textContent = state.knownCount || 0;
    if (qs("#lastTestWords")) qs("#lastTestWords").textContent = state.testList.length || 0;
    if (qs("#lastTestCount")) qs("#lastTestCount").textContent = state.testResults.length || 0;
  } catch (err) {
    console.warn("updateHomeDashboard error", err);
  }
}

/* -------------------------
    PRACTICE
    ------------------------- */
qs("#practiceBtn").addEventListener("click", () => {
    if (state.selectedLessons.length === 0) { alert("Vui lòng chọn bài học trước."); return; }
    
    state.practiceList = shuffle(state.allVocab.filter(r => state.selectedLessons.includes(r.lesson)));
    state.practiceIndex = 0;
    state.hintedWords = [];
    
    togglePanel("practice");
    renderPractice();
    renderHintedList();
});

qs("#nextPracticeBtn").addEventListener("click", () => {
    if (state.practiceList.length === 0) return;
    state.practiceIndex++;
    if (state.practiceIndex >= state.practiceList.length) state.practiceIndex = 0;
    renderPractice();
});

qs("#hintBtn").addEventListener("click", () => {
    if (state.practiceList.length === 0) return;
    const item = state.practiceList[state.practiceIndex % state.practiceList.length];
    
    // Thêm từ vào danh sách từ đã bấm hint nếu chưa có
    if (!state.hintedWords.includes(item.english)) {
        state.hintedWords.push(item.english);
        renderHintedList();
    }
    
    qs("#practiceHint").textContent = item.meaning || item.synonym || "—";
});

function renderPractice() {
    const item = state.practiceList[state.practiceIndex % state.practiceList.length];
    const indexDisplay = `${state.practiceIndex + 1}/${state.practiceList.length}`;
    
    if (!item) {
        qs("#practiceWord").textContent = "—";
        qs("#practiceHint").textContent = "—";
        return;
    }
    
    qs("#practiceWord").textContent = `${item.english} (${indexDisplay})`;
    qs("#practiceHint").textContent = "— (Ấn Hint)";
}

function renderHintedList() {
    const ul = qs("#hintedList");
    ul.innerHTML = "";
    state.hintedWords.forEach(word => {
        const li = document.createElement("li");
        li.textContent = word;
        ul.appendChild(li);
    });
}


/* -------------------------
    TEST
    ------------------------- */
qs("#testBtn").addEventListener("click", () => {
    if (state.selectedLessons.length === 0) { alert("Vui lòng chọn bài học trước."); return; }
    
    // Lấy danh sách từ để test (chỉ những từ có đủ nghĩa hoặc từ đồng nghĩa)
    const validVocab = state.allVocab.filter(r => 
        state.selectedLessons.includes(r.lesson) && (r.meaning.trim() || r.synonym.trim())
    );
    
    if (validVocab.length < 4) {
        alert("Cần ít nhất 4 từ có đủ nghĩa/đồng nghĩa để làm bài test.");
        return;
    }

    state.testList = shuffle(validVocab);
    state.testIndex = 0;
    state.testResults = [];
    state.requireBoth = qs("#requireBothCols").checked;
    
    togglePanel("test");
    renderTestQuestion();
});

qs("#nextTestBtn").addEventListener("click", checkAnswerAndNext);

function startTimer() {
    clearInterval(state.timerId);
    let timeLeft = TEST_DURATION_SECONDS;
    qs("#timer").textContent = `${timeLeft}s`;

    state.timerId = setInterval(() => {
        timeLeft--;
        qs("#timer").textContent = `${timeLeft}s`;

        if (timeLeft <= 0) {
            clearInterval(state.timerId);
            // Tự động chuyển câu nếu hết giờ
            checkAnswerAndNext(true); 
        }
    }, 1000);
}

function getDistractors(currentWord, field, count = 3) {
    const allOptions = state.testList
        .filter(v => v.english !== currentWord.english && v[field].trim().length > 0)
        .map(v => v[field].trim());
        
    return shuffle([...new Set(allOptions)]).slice(0, count);
}

function renderTestQuestion() {
    qs("#testResultList").innerHTML = ""; // Xóa kết quả câu trước

    if (state.testIndex >= state.testList.length) {
        return renderTestSummary();
    }

    const currentWord = state.testList[state.testIndex];
    qs("#testWord").textContent = currentWord.english;

    // --- Render Synonyms ---
    const synOptions = [currentWord.synonym.trim(), ...getDistractors(currentWord, 'synonym')].filter(s => s.length > 0);
    renderOptions(qs("#synOptions"), shuffle(synOptions));

    // --- Render Meanings ---
    const meanOptions = [currentWord.meaning.trim(), ...getDistractors(currentWord, 'meaning')].filter(m => m.length > 0);
    renderOptions(qs("#meanOptions"), shuffle(meanOptions));

    startTimer();
}

function renderOptions(ul, options) {
    ul.innerHTML = "";
    options.forEach(opt => {
        const li = document.createElement("li");
        li.innerHTML = `<input type="radio" name="${ul.id}" value="${opt}" id="${ul.id}-${opt.replace(/\s/g, '-')}" /><label for="${ul.id}-${opt.replace(/\s/g, '-')}">${opt}</label>`;
        ul.appendChild(li);
    });
}

function checkAnswerAndNext(isTimeout = false) {
    clearInterval(state.timerId);
    
    if (state.testIndex >= state.testList.length) {
        renderTestSummary();
        return;
    }

    const currentWord = state.testList[state.testIndex];
    const selectedSyn = qs('input[name="synOptions"]:checked');
    const selectedMean = qs('input[name="meanOptions"]:checked');
    
    const isSynCorrect = selectedSyn && selectedSyn.value === currentWord.synonym.trim();
    const isMeanCorrect = selectedMean && selectedMean.value === currentWord.meaning.trim();

    let isCorrect = false;

    if (isTimeout) {
        isCorrect = false; // Hết giờ tính là sai
    } else if (state.requireBoth) {
        isCorrect = isSynCorrect && isMeanCorrect;
    } else {
        isCorrect = isSynCorrect || isMeanCorrect;
    }

    // Ghi nhận kết quả
    state.testResults.push({
        word: currentWord.english,
        correct: isCorrect,
        syn: isSynCorrect,
        mean: isMeanCorrect,
        timeout: isTimeout
    });

    // Cập nhật giao diện kết quả tạm thời
    renderTestResultList(currentWord, isCorrect, isTimeout);

    // Chuyển câu hỏi
    state.testIndex++;
    
    // Tạm dừng 1 giây để người dùng thấy kết quả
    setTimeout(renderTestQuestion, 1000); 
}

function renderTestResultList(word, isCorrect, isTimeout) {
    const ul = qs("#testResultList");
    const li = document.createElement("li");
    let msg = "";

    if (isTimeout) {
        msg = `**[HẾT GIỜ]** ${word.english} - Sai!`;
        li.style.color = 'var(--danger)';
    } else if (isCorrect) {
        msg = `**[ĐÚNG]** ${word.english}`;
        li.style.color = 'var(--primary)';
        // Tăng điểm từ đã thuộc (tạm thời)
        state.knownCount++;
    } else {
        msg = `**[SAI]** ${word.english} - Correct Syn: ${word.synonym || '-'}, Mean: ${word.meaning || '-'}`;
        li.style.color = 'var(--danger)';
    }

    li.innerHTML = msg.replace(/\*\*/g, '<strong>');
    ul.prepend(li); // Thêm kết quả mới nhất lên đầu
}

function renderTestSummary() {
    const correctCount = state.testResults.filter(r => r.correct).length;
    const totalCount = state.testResults.length;
    const percentage = ((correctCount / totalCount) * 100).toFixed(1);

    const ul = qs("#testResultList");
    ul.innerHTML = "";
    
    // Tạo tiêu đề tổng kết
    const h4 = document.createElement("h4");
    h4.textContent = "TỔNG KẾT BÀI KIỂM TRA";
    ul.appendChild(h4);

    // Dòng kết quả chính
    const summaryLi = document.createElement("li");
    summaryLi.innerHTML = `Bạn đã hoàn thành **${totalCount}** từ. Đúng: **${correctCount}** (${percentage}%)`;
    summaryLi.style.cssText = 'font-weight: bold; border: 2px solid var(--primary); background: var(--card);';
    ul.appendChild(summaryLi);

    qs("#testWord").textContent = "— HOÀN THÀNH —";
    clearInterval(state.timerId);
    qs("#timer").textContent = `0s`;

    // Cập nhật Dashboard
    updateHomeDashboard();
}

/* -------------------------
    Khởi tạo an toàn khi load
    ------------------------- */
document.addEventListener("DOMContentLoaded", async () => {
  // Đảm bảo các phần tử tồn tại trước khi gắn event
  try {
    if (qs("#vocabRows") && qs("#vocabRows").children.length === 0) addVocabRow();
  } catch (e) {}

  // Refresh profiles nếu có
  try { await refreshProfiles(); } catch (e) { console.warn(e); }
  
  // Gắn sự kiện cho checkbox 'Bắt buộc chọn cả 2 cột'
  const requireBothCheckbox = qs("#requireBothCols");
  if (requireBothCheckbox) {
      requireBothCheckbox.addEventListener('change', (e) => {
          state.requireBoth = e.target.checked;
      });
  }
});
