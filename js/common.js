// Helpers shared by the list page (index.html) and the cafe page (cafe.html).
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

  window.Yumcha = {
    root: root,
    escapeHtml: escapeHtml,
    photoList: photoList,
    photoHtml: photoHtml,
    watchPhotoErrors: watchPhotoErrors
  };
})();
