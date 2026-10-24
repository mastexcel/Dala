// Poste des conseillers : lit et répond aux conversations clients via /v1/advisor-desk.
// Tout le contenu client est inséré avec textContent (jamais innerHTML).
(function () {
  'use strict';

  var API = '/v1/advisor-desk';
  var REFRESH_MS = 10000;
  var TOPICS = {
    INVEST: 'Placements',
    CROWDFUND: 'Crowdfunding en capital',
    SAVINGS: 'Épargne et tontines',
    CREDIT: 'Micro-crédit',
    BUSINESS: 'Levée de fonds',
    OTHER: 'Autre demande',
  };
  var TEMPLATES = [
    ['Rappel', 'Je vous propose un rappel téléphonique. Quel créneau vous convient (entre 8 h et 18 h) ?'],
    ['Crowdfunding', 'Sur DALA, le crowdfunding est uniquement en capital : vous devenez actionnaire. Chaque projet est validé par Bridge Investment Partners. Le ticket minimum est de 5 000 FCFA.'],
    ['Titres', 'Les bons du Trésor UEMOA conviennent à un horizon court et à un revenu régulier. Je peux simuler votre rendement selon votre montant et la durée.'],
    ['Précisions', 'Merci pour votre message. Pouvez-vous me préciser votre objectif, votre montant et votre horizon de placement ?'],
  ];

  var state = { key: '', name: '', filter: 'AWAITING', list: [], current: null, timer: null };
  var $ = function (id) { return document.getElementById(id); };

  function store(k, v) {
    try { v == null ? sessionStorage.removeItem(k) : sessionStorage.setItem(k, v); } catch (e) { /* stockage indisponible */ }
  }
  function load(k) {
    try { return sessionStorage.getItem(k) || ''; } catch (e) { return ''; }
  }

  function api(path, opts) {
    opts = opts || {};
    var headers = { 'x-admin-key': state.key };
    if (opts.body) headers['Content-Type'] = 'application/json';
    return fetch(API + path, { method: opts.method || 'GET', headers: headers, body: opts.body ? JSON.stringify(opts.body) : undefined }).then(function (res) {
      if (res.status === 403) {
        logout();
        throw new Error('Clé du back-office refusée.');
      }
      if (res.status === 204) return null;
      return res.json().then(function (data) {
        if (!res.ok) throw new Error(data.error || 'Erreur ' + res.status);
        return data;
      });
    });
  }

  function el(tag, cls, text) {
    var n = document.createElement(tag);
    if (cls) n.className = cls;
    if (text != null) n.textContent = text;
    return n;
  }

  function when(iso) {
    var d = new Date(iso);
    var today = new Date().toDateString() === d.toDateString();
    return today
      ? d.toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' })
      : d.toLocaleDateString('fr-FR', { day: 'numeric', month: 'short' }) + ' ' + d.toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' });
  }

  function customerName(c) {
    return c.user ? c.user.firstName + ' ' + c.user.lastName : 'Client';
  }

  /* ------------------------------ Liste ------------------------------ */

  function refreshList() {
    var query = state.filter === 'CLOSED' ? '?status=CLOSED' : '?status=OPEN';
    return api('/conversations' + query)
      .then(function (list) {
        state.list = state.filter === 'AWAITING' ? list.filter(function (c) { return c.awaitingReply; }) : list;
        if (state.filter !== 'CLOSED') {
          var awaiting = list.filter(function (c) { return c.awaitingReply; }).length;
          $('count-awaiting').textContent = awaiting ? String(awaiting) : '';
          document.title = (awaiting ? '(' + awaiting + ') ' : '') + 'Poste des conseillers · DALA Finance';
        }
        renderList();
      })
      .catch(function () { /* erreur réseau passagère : prochain rafraîchissement */ });
  }

  function renderList() {
    var ul = $('list');
    ul.replaceChildren();
    $('list-empty').hidden = state.list.length > 0;
    state.list.forEach(function (c) {
      var li = el('li');
      var b = el('button');
      b.type = 'button';
      if (state.current && state.current.id === c.id) b.setAttribute('aria-current', 'true');
      var row = el('div', 'row');
      row.append(el('span', 'name', customerName(c)), el('span', 'muted small', when(c.lastMessageAt)));
      var tags = el('div', 'row');
      tags.append(el('span', 'tag', TOPICS[c.topic] || c.topic));
      if (c.awaitingReply && c.status === 'OPEN') tags.append(el('span', 'waiting', 'En attente de réponse'));
      b.append(row, tags, el('span', 'preview', c.lastMessage || ''));
      b.addEventListener('click', function () { openConversation(c.id); });
      li.append(b);
      ul.append(li);
    });
  }

  /* --------------------------- Conversation --------------------------- */

  function openConversation(id) {
    return api('/conversations/' + encodeURIComponent(id)).then(function (c) {
      var changed = !state.current || state.current.id !== c.id;
      var sameLength = state.current && state.current.messages.length === c.messages.length;
      state.current = c;
      $('placeholder').hidden = true;
      $('conversation').hidden = false;
      $('app').classList.add('reading');
      $('c-subject').textContent = c.subject;
      var u = c.user;
      $('c-customer').textContent = u ? customerName(c) + ' · ' + u.phone + ' · KYC niveau ' + u.kycLevel : '';
      $('close-conv').disabled = c.status === 'CLOSED';
      if (changed || !sameLength) renderMessages();
      if (changed) {
        $('reply').value = '';
        $('reply-error').textContent = '';
      }
      renderList();
    });
  }

  function renderMessages() {
    var ol = $('messages');
    ol.replaceChildren();
    state.current.messages.forEach(function (m) {
      var li = el('li', 'msg ' + m.sender, m.body);
      var who = m.sender === 'USER' ? customerName(state.current) : m.sender === 'ADVISOR' ? m.authorName || 'Conseiller' : 'DALA';
      li.append(el('span', 'meta', who + ' · ' + when(m.createdAt)));
      ol.append(li);
    });
    ol.scrollTop = ol.scrollHeight;
  }

  function sendReply(ev) {
    ev.preventDefault();
    var body = $('reply').value.trim();
    if (!body || !state.current) return;
    $('send').disabled = true;
    $('reply-error').textContent = '';
    api('/conversations/' + encodeURIComponent(state.current.id) + '/messages', { method: 'POST', body: { body: body, authorName: state.name } })
      .then(function () {
        $('reply').value = '';
        return Promise.all([openConversation(state.current.id), refreshList()]);
      })
      .catch(function (e) { $('reply-error').textContent = e.message; })
      .finally(function () { $('send').disabled = false; });
  }

  function closeConversation() {
    if (!state.current || !window.confirm('Clôturer cette conversation ? Le client pourra la rouvrir en écrivant.')) return;
    api('/conversations/' + encodeURIComponent(state.current.id) + '/close', { method: 'POST' })
      .then(function () { return Promise.all([openConversation(state.current.id), refreshList()]); })
      .catch(function (e) { $('reply-error').textContent = e.message; });
  }

  /* ------------------------------ Session ------------------------------ */

  function start() {
    $('login').hidden = true;
    $('app').hidden = false;
    $('me').hidden = false;
    $('me-name').textContent = state.name;
    refreshList();
    clearInterval(state.timer);
    state.timer = setInterval(function () {
      refreshList();
      if (state.current) openConversation(state.current.id).catch(function () {});
    }, REFRESH_MS);
  }

  function logout() {
    clearInterval(state.timer);
    state.key = '';
    store('dala.desk.key', null);
    state.current = null;
    $('app').hidden = true;
    $('me').hidden = true;
    $('login').hidden = false;
  }

  function login(ev) {
    ev.preventDefault();
    state.key = $('login-key').value.trim();
    state.name = $('login-name').value.trim();
    $('login-error').textContent = '';
    api('/conversations?status=OPEN')
      .then(function () {
        store('dala.desk.key', state.key);
        store('dala.desk.name', state.name);
        $('login-key').value = '';
        start();
      })
      .catch(function (e) { $('login-error').textContent = e.message; });
  }

  /* ------------------------------ Démarrage ------------------------------ */

  TEMPLATES.forEach(function (t) {
    var b = el('button', null, t[0]);
    b.type = 'button';
    b.title = t[1];
    b.addEventListener('click', function () {
      var r = $('reply');
      r.value = r.value ? r.value + '\n' + t[1] : t[1];
      r.focus();
    });
    $('templates').append(b);
  });

  document.querySelectorAll('.filters button').forEach(function (b) {
    b.addEventListener('click', function () {
      state.filter = b.dataset.filter;
      document.querySelectorAll('.filters button').forEach(function (x) { x.setAttribute('aria-selected', String(x === b)); });
      refreshList();
    });
  });

  $('login-form').addEventListener('submit', login);
  $('reply-form').addEventListener('submit', sendReply);
  $('reply').addEventListener('keydown', function (e) {
    if (e.key === 'Enter' && (e.ctrlKey || e.metaKey)) sendReply(e);
  });
  $('close-conv').addEventListener('click', closeConversation);
  $('logout').addEventListener('click', logout);
  $('back').addEventListener('click', function () { $('app').classList.remove('reading'); });

  state.key = load('dala.desk.key');
  state.name = load('dala.desk.name');
  $('login-name').value = state.name;
  if (state.key && state.name) start();
  else $('login').hidden = false;
})();
