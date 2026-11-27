(() => {
  'use strict';
  const $ = (selector, root = document) => root.querySelector(selector);
  const $$ = (selector, root = document) => [...root.querySelectorAll(selector)];
  const form = $('#booking-form');
  const {name,phone,service,master,date,time} = form.elements;
  const status = $('#result');
  const offer = $('#selected-offer');
  $$('.price tbody th').forEach(row => service.add(new Option(row.textContent)));
  $$('[data-master]').forEach(link => master.add(new Option(link.dataset.master)));
  const durations = {'Мужская стрижка':60,'Борода':30,'Комплекс':90,'Отец и сын':90,'Королевское бритьё':45,'Камуфляж седины':30,'Уход':30};
  const moscowDate = new Intl.DateTimeFormat('sv-SE',{timeZone:'Europe/Moscow',year:'numeric',month:'2-digit',day:'2-digit'});
  const moscowTime = new Intl.DateTimeFormat('en-GB',{timeZone:'Europe/Moscow',hour:'2-digit',minute:'2-digit',hourCycle:'h23'});
  function localDigits(value) {
    const digits = value.replace(/\D/g,'');
    const hasPrefix = value.startsWith('+7') || /^[78]/.test(digits);
    return (hasPrefix ? digits.slice(1) : digits).slice(0,10);
  }
  phone.addEventListener('input', () => {
    if (/^(\+|\+7|7|8)$/.test(phone.value)) {
      phone.setCustomValidity('Введите 10 цифр после +7.');
      return;
    }
    const digits = localDigits(phone.value);
    const cursor = localDigits(phone.value.slice(0, phone.selectionStart)).length;
    const [area,mid,last1,last2] = [digits.slice(0,3),digits.slice(3,6),digits.slice(6,8),digits.slice(8)];
    phone.value = digits ? '+7 (' + area + (mid ? ') ' + mid : '') + (last1 ? '-' + last1 : '') + (last2 ? '-' + last2 : '') : '';
    if (cursor < digits.length) {
      let position = 4, seen = 0;
      while (position < phone.value.length && seen < cursor) {
        if (/\d/.test(phone.value[position])) seen++;
        position++;
      }
      phone.setSelectionRange(position,position);
    }
    phone.setCustomValidity(digits.length === 10 || !digits ? '' : 'Введите 10 цифр после +7.');
  });

  const admin = $('#admin');
  const login = $('#admin-login');
  const adminContent = $('#admin-content');
  const adminList = $('#admin-list');
  const adminError = $('#admin-error');
  const announce = $('#admin-announce');
  const sound = $('#admin-sound');
  const filterStatus = $('#admin-status');
  const filterDate = $('#admin-date');
  const filterMaster = $('#admin-master');
  const search = $('#admin-search');
  const statuses = {new:'Новая', confirmed:'Подтверждена', done:'Выполнена', canceled:'Отменена'};
  const keyPrefix = 'kontur.demo.booking.';
  const createdFormat = new Intl.DateTimeFormat('ru-RU',{
    timeZone:'Europe/Moscow', dateStyle:'short', timeStyle:'short'
  });
  let lastKeys = new Set();
  let audio;
  let adminTrigger;

  for (const [id, label] of Object.entries(statuses)) filterStatus.add(new Option(label,id));
  for (const option of master.options) filterMaster.add(new Option(option.text,option.value));

  function bookingKeys() {
    return Object.keys(localStorage).filter(key => key.startsWith(keyPrefix));
  }
  function readBooking(key) {
    try {
      const row = JSON.parse(localStorage.getItem(key));
      if (row && Object.hasOwn(statuses,row.status) && typeof row.id === 'string' &&
          ['name','phone','service','master','date','time','promo'].every(field => typeof row[field] === 'string') &&
          typeof row.createdAt === 'number' && !Number.isNaN(new Date(row.createdAt).getTime())) {
        return row;
      }
    } catch {
      // Повреждённая запись не мешает показать остальные заявки.
    }
    return null;
  }
  function tag(type, value) {
    const element = document.createElement(type);
    element.textContent = value;
    return element;
  }
  function adminButton(label, action) {
    const button = tag('button',label);
    button.type = 'button';
    button.className = 'btn alt';
    button.dataset.adminAction = action;
    return button;
  }
  function bookingEntry(row) {
    const entry = document.createElement('li');
    entry.className = 'admin-entry';
    entry.dataset.key = row.id;
    entry.dataset.status = row.status;
    entry.tabIndex = -1;
    const heading = tag('h4','№ ' + row.id);
    const created = tag('p','Создана ' + createdFormat.format(row.createdAt) + ' (МСК) · ' + statuses[row.status]);
    created.className = 'muted';
    const details = document.createElement('dl');
    for (const [label,value] of [['Имя',row.name],['Телефон',row.phone],['Услуга',row.service],['Мастер',row.master],
      ['Визит',row.date.split('-').reverse().join('.') + ' в ' + row.time + ' (МСК)'],['Акция',row.promo || 'Без акции']]) {
      const output = tag('dd',value);
      const digits = value.replace(/\D/g,'');
      if (label === 'Телефон' && /^7\d{10}$/.test(digits)) {
        const link = tag('a',value);
        link.href = 'tel:+' + digits;
        output.replaceChildren(link);
      }
      details.append(tag('dt',label),output);
    }
    const actions = document.createElement('div');
    actions.className = 'admin-actions';
    const label = tag('label','Статус заявки');
    label.className = 'field';
    const select = document.createElement('select');
    select.dataset.adminAction = 'status';
    for (const [id,text] of Object.entries(statuses)) select.add(new Option(text,id));
    select.value = row.status;
    label.append(select);
    actions.append(label,adminButton('Сохранить статус','save'),adminButton('Удалить','delete'));
    entry.append(heading,created,details,actions);
    return entry;
  }
  function beep() {
    if (!sound.checked || audio?.state !== 'running') return;
    const tone = audio.createOscillator();
    const volume = audio.createGain();
    const start = audio.currentTime;
    tone.frequency.value = 660;
    volume.gain.setValueAtTime(.09,start);
    volume.gain.exponentialRampToValueAtTime(.001,start + .22);
    tone.connect(volume).connect(audio.destination);
    tone.start(start);
    tone.stop(start + .22);
    tone.addEventListener('ended', () => { tone.disconnect(); volume.disconnect(); }, {once:true});
  }
  function refreshAdmin(initial = false) {
    if (adminContent.hidden || !admin.open) return;
    try {
      const keys = bookingKeys();
      const rows = keys.map(readBooking).filter(Boolean).sort((a,b) => b.createdAt - a.createdAt);
      const incoming = rows.filter(row => row.status === 'new' && !lastKeys.has(keyPrefix + row.id));
      lastKeys = new Set(keys);
      if (!initial && incoming.length) {
        announce.replaceChildren(tag('span',incoming.length === 1
          ? 'Поступила новая заявка № ' + incoming[0].id + '.'
          : 'Поступило заявок: ' + incoming.length + '.'));
        beep();
      }
      $('#admin-count').textContent = 'Новых: ' + rows.filter(row => row.status === 'new').length;
      const query = search.value.trim().toLocaleLowerCase('ru-RU');
      const searchDigits = query.replace(/\D/g,'');
      const digits = /^8\d{10}$/.test(searchDigits) ? '7' + searchDigits.slice(1) : searchDigits;
      const filtered = rows.filter(row =>
        (!filterStatus.value || row.status === filterStatus.value) &&
        (!filterDate.value || row.date === filterDate.value) &&
        (!filterMaster.value || row.master === filterMaster.value) &&
        (!query || row.name.toLocaleLowerCase('ru-RU').includes(query) ||
          (digits && !/[\p{L}]/u.test(query) && row.phone.replace(/\D/g,'').includes(digits))));
      const active = document.activeElement;
      const activeEntry = active?.closest('.admin-entry');
      const draft = activeEntry?.querySelector('select')?.value;
      const entries = filtered.map(bookingEntry);
      const empty = $('#admin-empty');
      empty.hidden = entries.length > 0;
      empty.textContent = rows.length ? 'Заявок по этим фильтрам нет.' : 'Заявок пока нет.';
      adminList.replaceChildren(...entries);
      if (activeEntry) {
        const replacement = entries.find(entry => entry.dataset.key === activeEntry.dataset.key);
        if (replacement && draft && draft !== activeEntry.dataset.status) $('select',replacement).value = draft;
        const control = replacement && (active.dataset.adminAction
          ? $('[data-admin-action="'+active.dataset.adminAction+'"]',replacement)
          : $('a',replacement) || replacement);
        (control || search).focus({preventScroll:true});
      }
    } catch {
      adminError.textContent = 'Локальное хранилище браузера недоступно.';
    }
  }

  function openAdmin() {
    if (admin.open) return;
    admin.showModal();
    $('#admin-pin').focus();
  }
  function syncAdminHash() {
    if (location.hash === '#admin') openAdmin();
    else if (admin.open) admin.close();
  }
  $('.admin-link').addEventListener('click', event => {
    event.preventDefault();
    adminTrigger = event.currentTarget;
    if (location.hash !== '#admin') history.pushState(null,'','#admin');
    openAdmin();
  });
  window.addEventListener('hashchange',syncAdminHash);
  admin.addEventListener('close', () => {
    adminContent.hidden = true;
    login.hidden = false;
    login.reset();
    adminList.replaceChildren();
    adminError.textContent = '';
    announce.textContent = '';
    sound.checked = false;
    if (location.hash === '#admin') {
      history.replaceState(null,'',location.href.split('#')[0]);
    }
    (adminTrigger || $('.admin-link')).focus({preventScroll:true});
  });
  login.addEventListener('submit', event => {
    event.preventDefault();
    if ($('#admin-pin').value !== '1234') {
      adminError.textContent = 'Неверный PIN. Для демо введите 1234.';
      $('#admin-pin').focus();
      return;
    }
    login.reset();
    login.hidden = true;
    adminContent.hidden = false;
    adminError.textContent = '';
    refreshAdmin(true);
    search.focus();
  });
  for (const control of [search,filterStatus,filterDate,filterMaster]) {
    control.addEventListener('input', () => refreshAdmin());
  }
  sound.addEventListener('change', async () => {
    if (!sound.checked) return;
    try {
      audio ||= new AudioContext();
      await audio.resume();
      beep();
    } catch {
      sound.checked = false;
      adminError.textContent = 'В этом браузере звук уведомлений недоступен.';
    }
  });

  const people = $$('[data-master]').map(link => link.dataset.master);
  const anyMaster = master.options[0].value;
  const conflict = 'Это время только что заняли. Выберите другое.';
  const noWindows = 'На эту дату свободных окон нет';
  const readSlotsError = 'Не удалось прочитать расписание из хранилища браузера.';
  const fullDate = new Intl.DateTimeFormat('ru-RU', {weekday:'long',day:'numeric',month:'long',year:'numeric',timeZone:'UTC'});
  const weekday = new Intl.DateTimeFormat('ru-RU', {weekday:'short',timeZone:'UTC'});
  const monthTitle = new Intl.DateTimeFormat('ru-RU', {month:'long',year:'numeric',timeZone:'UTC'});
  const clockLabel = mins => String(Math.floor(mins / 60)).padStart(2,'0') + ':' + String(mins % 60).padStart(2,'0');
  function minutes(text) {
    if (!/^\d{2}:\d{2}$/.test(text)) return NaN;
    const [hours, mins] = text.split(':').map(Number);
    return hours < 24 && mins < 60 ? hours * 60 + mins : NaN;
  }
  function utcDay(iso) { return new Date(iso + 'T12:00:00Z'); }
  function addDays(iso, delta) {
    const value = utcDay(iso);
    value.setUTCDate(value.getUTCDate() + delta);
    return value.toISOString().slice(0,10);
  }
  function bounds() {
    const now = new Date(), today = moscowDate.format(now);
    return {today, last:addDays(today,60), current:minutes(moscowTime.format(now))};
  }
  function serviceDuration(serviceName) {
    return Object.hasOwn(durations,serviceName) ? durations[serviceName] : 60;
  }
  function durationOf(row) {
    return Number.isInteger(row.durationMinutes) && row.durationMinutes > 0 && row.durationMinutes <= 660
      ? row.durationMinutes
      : serviceDuration(row.service);
  }
  function freePeople(agenda, day, start, length, preferred) {
    const intervals = agenda.get(day) || [];
    return people.filter(person =>
      (preferred === anyMaster || preferred === person) &&
      !intervals.some(item => (item.person === person || item.person === anyMaster) && start < item.end && start + length > item.start));
  }
  function readAgenda(exclude) {
    const agenda = new Map();
    const rows = bookingKeys().map(readBooking).filter(row => row && row.id !== exclude && row.status !== 'canceled');
    // Сначала фиксируем именные записи. Старые заявки «Любой мастер» распределяем в стабильном порядке.
    rows.sort((a,b) => Number(!people.includes(a.master))-Number(!people.includes(b.master)) ||
      a.createdAt-b.createdAt || a.id.localeCompare(b.id));
    for (const row of rows) {
      const start = minutes(row.time), length = durationOf(row);
      if (!Number.isFinite(start)) continue;
      const person = people.includes(row.master) ? row.master :
        freePeople(agenda,row.date,start,length,anyMaster)[0] || anyMaster;
      if (!agenda.has(row.date)) agenda.set(row.date,[]);
      agenda.get(row.date).push({person,start,end:start+length});
    }
    return agenda;
  }
  function available(agenda, clock, day, chosenService, preferred) {
    if (!day || day < clock.today || day > clock.last) return [];
    const length = serviceDuration(chosenService);
    const result = [];
    for (let start = 600; start + length <= 1260; start += 30) {
      if (day === clock.today && start <= clock.current) continue;
      const free = freePeople(agenda,day,start,length,preferred);
      if (free.length) result.push({time:clockLabel(start),end:clockLabel(start+length),master:free[0]});
    }
    return result;
  }

  // localStorage хранит сами заявки. Блокировка сериализует чтение, проверку и запись между вкладками.
  let gateDatabase;
  function openGate() {
    if (!gateDatabase) gateDatabase = new Promise((resolve,reject) => {
      const request = indexedDB.open('kontur.demo.scheduler',1);
      request.onupgradeneeded = () => request.result.createObjectStore('gate');
      request.onsuccess = () => {
        const db = request.result;
        db.onversionchange = () => { db.close(); gateDatabase = null; };
        resolve(db);
      };
      request.onerror = () => reject(request.error);
      request.onblocked = () => reject(new Error('Хранилище занято другой версией сайта.'));
    }).catch(error => { gateDatabase = null; throw error; });
    return gateDatabase;
  }
  function withWriteLock(change) {
    if (navigator.locks?.request) return navigator.locks.request('kontur.demo.scheduler', {mode:'exclusive'}, change);
    // Две readwrite-транзакции с одной областью IndexedDB выполняются по очереди.
    return openGate().then(db => new Promise((resolve,reject) => {
      const tx = db.transaction('gate','readwrite');
      let value, failure;
      tx.objectStore('gate').get('writer').onsuccess = () => {
        try { value = change(); }
        catch (error) { failure = error; tx.abort(); }
      };
      tx.oncomplete = () => resolve(value);
      tx.onabort = () => reject(failure || tx.error || new Error('Запись прервана.'));
    }));
  }
  function saveRow(data, customer = false) {
    const createdAt = Date.now();
    const suffix = Array.from(crypto.getRandomValues(new Uint32Array(2)), n => n.toString(36)).join('-');
    const id = createdAt.toString(36) + '-' + suffix;
    const receiptKey = 'kontur.demo.receipt';
    const previous = customer ? sessionStorage.getItem(receiptKey) : null;
    if (customer) sessionStorage.setItem(receiptKey,id);
    try {
      localStorage.setItem(keyPrefix + id, JSON.stringify({
        ...data,durationMinutes:serviceDuration(data.service),id,createdAt,status:'new'
      }));
    } catch (error) {
      if (customer && previous === null) sessionStorage.removeItem(receiptKey);
      else if (customer) sessionStorage.setItem(receiptKey,previous);
      throw error;
    }
    return id;
  }

  const strip = $('#date-strip'), calendar = $('#calendar'), grid = $('#month-days');
  const summary = $('#date-summary'), slotNote = $('#slot-note');
  let agenda, clock, month, conflictVisible = false;
  const monthStart = iso => iso.slice(0,7) + '-01';
  function moveMonth(first, step) {
    const value = utcDay(first);
    value.setUTCMonth(value.getUTCMonth() + step,1);
    return value.toISOString().slice(0,10);
  }
  function slots(day) { return available(agenda,clock,day,service.value,master.value); }
  const dateButton = (iso, compact) => {
    const day = utcDay(iso), button = document.createElement('button');
    button.type = 'button';
    button.dataset.day = iso;
    button.setAttribute('aria-label',fullDate.format(day));
    button.setAttribute('aria-pressed',String(iso === date.value));
    if (iso === clock.today) button.setAttribute('aria-current','date');
    button.disabled = !slots(iso).length;
    if (compact) button.append(tag('small',weekday.format(day)),tag('strong',String(day.getUTCDate())));
    else button.textContent = day.getUTCDate();
    return button;
  };
  function drawStrip() {
    const activeDay = strip.contains(document.activeElement) && document.activeElement.dataset.day;
    strip.replaceChildren(...Array.from({length:14},(_,i) => dateButton(addDays(clock.today,i),true)));
    if (activeDay) {
      const replacement = $('button[data-day="'+activeDay+'"]:enabled',strip) || $('button:enabled',strip) || $('#date-open');
      replacement.focus({preventScroll:true});
    }
    summary.textContent = 'Выбрана дата: ' + fullDate.format(utcDay(date.value));
  }
  function drawMonth(focusDay) {
    const active = grid.contains(document.activeElement) && document.activeElement.dataset.day;
    $('#month-label').textContent = monthTitle.format(utcDay(month));
    $('#month-prev').disabled = month <= monthStart(clock.today);
    $('#month-next').disabled = month >= monthStart(clock.last);
    const cells = [], offset = (utcDay(month).getUTCDay()+6)%7;
    for (let i=0;i<offset;i++) {
      const blank = document.createElement('span'); blank.setAttribute('aria-hidden','true'); cells.push(blank);
    }
    for (let day=month; monthStart(day)===month; day=addDays(day,1)) cells.push(dateButton(day,false));
    grid.replaceChildren(...cells);
    if (focusDay || active) {
      const target = $('button[data-day="'+(focusDay || active)+'"]:enabled',grid) || $('button:enabled',grid) || $('[data-close]',calendar);
      target.focus({preventScroll:true});
    }
  }
  function drawTimes(external = false) {
    const selected = time.value, choices = slots(date.value);
    const valid = choices.some(option => option.time === selected);
    time.replaceChildren(new Option(choices.length ? 'Выберите время' : 'Выберите другую дату',''),
      ...choices.map(option => new Option(
        service.value ? option.time + '–' + option.end : option.time,
        option.time
      )));
    time.value = valid ? selected : '';
    slotNote.textContent = choices.length ? '' : noWindows;
    if (external && selected && !valid) showConflict();
  }
  function showConflict() {
    conflictVisible = true;
    status.textContent = conflict;
    if (!$('dialog[open]')) time.focus();
  }
  function refreshAvailability(external = false) {
    try { clock = bounds(); agenda = readAgenda(); }
    catch { slotNote.textContent = readSlotsError; return false; }
    if (!date.value || date.value<clock.today || date.value>clock.last) {
      date.value = clock.today;
      for (let d=clock.today; d<=clock.last; d=addDays(d,1)) if (slots(d).length) { date.value=d; break; }
    }
    drawStrip(); drawTimes(external);
    if (calendar.open) drawMonth();
    return true;
  }
  function pickDay(day) {
    date.value = day;
    conflictVisible = false;
    status.textContent = '';
    drawStrip(); drawTimes();
  }
  function openCalendar() {
    if (!refreshAvailability()) return;
    month = monthStart(date.value);
    calendar.showModal();
    drawMonth(date.value);
  }
  $('#date-open').addEventListener('click', openCalendar);
  calendar.addEventListener('close', () => $('#date-open').focus({preventScroll:true}));
  strip.addEventListener('click', event => {
    const button = event.target.closest('button[data-day]');
    if (button && !button.disabled) pickDay(button.dataset.day);
  });
  grid.addEventListener('click', event => {
    const button = event.target.closest('button[data-day]');
    if (button && !button.disabled) { pickDay(button.dataset.day); calendar.close(); }
  });
  $('#month-prev').addEventListener('click', () => { month = moveMonth(month,-1); drawMonth(); });
  $('#month-next').addEventListener('click', () => { month = moveMonth(month,1); drawMonth(); });
  function arrowDay(event) {
    const button = event.target.closest('[data-day]');
    if (!button) return;
    const steps = {ArrowLeft:-1, ArrowRight:1, ArrowUp:-7, ArrowDown:7};
    const step = steps[event.key];
    if (!step) return;
    event.preventDefault();
    const inside = grid.contains(button);
    const last = inside ? clock.last : addDays(clock.today,13);
    let day = addDays(button.dataset.day,step);
    while (day >= clock.today && day<=last && !slots(day).length) day = addDays(day,Math.sign(step));
    if (day<clock.today || day>last) return;
    if (inside) { month=monthStart(day); drawMonth(day); }
    else $('button[data-day="'+day+'"]',strip)?.focus();
  }
  grid.addEventListener('keydown',arrowDay);
  strip.addEventListener('keydown',arrowDay);

  service.addEventListener('change', () => {
    if (offer.dataset.service && offer.dataset.service !== service.value) {
      offer.textContent = '';
      delete offer.dataset.service;
      delete offer.dataset.promo;
    }
    conflictVisible = false; status.textContent = ''; refreshAvailability();
  });
  master.addEventListener('change', () => { conflictVisible = false; status.textContent = ''; refreshAvailability(); });
  time.addEventListener('change', () => { conflictVisible = false; status.textContent = ''; });
  document.addEventListener('click', event => {
    const action = event.target.closest('[data-master],[data-offer]');
    if (!action) return;
    if (action.dataset.master) master.value = action.dataset.master;
    const {offer:promo,service:chosen} = action.dataset;
    if (promo) {
      if (chosen) service.value = chosen;
      offer.dataset.promo = promo;
      offer.dataset.service = chosen || '';
      offer.textContent = 'Выбрана акция «' + promo + '».';
    }
    conflictVisible = false; status.textContent = ''; refreshAvailability();
    $('#booking').focus({preventScroll:true});
  });

  function syncAfterWrite() { refreshAdmin(); refreshAvailability(true); }
  window.addEventListener('storage', event => {
    if (event.key === null || event.key.startsWith(keyPrefix)) syncAfterWrite();
  });
  window.addEventListener('pageshow', () => refreshAvailability(true));
  document.addEventListener('visibilitychange', () => { if (!document.hidden) syncAfterWrite(); });
  setInterval(() => { if (!document.hidden) refreshAvailability(true); },60000);

  async function adminWrite(operation) {
    adminError.textContent = '';
    try {
      const message = await withWriteLock(operation);
      syncAfterWrite();
      if (message) announce.textContent = message;
    } catch { adminError.textContent = 'Не удалось изменить расписание. Проверьте доступ к хранилищу браузера.'; }
  }
  $('#admin-add').addEventListener('click', () => adminWrite(() => {
    const busy = readAgenda(), now = bounds(), kind = 'Мужская стрижка';
    for (let day=now.today; day<=now.last; day=addDays(day,1)) {
      const options = available(busy,now,day,kind,anyMaster);
      if (!options.length) continue;
      const slot = options[0];
      saveRow({name:'Тестовый клиент',phone:'+7 (000) 000-00-00',service:kind,master:slot.master,
        date:day,time:slot.time,promo:'Первая стрижка −20%'});
      return;
    }
    return 'На ближайшие 60 дней свободных окон для тестовой заявки нет.';
  }));
  $('#admin-clear').addEventListener('click', () => {
    if (window.confirm('Удалить все заявки из демо-админки этого браузера?')) adminWrite(() => {
      for (const key of bookingKeys()) localStorage.removeItem(key);
      return 'Демо-данные очищены.';
    });
  });
  adminList.addEventListener('click', event => {
    const button = event.target.closest('button[data-admin-action]');
    if (!button) return;
    const entry = button.closest('.admin-entry'), id = entry.dataset.key, key = keyPrefix + id;
    const remove = button.dataset.adminAction === 'delete', next = $('select',entry).value;
    if (remove && !window.confirm('Удалить заявку № ' + id + '?')) return;
    adminWrite(() => {
      const row = readBooking(key);
      if (!row) return 'Заявка уже удалена.';
      if (remove) { localStorage.removeItem(key); return 'Заявка удалена.'; }
      if (!Object.hasOwn(statuses,next)) return;
      if (row.status === 'canceled' && next !== 'canceled') {
        const free = freePeople(readAgenda(id),row.date,minutes(row.time),durationOf(row),row.master);
        if (!free.length) return 'Это время уже занято. Заявка остаётся отменённой.';
        row.master = free[0];
      }
      localStorage.setItem(key,JSON.stringify({...row,status:next}));
      return 'Статус заявки «' + statuses[next] + '» сохранён.';
    });
  });
  let submitting = false;
  form.addEventListener('input', () => {
    name.setCustomValidity('');
    if (!conflictVisible) status.textContent = '';
  });
  form.addEventListener('submit', async event => {
    event.preventDefault();
    if (submitting) return;
    name.setCustomValidity(name.value.trim() ? '' : 'Введите имя.');
    if (!form.reportValidity()) return;
    const data = {name:name.value.trim(),phone:phone.value,service:service.value,master:master.value,
      date:date.value,time:time.value,promo:offer.dataset.promo || ''};
    const submit = $('button[type=submit]',form);
    submitting = true; submit.disabled = true;
    try {
      const saved = await withWriteLock(() => {
        const choices = available(readAgenda(),bounds(),data.date,data.service,data.master);
        const slot = choices.find(choice => choice.time === data.time);
        if (!slot) return false;
        saveRow({...data,master:slot.master},true);
        return true;
      });
      if (!saved) { refreshAvailability(); showConflict(); return; }
      location.assign('thanks.html');
    } catch {
      status.textContent = 'Заявка не сохранена. Проверьте, доступно ли локальное хранилище браузера, и повторите попытку.';
    } finally {
      submitting = false; submit.disabled = false;
    }
  });

  refreshAvailability();
  $('#booking-fields').disabled = false;
  syncAdminHash();
})();
