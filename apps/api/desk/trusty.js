// Médiation des litiges Trusty via /v1/trusty-desk. Contenu client inséré avec textContent uniquement.
(function () {
  'use strict';

  var API = '/v1/trusty-desk';
  var STATUS = {
    PROPOSED: 'Proposée', ACCEPTED: 'Acceptée', FUNDED: 'Fonds bloqués', DELIVERED: 'Livrée',
    DISPUTED: 'Litige', RELEASED: 'Vendeur payé', REFUNDED: 'Remboursée', CANCELLED: 'Annulée',
  };
  var ACTOR = { BUYER: 'Acheteur', SELLER: 'Vendeur', SYSTEM: 'DALA', MEDIATOR: 'Médiation' };
  var state = { key: '', name: '', filter: 'DISPUTED', current: null };
  var $ = function (id) { return document.getElementById(id); };
  var fcfa = function (n) { return Math.round(n).toLocaleString('fr-FR').replace(/ | /g, ' ') + ' FCFA'; };

  function read(k) { try { return sessionStorage.getItem(k) || ''; } catch (e) { return ''; } }

  function api(path, opts) {
    opts = opts || {};
    var headers = { 'x-admin-key': state.key };
    if (opts.body) headers['Content-Type'] = 'application/json';
    return fetch(API + path, { method: opts.method || 'GET', headers: headers, body: opts.body ? JSON.stringify(opts.body) : undefined }).then(function (res) {
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
    return d.toLocaleDateString('fr-FR', { day: 'numeric', month: 'short' }) + ' ' + d.toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' });
  }

  function refreshList() {
    return api('/escrows?status=' + state.filter).then(function (list) {
      var ul = $('list');
      ul.textContent = '';
      $('list-empty').hidden = list.length > 0;
      if (state.filter === 'DISPUTED') $('count').textContent = list.length ? String(list.length) : '';
      list.forEach(function (e) {
        var b = el('button');
        b.type = 'button';
        if (state.current && state.current.id === e.id) b.setAttribute('aria-current', 'true');
        var row = el('span', 'row');
        row.appendChild(el('span', 'name', e.title));
        row.appendChild(el('span', 'muted small', fcfa(e.amount)));
        b.appendChild(row);
        b.appendChild(el('span', 'preview', e.buyer.name + ' → ' + e.seller.name));
        b.appendChild(el('span', e.status === 'DISPUTED' ? 'waiting' : 'tag', STATUS[e.status] + ' · ' + when(e.updatedAt)));
        b.addEventListener('click', function () { open(e.id); });
        var li = el('li');
        li.appendChild(b);
        ul.appendChild(li);
      });
    }).catch(function (err) { $('auth').hidden = false; $('auth').firstChild.textContent = err.message + ' '; });
  }

  function open(id) {
    return api('/escrows/' + id).then(function (e) {
      state.current = e;
      $('placeholder').hidden = true;
      $('conversation').hidden = false;
      $('app').classList.add('reading');
      $('e-title').textContent = e.title + ' · ' + fcfa(e.amount) + ' · ' + STATUS[e.status];
      $('e-parties').textContent = 'Acheteur : ' + e.buyer.name + ' (' + e.buyer.phone + ') · Vendeur : ' + e.seller.name + ' (' + e.seller.phone + ')';
      var ol = $('messages');
      ol.textContent = '';
      if (e.description) ol.appendChild(el('li', 'msg SYSTEM', 'Description : ' + e.description));
      e.events.forEach(function (v) {
        var li = el('li', 'msg ' + (v.actor === 'MEDIATOR' ? 'ADVISOR' : v.actor === 'SYSTEM' ? 'SYSTEM' : 'USER'), v.message);
        li.appendChild(el('span', 'meta', ACTOR[v.actor] + ' · ' + when(v.createdAt)));
        ol.appendChild(li);
      });
      ol.scrollTop = ol.scrollHeight;
      var open = ['RELEASED', 'REFUNDED', 'CANCELLED'].indexOf(e.status) < 0;
      $('reply-form').hidden = !open;
      $('resolve-form').hidden = e.status !== 'DISPUTED';
      $('seller-amount').max = String(e.amount);
      $('seller-amount').value = '';
      $('split').textContent = '';
      $('error').textContent = '';
      refreshList();
    });
  }

  $('seller-amount').addEventListener('input', function () {
    var v = Number($('seller-amount').value);
    $('split').textContent = state.current && v >= 0 && v <= state.current.amount ? 'Vendeur : ' + fcfa(v) + ' · Acheteur remboursé : ' + fcfa(state.current.amount - v) : '';
  });

  $('reply-form').addEventListener('submit', function (ev) {
    ev.preventDefault();
    api('/escrows/' + state.current.id + '/messages', { method: 'POST', body: { message: $('reply').value, authorName: state.name } })
      .then(function () { $('reply').value = ''; return open(state.current.id); })
      .catch(function (err) { $('error').textContent = err.message; });
  });

  $('resolve-form').addEventListener('submit', function (ev) {
    ev.preventDefault();
    var seller = Number($('seller-amount').value);
    if (!window.confirm('Verser ' + fcfa(seller) + ' au vendeur et rembourser ' + fcfa(state.current.amount - seller) + " à l'acheteur ?")) return;
    api('/escrows/' + state.current.id + '/resolve', { method: 'POST', body: { sellerAmount: seller, note: $('note').value, authorName: state.name } })
      .then(function () { $('note').value = ''; return open(state.current.id); })
      .catch(function (err) { $('error').textContent = err.message; });
  });

  Array.prototype.forEach.call(document.querySelectorAll('[data-filter]'), function (b) {
    b.addEventListener('click', function () {
      state.filter = b.getAttribute('data-filter');
      Array.prototype.forEach.call(document.querySelectorAll('[data-filter]'), function (x) { x.setAttribute('aria-selected', String(x === b)); });
      refreshList();
    });
  });
  $('back').addEventListener('click', function () { $('app').classList.remove('reading'); });

  state.key = read('dala.desk.key');
  state.name = read('dala.desk.name');
  $('me-name').textContent = state.name;
  if (!state.key) { $('auth').hidden = false; return; }
  refreshList();
  setInterval(refreshList, 15000);
})();
