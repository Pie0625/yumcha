// Yumcha v1: filter, sort and show cafes. No frameworks, no build step.
(function () {
  'use strict';

  var cafes = window.YUMCHA_CAFES || [];

  var state = {
    maxSpend: Infinity,
    minRating: 0,
    vibes: [],
    sort: 'rating',
    position: null
  };

  var els = {
    spend: document.getElementById('spend'),
    rating: document.getElementById('rating'),
    sort: document.getElementById('sort'),
    chips: document.getElementById('vibe-chips'),
    results: document.getElementById('results'),
    count: document.getElementById('count'),
    empty: document.getElementById('empty'),
    clear: document.getElementById('clear-btn'),
    emptyClear: document.getElementById('empty-clear'),
    locateBtn: document.getElementById('locate-btn'),
    locateStatus: document.getElementById('locate-status')
  };

  function escapeHtml(text) {
    return String(text).replace(/[&<>"']/g, function (c) {
      return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c];
    });
  }

  function averagePrice(cafe) {
    return (cafe.priceFrom + cafe.priceTo) / 2;
  }

  // Straight-line distance in km between two lat/lng points.
  function distanceKm(a, b) {
    var toRad = Math.PI / 180;
    var dLat = (b.lat - a.lat) * toRad;
    var dLng = (b.lng - a.lng) * toRad;
    var h = Math.sin(dLat / 2) * Math.sin(dLat / 2) +
      Math.cos(a.lat * toRad) * Math.cos(b.lat * toRad) *
      Math.sin(dLng / 2) * Math.sin(dLng / 2);
    return 6371 * 2 * Math.atan2(Math.sqrt(h), Math.sqrt(1 - h));
  }

  function formatDistance(km) {
    return km < 1 ? Math.round(km * 1000) + ' m away' : km.toFixed(1) + ' km away';
  }

  function allVibes() {
    var seen = {};
    cafes.forEach(function (c) { c.vibes.forEach(function (v) { seen[v] = true; }); });
    return Object.keys(seen).sort();
  }

  function filtersActive() {
    return state.maxSpend !== Infinity || state.minRating > 0 || state.vibes.length > 0;
  }

  function getVisibleCafes() {
    var list = cafes.filter(function (c) {
      if (averagePrice(c) > state.maxSpend) return false;
      if (c.rating < state.minRating) return false;
      // A cafe must have every vibe that is switched on.
      return state.vibes.every(function (v) { return c.vibes.indexOf(v) !== -1; });
    });

    if (state.position) {
      list = list.map(function (c) {
        return Object.assign({}, c, { km: distanceKm(state.position, c) });
      });
    }

    list.sort(function (a, b) {
      if (state.sort === 'price') return averagePrice(a) - averagePrice(b) || b.rating - a.rating;
      if (state.sort === 'nearest' && state.position) return a.km - b.km;
      return b.rating - a.rating || averagePrice(a) - averagePrice(b);
    });

    return list;
  }

  function cardHtml(c) {
    var distance = typeof c.km === 'number'
      ? '<div><dt>Distance</dt><dd class="distance">' + formatDistance(c.km) + '</dd></div>'
      : '';
    var tags = c.vibes.map(function (v) { return '<li>' + escapeHtml(v) + '</li>'; }).join('');

    return '<li class="cafe">' +
      '<div class="cafe-top">' +
        '<div><h2>' + escapeHtml(c.name) + '</h2>' +
        '<p class="cafe-place">' + escapeHtml(c.area) + '</p></div>' +
        '<span class="rating" aria-label="Rated ' + c.rating.toFixed(1) + ' out of 5">' + c.rating.toFixed(1) + '</span>' +
      '</div>' +
      '<p class="price">RM' + c.priceFrom + ' to RM' + c.priceTo + ' <span>per person</span></p>' +
      '<ul class="tags" aria-label="Vibe">' + tags + '</ul>' +
      '<p class="blurb">' + escapeHtml(c.blurb) + '</p>' +
      '<dl class="facts">' + distance +
        '<div><dt>Open</dt><dd>' + escapeHtml(c.hours) + '</dd></div>' +
        '<div><dt>Good for</dt><dd>' + escapeHtml(c.goodFor) + '</dd></div>' +
      '</dl>' +
    '</li>';
  }

  function render() {
    var list = getVisibleCafes();
    els.results.innerHTML = list.map(cardHtml).join('');
    els.count.textContent = list.length === 1 ? '1 cafe' : list.length + ' cafes';
    els.empty.hidden = list.length > 0;
    els.clear.hidden = !filtersActive();
  }

  function buildChips() {
    allVibes().forEach(function (vibe) {
      var b = document.createElement('button');
      b.type = 'button';
      b.className = 'chip';
      b.textContent = vibe;
      b.setAttribute('aria-pressed', 'false');
      b.addEventListener('click', function () {
        var i = state.vibes.indexOf(vibe);
        if (i === -1) state.vibes.push(vibe); else state.vibes.splice(i, 1);
        b.setAttribute('aria-pressed', i === -1 ? 'true' : 'false');
        render();
      });
      els.chips.appendChild(b);
    });
  }

  function clearFilters() {
    state.maxSpend = Infinity;
    state.minRating = 0;
    state.vibes = [];
    els.spend.value = 'any';
    els.rating.value = '0';
    Array.prototype.forEach.call(els.chips.children, function (b) {
      b.setAttribute('aria-pressed', 'false');
    });
    render();
  }

  function useLocation() {
    if (!navigator.geolocation) {
      els.locateStatus.textContent = 'Your browser does not support location.';
      return;
    }
    els.locateBtn.disabled = true;
    els.locateStatus.textContent = 'Finding you...';

    navigator.geolocation.getCurrentPosition(function (pos) {
      state.position = { lat: pos.coords.latitude, lng: pos.coords.longitude };
      state.sort = 'nearest';
      els.sort.querySelector('option[value="nearest"]').disabled = false;
      els.sort.querySelector('option[value="nearest"]').textContent = 'Nearest';
      els.sort.value = 'nearest';
      els.locateBtn.disabled = false;
      els.locateBtn.textContent = 'Update my location';
      els.locateStatus.textContent = 'Sorted by distance from you.';
      render();
    }, function (err) {
      els.locateBtn.disabled = false;
      els.locateStatus.textContent = err.code === 1
        ? 'Location is blocked. Allow it in your browser settings and try again.'
        : 'Could not find your location. Try again.';
    }, { enableHighAccuracy: false, timeout: 10000, maximumAge: 60000 });
  }

  els.spend.addEventListener('change', function () {
    state.maxSpend = els.spend.value === 'any' ? Infinity : Number(els.spend.value);
    render();
  });
  els.rating.addEventListener('change', function () {
    state.minRating = Number(els.rating.value);
    render();
  });
  els.sort.addEventListener('change', function () {
    state.sort = els.sort.value;
    render();
  });
  els.clear.addEventListener('click', clearFilters);
  els.emptyClear.addEventListener('click', clearFilters);
  els.locateBtn.addEventListener('click', useLocation);

  buildChips();
  render();
})();
