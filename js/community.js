// Community: sign in, read and share experiences on a cafe page.
//
// Needs Supabase (see the README). Until js/config.js is filled in this file does nothing,
// and the page keeps its "coming soon" text.
(function () {
  'use strict';

  var A = window.Yumcha.auth;
  var section = document.getElementById('experiences');
  var cafeId = window.YUMCHA_CAFE_ID;
  if (!section || !cafeId || !A || !A.enabled) return;

  var esc = window.Yumcha.escapeHtml;
  var say = window.Yumcha.say;
  var starsHtml = window.Yumcha.starsHtml;
  var formatDate = window.Yumcha.formatDate;
  var friendlyError = window.Yumcha.friendlyError;
  var client = null;
  var state = { user: null, items: [], status: 'loading' }; // status: loading, ready or error

  section.classList.add('is-live');
  section.innerHTML =
    '<h2 id="exp-title">Experiences</h2>' +
    '<p class="exp-summary" id="exp-summary">Loading experiences...</p>' +
    '<div id="exp-compose"></div>' +
    '<ul class="exp-list" id="exp-list"></ul>';

  var summaryEl = section.querySelector('#exp-summary');
  var composeEl = section.querySelector('#exp-compose');
  var listEl = section.querySelector('#exp-list');

  // ------------------------------------------------------------------ helpers
  function myPost() {
    if (!state.user) return null;
    return state.items.filter(function (x) { return x.user_id === state.user.id; })[0] || null;
  }

  // ------------------------------------------------------------------ rendering
  function renderSummary() {
    if (state.status === 'loading') { summaryEl.textContent = 'Loading experiences...'; return; }
    if (state.status === 'error') { summaryEl.textContent = ''; return; }
    var n = state.items.length;
    if (!n) { summaryEl.textContent = 'No experiences yet. Be the first to share one.'; return; }
    var total = state.items.reduce(function (t, x) { return t + Number(x.rating); }, 0);
    summaryEl.textContent = (total / n).toFixed(1) + ' average from ' + n + (n === 1 ? ' experience.' : ' experiences.');
  }

  function renderList() {
    if (state.status === 'loading') { listEl.innerHTML = ''; return; }
    if (state.status === 'error') {
      listEl.innerHTML = '<li class="exp-empty">We could not load experiences. Refresh the page to try again.</li>';
      return;
    }
    listEl.innerHTML = state.items.map(function (x) {
      var own = state.user && x.user_id === state.user.id;
      return '<li class="exp-item" data-id="' + esc(x.id) + '">' +
        '<div class="exp-head">' +
          '<strong class="exp-author">' + esc(x.author_name) + '</strong>' +
          (own ? '<span class="exp-you">You</span>' : '') +
          starsHtml(x.rating) +
          '<time datetime="' + esc(x.created_at) + '">' + esc(formatDate(x.created_at)) + '</time>' +
        '</div>' +
        '<p class="exp-body">' + esc(x.body) + '</p>' +
        '<div class="exp-actions">' +
          (own ? '<button type="button" class="link-btn" data-action="delete">Delete</button>'
               : '<button type="button" class="link-btn" data-action="report">Report</button>') +
        '</div>' +
      '</li>';
    }).join('');
  }

  function renderCompose() {
    if (state.status !== 'ready') { composeEl.innerHTML = ''; return; }

    if (!state.user) {
      composeEl.innerHTML =
        '<div class="exp-cta"><p>Been here? Sign in to share your experience.</p>' +
        '<button type="button" class="btn" id="exp-signin">Sign in to share</button></div>';
      composeEl.querySelector('#exp-signin').addEventListener('click', function () { A.openAuth('signin', 'Sign in to share'); });
      return;
    }

    var who = A.storedName(state.user) || 'your account';
    var account = '<p class="exp-account">Signed in as ' + esc(who) +
      '. <button type="button" class="link-btn" id="exp-signout">Sign out</button></p>';

    if (myPost()) {
      composeEl.innerHTML = account + '<p class="exp-note">You have shared your experience here. Delete it below if you want to post a new one.</p>';
      composeEl.querySelector('#exp-signout').addEventListener('click', A.signOut);
      return;
    }

    var rating = '';
    for (var i = 1; i <= 5; i++) {
      rating += '<label class="rate-opt"><input type="radio" name="rating" value="' + i + '"><span>' + i + '</span></label>';
    }
    composeEl.innerHTML = account +
      '<form class="exp-form" id="exp-form" novalidate>' +
        '<div class="field"><label for="exp-name">Your name (shown with your post)</label>' +
          '<input id="exp-name" name="name" maxlength="40" autocomplete="nickname" value="' + esc(A.suggestedName(state.user)) + '"></div>' +
        '<fieldset class="rate"><legend>Your rating</legend>' + rating +
          '<p class="rate-hint">1 is poor, 5 is great</p></fieldset>' +
        '<div class="field"><label for="exp-body">Your experience</label>' +
          '<textarea id="exp-body" name="body" rows="4" maxlength="1000" placeholder="What was it like? Food, seats, noise, wifi, who you went with..."></textarea>' +
          '<p class="exp-count" id="exp-count">0 / 1000</p></div>' +
        '<p class="exp-note">Posts are public. Share honest, respectful experiences from your own visit.</p>' +
        '<p class="form-message" id="exp-msg" role="alert"></p>' +
        '<button type="submit" class="btn" id="exp-submit">Post experience</button>' +
      '</form>';

    composeEl.querySelector('#exp-signout').addEventListener('click', A.signOut);
    composeEl.querySelector('#exp-form').addEventListener('submit', submitExperience);
    var body = composeEl.querySelector('#exp-body');
    var count = composeEl.querySelector('#exp-count');
    body.addEventListener('input', function () { count.textContent = body.value.length + ' / 1000'; });
  }

  function renderAll() {
    renderSummary();
    renderCompose();
    renderList();
  }

  // ------------------------------------------------------------------ data
  function loadExperiences() {
    return client.from('experiences')
      .select('id,user_id,author_name,rating,body,created_at')
      .eq('cafe_id', cafeId)
      .order('created_at', { ascending: false })
      .limit(100)
      .then(function (res) {
        if (res.error) throw res.error;
        state.items = res.data || [];
        state.status = 'ready';
      });
  }

  function submitExperience(e) {
    e.preventDefault();
    var form = e.target;
    var msg = form.querySelector('#exp-msg');
    var button = form.querySelector('#exp-submit');
    var name = form.elements.name.value.trim();
    var picked = form.querySelector('input[name="rating"]:checked');
    var body = form.elements.body.value.trim();

    if (!name) return say(msg, 'Add a name to show with your post.');
    if (!picked) return say(msg, 'Choose a rating from 1 to 5.');
    if (body.length < 10) return say(msg, 'Write at least 10 characters about your visit.');

    say(msg, '');
    button.disabled = true;
    button.textContent = 'Posting...';

    // The name on a post comes from the account, so save it there first if it changed.
    var saveName = A.storedName(state.user) === name
      ? Promise.resolve({})
      : client.auth.updateUser({ data: { display_name: name } });

    saveName.then(function (res) {
      if (res && res.error) throw res.error;
      return client.from('experiences').insert({ cafe_id: cafeId, rating: Number(picked.value), body: body });
    }).then(function (res) {
      if (res.error) throw res.error;
      return loadExperiences();
    }).then(renderAll).catch(function (err) {
      say(msg, friendlyError(err, 'You have already shared an experience for this cafe.'));
      button.disabled = false;
      button.textContent = 'Post experience';
    });
  }

  function deleteExperience(id) {
    if (!window.confirm('Delete your experience? This cannot be undone.')) return;
    client.from('experiences').delete().eq('id', id).then(function (res) {
      if (res.error) throw res.error;
      state.items = state.items.filter(function (x) { return x.id !== id; });
      renderAll();
    }).catch(function (err) {
      window.alert(friendlyError(err));
    });
  }

  listEl.addEventListener('click', function (e) {
    var button = e.target.closest('button[data-action]');
    if (!button) return;
    var id = button.closest('.exp-item').getAttribute('data-id');
    if (button.getAttribute('data-action') === 'delete') deleteExperience(id);
    else A.openReport({ table: 'reports', column: 'experience_id', id: id });
  });

  // ------------------------------------------------------------------ start
  A.ready.then(function (c) {
    client = c;
    state.user = A.user;
    return loadExperiences();
  }).catch(function (err) {
    state.status = 'error';
    if (!client) summaryEl.textContent = 'The community is not available right now. Please try again later.';
    if (window.console) console.error('Yumcha community:', err);
  }).then(renderAll);

  A.onUserChange(function (user) {
    state.user = user;
    if (state.status !== 'loading') { renderCompose(); renderList(); }
  });
})();
