const PW_KEY = 'fd_family_password';
  let children = [];
  let currentFilter = 'all';
  let flatPhotos = [];
  let lightboxIndex = 0;

  function getPw() { return localStorage.getItem(PW_KEY) || ''; }

  async function api(path, options = {}) {
    const res = await fetch(path, {
      ...options,
      headers: {
        ...(options.headers || {}),
        'x-family-password': getPw(),
      },
    });
    if (res.status === 401) {
      showLogin();
      throw new Error('unauthorized');
    }
    return res;
  }

  function hideAllScreens() {
    document.getElementById('loginScreen').classList.add('hidden');
    document.getElementById('welcomeScreen').classList.add('hidden');
    document.getElementById('setupScreen').classList.add('hidden');
    document.getElementById('app').classList.add('hidden');
  }
  function showLogin() {
    hideAllScreens();
    document.getElementById('loginScreen').classList.remove('hidden');
  }
  function showApp() {
    hideAllScreens();
    document.getElementById('app').classList.remove('hidden');
  }
  function showWelcome() {
    hideAllScreens();
    document.getElementById('welcomeScreen').classList.remove('hidden');
  }
  function showSetup() {
    hideAllScreens();
    if (!document.querySelector('#setupChildList .setup-row')) {
      addSetupRow({ color: 'white' });
    }
    document.getElementById('setupScreen').classList.remove('hidden');
  }

  function computeAge(birthdate) {
    const b = new Date(birthdate);
    const now = new Date();
    let months = (now.getFullYear() - b.getFullYear()) * 12 + (now.getMonth() - b.getMonth());
    if (now.getDate() < b.getDate()) months--;
    if (months < 0) months = 0;
    if (months < 24) return `${months}개월`;
    const years = Math.floor(months / 12);
    const rem = months % 12;
    return rem ? `${years}세 ${rem}개월` : `${years}세`;
  }

  function formatDate(dateStr) {
    const d = new Date(dateStr);
    return `${d.getFullYear()}.${String(d.getMonth() + 1).padStart(2, '0')}.${String(d.getDate()).padStart(2, '0')}`;
  }

  async function loadChildren() {
    const res = await api('/api/children');
    children = await res.json();
    renderTabs();
    renderChildPicker();
  }

  function renderTabs() {
    const tabs = document.getElementById('tabs');
    tabs.innerHTML = '';
    const allBtn = document.createElement('button');
    allBtn.className = 'tab' + (currentFilter === 'all' ? ' active' : '');
    allBtn.textContent = '전체';
    allBtn.onclick = () => { currentFilter = 'all'; renderTabs(); loadRecords(); };
    tabs.appendChild(allBtn);

    for (const c of children) {
      const btn = document.createElement('button');
      btn.className = 'tab' + (currentFilter === c.id ? ' active' : '');
      btn.textContent = c.name;
      btn.onclick = () => { currentFilter = c.id; renderTabs(); loadRecords(); };
      tabs.appendChild(btn);
    }
  }

  function renderChildPicker() {
    const picker = document.getElementById('childPicker');
    picker.innerHTML = '';
    for (const c of children) {
      const btn = document.createElement('button');
      btn.type = 'button';
      btn.className = `child-btn theme-${c.color}`;
      btn.textContent = c.name;
      btn.dataset.id = c.id;
      btn.onclick = () => {
        picker.querySelectorAll('.child-btn').forEach((b) => b.classList.remove('selected'));
        btn.classList.add('selected');
      };
      picker.appendChild(btn);
    }
    if (picker.firstChild) picker.firstChild.classList.add('selected');
  }

  function childById(id) { return children.find((c) => c.id === id); }

  async function loadRecords() {
    const url = currentFilter === 'all' ? '/api/records' : `/api/records?child_id=${currentFilter}`;
    const res = await api(url);
    const records = await res.json();
    renderTimeline(records);
  }

  function renderTimeline(records) {
    const el = document.getElementById('timeline');
    el.innerHTML = '';
    flatPhotos = [];

    if (!records.length) {
      el.innerHTML = '<div class="empty-state">아직 기록이 없어요.<br>오른쪽 아래 + 버튼으로 첫 기록을
  남겨보세요!</div>';
      return;
    }

    for (const r of records) {
      const child = childById(r.child_id);
      const theme = child ? child.color : 'white';

      const entry = document.createElement('div');
      entry.className = 'entry';

      const tick = document.createElement('div');
      tick.className = 'entry-tick';
      entry.appendChild(tick);

      const dateLabel = document.createElement('div');
      dateLabel.className = 'entry-date';
      dateLabel.textContent = formatDate(r.record_date);
      entry.appendChild(dateLabel);

      const card = document.createElement('div');
      card.className = `card theme-${theme}`;

      const cardTop = document.createElement('div');
      cardTop.className = 'card-top';

      const tag = document.createElement('span');
      tag.className = `card-tag theme-${theme}`;
      tag.textContent = child ? child.name : '아이';
      if (child) {
        const ageSpan = document.createElement('span');
        ageSpan.className = 'card-age';
        ageSpan.textContent = computeAge(child.birthdate);
        tag.appendChild(ageSpan);
      }
      cardTop.appendChild(tag);

      const deleteBtn = document.createElement('button');
      deleteBtn.type = 'button';
      deleteBtn.className = 'card-delete';
      deleteBtn.textContent = '삭제';
      deleteBtn.onclick = async () => {
        if (!confirm('이 기록을 삭제할까요?')) return;
        await api(`/api/records/${r.id}`, { method: 'DELETE' });
        showToast('삭제했어요');
        await loadRecords();
      };
      cardTop.appendChild(deleteBtn);

      card.appendChild(cardTop);

      if (r.photos && r.photos.length) {
        const photosWrap = document.createElement('div');
        photosWrap.className = 'card-photos';
        r.photos.forEach((p, idx) => {
          const wrap = document.createElement('div');
          wrap.className = 'card-photo-wrap';
          const img = document.createElement('img');
          img.src = p.url;
          img.loading = 'lazy';
          img.onerror = () => console.error('사진을 불러오지 못했어요:', p.url);
          const flatIndex = flatPhotos.length;
          flatPhotos.push(p.url);
          img.onclick = () => openLightbox(flatIndex);
          wrap.appendChild(img);
          if (idx === 0 && r.photos.length > 1) {
            const badge = document.createElement('span');
            badge.className = 'photo-count';
            badge.textContent = `1/${r.photos.length}`;
            wrap.appendChild(badge);
          }
          photosWrap.appendChild(wrap);
        });
        card.appendChild(photosWrap);
      }

      if (r.content) {
        const content = document.createElement('div');
        content.className = 'card-content';
        content.textContent = r.content;
        card.appendChild(content);
      }

      if (r.author) {
        const author = document.createElement('div');
        author.className = 'card-author';
        author.textContent = `— ${r.author}`;
        card.appendChild(author);
      }

      entry.appendChild(card);
      el.appendChild(entry);
    }
  }

  function openLightbox(index) {
    lightboxIndex = index;
    updateLightboxImg();
    document.getElementById('lightbox').classList.remove('hidden');
  }
  function closeLightbox() { document.getElementById('lightbox').classList.add('hidden'); }
  function updateLightboxImg() { document.getElementById('lightboxImg').src = flatPhotos[lightboxIndex]; }
  function nextPhoto() { lightboxIndex = (lightboxIndex + 1) % flatPhotos.length; updateLightboxImg(); }
  function prevPhoto() { lightboxIndex = (lightboxIndex - 1 + flatPhotos.length) % flatPhotos.length;
  updateLightboxImg(); }

  let touchStartX = 0;
  document.getElementById('lightbox').addEventListener('touchstart', (e) => {
    touchStartX = e.touches[0].clientX;
  });
  document.getElementById('lightbox').addEventListener('touchend', (e) => {
    const dx = e.changedTouches[0].clientX - touchStartX;
    if (Math.abs(dx) > 40) { if (dx < 0) nextPhoto(); else prevPhoto(); }
  });
  document.getElementById('lightboxClose').onclick = closeLightbox;
  document.getElementById('lightboxNext').onclick = nextPhoto;
  document.getElementById('lightboxPrev').onclick = prevPhoto;
  document.getElementById('lightbox').addEventListener('click', (e) => {
    if (e.target.id === 'lightbox') closeLightbox();
  });

  const addModal = document.getElementById('addModal');
  document.getElementById('addBtn').onclick = () => {
    document.getElementById('recordDate').value = new Date().toISOString().slice(0, 10);
    addModal.classList.remove('hidden');
  };
  document.getElementById('cancelAdd').onclick = () => addModal.classList.add('hidden');

  document.getElementById('addForm').addEventListener('submit', async (e) => {
    e.preventDefault();
    const selected = document.querySelector('.child-btn.selected');
    if (!selected) { showToast('아이를 선택해주세요'); return; }

    const fd = new FormData();
    fd.append('child_id', selected.dataset.id);
    fd.append('record_date', document.getElementById('recordDate').value);
    fd.append('content', document.getElementById('recordContent').value);
    fd.append('author', document.getElementById('recordAuthor').value);
    const files = document.getElementById('recordPhotos').files;
    for (const f of files) fd.append('photos', f);

    const submitBtn = document.getElementById('submitAdd');
    submitBtn.disabled = true;
    submitBtn.textContent = '저장 중...';
    try {
      const res = await api('/api/records', { method: 'POST', body: fd });
      if (!res.ok) throw new Error('failed');
      addModal.classList.add('hidden');
      document.getElementById('addForm').reset();
      showToast('저장했어요!');
      await loadRecords();
    } catch (err) {
      showToast('저장에 실패했어요. 다시 시도해주세요.');
    } finally {
      submitBtn.disabled = false;
      submitBtn.textContent = '저장';
    }
  });

  function showToast(msg) {
    const t = document.getElementById('toast');
    t.textContent = msg;
    t.classList.remove('hidden');
    setTimeout(() => t.classList.add('hidden'), 2000);
  }

  document.getElementById('settingsBtn').onclick = () => {
    renderChildList();
    document.getElementById('settingsModal').classList.remove('hidden');
  };
  document.getElementById('closeSettings').onclick = () =>
  document.getElementById('settingsModal').classList.add('hidden');

  function escapeHtml(str) {
    return String(str).replace(/[&<>"']/g, (ch) => ({
      '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;',
    }[ch]));
  }

  function renderChildList() {
    const list = document.getElementById('childList');
    list.innerHTML = '';
    for (const c of children) {
      const row = document.createElement('div');
      row.className = 'child-edit-row';
      row.innerHTML = `
        <input type="text" value="${escapeHtml(c.name)}" data-field="name">
        <input type="date" value="${escapeHtml(c.birthdate)}" data-field="birthdate">
        <select data-field="color">
          <option value="white" ${c.color === 'white' ? 'selected' : ''}>화이트</option>
          <option value="black" ${c.color === 'black' ? 'selected' : ''}>블랙</option>
        </select>
        <button type="button" data-action="save">저장</button>
      `;
      row.querySelector('[data-action="save"]').onclick = async () => {
        const name = row.querySelector('[data-field="name"]').value;
        const birthdate = row.querySelector('[data-field="birthdate"]').value;
        const color = row.querySelector('[data-field="color"]').value;
        await api(`/api/children/${c.id}`, {
          method: 'PUT',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ name, birthdate, color }),
        });
        showToast('저장했어요!');
        await loadChildren();
        await loadRecords();
      };
      list.appendChild(row);
    }
  }

  function addSetupRow(prefill = {}) {
    const list = document.getElementById('setupChildList');
    const row = document.createElement('div');
    row.className = 'setup-row';
    row.innerHTML = `
      <input type="text" placeholder="이름 (예: 유빈)" data-field="name" value="${escapeHtml(prefill.name || '')}">
      <input type="date" data-field="birthdate" value="${escapeHtml(prefill.birthdate || '')}">
      <select data-field="color">
        <option value="white" ${prefill.color === 'black' ? '' : 'selected'}>화이트</option>
        <option value="black" ${prefill.color === 'black' ? 'selected' : ''}>블랙</option>
      </select>
      <button type="button" class="setup-remove" title="이 아이 삭제">✕</button>
    `;
    row.querySelector('.setup-remove').onclick = () => row.remove();
    list.appendChild(row);
  }

  document.getElementById('startBtn').onclick = () => showSetup();
  document.getElementById('setupAddChild').onclick = () => addSetupRow();

  document.getElementById('setupDone').onclick = async () => {
    const rows = document.querySelectorAll('#setupChildList .setup-row');
    const entries = [];
    rows.forEach((row) => {
      const name = row.querySelector('[data-field="name"]').value.trim();
      const birthdate = row.querySelector('[data-field="birthdate"]').value;
      const color = row.querySelector('[data-field="color"]').value;
      if (name && birthdate) entries.push({ name, birthdate, color });
    });
    if (!entries.length) {
      showToast('최소 한 명의 이름과 생일을 입력해주세요');
      return;
    }

    const btn = document.getElementById('setupDone');
    btn.disabled = true;
    btn.textContent = '저장 중...';
    try {
      for (const entry of entries) {
        await api('/api/children', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(entry),
        });
      }
      await loadChildren();
      showApp();
      await loadRecords();
    } catch (e) {
      showToast('저장에 실패했어요. 다시 시도해주세요.');
    } finally {
      btn.disabled = false;
      btn.textContent = '완료';
    }
  };

  document.querySelectorAll('.skip-to-app').forEach((el) => {
    el.onclick = async (e) => {
      e.preventDefault();
      showApp();
      await loadRecords();
    };
  });

  document.getElementById('previewWelcomeBtn').onclick = () => {
    document.getElementById('settingsModal').classList.add('hidden');
    showWelcome();
  };

  document.getElementById('addChildBtn').onclick = async () => {
    const name = prompt('아이 이름을 입력해주세요');
    if (!name) return;
    const birthdate = prompt('생년월일을 입력해주세요 (예: 2024-05-01)');
    if (!birthdate) return;
    const color = confirm('화이트 테마로 할까요? (취소를 누르면 블랙 테마)') ? 'white' : 'black';
    await api('/api/children', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ name, birthdate, color }),
    });
    renderChildList();
    await loadChildren();
  };

  document.getElementById('pwSubmit').onclick = async () => {
    const pw = document.getElementById('pwInput').value;
    const res = await fetch('/api/login', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ password: pw }),
    });
    const data = await res.json();
    if (data.ok) {
      localStorage.setItem(PW_KEY, pw);
      boot().catch(() => showLogin());
    } else {
      document.getElementById('pwError').textContent = data.message || '틀렸어요';
    }
  };
  document.getElementById('pwInput').addEventListener('keydown', (e) => {
    if (e.key === 'Enter') document.getElementById('pwSubmit').click();
  });

  async function boot() {
    await loadChildren();
    if (children.length === 0) {
      showWelcome();
    } else {
      showApp();
      await loadRecords();
    }
  }

  if (getPw()) {
    boot().catch(() => showLogin());
  } else {
    showLogin();
  }
