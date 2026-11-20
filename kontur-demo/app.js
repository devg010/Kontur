(() => {
  'use strict';
  const $ = (selector, root = document) => root.querySelector(selector);
  const $$ = (selector, root = document) => [...root.querySelectorAll(selector)];
  const desktop = matchMedia('(min-width:54rem)');
  const motion = matchMedia('(hover:hover) and (pointer:fine) and (prefers-reduced-motion:no-preference)');
  const menu = $('#menu');
  const toggle = $('#menu-toggle');
  function setMenu(open) {
    menu.hidden = !open;
    toggle.setAttribute('aria-expanded', String(open));
    toggle.setAttribute('aria-label', open ? 'Закрыть меню' : 'Открыть меню');
  }
  toggle.addEventListener('click', () => setMenu(menu.hidden));
  menu.addEventListener('click', event => {
    const link = event.target.closest('a');
    if (!link || desktop.matches) return;
    setMenu(false);
    const section = document.getElementById(link.hash.slice(1));
    if (section) { section.tabIndex = -1; section.focus({preventScroll:true}); }
  });
  document.addEventListener('keydown', event => {
    if (event.key === 'Escape' && !menu.hidden && !$('dialog[open]')) {
      setMenu(false);
      toggle.focus();
    }
  });
  desktop.addEventListener('change', () => setMenu(false));

  const cookie = $('#cookie-panel');
  const cookieKey = 'kontur.demo.cookies';
  let loadedAnalytics;
  function applyCookie(choice) {
    cookie.hidden = choice === 'accepted' || choice === 'essential';
    if (choice === 'accepted') loadedAnalytics ||= import('./analytics-demo.js').catch(() => {});
    updateDock();
  }
  cookie.addEventListener('click', event => {
    const button = event.target.closest('[data-cookie]');
    if (!button) return;
    try { localStorage.setItem(cookieKey, button.dataset.cookie); } catch { /* Выбор действует на открытой странице. */ }
    applyCookie(button.dataset.cookie);
  });
  window.addEventListener('storage', event => {
    if (event.key === cookieKey || event.key === null) applyCookie(event.newValue);
  });

  const dock = $('#mobile-dock');
  const obstructed = new Set();
  function updateDock() {
    if (!dock) return;
    const viewport = window.visualViewport;
    const typing = document.activeElement?.matches('input:not([type=checkbox]):not([type=button]), textarea, [contenteditable=true]');
    const keyboard = viewport && innerHeight - viewport.height > 120;
    dock.hidden = desktop.matches || !cookie.hidden || Boolean($('dialog[open]')) ||
      obstructed.size > 0 || Boolean(keyboard) || (typing && matchMedia('(pointer:coarse)').matches);
  }
  if (dock) {
    const observer = new IntersectionObserver(entries => {
      for (const entry of entries) {
        if (entry.isIntersecting) obstructed.add(entry.target);
        else obstructed.delete(entry.target);
      }
      updateDock();
    });
    [$('#booking'), $('.footer')].forEach(element => observer.observe(element));
    const dialogs = new MutationObserver(updateDock);
    $$('dialog').forEach(element => dialogs.observe(element, {attributes:true, attributeFilter:['open']}));
    document.addEventListener('focusin', updateDock);
    document.addEventListener('focusout', () => requestAnimationFrame(updateDock));
    window.visualViewport?.addEventListener('resize', updateDock);
    desktop.addEventListener('change', updateDock);
  }
  try { applyCookie(localStorage.getItem(cookieKey)); } catch { applyCookie(null); }

  // Модальные окна используют нативную блокировку фокуса. Лист закрывается после перелистывания.
  const notebook = $('#notebook');
  function closeDialog(dialog) {
    if (!dialog?.open || dialog.classList.contains('is-closing')) return;
    if (dialog !== notebook || getComputedStyle(dialog).animationName === 'none') {
      dialog.close();
      return;
    }
    dialog.classList.add('is-closing');
    const finish = () => {
      clearTimeout(timer);
      dialog.removeEventListener('animationend', onEnd);
      if (dialog.open) dialog.close();
      dialog.classList.remove('is-closing');
    };
    const onEnd = event => { if (event.target === dialog) finish(); };
    const timer = setTimeout(finish, 500);
    dialog.addEventListener('animationend', onEnd);
  }
  $$('dialog').forEach(dialog => {
    dialog.addEventListener('click', event => {
      if (event.target.closest('[data-close]')) return closeDialog(dialog);
      if (event.target !== dialog) return;
      const box = dialog.getBoundingClientRect();
      if (event.clientX < box.left || event.clientX > box.right || event.clientY < box.top || event.clientY > box.bottom) closeDialog(dialog);
    });
  });
  notebook?.addEventListener('cancel', event => { event.preventDefault(); closeDialog(notebook); });
  notebook?.addEventListener('keydown', event => {
    if (event.key !== 'Tab') return;
    const first = $('[data-close]',notebook), last = $('#note-book');
    if (event.shiftKey && document.activeElement === first) { event.preventDefault(); last.focus(); }
    if (!event.shiftKey && document.activeElement === last) { event.preventDefault(); first.focus(); }
  });

  function showReceipt() {
    const receipt = $('#receipt');
    if (!receipt) return;
    let row;
    try {
      const id = sessionStorage.getItem('kontur.demo.receipt');
      if (id) row = JSON.parse(localStorage.getItem('kontur.demo.booking.' + id));
    } catch { /* Сводка без заявки показывает начальный текст. */ }
    if (!row || !['service','master','date','time'].every(key => typeof row[key] === 'string')) return;
    const date = new Date(row.date + 'T12:00:00Z');
    if (!Number.isFinite(date.getTime())) return;
    $('#receipt-title').textContent = 'Спасибо за запись';
    $('#receipt-intro').textContent = 'Демо-заявка сохранена в этом браузере. Детали визита появились у администратора.';
    const values = [['Услуга',row.service],['Мастер',row.master],
      ['Дата',date.toLocaleDateString('ru-RU',{day:'numeric',month:'long',year:'numeric',timeZone:'Europe/Moscow'})],['Время',row.time + ' МСК']];
    for (const [label, value] of values) {
      const dt = document.createElement('dt'), dd = document.createElement('dd');
      dt.textContent = label; dd.textContent = value;
      receipt.append(dt, dd);
    }
    receipt.hidden = false;
  }
  showReceipt();
  document.addEventListener('click', event => {
    const route = event.target.closest('[data-route]');
    if (route) {
      event.preventDefault();
      $('#route-demo').textContent = 'Демо. Здесь откроется маршрут в сервисе «' + route.dataset.route + '» к адресу барбершопа.';
    }
  });

  function homeInteractions() {
    const marquee = $('.marquee');
    const pause = $('.marquee-toggle',marquee);
    pause.addEventListener('click', () => {
      const paused = marquee.dataset.paused !== 'true';
      marquee.dataset.paused = String(paused);
      pause.setAttribute('aria-pressed', String(paused));
      const label = paused ? 'Продолжить бегущую строку' : 'Приостановить бегущую строку';
      pause.setAttribute('aria-label',label);
      pause.title = label;
      $('span',pause).textContent = paused ? '▷' : 'Ⅱ';
    });
    const switcher = $('#price-switch');
    switcher.addEventListener('click', event => {
      const button = event.target.closest('button[data-tier]');
      if (!button) return;
      $$('button', switcher).forEach(item => item.setAttribute('aria-pressed', String(item === button)));
      $('#price-tier').textContent = button.textContent + ', ₽';
      $$('.price td').forEach(cell => {
        cell.textContent = Number(cell.dataset[button.dataset.tier]).toLocaleString('ru-RU') + ' ₽';
      });
    });

    const range = $('#compare-range');
    function updateComparison() {
      $('#comparison').style.setProperty('--cut', range.value + '%');
      range.setAttribute('aria-valuetext', 'До: ' + range.value + '%, после: ' + (100 - range.value) + '%');
    }
    range.addEventListener('input', updateComparison);
    updateComparison();

    const comparison = $('#comparison');
    const comparisonGroup = $('#compare-examples');
    const comparisonBefore = $('.before', comparison);
    const comparisonAfter = $('img:not(.before)', comparison);
    const examples = [
      {
        before: ['edging', 'До: барбер работает над формой стрижки'],
        after: ['fade', 'После: чёткий переход длины на висках'],
        caption: 'Фейд · Илья Савин · 60 мин'
      },
      {
        before: ['beard-work', 'До: барбер подравнивает бороду ножницами'],
        after: ['beard-line', 'После: борода с оформленной линией щёк'],
        caption: 'Оформление бороды · Максим Орлов · 30 мин'
      },
      {
        before: ['shave-before', 'До: подготовка бороды к бритью'],
        after: ['shave-after', 'После: финальный проход шаветкой'],
        caption: 'Королевское бритьё · Максим Орлов · 45 мин'
      }
    ];
    let example = 0;
    function setComparePhoto(image, [id, description]) {
      image.alt = description;
      image.dataset.photo = id;
      const largest = id === 'beard-line' ? 2304 : ['edging','fade'].includes(id) ? 1920 : 2160;
      image.srcset = [640,1440,largest].map(width => 'assets/' + id + '-' + width + '.webp ' + width + 'w').join(', ');
      image.src = 'assets/' + id + '-640.webp';
    }
    function stepExample(step) {
      example = (example + step + examples.length) % examples.length;
      const {before, after, caption} = examples[example];
      setComparePhoto(comparisonBefore, before);
      setComparePhoto(comparisonAfter, after);
      $('#compare-example').textContent = caption;
      const position = $('#compare-position');
      position.textContent = (example + 1) + ' / ' + examples.length;
      range.value = '50';
      updateComparison();
    }
    $('#compare-prev').addEventListener('click', () => stepExample(-1));
    $('#compare-next').addEventListener('click', () => stepExample(1));
    comparisonGroup.addEventListener('keydown', event => {
      if (event.target === range || !['ArrowLeft','ArrowRight'].includes(event.key)) return;
      event.preventDefault();
      stepExample(event.key === 'ArrowLeft' ? -1 : 1);
    });
    let swipe;
    comparison.addEventListener('pointerdown', event => {
      if (event.pointerType === 'touch' && event.isPrimary) {
        swipe = {id:event.pointerId, x:event.clientX, y:event.clientY};
      }
    }, {passive:true});
    comparison.addEventListener('pointerup', event => {
      if (swipe?.id !== event.pointerId) return;
      const dx = event.clientX - swipe.x;
      const dy = event.clientY - swipe.y;
      swipe = null;
      if (Math.abs(dx) >= 45 && Math.abs(dx) > Math.abs(dy) * 1.4) stepExample(dx < 0 ? 1 : -1);
    }, {passive:true});
    comparison.addEventListener('pointercancel', () => { swipe = null; }, {passive:true});

    const reviews = $$('#reviews .review');
    let review = 0;
    function stepReview(step) {
      reviews[review].hidden = true;
      review = (review + step + reviews.length) % reviews.length;
      reviews[review].hidden = false;
      $('#review-position').textContent = (review + 1) + ' / ' + reviews.length;
    }
    $('#prev').addEventListener('click', () => stepReview(-1));
    $('#next').addEventListener('click', () => stepReview(1));

    const modal = $('#modal');
    function openModal(title, message, image, policy = false) {
      $('#modal-title').textContent = title;
      $('#modal-text').textContent = message;
      $('#modal-text').hidden = !message;
      $('#modal-policy').hidden = !policy;
      const photo = $('#modal-image');
      photo.hidden = !image;
      if (image) {
        photo.alt = image.alt;
        photo.sizes = '(min-width:640px) 600px, 92vw';
        photo.srcset = image.srcset;
        photo.src = image.src;
      }
      modal.showModal();
    }
    $('#photos').addEventListener('click', event => {
      const image = event.target.closest('button')?.querySelector('img');
      if (image) openModal(image.alt, '', image);
    });
    let trigger;
    let chosenService;
    let chosenMaster;
    let bookAfterClosing = false;
    function choose(service, master) {
      const fields = $('#booking-form').elements;
      if (master) fields.master.value = master;
      if (service) fields.service.value = service;
      fields.service.dispatchEvent(new Event('change', {bubbles:true}));
      $('#booking').focus({preventScroll:true});
    }
    function openNote(button) {
      const card = button.closest('.card');
      trigger = button;
      chosenService = button.dataset.bookService || card.dataset.caseService;
      chosenMaster = card.dataset.caseMaster;
      const cell = $$('.price tbody tr').find(row => row.cells[0].textContent === chosenService).cells[1];
      const tierButton = $('#price-switch [aria-pressed=true]');
      const person = chosenMaster && $$('.person').find(item => $('h3', item).textContent === chosenMaster);
      const tier = person ? ($('.duration',person).textContent.startsWith('Топ-барбер') ? 'top' : 'barber') : tierButton.dataset.tier;
      $('#note-kind').textContent = chosenMaster ? 'Демо-кейс · ' + chosenService : 'Услуга';
      $('#note-title').textContent = button.textContent;
      $('#note-body').replaceChildren((chosenMaster ? $('.case-story',card) : $('p',card)).cloneNode(true));
      $('#note-duration').textContent = $('.duration',card).textContent;
      $('#note-tier').textContent = 'Цена · ' + (tier === 'top' ? 'Топ-барбер' : 'Барбер');
      $('#note-price').textContent = Number(cell.dataset[tier]).toLocaleString('ru-RU') + ' ₽';
      notebook.showModal();
      $('[data-close]',notebook).focus({preventScroll:true});
    }
    notebook.addEventListener('close', () => {
      if (bookAfterClosing) {
        bookAfterClosing = false;
        choose(chosenService, chosenMaster);
        if (location.hash !== '#booking') location.hash = 'booking';
        $('#booking').scrollIntoView({block:'start'});
      } else trigger?.focus({preventScroll:true});
    });
    $('#note-book').addEventListener('click', event => {
      event.preventDefault();
      bookAfterClosing = true;
      closeDialog(notebook);
    });
    document.addEventListener('click', event => {
      const button = event.target.closest('.sheet-trigger,[data-choose-service],[data-channel],[data-dialog]');
      if (!button) return;
      if (button.matches('.sheet-trigger')) return openNote(button);
      if (button.dataset.chooseService) return choose(button.dataset.chooseService, button.dataset.chooseMaster);
      if (button.dataset.channel) return openModal(button.dataset.channel, 'Демо-кнопка. Для рабочего сайта добавьте ссылку на аккаунт барбершопа.');
      if (button.dataset.dialog === 'consent') openModal('Согласие на обработку данных',
        'Демо согласия по 152-ФЗ. В рабочей версии оператором будет указан барбершоп с его реквизитами. Имя, телефон и сведения о визите используются для подтверждения записи. При отправке имя, телефон и сведения о записи сохраняются в браузере этого устройства и доступны в демо-админке. Демо использует вымышленные данные.', null, true);
    });
  }
  if ($('#booking-form')) homeInteractions();

  // Сначала читаем размеры видимых элементов, затем одним кадром обновляем их стили.
  function startMotion() {
    if (!('IntersectionObserver' in window)) return () => {};
    const visible = new Set(), lit = new Set(), registered = new Set();
    const hero = $('.hero');
    const photo = $('.hero-picture');
    const selector = '.card,.review,.form,.gallery button,.btn,.icon,.seg button';
    const group = $('#services .grid');
    let point, frame = 0, counterFrame = 0, heroVisible = false;
    const properties = ['--near','--mx','--my','--rx','--ry','--bx','--by','--scale','--shift'];
    function clear(element) { for (const property of properties) element.style.removeProperty(property); }
    function paint() {
      frame = 0;
      const samples = [], next = new Set();
      let activeCard;
      const topDialog = $('dialog[open]');
      if (point) for (const element of visible) {
        if (topDialog && !topDialog.contains(element)) continue;
        const box = element.getBoundingClientRect();
        if (!box.width || !box.height) continue;
        const x = point.x - box.left, y = point.y - box.top;
        const distance = Math.hypot(Math.max(0,-x,x-box.width), Math.max(0,-y,y-box.height));
        const serviceCard = element.classList.contains('service-card');
        if (distance === 0 && serviceCard) activeCard = element;
        if (distance >= 126 && !serviceCard) continue;
        samples.push({element,box,x,y,near:Math.max(0,1-distance/126),serviceCard});
      }
      const offset = heroVisible && photo ? Math.max(-24,Math.min(34,Math.round(-hero.getBoundingClientRect().top * .07))) : 0;
      if (photo) photo.style.setProperty('--parallax',offset+'px');
      const activeIndex = activeCard && Array.prototype.indexOf.call(group.children, activeCard);
      for (const {element,box,x,y,near,serviceCard} of samples) {
        if (!near && !(serviceCard && activeCard)) continue;
        next.add(element);
        element.style.setProperty('--near',near.toFixed(3));
        element.style.setProperty('--mx',Math.round(x)+'px');
        element.style.setProperty('--my',Math.round(y)+'px');
        const normX = Math.max(-1, Math.min(1, 2*x/box.width-1));
        const normY = Math.max(-1, Math.min(1, 2*y/box.height-1));
        if (element.matches('.btn,.icon,.seg button')) {
          element.style.setProperty('--bx',Math.round(normX * 6 * near)+'px');
          element.style.setProperty('--by',Math.round(normY * 6 * near)+'px');
        }
        if (element.classList.contains('person')) {
          element.style.setProperty('--rx',(-normY * 3.5 * near).toFixed(2)+'deg');
          element.style.setProperty('--ry',(normX * 3.5 * near).toFixed(2)+'deg');
        }
        if (serviceCard) {
          const index = Array.prototype.indexOf.call(group.children,element);
          element.style.setProperty('--scale', !activeCard ? '1' : element === activeCard ? '1.015' : '.988');
          element.style.setProperty('--shift',activeCard ? Math.sign(index-activeIndex)*3+'px' : '0px');
        }
      }
      for (const element of lit) if (!next.has(element)) clear(element);
      lit.clear();
      for (const element of next) lit.add(element);
    }
    function schedule() { if (!frame) frame = requestAnimationFrame(paint); }
    const watcher = new IntersectionObserver(entries => {
      for (const {target,isIntersecting} of entries) {
        if (target === hero) heroVisible = isIntersecting;
        else if (isIntersecting) visible.add(target);
        else visible.delete(target);
      }
      schedule();
    });
    function register(element) {
      if (registered.has(element)) return;
      registered.add(element);
      element.classList.add('light-target');
      const rim = document.createElement('span');
      rim.className = 'rim-light';
      rim.setAttribute('aria-hidden','true');
      element.append(rim);
      watcher.observe(element);
    }
    $$(selector).forEach(register);
    if (hero) watcher.observe(hero);
    const list = $('#admin-list');
    const dynamic = new MutationObserver(() => {
      for (const item of registered) if (!item.isConnected) {
        watcher.unobserve(item); visible.delete(item); lit.delete(item); registered.delete(item);
      }
      $$(selector,list).forEach(register);
    });
    if (list) dynamic.observe(list,{childList:true});
    const reveal = new IntersectionObserver(entries => {
      for (const {target,isIntersecting} of entries) {
        if (!isIntersecting) continue;
        reveal.unobserve(target);
        if (target.matches('.stats')) {
          const start = performance.now(), counters = $$('[data-count]',target);
          function tick(now) {
            const t = Math.min(1,(now-start)/600);
            for (const value of counters) {
              const digits = value.dataset.count.includes('.') ? 1 : 0;
              value.textContent = (Number(value.dataset.count)*t).toLocaleString('ru-RU',{minimumFractionDigits:digits,maximumFractionDigits:digits}) + (value.dataset.suffix || '');
            }
            if (t<1) counterFrame = requestAnimationFrame(tick);
          }
          counterFrame = requestAnimationFrame(tick);
        } else {
          target.classList.add('arrive');
          target.addEventListener('animationend', () => target.classList.remove('arrive'), {once:true});
        }
      }
    }, {threshold:.08});
    $$('main h2,main .grid>.card,main .stats').forEach(element => {
      if (element.matches('.card')) {
        const i = Array.prototype.indexOf.call(element.parentElement.children,element);
        element.style.setProperty('--delay',(i % 3)*60+'ms');
      }
      reveal.observe(element);
    });
    const controller = new AbortController();
    const passive = {passive:true,signal:controller.signal};
    const reset = () => { point = null; schedule(); };
    document.addEventListener('pointermove', event => {
      point = event.pointerType === 'touch' ? null : {x:event.clientX,y:event.clientY}; schedule();
    },passive);
    document.addEventListener('pointerout', event => { if (!event.relatedTarget) reset(); },passive);
    document.addEventListener('pointercancel',reset,passive);
    window.addEventListener('blur',reset,passive);
    window.addEventListener('scroll',schedule,passive);
    window.addEventListener('resize',schedule,passive);
    return () => {
      controller.abort(); watcher.disconnect(); reveal.disconnect(); dynamic.disconnect();
      cancelAnimationFrame(frame); cancelAnimationFrame(counterFrame);
      for (const element of registered) {
        element.classList.remove('light-target'); element.querySelector(':scope > .rim-light')?.remove(); clear(element);
      }
      $$('.arrive').forEach(el => el.classList.remove('arrive'));
      $$('[data-count]').forEach(el => { el.textContent = Number(el.dataset.count).toLocaleString('ru-RU') + (el.dataset.suffix || ''); });
      photo?.style.removeProperty('--parallax');
    };
  }
  let stopMotion;
  function configureMotion() { stopMotion?.(); stopMotion = motion.matches ? startMotion() : null; }
  configureMotion();
  motion.addEventListener('change',configureMotion);
})();
