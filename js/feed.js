// Community page: a feed of posts with recommendations (place, photos, three ratings),
// discussion posts and reactions. Needs Supabase (see the README).
(function () {
  'use strict';

  var Y = window.Yumcha;
  var A = Y.auth;
  var host = document.getElementById('community');
  if (!host) return;

  var esc = Y.escapeHtml;
  var say = Y.say;
  var PAGE = 10;
  var BUCKET = 'post-photos';
  var KINDS = [
    { id: 'like', label: 'Like', icon: '♥' },
    { id: 'yum', label: 'Yum', icon: '😋' },
    { id: 'helpful', label: 'Helpful', icon: '💡' }
  ];
  var RATINGS = [
    { key: 'environment', label: 'Environment', hint: 'Seats, noise, atmosphere' },
    { key: 'food', label: 'Food & drinks', hint: 'Taste and choice' },
    { key: 'price', label: 'Price', hint: '5 = great value, 1 = too expensive' }
  ];
  var PHOTO_PATH = /^[0-9a-f-]{36}\/[0-9a-f-]{36}\.jpg$/;
  var MAPS_URL = /^https:\/\/((www|maps)\.google\.(com|[a-z]{2,3}|com?\.[a-z]{2})\/(maps|\?)|maps\.app\.goo\.gl\/|goo\.gl\/maps\/)/i;

  var client = null;
  var state = { user: null, filter: 'all', posts: [], counts: {}, mine: {}, more: false, status: 'loading', busy: false };
  var pendingCompose = null; // set by ?new=1 links and by "New post" while signed out

  if (!A || !A.enabled) {
    host.innerHTML = '<div class="feed-note"><h2>The community opens soon</h2>' +
      '<p>Posts, photos and ratings will appear here once the community is switched on.</p></div>';
    return;
  }

  host.innerHTML =
    '<div class="feed-bar">' +
      '<div class="chips" id="feed-filter" role="group" aria-label="Show posts"></div>' +
      '<button type="button" class="btn" id="feed-new">New post</button>' +
    '</div>' +
    '<p class="exp-account" id="feed-account"></p>' +
    '<p class="feed-note" id="feed-status" role="status">Loading posts...</p>' +
    '<ul class="feed" id="feed"></ul>' +
    '<div class="feed-more"><button type="button" class="btn btn-ghost" id="feed-more" hidden>Show more</button></div>';

  var filterEl = host.querySelector('#feed-filter');
  var accountEl = host.querySelector('#feed-account');
  var statusEl = host.querySelector('#feed-status');
  var feedEl = host.querySelector('#feed');
  var moreBtn = host.querySelector('#feed-more');

  var FILTERS = [['all', 'All'], ['recommendation', 'Recommendations'], ['discussion', 'Discussions']];

  // ------------------------------------------------------------------ helpers
  function cafeById(id) {
    return (window.YUMCHA_CAFES || []).filter(function (c) { return c.id === id; })[0] || null;
  }

  function uuid() {
    if (window.crypto && crypto.randomUUID) return crypto.randomUUID();
    var b = new Uint8Array(16);
    crypto.getRandomValues(b);
    b[6] = (b[6] & 15) | 64; b[8] = (b[8] & 63) | 128;
    var h = Array.prototype.map.call(b, function (x) { return ('0' + x.toString(16)).slice(-2); }).join('');
    return h.replace(/^(.{8})(.{4})(.{4})(.{4})(.{12})$/, '$1-$2-$3-$4-$5');
  }

  function photoSrc(path) {
    return A.url + '/storage/v1/object/public/' + BUCKET + '/' + path;
  }

  function ratingRows(p) {
    if (p.kind !== 'recommendation') return '';
    return '<dl class="post-ratings">' + RATINGS.map(function (r) {
      return '<div><dt>' + esc(r.label) + '</dt><dd>' + Y.starsHtml(p['rating_' + r.key]) + '</dd></div>';
    }).join('') + '</dl>';
  }

  // ------------------------------------------------------------------ rendering
  function renderFilters() {
    filterEl.innerHTML = FILTERS.map(function (f) {
      return '<button type="button" class="chip" data-filter="' + f[0] + '" aria-pressed="' + (state.filter === f[0]) + '">' + f[1] + '</button>';
    }).join('');
  }

  function renderAccount() {
    if (!state.user) { accountEl.innerHTML = ''; return; }
    accountEl.innerHTML = 'Signed in as ' + esc(A.storedName(state.user) || 'your account') +
      '. <button type="button" class="link-btn" id="feed-signout">Sign out</button>';
    accountEl.querySelector('#feed-signout').addEventListener('click', A.signOut);
  }

  function reactionsHtml(p) {
    var counts = state.counts[p.id] || {};
    var mine = state.mine[p.id] || {};
    return '<div class="post-reactions" role="group" aria-label="Reactions">' + KINDS.map(function (k) {
      var on = !!mine[k.id];
      var n = counts[k.id] || 0;
      return '<button type="button" class="react" data-react="' + k.id + '" aria-pressed="' + on + '">' +
        '<span aria-hidden="true">' + k.icon + '</span> ' + k.label + (n ? ' <b>' + n + '</b>' : '') + '</button>';
    }).join('') + '</div>';
  }

  function postHtml(p) {
    var own = state.user && p.user_id === state.user.id;
    var place = '';
    if (p.kind === 'recommendation') {
      var cafe = p.cafe_id ? cafeById(p.cafe_id) : null;
      var name = esc(p.place_name);
      var area = p.place_area ? '<span class="post-area">' + esc(p.place_area) + '</span>' : '';
      var maps = p.maps_url && MAPS_URL.test(p.maps_url)
        ? ' <a class="post-maps" href="' + esc(p.maps_url) + '" target="_blank" rel="noopener noreferrer">Open in Google Maps</a>' : '';
      place = '<p class="post-place"><span aria-hidden="true">📍</span> ' +
        (cafe ? '<a href="' + esc(Y.root + cafe.id + '/') + '">' + name + '</a>' : '<strong>' + name + '</strong>') +
        area + maps + '</p>';
    }
    var photos = (p.photos || []).filter(function (x) { return PHOTO_PATH.test(x); });
    var grid = photos.length
      ? '<ul class="post-photos n' + photos.length + '">' + photos.map(function (x, i) {
          return '<li><button type="button" class="post-photo" data-src="' + esc(photoSrc(x)) + '" aria-label="View photo ' + (i + 1) + ' of ' + photos.length + '">' +
            '<img src="' + esc(photoSrc(x)) + '" alt="" loading="lazy"></button></li>';
        }).join('') + '</ul>'
      : '';
    return '<li class="post" data-id="' + esc(p.id) + '">' +
      '<div class="exp-head">' +
        '<strong class="exp-author">' + esc(p.author_name) + '</strong>' +
        (own ? '<span class="exp-you">You</span>' : '') +
        '<span class="post-kind">' + (p.kind === 'recommendation' ? 'Recommends' : 'Discussion') + '</span>' +
        '<time datetime="' + esc(p.created_at) + '">' + esc(Y.formatDate(p.created_at)) + '</time>' +
      '</div>' +
      place + ratingRows(p) +
      '<p class="exp-body">' + esc(p.body) + '</p>' + grid +
      '<div class="post-foot">' + reactionsHtml(p) +
        '<span class="exp-actions">' + (own
          ? '<button type="button" class="link-btn" data-action="delete">Delete</button>'
          : '<button type="button" class="link-btn" data-action="report">Report</button>') + '</span>' +
      '</div></li>';
  }

  function renderFeed() {
    if (state.status === 'error') {
      statusEl.textContent = 'We could not load posts. Refresh the page to try again.';
      feedEl.innerHTML = ''; moreBtn.hidden = true; return;
    }
    if (state.status === 'loading') { statusEl.textContent = 'Loading posts...'; return; }
    statusEl.textContent = state.posts.length ? '' : 'No posts here yet. Be the first to share one.';
    feedEl.innerHTML = state.posts.map(postHtml).join('');
    moreBtn.hidden = !state.more;
    moreBtn.disabled = state.busy;
  }

  // ------------------------------------------------------------------ data
  function loadReactions(posts) {
    var ids = posts.map(function (p) { return p.id; });
    if (!ids.length) return Promise.resolve();
    var counts = client.from('post_reaction_counts').select('post_id,kind,total').in('post_id', ids)
      .then(function (res) {
        if (res.error) throw res.error;
        (res.data || []).forEach(function (r) {
          (state.counts[r.post_id] = state.counts[r.post_id] || {})[r.kind] = r.total;
        });
      });
    var mine = !state.user ? Promise.resolve() :
      client.from('post_reactions').select('post_id,kind').eq('user_id', state.user.id).in('post_id', ids)
        .then(function (res) {
          if (res.error) throw res.error;
          (res.data || []).forEach(function (r) {
            (state.mine[r.post_id] = state.mine[r.post_id] || {})[r.kind] = true;
          });
        });
    return Promise.all([counts, mine]);
  }

  function loadPosts(reset) {
    state.busy = true;
    if (reset) { state.posts = []; state.counts = {}; state.mine = {}; state.status = 'loading'; renderFeed(); }
    var from = state.posts.length;
    var q = client.from('posts')
      .select('id,user_id,author_name,kind,cafe_id,place_name,place_area,maps_url,rating_environment,rating_food,rating_price,body,photos,created_at')
      .order('created_at', { ascending: false })
      .range(from, from + PAGE); // one extra row tells us whether there is another page
    if (state.filter !== 'all') q = q.eq('kind', state.filter);
    var filterAtStart = state.filter;
    return q.then(function (res) {
      if (res.error) throw res.error;
      if (filterAtStart !== state.filter) return; // the filter changed while loading
      var rows = res.data || [];
      state.more = rows.length > PAGE;
      var page = rows.slice(0, PAGE);
      return loadReactions(page).then(function () {
        state.posts = state.posts.concat(page);
        state.status = 'ready';
      });
    }).catch(function (err) {
      state.status = state.posts.length ? 'ready' : 'error';
      if (window.console) console.error('Yumcha feed:', err);
    }).then(function () { state.busy = false; renderFeed(); });
  }

  // ------------------------------------------------------------------ reactions, delete, report
  function toggleReaction(postId, kind) {
    if (!state.user) { A.openAuth('signin', 'Sign in to react'); return; }
    var mine = state.mine[postId] = state.mine[postId] || {};
    var counts = state.counts[postId] = state.counts[postId] || {};
    var had = !!mine[kind];
    function apply(on) {
      mine[kind] = on;
      counts[kind] = Math.max(0, (counts[kind] || 0) + (on ? 1 : -1));
      renderFeed();
    }
    apply(!had);
    var req = had
      ? client.from('post_reactions').delete().eq('post_id', postId).eq('kind', kind).eq('user_id', state.user.id)
      : client.from('post_reactions').insert({ post_id: postId, kind: kind });
    req.then(function (res) {
      if (res.error && !(res.error.code === '23505' && !had)) throw res.error;
    }).catch(function () { apply(had); window.alert('Could not save your reaction. Please try again.'); });
  }

  function deletePost(id) {
    if (!window.confirm('Delete your post? This cannot be undone.')) return;
    var post = state.posts.filter(function (p) { return p.id === id; })[0];
    client.from('posts').delete().eq('id', id).then(function (res) {
      if (res.error) throw res.error;
      state.posts = state.posts.filter(function (p) { return p.id !== id; });
      renderFeed();
      var files = ((post && post.photos) || []).filter(function (x) { return PHOTO_PATH.test(x); });
      if (files.length) client.storage.from(BUCKET).remove(files).then(function () {}, function () {});
    }).catch(function (err) { window.alert(Y.friendlyError(err)); });
  }

  feedEl.addEventListener('click', function (e) {
    var li = e.target.closest('.post');
    if (!li) return;
    var id = li.getAttribute('data-id');
    var react = e.target.closest('[data-react]');
    if (react) return toggleReaction(id, react.getAttribute('data-react'));
    var photo = e.target.closest('.post-photo');
    if (photo) return openLightbox(photo.getAttribute('data-src'));
    var action = e.target.closest('[data-action]');
    if (!action) return;
    if (action.getAttribute('data-action') === 'delete') deletePost(id);
    else if (!state.user) A.openAuth('signin', 'Sign in to report');
    else A.openReport({ table: 'post_reports', column: 'post_id', id: id });
  });

  function openLightbox(src) {
    var d = Y.buildDialog('lightbox', '<img class="lightbox-img" alt="Photo from a post">' +
      '<button type="button" class="btn btn-ghost" data-close>Close</button>', 'dialog-wide');
    d.querySelector('img').src = src;
    d.querySelector('[data-close]').addEventListener('click', function () { d.close(); });
    d.addEventListener('close', function () { d.remove(); });
    d.showModal();
  }

  // ------------------------------------------------------------------ photos
  // Photos are redrawn onto a canvas and saved as a smaller JPEG. This also removes hidden
  // data such as the location a phone stores inside the original picture.
  function loadBitmap(file) {
    if (window.createImageBitmap) {
      return createImageBitmap(file).catch(function () { return viaImage(file); });
    }
    return viaImage(file);
  }
  function viaImage(file) {
    return new Promise(function (resolve, reject) {
      var url = URL.createObjectURL(file);
      var img = new Image();
      img.onload = function () { URL.revokeObjectURL(url); resolve(img); };
      img.onerror = function () { URL.revokeObjectURL(url); reject(new Error('unreadable')); };
      img.src = url;
    });
  }
  function resizePhoto(file) {
    return loadBitmap(file).then(function (img) {
      var w = img.width, h = img.height, max = 1600;
      var scale = Math.min(1, max / Math.max(w, h));
      var canvas = document.createElement('canvas');
      canvas.width = Math.max(1, Math.round(w * scale));
      canvas.height = Math.max(1, Math.round(h * scale));
      var ctx = canvas.getContext('2d');
      ctx.fillStyle = '#fff'; // JPEG has no transparency
      ctx.fillRect(0, 0, canvas.width, canvas.height);
      ctx.drawImage(img, 0, 0, canvas.width, canvas.height);
      if (img.close) img.close();
      function encode(q) {
        return new Promise(function (resolve, reject) {
          canvas.toBlob(function (b) { b ? resolve(b) : reject(new Error('encode')); }, 'image/jpeg', q);
        });
      }
      return encode(0.82).then(function (b) {
        return b.size > 2000000 ? encode(0.6) : b;
      }).then(function (b) {
        if (b.size > 2097152) throw new Error('too large');
        return b;
      });
    });
  }

  // ------------------------------------------------------------------ composer
  function openComposer(prefill) {
    prefill = prefill || {};
    var photos = []; // { blob, url }
    var cafes = (window.YUMCHA_CAFES || []).slice().sort(function (a, b) { return a.name.localeCompare(b.name); });
    var cafeOptions = '<option value="">Somewhere else</option>' + cafes.map(function (c) {
      return '<option value="' + esc(c.id) + '">' + esc(c.name) + ' (' + esc(c.area) + ')</option>';
    }).join('');

    var ratingsHtml = RATINGS.map(function (r) {
      var opts = '';
      for (var i = 1; i <= 5; i++) {
        opts += '<label class="rate-opt"><input type="radio" name="r-' + r.key + '" value="' + i + '"><span>' + i + '</span></label>';
      }
      return '<fieldset class="rate"><legend>' + esc(r.label) + '</legend>' + opts +
        '<p class="rate-hint">' + esc(r.hint) + '</p></fieldset>';
    }).join('');

    var d = Y.buildDialog('composer',
      '<h2>New post</h2>' +
      '<form id="post-form" novalidate>' +
        '<div class="seg" role="group" aria-label="Type of post">' +
          '<button type="button" class="chip" data-kind="recommendation" aria-pressed="true">Recommend a place</button>' +
          '<button type="button" class="chip" data-kind="discussion" aria-pressed="false">Start a discussion</button>' +
        '</div>' +
        '<div class="field"><label for="post-name">Your name (shown with your post)</label>' +
          '<input id="post-name" maxlength="40" autocomplete="nickname"></div>' +
        '<div id="place-fields" class="compose-group">' +
          '<div class="field"><label for="post-cafe">Place</label><select id="post-cafe">' + cafeOptions + '</select></div>' +
          '<div id="other-place" class="compose-group">' +
            '<div class="field"><label for="post-place">Name of the place</label><input id="post-place" maxlength="80"></div>' +
            '<div class="field"><label for="post-area">Area (optional)</label><input id="post-area" maxlength="80" placeholder="e.g. Bangsar"></div>' +
            '<div class="field"><label for="post-maps">Google Maps link (optional)</label><input id="post-maps" type="url" maxlength="300" inputmode="url" placeholder="https://maps.app.goo.gl/...">' +
              '<p class="field-hint">In Google Maps, press Share, then Copy link.</p></div>' +
          '</div>' +
          ratingsHtml +
        '</div>' +
        '<div class="field"><label for="post-body" id="body-label">Why do you recommend it?</label>' +
          '<textarea id="post-body" rows="4" maxlength="1000"></textarea>' +
          '<p class="exp-count" id="post-count">0 / 1000</p></div>' +
        '<div id="photo-fields" class="field"><span class="label-like">Photos (up to 3)</span>' +
          '<ul class="thumbs" id="thumbs"></ul>' +
          '<input type="file" id="post-photo-input" accept="image/*" multiple hidden>' +
          '<button type="button" class="btn btn-ghost" id="add-photo">Add photos</button>' +
          '<p class="field-hint">Photos are shrunk before they upload. Only share photos you took.</p></div>' +
        '<p class="exp-note">Posts are public. Be honest and kind.</p>' +
        '<p class="form-message" id="post-msg" role="alert"></p>' +
        '<div class="dialog-actions"><button type="submit" class="btn" id="post-submit">Post</button>' +
          '<button type="button" class="link-btn" id="post-cancel">Cancel</button></div>' +
      '</form>', 'dialog-wide');

    var form = d.querySelector('#post-form');
    var kind = 'recommendation';
    var msg = d.querySelector('#post-msg');
    var submit = d.querySelector('#post-submit');
    var thumbs = d.querySelector('#thumbs');
    var fileInput = d.querySelector('#post-photo-input');
    var cafeSel = d.querySelector('#post-cafe');
    var uploading = false;

    d.querySelector('#post-name').value = A.suggestedName(state.user);
    if (prefill.cafe && cafeById(prefill.cafe)) cafeSel.value = prefill.cafe;

    function syncPlace() { d.querySelector('#other-place').hidden = !!cafeSel.value; }
    function setKind(k) {
      kind = k;
      Array.prototype.forEach.call(d.querySelectorAll('[data-kind]'), function (b) {
        b.setAttribute('aria-pressed', String(b.getAttribute('data-kind') === k));
      });
      d.querySelector('#place-fields').hidden = k !== 'recommendation';
      d.querySelector('#body-label').textContent = k === 'recommendation' ? 'Why do you recommend it?' : 'What do you want to ask or share?';
    }
    function drawThumbs() {
      thumbs.innerHTML = '';
      photos.forEach(function (p, i) {
        var li = document.createElement('li');
        var img = document.createElement('img');
        img.src = p.url; img.alt = 'Photo ' + (i + 1);
        var rm = document.createElement('button');
        rm.type = 'button'; rm.className = 'thumb-remove'; rm.textContent = '×';
        rm.setAttribute('aria-label', 'Remove photo ' + (i + 1));
        rm.addEventListener('click', function () { URL.revokeObjectURL(p.url); photos.splice(i, 1); drawThumbs(); });
        li.appendChild(img); li.appendChild(rm); thumbs.appendChild(li);
      });
      d.querySelector('#add-photo').hidden = photos.length >= 3;
    }
    function close() { photos.forEach(function (p) { URL.revokeObjectURL(p.url); }); d.close(); }

    syncPlace(); setKind('recommendation'); drawThumbs();
    cafeSel.addEventListener('change', syncPlace);
    d.addEventListener('click', function (e) {
      var k = e.target.closest('[data-kind]');
      if (k) setKind(k.getAttribute('data-kind'));
    });
    var body = d.querySelector('#post-body'), count = d.querySelector('#post-count');
    body.addEventListener('input', function () { count.textContent = body.value.length + ' / 1000'; });
    d.querySelector('#post-cancel').addEventListener('click', close);
    d.addEventListener('close', function () { d.remove(); });

    d.querySelector('#add-photo').addEventListener('click', function () { fileInput.click(); });
    fileInput.addEventListener('change', function () {
      var files = Array.prototype.slice.call(fileInput.files || []).slice(0, 3 - photos.length);
      fileInput.value = '';
      say(msg, '');
      files.reduce(function (chain, f) {
        return chain.then(function () {
          if (!/^image\//.test(f.type)) { say(msg, 'Only photos can be added.'); return; }
          return resizePhoto(f).then(function (blob) {
            if (photos.length < 3) photos.push({ blob: blob, url: URL.createObjectURL(blob) });
          }).catch(function () { say(msg, 'One of those photos could not be used. Try a different one.'); });
        });
      }, Promise.resolve()).then(drawThumbs);
    });

    form.addEventListener('submit', function (e) {
      e.preventDefault();
      if (uploading) return;
      var name = d.querySelector('#post-name').value.trim();
      var text = body.value.trim();
      var row = { kind: kind, body: text };
      if (!name) return say(msg, 'Add a name to show with your post.');
      if (kind === 'recommendation') {
        var cafe = cafeById(cafeSel.value);
        if (cafe) {
          row.cafe_id = cafe.id; row.place_name = cafe.name; row.place_area = cafe.area;
        } else {
          row.place_name = d.querySelector('#post-place').value.trim();
          row.place_area = d.querySelector('#post-area').value.trim() || null;
          var maps = d.querySelector('#post-maps').value.trim();
          if (row.place_name.length < 2) return say(msg, 'Add the name of the place.');
          if (maps && !MAPS_URL.test(maps)) return say(msg, 'That does not look like a Google Maps link. Copy it from the Share button in Google Maps.');
          row.maps_url = maps || null;
        }
        for (var i = 0; i < RATINGS.length; i++) {
          var picked = d.querySelector('input[name="r-' + RATINGS[i].key + '"]:checked');
          if (!picked) return say(msg, 'Rate the ' + RATINGS[i].label.toLowerCase() + ' from 1 to 5.');
          row['rating_' + RATINGS[i].key] = Number(picked.value);
        }
      }
      if (text.length < 10) return say(msg, 'Write at least 10 characters.');

      say(msg, '');
      uploading = true; submit.disabled = true; submit.textContent = 'Posting...';
      var uploaded = [];
      var saveName = A.storedName(state.user) === name
        ? Promise.resolve({}) : client.auth.updateUser({ data: { display_name: name } });

      saveName.then(function (res) {
        if (res && res.error) throw res.error;
        return photos.reduce(function (chain, p) {
          return chain.then(function () {
            var path = state.user.id + '/' + uuid() + '.jpg';
            return client.storage.from(BUCKET).upload(path, p.blob, { contentType: 'image/jpeg' }).then(function (r) {
              if (r.error) throw r.error;
              uploaded.push(path);
            });
          });
        }, Promise.resolve());
      }).then(function () {
        row.photos = uploaded;
        return client.from('posts').insert(row);
      }).then(function (res) {
        if (res.error) throw res.error;
        close();
        return loadPosts(true);
      }).catch(function (err) {
        if (uploaded.length) client.storage.from(BUCKET).remove(uploaded).then(function () {}, function () {});
        say(msg, Y.friendlyError(err));
        uploading = false; submit.disabled = false; submit.textContent = 'Post';
      });
    });

    d.showModal();
  }

  function startCompose(prefill) {
    if (!state.user) { pendingCompose = prefill || {}; A.openAuth('signin', 'Sign in to post'); return; }
    openComposer(prefill);
  }

  // ------------------------------------------------------------------ events and start
  filterEl.addEventListener('click', function (e) {
    var b = e.target.closest('[data-filter]');
    if (!b || b.getAttribute('data-filter') === state.filter) return;
    state.filter = b.getAttribute('data-filter');
    renderFilters();
    loadPosts(true);
  });
  host.querySelector('#feed-new').addEventListener('click', function () { startCompose({}); });
  moreBtn.addEventListener('click', function () { if (!state.busy) loadPosts(false); });

  renderFilters();

  A.ready.then(function (c) {
    client = c;
    state.user = A.user;
    renderAccount();
    var qs = new URLSearchParams(window.location.search);
    if (qs.get('new') === '1') {
      startCompose({ cafe: qs.get('cafe') || '' });
      if (window.history && history.replaceState) history.replaceState(null, '', window.location.pathname);
    }
    return loadPosts(true);
  }).catch(function (err) {
    state.status = 'error';
    renderFeed();
    if (window.console) console.error('Yumcha community:', err);
  });

  A.onUserChange(function (user) {
    state.user = user;
    renderAccount();
    if (!client) return;
    state.mine = {};
    var ids = state.posts;
    (user ? loadReactions(ids).catch(function () {}) : Promise.resolve()).then(renderFeed);
    if (user && pendingCompose) { var p = pendingCompose; pendingCompose = null; openComposer(p); }
  });
})();
