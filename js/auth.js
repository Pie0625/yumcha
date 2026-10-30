// Sign in, and the Supabase connection, shared by every page that uses the community.
//
// Other scripts use window.Yumcha.auth:
//   enabled        false until js/config.js is filled in (then nothing else here runs)
//   ready          a promise that gives the Supabase client once it is ready
//   client, user   the client, and the signed-in person (or null)
//   onUserChange   run a function when someone signs in or out
//   openAuth, signOut, openReport   the sign-in window, sign out, and the report window
(function () {
  'use strict';

  var Y = window.Yumcha;
  var cfg = window.YUMCHA_CONFIG || {};
  var enabled = !!(cfg.supabaseUrl && cfg.supabaseAnonKey);

  // Accept the project address with or without the "/rest/v1/" ending that Supabase shows elsewhere.
  var url = String(cfg.supabaseUrl || '').trim().replace(/\/rest\/v1\/?$/i, '').replace(/\/+$/, '');

  var auth = {
    enabled: enabled,
    url: url,
    client: null,
    user: null,
    ready: null,
    onUserChange: function (fn) { listeners.push(fn); },
    openAuth: openAuth,
    openReport: openReport,
    signOut: function () { if (auth.client) auth.client.auth.signOut(); },
    storedName: storedName,
    suggestedName: suggestedName
  };
  var listeners = [];
  Y.auth = auth;
  if (!enabled) return;

  // ------------------------------------------------------------------ helpers
  function storedName(user) {
    return String(((user && user.user_metadata) || {}).display_name || '').trim();
  }

  // For a name box: the saved name, or the first word of a Google name.
  function suggestedName(user) {
    var m = (user && user.user_metadata) || {};
    if (storedName(user)) return storedName(user);
    return String(m.full_name || m.name || '').trim().split(/\s+/)[0] || '';
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

  var say = Y.say;
  var esc = Y.escapeHtml;

  // ------------------------------------------------------------------ connection
  function loadSdk() {
    return new Promise(function (resolve, reject) {
      if (window.supabase && window.supabase.createClient) return resolve();
      var s = document.createElement('script');
      s.src = Y.root + 'js/vendor/supabase.js';
      s.onload = resolve;
      s.onerror = function () { reject(new Error('Could not load the sign-in library.')); };
      document.head.appendChild(s);
    });
  }

  auth.ready = loadSdk().then(function () {
    auth.client = window.supabase.createClient(url, cfg.supabaseAnonKey);

    auth.client.auth.onAuthStateChange(function (event, session) {
      var before = auth.user && auth.user.id;
      auth.user = session ? session.user : null;
      var changed = before !== (auth.user && auth.user.id);
      // Wait a moment before touching the page, as the Supabase docs advise.
      setTimeout(function () {
        if (changed) listeners.forEach(function (fn) { fn(auth.user); });
        if (event === 'PASSWORD_RECOVERY') openAuth('reset');
      }, 0);
    });

    return auth.client.auth.getSession();
  }).then(function (res) {
    auth.user = (res.data && res.data.session) ? res.data.session.user : null;
    return auth.client;
  });
  auth.ready.catch(function () {}); // the pages that need it report the problem themselves

  // ------------------------------------------------------------------ sign in, create account, new password
  var win = null;

  function ensureAuth() {
    if (win) return win;
    var google = cfg.enableGoogle
      ? '<div class="auth-google"><button type="button" class="btn btn-ghost" id="auth-google">Continue with Google</button>' +
        '<p class="dialog-or">or use your email</p></div>'
      : '';
    var d = Y.buildDialog('auth-dialog',
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

    win = {
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

    win.cancel.addEventListener('click', function () { d.close(); });
    win.seg.addEventListener('click', function (e) {
      var b = e.target.closest('button[data-mode]');
      if (b) setAuthMode(b.getAttribute('data-mode'));
    });
    win.form.addEventListener('submit', submitAuth);
    win.forgot.addEventListener('click', sendReset);
    var g = d.querySelector('#auth-google');
    if (g) g.addEventListener('click', function () {
      say(win.msg, '');
      auth.client.auth.signInWithOAuth({ provider: 'google', options: { redirectTo: window.location.href.split('#')[0] } })
        .then(function (res) { if (res.error) say(win.msg, authError(res.error)); });
    });
    return win;
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
    var a = win;
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
      request = auth.client.auth.signUp({
        email: email, password: password,
        options: { data: { display_name: name }, emailRedirectTo: window.location.href.split('#')[0] }
      });
    } else if (a.mode === 'reset') {
      request = auth.client.auth.updateUser({ password: password });
    } else {
      request = auth.client.auth.signInWithPassword({ email: email, password: password });
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
    var a = win;
    var email = a.email.value.trim();
    if (!/^\S+@\S+\.\S+$/.test(email)) return say(a.msg, 'Enter your email above first, then press "Forgot password?".');
    auth.client.auth.resetPasswordForEmail(email, { redirectTo: window.location.href.split('#')[0] }).then(function (res) {
      if (res.error) throw res.error;
      say(a.msg, 'If that email has an account, we sent a link to reset the password.', true);
    }).catch(function (err) { say(a.msg, authError(err)); });
  }

  // ------------------------------------------------------------------ report something
  // target: { table: 'reports', column: 'experience_id', id: '...' }
  var report = null;
  var target = null;

  function openReport(t) {
    if (!auth.user) return openAuth('signin', 'Sign in to report');
    if (!report) {
      var reasons = ['Spam or advertising', 'Rude or offensive', 'Fake or misleading', 'Something else'];
      var radios = reasons.map(function (r, i) {
        return '<label class="reason"><input type="radio" name="reason" value="' + esc(r) + '"' + (i === 0 ? ' checked' : '') + '> ' + esc(r) + '</label>';
      }).join('');
      var d = Y.buildDialog('report-dialog',
        '<h2 id="report-title">Report this</h2>' +
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
        var row = { reason: report.form.querySelector('input[name="reason"]:checked').value };
        row[target.column] = target.id;
        report.submit.disabled = true;
        auth.client.from(target.table).insert(row).then(function (res) {
          if (res.error) throw res.error;
          say(report.msg, 'Thank you. We will take a look.', true);
          report.submit.hidden = true;
          report.cancel.textContent = 'Close';
        }).catch(function (err) {
          say(report.msg, Y.friendlyError(err, 'You have already reported this.'));
          report.submit.disabled = false;
        });
      });
    }
    target = t;
    say(report.msg, '');
    report.submit.hidden = false;
    report.submit.disabled = false;
    report.cancel.textContent = 'Cancel';
    report.dialog.showModal();
  }
})();
