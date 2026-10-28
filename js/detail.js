// Cafe page: shows one cafe, picked by the ?id= part of the address.
(function () {
  'use strict';

  var esc = window.Yumcha.escapeHtml;
  var root = document.getElementById('detail');
  var id = new URLSearchParams(window.location.search).get('id');
  var cafe = (window.YUMCHA_CAFES || []).filter(function (c) { return c.id === id; })[0];

  window.Yumcha.watchPhotoErrors(root);

  if (!cafe) {
    document.title = 'Cafe not found | Yumcha';
    root.innerHTML =
      '<div class="empty">' +
        '<h1 class="detail-title">We could not find that cafe</h1>' +
        '<p>The link may be old or mistyped.</p>' +
        '<a class="btn btn-link" href="index.html">See all cafes</a>' +
      '</div>';
    return;
  }

  document.title = cafe.name + ' | Yumcha';

  var tags = cafe.vibes.map(function (v) { return '<li>' + esc(v) + '</li>'; }).join('');
  var mapUrl = 'https://www.google.com/maps/search/?api=1&query=' +
    Number(cafe.lat) + ',' + Number(cafe.lng);

  root.innerHTML =
    '<a class="back-link" href="index.html">Back to all cafes</a>' +
    window.Yumcha.photoHtml(cafe, 'detail-photo') +
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
    '<a class="btn btn-link" href="' + mapUrl + '" target="_blank" rel="noopener noreferrer">View area on map</a>' +
    '<section class="experiences" aria-labelledby="exp-title">' +
      '<h2 id="exp-title">Experiences</h2>' +
      '<p>Tips and stories from people who have been here will show up in this space. Coming in a later version.</p>' +
    '</section>';
})();
