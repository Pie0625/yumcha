// Cafe page: shows one cafe. The generated page (tools/build-pages.js) sets window.YUMCHA_CAFE_ID.
(function () {
  'use strict';

  var esc = window.Yumcha.escapeHtml;
  var root = document.getElementById('detail');
  var id = window.YUMCHA_CAFE_ID;
  var homeUrl = window.Yumcha.root + 'home/';
  var cafe = (window.YUMCHA_CAFES || []).filter(function (c) { return c.id === id; })[0];

  window.Yumcha.watchPhotoErrors(root);

  if (!cafe) {
    document.title = 'Cafe not found | Yumcha';
    root.innerHTML =
      '<div class="empty">' +
        '<h1 class="detail-title">We could not find that cafe</h1>' +
        '<p>The link may be old or mistyped.</p>' +
        '<a class="btn btn-link" href="' + homeUrl + '">See all cafes</a>' +
      '</div>';
    return;
  }

  document.title = cafe.name + ' | Yumcha';

  var tags = cafe.vibes.map(function (v) { return '<li>' + esc(v) + '</li>'; }).join('');
  var mapUrl = 'https://www.google.com/maps/search/?api=1&query=' +
    Number(cafe.lat) + ',' + Number(cafe.lng);

  // One photo shows as a single image. Several show as a swipeable gallery.
  function galleryHtml() {
    var count = window.Yumcha.photoList(cafe).length;
    if (count < 2) return window.Yumcha.photoHtml(cafe, 'detail-photo');
    var slides = '';
    for (var i = 0; i < count; i++) slides += window.Yumcha.photoHtml(cafe, 'detail-photo', i);
    return '<div class="gallery">' +
      '<div class="gallery-track" tabindex="0" role="group" aria-label="Photos of ' + esc(cafe.name) + '">' + slides + '</div>' +
      '<button type="button" class="gallery-btn gallery-prev" aria-label="Previous photo">&#8249;</button>' +
      '<button type="button" class="gallery-btn gallery-next" aria-label="Next photo">&#8250;</button>' +
      '<p class="gallery-count" aria-live="polite">1 of ' + count + '</p>' +
    '</div>';
  }

  root.innerHTML =
    '<a class="back-link" href="' + homeUrl + '">Back to all cafes</a>' +
    galleryHtml() +
    '<div class="detail-head">' +
      '<div><h1 class="detail-title">' + esc(cafe.name) + '</h1>' +
      '<p class="cafe-place">' + esc(cafe.area) + '</p></div>' +
      '<span class="rating" aria-label="Rated ' + cafe.rating.toFixed(1) + ' out of 5">' + cafe.rating.toFixed(1) + '</span>' +
    '</div>' +
    '<p class="price">RM' + cafe.priceFrom + ' to RM' + cafe.priceTo + ' <span>per person</span></p>' +
    '<ul class="tags" aria-label="Vibe">' + tags + '</ul>' +
    '<p class="blurb detail-blurb">' + esc(cafe.blurb) + '</p>' +
    '<dl class="facts detail-facts">' +
      '<div><dt>Open</dt><dd>' + esc(cafe.hours) + '</dd></div>' +
      '<div><dt>Good for</dt><dd>' + esc(cafe.goodFor) + '</dd></div>' +
      '<div><dt>Area</dt><dd>' + esc(cafe.area) + '</dd></div>' +
    '</dl>' +
    '<div class="detail-actions">' +
      '<a class="btn btn-link" href="' + mapUrl + '" target="_blank" rel="noopener noreferrer">View area on map</a>' +
      (window.Yumcha.auth && window.Yumcha.auth.enabled
        ? '<a class="btn btn-ghost btn-link" href="' + window.Yumcha.root + 'community/?new=1&cafe=' + encodeURIComponent(cafe.id) + '">Recommend this cafe</a>'
        : '') +
    '</div>' +
    '<section class="experiences" id="experiences" aria-labelledby="exp-title">' +
      '<h2 id="exp-title">Experiences</h2>' +
      '<p>Tips and stories from people who have been here will show up in this space. Coming in a later version.</p>' +
    '</section>';

  // Gallery buttons and the "2 of 3" counter.
  var track = root.querySelector('.gallery-track');
  if (track) {
    var counter = root.querySelector('.gallery-count');
    var reduce = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    var total = track.children.length;
    var go = function (step) {
      track.scrollBy({ left: step * track.clientWidth, behavior: reduce ? 'auto' : 'smooth' });
    };
    root.querySelector('.gallery-prev').addEventListener('click', function () { go(-1); });
    root.querySelector('.gallery-next').addEventListener('click', function () { go(1); });
    track.addEventListener('scroll', function () {
      var index = Math.round(track.scrollLeft / track.clientWidth);
      counter.textContent = (Math.min(index, total - 1) + 1) + ' of ' + total;
    }, { passive: true });
  }
})();
