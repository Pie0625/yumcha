// Community: sign in, read and share experiences on a cafe page.
//
// Needs Supabase (see the README). Until js/config.js is filled in this file does nothing,
// and the page keeps its "coming soon" text.
(function () {
  'use strict';

  var cfg = window.YUMCHA_CONFIG || {};
  var section = document.getElementById('experiences');
  var cafeId = window.YUMCHA_CAFE_ID;
  if (!section || !cafeId || !cfg.supabaseUrl || !cfg.supabaseAnonKey) return;

  var esc = window.Yumcha.escapeHtml;
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
  function loadSdk() {
    return new Promise(function (resolve, reject) {
      if (window.supabase && window.supabase.createClient) return resolve();
      var s = document.createElement('script');
      s.src = window.Yumcha.root + 'js/vendor/supabase.js';
      s.onload = resolve;
      s.onerror = function () { reject(new Error('Could not load the sign-in library.')); };
      document.head.appendChild(s);
    });
  }

  function storedName(user) {
    return String(((user && user.user_metadata) || {}).display_name || '').trim();
  }

  // For the name box: the saved name, or the first word of a Google name.
  function suggestedName(user) {
    var m = (user && user.user_metadata) || {};
    if (storedName(user)) return storedName(user);
    return String(m.full_name || m.name || '').trim().split(/\s+/)[0] || '';
  }

  function myPost() {
    if (!state.user) return null;
    return state.items.filter(function (x) { return x.user_id === state.user.id; })[0] || null;
  }

  function starsHtml(n) {
    n = Math.max(0, Math.min(5, Number(n) || 0));
    return '<span class="stars" role="img" aria-label="Rated ' + n + ' out of 5">' +
      '★'.repeat(n) + '<span class="stars-off">' + '★'.repeat(5 - n) + '</span></span>';
  }

  function formatDate(iso) {
    var d = new Date(iso);
    return isNaN(d) ? '' : d.toLocaleDateString('en-MY', { day: 'numeric', month: 'short', year: 'numeric' });
  }

  // Short, plain messages for database errors. `duplicate` is shown when the same thing is done twice.
  function friendlyError(err, duplicate) {
    var msg = String((err && err.message) || '');
    if (err && err.code === '23505') return duplicate || 'You have already done this.';
    if (err && err.code === '23514') return 'Posts need a rating from 1 to 5 and 10 to 1000 characters.';
    if ((err && err.code === '42501') || /row-level security|jwt/i.test(msg)) return 'Please sign in again and try once more.';
    if (/failed to fetch|network|load failed/i.test(msg)) return 'Could not reach the server. Check your connection and try again.';
    return 'Something went wrong. Please try again.';
  }

  // Messages for sign in and sign up errors.
  function authError(err) {
    var msg = String((err && err.message) || '');
    if (/invalid login credentials/i.test(msg)) return 'That email and password do not match.';
    if (/email not confirmed/i.test(msg)) return 'Confirm your email first. Check your inbox for the link.';
    if (/already registered/i.test(msg)) return 'That email already has an account. Try signing in.';
    if ((err && err.status === 429) || /rate limit/i.test(msg)) return 'Too many tries. Wait a few minutes and try again.';
    if (/failed to fetch|network|load failed/i.test(msg)) return 'Could not reach the server. Check your connection and try again.';
    return msg || 'Something went wrong. Please try again.';
  }

  function say(el, text, ok) {
    el.textContent = text;
    el.className = 'form-message' + (ok ? ' is-ok' : '');
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
      composeEl.querySelector('#exp-signin').addEventListener('click', function () { openAuth('signin', 'Sign in to share'); });
      return;
    }

    var who = storedName(state.user) || 'your account';
    var account = '<p class="exp-account">Signed in as ' + esc(who) +
      '. <button type="button" class="link-btn" id="exp-signout">Sign out</button></p>';

    if (myPost()) {
      composeEl.innerHTML = account + '<p class="exp-note">You have shared your experience here. Delete it below if you want to post a new one.</p>';
      composeEl.querySelector('#exp-signout').addEventListener('click', signOut);
      return;
    }

    var rating = '';
    for (var i = 1; i <= 5; i++) {
      rating += '<label class="rate-opt"><input type="radio" name="rating" value="' + i + '"><span>' + i + '</span></label>';
    }
    composeEl.innerHTML = account +
      '<form class="exp-form" id="exp-form" novalidate>' +
        '<div class="field"><label for="exp-name">Your name (shown with your post)</label>' +
          '<input id="exp-name" name="name" maxlength="40" autocomplete="nickname" value="' + esc(suggestedName(state.user)) + '"></div>' +
        '<fieldset class="rate"><legend>Your rating</legend>' + rating +
          '<p class="rate-hint">1 is poor, 5 is great</p></fieldset>' +
        '<div class="field"><label for="exp-body">Your experience</label>' +
          '<textarea id="exp-body" name="body" rows="4" maxlength="1000" placeholder="What was it like? Food, seats, noise, wifi, who you went with..."></textarea>' +
          '<p class="exp-count" id="exp-count">0 / 1000</p></div>' +
        '<p class="exp-note">Posts are public. Share honest, respectful experiences from your own visit.</p>' +
        '<p class="form-message" id="exp-msg" role="alert"></p>' +
        '<button type="submit" class="btn" id="exp-submit">Post experience</button>' +
      '</form>';

    composeEl.querySelector('#exp-signout').addEventListener('click', signOut);
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

  function signOut() {
    client.auth.signOut();
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
    var saveName = storedName(state.user) === name
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
    else openReport(id);
  });

  // ------------------------------------------------------------------ dialogs
  function buildDialog(id, html) {
    var d = document.createElement('dialog');
    d.className = 'dialog';
    d.id = id;
    d.innerHTML = '<div class="dialog-body">' + html + '</div>';
    d.addEventListener('click', function (e) { if (e.target === d) d.close(); });
    document.body.appendChild(d);
    return d;
  }

  // ---- sign in, create account, set a new password
  var auth = null;

  function ensureAuth() {
    if (auth) return auth;
    var google = cfg.enableGoogle
      ? '<div class="auth-google"><button type="button" class="btn btn-ghost" id="auth-google">Continue with Google</button>' +
        '<p class="dialog-or">or use your email</p></div>'
      : '';
    var d = buildDialog('auth-dialog',
      '<h2 id="auth-title">Sign in to share</h2>' + google +
      '<div class="seg" id="auth-seg" role="group" aria-label="Sign in or create an account">' +
        '<button type="button" class="chip" data-mode="signin" aria-pressed="true">Sign in</button>' +
        '<button type="button" class="chip" data-mode="signup" aria-pressed="false">Create account</button>' +
      '</div>' +
      '<form id="auth-form" novalidate>' +
        '<div class="field" id="auth-name-field" hidden><label for="auth-name">Your name (shown with your posts)</label>' +
          '<input id="auth-name" maxlength="40" autocomplete="nickname"></div>' +
        '<div class="field" id="auth-email-field"><label for="auth-email">Email</label>' +
          '<input id="auth-email" type="email" autocomplete="email"></div>' +
        '<div class="field"><label for="auth-password" id="auth-password-label">Password</label>' +
          '<input id="auth-password" type="password" autocomplete="current-password">' +
          '<p class="field-hint" id="auth-hint" hidden>At least 8 characters.</p></div>' +
        '<button type="button" class="link-btn" id="auth-forgot">Forgot password?</button>' +
        '<p class="form-message" id="auth-msg" role="alert"></p>' +
        '<div class="dialog-actions">' +
          '<button type="submit" class="btn" id="auth-submit">Sign in</button>' +
          '<button type="button" class="link-btn" id="auth-cancel">Cancel</button>' +
        '</div>' +
      '</form>');

    auth = {
      dialog: d, mode: 'signin',
      title: d.querySelector('#auth-title'), seg: d.querySelector('#auth-seg'),
      google: d.querySelector('.auth-google'),
      form: d.querySelector('#auth-form'),
      nameField: d.querySelector('#auth-name-field'), emailField: d.querySelector('#auth-email-field'),
      name: d.querySelector('#auth-name'), email: d.querySelector('#auth-email'),
      password: d.querySelector('#auth-password'), passwordLabel: d.querySelector('#auth-password-label'),
      hint: d.querySelector('#auth-hint'), forgot: d.querySelector('#auth-forgot'),
      msg: d.querySelector('#auth-msg'), submit: d.querySelector('#auth-submit'), cancel: d.querySelector('#auth-cancel')
    };

    auth.cancel.addEventListener('click', function () { d.close(); });
    auth.seg.addEventListener('click', function (e) {
      var b = e.target.closest('button[data-mode]');
      if (b) setAuthMode(b.getAttribute('data-mode'));
    });
    auth.form.addEventListener('submit', submitAuth);
    auth.forgot.addEventListener('click', sendReset);
    var g = d.querySelector('#auth-google');
    if (g) g.addEventListener('click', function () {
      say(auth.msg, '');
      client.auth.signInWithOAuth({ provider: 'google', options: { redirectTo: window.location.href.split('#')[0] } })
        .then(function (res) { if (res.error) say(auth.msg, authError(res.error)); });
    });
    return auth;
  }

  function setAuthMode(mode) {
    var a = ensureAuth();
    var reset = mode === 'reset';
    a.mode = mode;
    a.seg.hidden = reset;
    if (a.google) a.google.hidden = reset;
    a.nameField.hidden = mode !== 'signup';
    a.emailField.hidden = reset;
    a.forgot.hidden = mode !== 'signin';
    a.hint.hidden = mode === 'signin';
    a.passwordLabel.textContent = reset ? 'New password' : 'Password';
    a.password.setAttribute('autocomplete', mode === 'signin' ? 'current-password' : 'new-password');
    a.submit.textContent = { signin: 'Sign in', signup: 'Create account', reset: 'Save new password' }[mode];
    a.submit.hidden = false;
    a.submit.disabled = false;
    a.cancel.textContent = 'Cancel';
    Array.prototype.forEach.call(a.seg.querySelectorAll('button'), function (b) {
      b.setAttribute('aria-pressed', b.getAttribute('data-mode') === mode ? 'true' : 'false');
    });
    say(a.msg, '');
  }

  function openAuth(mode, title) {
    var a = ensureAuth();
    setAuthMode(mode);
    a.title.textContent = mode === 'reset' ? 'Choose a new password' : (title || 'Sign in to share');
    if (!a.dialog.open) a.dialog.showModal();
  }

  function submitAuth(e) {
    e.preventDefault();
    var a = auth;
    var email = a.email.value.trim();
    var password = a.password.value;
    var name = a.name.value.trim();

    if (a.mode !== 'reset' && !/^\S+@\S+\.\S+$/.test(email)) return say(a.msg, 'Enter a valid email address.');
    if (a.mode === 'signin' && !password) return say(a.msg, 'Enter your password.');
    if (a.mode !== 'signin' && password.length < 8) return say(a.msg, 'Use a password with at least 8 characters.');
    if (a.mode === 'signup' && !name) return say(a.msg, 'Add a name to show with your posts.');

    say(a.msg, '');
    a.submit.disabled = true;

    var request;
    if (a.mode === 'signup') {
      request = client.auth.signUp({
        email: email, password: password,
        options: { data: { display_name: name }, emailRedirectTo: window.location.href.split('#')[0] }
      });
    } else if (a.mode === 'reset') {
      request = client.auth.updateUser({ password: password });
    } else {
      request = client.auth.signInWithPassword({ email: email, password: password });
    }

    request.then(function (res) {
      if (res.error) throw res.error;
      a.password.value = '';
      if (a.mode === 'reset') {
        say(a.msg, 'Password updated. You are signed in.', true);
        a.submit.hidden = true;
        a.cancel.textContent = 'Close';
      } else if (a.mode === 'signup' && !(res.data && res.data.session)) {
        say(a.msg, 'Check your email and open the link to confirm your account. Then come back and sign in.', true);
        a.submit.disabled = false;
      } else {
        a.dialog.close();
      }
    }).catch(function (err) {
      say(a.msg, authError(err));
      a.submit.disabled = false;
    });
  }

  function sendReset() {
    var a = auth;
    var email = a.email.value.trim();
    if (!/^\S+@\S+\.\S+$/.test(email)) return say(a.msg, 'Enter your email above first, then press "Forgot password?".');
    client.auth.resetPasswordForEmail(email, { redirectTo: window.location.href.split('#')[0] }).then(function (res) {
      if (res.error) throw res.error;
      say(a.msg, 'If that email has an account, we sent a link to reset the password.', true);
    }).catch(function (err) { say(a.msg, authError(err)); });
  }

  // ---- report an experience
  var report = null;
  var reportingId = null;

  function openReport(experienceId) {
    if (!state.user) return openAuth('signin', 'Sign in to report');
    if (!report) {
      var reasons = ['Spam or advertising', 'Rude or offensive', 'Fake or misleading', 'Something else'];
      var radios = reasons.map(function (r, i) {
        return '<label class="reason"><input type="radio" name="reason" value="' + esc(r) + '"' + (i === 0 ? ' checked' : '') + '> ' + esc(r) + '</label>';
      }).join('');
      var d = buildDialog('report-dialog',
        '<h2 id="report-title">Report this experience</h2>' +
        '<form id="report-form"><fieldset class="reasons"><legend class="sr-only">Reason</legend>' + radios + '</fieldset>' +
          '<p class="form-message" id="report-msg" role="alert"></p>' +
          '<div class="dialog-actions">' +
            '<button type="submit" class="btn" id="report-submit">Send report</button>' +
            '<button type="button" class="link-btn" id="report-cancel">Cancel</button>' +
          '</div></form>');
      report = { dialog: d, form: d.querySelector('#report-form'), msg: d.querySelector('#report-msg'),
                 submit: d.querySelector('#report-submit'), cancel: d.querySelector('#report-cancel') };
      report.cancel.addEventListener('click', function () { d.close(); });
      report.form.addEventListener('submit', function (e) {
        e.preventDefault();
        var reason = report.form.querySelector('input[name="reason"]:checked').value;
        report.submit.disabled = true;
        client.from('reports').insert({ experience_id: reportingId, reason: reason }).then(function (res) {
          if (res.error) throw res.error;
          say(report.msg, 'Thank you. We will take a look.', true);
          report.submit.hidden = true;
          report.cancel.textContent = 'Close';
        }).catch(function (err) {
          say(report.msg, friendlyError(err, 'You have already reported this experience.'));
          report.submit.disabled = false;
        });
      });
    }
    reportingId = experienceId;
    say(report.msg, '');
    report.submit.hidden = false;
    report.submit.disabled = false;
    report.cancel.textContent = 'Cancel';
    report.dialog.showModal();
  }

  // ------------------------------------------------------------------ start
  loadSdk().then(function () {
    client = window.supabase.createClient(cfg.supabaseUrl, cfg.supabaseAnonKey);

    client.auth.onAuthStateChange(function (event, session) {
      var before = state.user && state.user.id;
      state.user = session ? session.user : null;
      var changed = before !== (state.user && state.user.id);
      // Wait a moment before touching the page, as the Supabase docs advise.
      setTimeout(function () {
        if (changed && state.status !== 'loading') { renderCompose(); renderList(); }
        if (event === 'PASSWORD_RECOVERY') openAuth('reset');
      }, 0);
    });

    return client.auth.getSession();
  }).then(function (res) {
    state.user = (res.data && res.data.session) ? res.data.session.user : null;
    return loadExperiences();
  }).catch(function (err) {
    state.status = 'error';
    if (!client) summaryEl.textContent = 'The community is not available right now. Please try again later.';
    if (window.console) console.error('Yumcha community:', err);
  }).then(renderAll);
})();
