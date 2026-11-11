// Map view on the home page: shows the cafes that match the current filters as pins.
//
// The map library (Leaflet, in js/vendor/) only loads the first time someone opens the map.
// Map pictures come from OpenStreetMap (see the README for the usage rules).
(function () {
  'use strict';

  var Y = window.Yumcha;
  var esc = Y.escapeHtml;
  var TILES = 'https://tile.openstreetmap.org/{z}/{x}/{y}.png';
  var ATTRIBUTION = '&copy; <a href="https://www.openstreetmap.org/copyright" target="_blank" rel="noopener noreferrer">OpenStreetMap</a> contributors';
  var KL = [3.139, 101.687]; // used only if there is nothing to show

  var listBtn = document.getElementById('view-list');
  var mapBtn = document.getElementById('view-map');
  var panel = document.getElementById('map-panel');
  var mapEl = document.getElementById('map');
  var noteEl = document.getElementById('map-note');
  var meBtn = document.getElementById('map-me');
  var results = document.getElementById('results');
  var locateBtn = document.getElementById('locate-btn');
  if (!listBtn || !mapBtn || !panel || !mapEl) return;

  // The home page keeps its newest results in Yumcha.lastResults; it may have drawn them before this file loaded.
  var latest = Y.lastResults || { list: [], position: null };
  var map = null;       // the Leaflet map, once created
  var layer = null;     // the group that holds the pins
  var youMarker = null;
  var loading = null;   // promise while the library loads
  var showing = false;
  var wantMe = false;   // "Show me" was pressed before the location arrived

  // ------------------------------------------------------------------ loading
  function loadLeaflet() {
    if (window.L) return Promise.resolve();
    if (loading) return loading;
    loading = new Promise(function (resolve, reject) {
      var s = document.createElement('script');
      s.src = Y.root + 'js/vendor/leaflet.js';
      s.onload = function () { window.L ? resolve() : reject(new Error('no Leaflet')); };
      s.onerror = function () { reject(new Error('could not load Leaflet')); };
      document.head.appendChild(s);
    }).catch(function (err) { loading = null; throw err; });
    return loading;
  }

  // ------------------------------------------------------------------ pins
  function popupHtml(c) {
    var distance = typeof c.km === 'number'
      ? '<p class="pop-line">' + (c.km < 1 ? Math.round(c.km * 1000) + ' m away' : c.km.toFixed(1) + ' km away') + '</p>' : '';
    return '<div class="pop">' +
      '<a class="pop-name" href="' + esc(Y.root + encodeURIComponent(c.id) + '/') + '">' + esc(c.name) + '</a>' +
      '<p class="pop-line">' + esc(c.area) + '</p>' +
      '<p class="pop-line"><strong>' + c.rating.toFixed(1) + '</strong> rating &middot; RM' + c.priceFrom + ' to RM' + c.priceTo + '</p>' +
      distance +
      '<a class="pop-link" href="' + esc(Y.root + encodeURIComponent(c.id) + '/') + '">View cafe</a>' +
    '</div>';
  }

  function pinIcon(c) {
    return L.divIcon({
      className: 'pin-wrap',
      html: '<span class="pin">' + c.rating.toFixed(1) + '</span>',
      iconSize: [46, 30],
      iconAnchor: [23, 30],
      popupAnchor: [0, -30]
    });
  }

  function drawPins() {
    if (!map) return;
    layer.clearLayers();
    var points = [];
    latest.list.forEach(function (c) {
      var lat = Number(c.lat), lng = Number(c.lng);
      if (!isFinite(lat) || !isFinite(lng)) return;
      L.marker([lat, lng], { icon: pinIcon(c), title: c.name + ', rated ' + c.rating.toFixed(1), keyboard: true, riseOnHover: true, zIndexOffset: Math.round(c.rating * 100) })
        .bindPopup(popupHtml(c), { maxWidth: 240 })
        .addTo(layer);
      points.push([lat, lng]);
    });

    if (youMarker) { map.removeLayer(youMarker); youMarker = null; }
    if (latest.position) {
      youMarker = L.circleMarker([latest.position.lat, latest.position.lng], {
        radius: 8, color: '#fff', weight: 3, fillColor: '#3b82f6', fillOpacity: 1
      }).bindTooltip('You are here').addTo(map);
    }

    var n = points.length;
    noteEl.textContent = n === 0 ? 'No cafes match your filters.' : (n === 1 ? '1 cafe on the map.' : n + ' cafes on the map. Zoom in to separate pins that overlap.');
    if (n === 1) map.setView(points[0], 15);
    else if (n > 1) map.fitBounds(points, { padding: [40, 40], maxZoom: 15 });
  }

  function centreOnMe() {
    if (!map || !latest.position) return;
    map.setView([latest.position.lat, latest.position.lng], 15);
  }

  function ensureMap() {
    if (map) return;
    map = L.map(mapEl, { zoomControl: true, attributionControl: true }).setView(KL, 11);
    L.tileLayer(TILES, { maxZoom: 19, attribution: ATTRIBUTION }).addTo(map);
    layer = L.layerGroup().addTo(map);
  }

  // ------------------------------------------------------------------ switching views
  function setButtons(isMap) {
    listBtn.setAttribute('aria-pressed', String(!isMap));
    mapBtn.setAttribute('aria-pressed', String(isMap));
  }

  function showList() {
    showing = false;
    panel.hidden = true;
    results.hidden = false;
    setButtons(false);
    setQuery(false);
  }

  function showMap(scroll) {
    mapBtn.disabled = true;
    return loadLeaflet().then(function () {
      showing = true;
      results.hidden = true;
      panel.hidden = false;
      setButtons(true);
      setQuery(true);
      ensureMap();
      map.invalidateSize();
      drawPins();
      if (wantMe) { wantMe = false; centreOnMe(); }
      // On a phone the filters push the map off screen, so bring it into view.
      if (scroll && panel.scrollIntoView) panel.scrollIntoView({ behavior: 'smooth', block: 'start' });
    }).catch(function (err) {
      showList();
      window.alert('The map could not load. You can keep using the list.');
      if (window.console) console.error('Yumcha map:', err);
    }).then(function () { mapBtn.disabled = false; });
  }

  function setQuery(isMap) {
    try {
      var url = new URL(window.location.href);
      if (isMap) url.searchParams.set('view', 'map'); else url.searchParams.delete('view');
      window.history.replaceState(null, '', url.pathname + url.search + url.hash);
    } catch (e) { /* the address bar is only a convenience */ }
  }

  listBtn.addEventListener('click', showList);
  mapBtn.addEventListener('click', function () { if (!showing) showMap(true); });

  meBtn.addEventListener('click', function () {
    if (latest.position) return centreOnMe();
    wantMe = true;
    noteEl.textContent = 'Finding you...';
    if (locateBtn) locateBtn.click();
  });

  // The home page tells us whenever the filtered list or the person's position changes.
  document.addEventListener('yumcha:results', function (e) {
    var hadPosition = !!latest.position;
    latest = e.detail || latest;
    if (!showing) return;
    drawPins();
    if (wantMe && latest.position) { wantMe = false; centreOnMe(); }
    else if (!hadPosition && latest.position) centreOnMe();
  });

  try {
    if (new URLSearchParams(window.location.search).get('view') === 'map') showMap();
  } catch (e) { /* ignore */ }
})();
