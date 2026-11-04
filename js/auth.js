// Sign in, and the Supabase connection, shared by every page that uses the community.
//
// Other scripts use window.Yumcha.auth:
//   enabled        false until js/config.js is filled in (then nothing else here runs)
//   ready          a promise that gives the Supabase client once it is ready
//   client, user   the client, and the signed-in person (or null)
//   onUserChange   run a function when someone signs in or out
//   openAuth, signOut, openReport   go to the sign-in page, sign out, and the report window
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
    suggestedName: suggestedName,
    errorMessage: authError
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

  // Plain messages for sign in errors.
  function authError(err) {
    var msg = String((err && err.message) || '');
    if (/expired or is invalid|invalid.*(token|otp)|otp.*(expired|invalid)/i.test(msg)) return 'That code is wrong or has expired. Check it, or ask for a new one.';
    if (/signups? not allowed|otp_disabled|provider is not enabled/i.test(msg)) return 'That sign-in method is not switched on yet.';
    if (/only request this after/i.test(msg)) return 'Please wait a minute before asking for another code.';
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
      }, 0);
    });

    return auth.client.auth.getSession();
  }).then(function (res) {
    auth.user = (res.data && res.data.session) ? res.data.session.user : null;
    return auth.client;
  });
  auth.ready.catch(function () {}); // the pages that need it report the problem themselves

  // ------------------------------------------------------------------ sign in
  // Signing in has its own page (login/). Pages that need a signed-in person send them there
  // and the login page brings them back. `next` is the page to return to (default: this one).
  function openAuth(mode, title, next) {
    var back = next || (window.location.pathname + window.location.search);
    window.location.href = Y.root + 'login/?next=' + encodeURIComponent(back);
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
