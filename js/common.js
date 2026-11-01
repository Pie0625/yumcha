// Helpers shared by every page.
(function () {
  'use strict';

  // The site's root address, worked out from where this script was loaded.
  // Pages live in different folders (/home/, /kopi-kawan/), so links and
  // image paths are built from this instead of being relative to the page.
  var root = document.currentScript.src.replace(/js\/common\.js.*$/, '');

  function escapeHtml(text) {
    return String(text).replace(/[&<>"']/g, function (c) {
      return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c];
    });
  }

  // Turns a string into a stable number, so each cafe always gets the same colour.
  function hash(text) {
    var h = 0;
    for (var i = 0; i < text.length; i++) h = (h * 31 + text.charCodeAt(i)) >>> 0;
    return h;
  }

  // A warm brown block with the cafe's first letter, shown when a cafe has no photo.
  function placeholderHtml(cafe, className) {
    var hue = 18 + (hash(cafe.id) % 24);
    var light = 20 + (hash(cafe.id + 'x') % 6);
    var style = 'background:linear-gradient(135deg,hsl(' + hue + ' 38% ' + (light + 6) + '%),hsl(' +
      (hue + 10) + ' 42% ' + (light - 5) + '%))';
    return '<div class="' + className + ' photo-placeholder" style="' + style + '" aria-hidden="true">' +
      '<span>' + escapeHtml(cafe.name.charAt(0)) + '</span></div>';
  }

  // A cafe can have `photos: [...]` (several) or the older `photo: '...'` (one).
  function photoList(cafe) {
    if (Array.isArray(cafe.photos) && cafe.photos.length) return cafe.photos;
    return cafe.photo ? [cafe.photo] : [];
  }

  // A photo is either a full link (https://...) from an image host, or a path inside this site.
  function photoUrl(photo) {
    return /^https?:\/\//i.test(photo) ? photo : root + photo;
  }

  // One image for the cafe (the first by default); a placeholder if it has none.
  function photoHtml(cafe, className, index) {
    var cls = 'photo ' + (className || '');
    var list = photoList(cafe);
    var photo = list[index || 0];
    if (!photo) return placeholderHtml(cafe, cls);
    return '<img class="' + cls + '" src="' + escapeHtml(photoUrl(photo)) + '" alt="Image ' +
      ((index || 0) + 1) + ' of ' + escapeHtml(cafe.name) + '" loading="lazy" data-cafe="' +
      escapeHtml(cafe.id) + '">';
  }

  // If a photo file is missing or fails to load, swap in the placeholder.
  function watchPhotoErrors(container) {
    container.addEventListener('error', function (e) {
      var img = e.target;
      if (!img || img.tagName !== 'IMG' || !img.dataset.cafe) return;
      var cafe = (window.YUMCHA_CAFES || []).filter(function (c) { return c.id === img.dataset.cafe; })[0];
      if (!cafe) return;
      var holder = document.createElement('div');
      holder.innerHTML = placeholderHtml(cafe, img.className);
      img.replaceWith(holder.firstChild);
    }, true);
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

  // Short, plain messages for database and upload errors. `duplicate` is shown when the same thing is done twice.
  function friendlyError(err, duplicate) {
    var msg = String((err && err.message) || '');
    if (err && err.code === '23505') return duplicate || 'You have already done this.';
    if (err && err.code === '23514') return 'That did not meet the rules for posts. Check the lengths and ratings.';
    if ((err && err.code === '42501') || /row-level security|jwt/i.test(msg)) return 'Please sign in again and try once more.';
    if (/payload too large|exceeded the maximum|too large/i.test(msg)) return 'A photo is too big. Try a smaller one.';
    if (/mime type|not supported/i.test(msg)) return 'Only photos can be uploaded.';
    if (/failed to fetch|network|load failed/i.test(msg)) return 'Could not reach the server. Check your connection and try again.';
    return 'Something went wrong. Please try again.';
  }

  // Shows a message under a form. `ok` makes it a success message.
  function say(el, text, ok) {
    el.textContent = text;
    el.className = 'form-message' + (ok ? ' is-ok' : '');
  }

  function buildDialog(id, html, extraClass) {
    var d = document.createElement('dialog');
    d.className = 'dialog' + (extraClass ? ' ' + extraClass : '');
    d.id = id;
    d.innerHTML = '<div class="dialog-body">' + html + '</div>';
    d.addEventListener('click', function (e) { if (e.target === d) d.close(); });
    document.body.appendChild(d);
    return d;
  }

  window.Yumcha = {
    root: root,
    escapeHtml: escapeHtml,
    photoList: photoList,
    photoHtml: photoHtml,
    watchPhotoErrors: watchPhotoErrors,
    starsHtml: starsHtml,
    formatDate: formatDate,
    friendlyError: friendlyError,
    say: say,
    buildDialog: buildDialog
  };
})();
