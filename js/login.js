// Login page: continue with Google, or get a one-time code by email.
//
// Email sign-in sends a code (not a link). For that to work, the email templates in Supabase
// must include {{ .Token }}. See the README.
(function () {
  'use strict';

  var Y = window.Yumcha;
  var A = Y.auth;
  var cfg = window.YUMCHA_CONFIG || {};
  var host = document.getElementById('login');
  if (!host) return;
  var esc = Y.escapeHtml;
  var say = Y.say;
  var PENDING = 'yumcha-login-pending';
  var COOLDOWN = 60;

  if (!A || !A.enabled) {
    host.innerHTML = '<h1>Sign in opens soon</h1><p class="login-lede">Accounts will be available once the community is switched on.</p>' +
      '<p><a class="btn btn-link" href="' + esc(Y.root + 'home/') + '">Back to the cafes</a></p>';
    return;
  }

  // Where to go afterwards: only pages on this site, and never the login page itself.
  function nextPage() {
    var fallback = Y.root + 'home/';
    try {
      var want = new URLSearchParams(window.location.search).get('next') || '';
      var u = new URL(want, window.location.origin);
      var base = new URL(Y.root).pathname;
      if (u.origin !== window.location.origin || u.pathname.indexOf(base) !== 0) return fallback;
      if (u.pathname.indexOf(base + 'login') === 0) return fallback;
      return u.pathname + u.search;
    } catch (e) { return fallback; }
  }
  function remember(on) {
    try { if (on) sessionStorage.setItem(PENDING, '1'); else sessionStorage.removeItem(PENDING); } catch (e) {}
  }
  function wasPending() { try { return sessionStorage.getItem(PENDING) === '1'; } catch (e) { return false; } }
  function go() { remember(false); window.location.replace(nextPage()); }

  var client = null;
  var timer = null;
  var email = '';

  function clearTimer() { if (timer) { clearInterval(timer); timer = null; } }

  // ------------------------------------------------------------------ screens
  function chooseScreen() {
    clearTimer();
    var google = cfg.enableGoogle
      ? '<button type="button" class="btn btn-ghost login-google" id="login-google">Continue with Google</button>' +
        '<p class="dialog-or">or use your email</p>'
      : '';
    host.innerHTML =
      '<h1>Sign in to Yumcha</h1>' +
      '<p class="login-lede">Post recommendations, add photos, rate places and react to posts.</p>' + google +
      '<form id="login-form" novalidate>' +
        '<div class="field"><label for="login-email">Email</label>' +
          '<input id="login-email" type="email" autocomplete="email" inputmode="email" placeholder="you@example.com"></div>' +
        '<p class="field-hint">We will email you a code. No password needed. New here? This creates your account.</p>' +
        '<p class="form-message" id="login-msg" role="alert"></p>' +
        '<button type="submit" class="btn" id="login-send">Email me a code</button>' +
      '</form>';
    var form = host.querySelector('#login-form');
    var input = host.querySelector('#login-email');
    if (email) input.value = email;
    form.addEventListener('submit', function (e) { e.preventDefault(); sendCode(input.value.trim(), form); });
    var g = host.querySelector('#login-google');
    if (g) g.addEventListener('click', function () {
      var msg = host.querySelector('#login-msg');
      say(msg, '');
      remember(true);
      client.auth.signInWithOAuth({ provider: 'google', options: { redirectTo: window.location.origin + window.location.pathname + window.location.search } })
        .then(function (res) { if (res.error) { remember(false); say(msg, A.errorMessage(res.error)); } });
    });
  }

  function codeScreen() {
    host.innerHTML =
      '<h1>Check your email</h1>' +
      '<p class="login-lede">We sent a code to <strong id="login-sent-to"></strong>. Type it below.</p>' +
      '<form id="login-form" novalidate>' +
        '<div class="field"><label for="login-code">Code</label>' +
          '<input id="login-code" class="login-code" inputmode="numeric" autocomplete="one-time-code" maxlength="12" placeholder="123456"></div>' +
        '<p class="form-message" id="login-msg" role="alert"></p>' +
        '<button type="submit" class="btn" id="login-verify">Sign in</button>' +
      '</form>' +
      '<p class="login-links"><button type="button" class="link-btn" id="login-resend"></button>' +
        '<button type="button" class="link-btn" id="login-change">Use a different email</button></p>' +
      '<p class="field-hint">Can\'t find it? Look in your spam folder.</p>';
    host.querySelector('#login-sent-to').textContent = email;
    var input = host.querySelector('#login-code');
    var form = host.querySelector('#login-form');
    input.focus();
    form.addEventListener('submit', function (e) { e.preventDefault(); verify(input.value, form); });
    host.querySelector('#login-change').addEventListener('click', chooseScreen);
    var resend = host.querySelector('#login-resend');
    resend.addEventListener('click', function () { sendCode(email, null, true); });
    startCooldown(resend);
  }

  function startCooldown(btn) {
    clearTimer();
    var left = COOLDOWN;
    function tick() {
      if (left > 0) { btn.disabled = true; btn.textContent = 'Send a new code in ' + left + 's'; left--; }
      else { btn.disabled = false; btn.textContent = 'Send a new code'; clearTimer(); }
    }
    tick();
    timer = setInterval(tick, 1000);
  }

  function nameScreen(user) {
    clearTimer();
    host.innerHTML =
      '<h1>What should we call you?</h1>' +
      '<p class="login-lede">This name is shown with your posts. You can change it later when you post.</p>' +
      '<form id="login-form" novalidate>' +
        '<div class="field"><label for="login-name">Your name</label>' +
          '<input id="login-name" maxlength="40" autocomplete="nickname"></div>' +
        '<p class="form-message" id="login-msg" role="alert"></p>' +
        '<button type="submit" class="btn" id="login-save">Continue</button>' +
      '</form>';
    var input = host.querySelector('#login-name');
    input.value = A.suggestedName(user);
    input.focus();
    host.querySelector('#login-form').addEventListener('submit', function (e) {
      e.preventDefault();
      var msg = host.querySelector('#login-msg');
      var btn = host.querySelector('#login-save');
      var name = input.value.trim();
      if (!name) return say(msg, 'Add a name to show with your posts.');
      btn.disabled = true;
      client.auth.updateUser({ data: { display_name: name } }).then(function (res) {
        if (res.error) throw res.error;
        go();
      }).catch(function (err) { say(msg, A.errorMessage(err)); btn.disabled = false; });
    });
  }

  function signedInScreen(user) {
    clearTimer();
    host.innerHTML =
      '<h1>You are signed in</h1>' +
      '<p class="login-lede">Signed in as <strong id="login-who"></strong>.</p>' +
      '<p class="login-links"><a class="btn btn-link" id="login-continue" href="#">Continue</a>' +
        '<button type="button" class="link-btn" id="login-out">Sign out</button></p>';
    host.querySelector('#login-who').textContent = A.storedName(user) || user.email || 'your account';
    host.querySelector('#login-continue').addEventListener('click', function (e) { e.preventDefault(); go(); });
    host.querySelector('#login-out').addEventListener('click', function () {
      client.auth.signOut().then(function () { email = ''; chooseScreen(); });
    });
  }

  // ------------------------------------------------------------------ actions
  function sendCode(address, form, again) {
    var msg = host.querySelector('#login-msg');
    if (!/^\S+@\S+\.\S+$/.test(address)) return say(msg, 'Enter a valid email address.');
    var btn = form ? form.querySelector('button[type="submit"]') : host.querySelector('#login-resend');
    say(msg, ''); btn.disabled = true;
    client.auth.signInWithOtp({ email: address, options: { shouldCreateUser: true } }).then(function (res) {
      if (res.error) throw res.error;
      email = address;
      if (again) { say(msg, 'We sent a new code.', true); startCooldown(btn); }
      else codeScreen();
    }).catch(function (err) {
      say(msg, A.errorMessage(err));
      if (again) startCooldown(btn); else btn.disabled = false;
    });
  }

  function verify(raw, form) {
    var msg = host.querySelector('#login-msg');
    var code = String(raw).replace(/\s+/g, '');
    if (!/^\d{6,10}$/.test(code)) return say(msg, 'Type the number from the email (6 to 10 digits).');
    var btn = form.querySelector('button[type="submit"]');
    say(msg, ''); btn.disabled = true;
    client.auth.verifyOtp({ email: email, token: code, type: 'email' }).then(function (res) {
      if (res.error) throw res.error;
      var user = res.data && res.data.user;
      if (!user) throw new Error('Something went wrong. Please try again.');
      if (A.storedName(user)) go(); else nameScreen(user);
    }).catch(function (err) {
      say(msg, A.errorMessage(err));
      btn.disabled = false;
    });
  }

  // ------------------------------------------------------------------ start
  A.ready.then(function (c) {
    client = c;
    var user = A.user;
    if (!user) { remember(false); return chooseScreen(); }
    if (!A.storedName(user)) return nameScreen(user);
    if (wasPending()) return go(); // just came back from Google
    signedInScreen(user);
  }).catch(function (err) {
    host.innerHTML = '<h1>Sign in is not available right now</h1><p class="login-lede">Please try again later.</p>';
    if (window.console) console.error('Yumcha login:', err);
  });
})();
