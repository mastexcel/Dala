// Page publique de paiement d'une demande DALA. Tout contenu reçu est inséré avec textContent.
(function () {
  'use strict';
  var code = (location.pathname.split('/').filter(Boolean).pop() || '').toUpperCase();
  var API = '/v1/pay/' + encodeURIComponent(code);
  var state = { provider: null, providers: [] };
  var $ = function (id) { return document.getElementById(id); };

  function show(id) {
    ['loading', 'error', 'request', 'done'].forEach(function (s) { $(s).hidden = s !== id; });
  }
  function fcfa(n) {
    return new Intl.NumberFormat('fr-FR').format(n) + ' FCFA';
  }
  function fail(text) {
    $('error-text').textContent = text;
    show('error');
  }
  function finished(title, text) {
    $('done-title').textContent = title;
    $('done-text').textContent = text;
    show('done');
  }
  function digits(v) { return v.replace(/\D/g, '').slice(0, 10); }

  /** Opérateur suggéré d'après le préfixe ivoirien (07 Orange, 05 MTN, 01 Moov). */
  function suggest(auto) {
    var d = digits($('phone').value);
    var match = state.providers.filter(function (p) { return p.prefix && d.indexOf(p.prefix) === 0; })[0];
    // Pendant la saisie du numéro seulement : un choix explicite du payeur n'est jamais écrasé.
    if (auto && match && state.provider !== match.id) select(match.id);
    var current = state.providers.filter(function (p) { return p.id === state.provider; })[0];
    $('hint').textContent = current && current.prefix && d.length >= 2 && d.indexOf(current.prefix) !== 0
      ? 'Les numéros ' + current.name + ' commencent par ' + current.prefix + '.'
      : '';
  }

  function select(id) {
    state.provider = id;
    Array.prototype.forEach.call($('providers').children, function (b) { b.setAttribute('aria-checked', String(b.dataset.id === id)); });
  }

  function render(r) {
    if (r.status === 'PAID') return finished('Déjà payée', 'Cette demande a déjà été réglée. Merci !');
    if (r.status !== 'OPEN') return fail(r.status === 'EXPIRED' ? 'Cette demande a expiré.' : r.status === 'PENDING' ? 'Un paiement est déjà en cours pour cette demande.' : 'Cette demande a été annulée.');
    $('beneficiary').textContent = r.beneficiary;
    $('amount').textContent = fcfa(r.amount);
    $('note').textContent = r.note || '';
    state.providers = r.providers;
    r.providers.forEach(function (p) {
      var b = document.createElement('button');
      b.type = 'button';
      b.dataset.id = p.id;
      b.setAttribute('role', 'radio');
      b.setAttribute('aria-checked', 'false');
      var dot = document.createElement('span');
      dot.className = 'dot';
      dot.style.background = { ORANGE_MONEY: '#FF7900', MTN_MOMO: '#FFCB05', MOOV_MONEY: '#0057A8', WAVE: '#1DC8F1' }[p.id] || '#999';
      b.append(dot, document.createTextNode(p.name));
      b.addEventListener('click', function () { select(p.id); suggest(false); });
      $('providers').append(b);
    });
    if (r.providers[0]) select(r.providers[0].id);
    show('request');
  }

  $('phone').addEventListener('input', function () {
    var d = digits(this.value);
    this.value = d.replace(/(\d{2})(?=\d)/g, '$1 ');
    suggest(true);
  });

  $('pay-form').addEventListener('submit', function (e) {
    e.preventDefault();
    var d = digits($('phone').value);
    $('pay-error').textContent = '';
    if (d.length !== 10) { $('pay-error').textContent = 'Le numéro doit contenir 10 chiffres.'; return; }
    $('pay').disabled = true;
    fetch(API, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ provider: state.provider, phone: '+225' + d }) })
      .then(function (res) { return res.json().then(function (b) { return { ok: res.ok, body: b }; }); })
      .then(function (r) {
        if (!r.ok) throw new Error(r.body.error || 'Paiement impossible');
        if (r.body.status === 'PAID') finished('Paiement effectué', 'Merci ! ' + $('beneficiary').textContent + ' a bien reçu ' + $('amount').textContent + '.');
        else finished('Validez sur votre téléphone', r.body.message || 'Confirmez le paiement avec le code secret de votre mobile money.');
      })
      .catch(function (err) { $('pay-error').textContent = err.message; })
      .finally(function () { $('pay').disabled = false; });
  });

  if (!/^[A-Z0-9]{6,12}$/.test(code)) return fail('Lien de paiement invalide.');
  fetch(API)
    .then(function (res) { return res.json().then(function (b) { if (!res.ok) throw new Error(b.error || 'Demande introuvable'); return b; }); })
    .then(render)
    .catch(function (err) { fail(err.message); });
})();
