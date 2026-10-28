# Yumcha ☕ — Where to Lepak?

Yumcha helps you and your friends find a good place to *lepak* (hang out). Start with cafes near you, see what they're like before you go, and read or share real experiences from other people.

> **Status:** early development. Version 1 is a mobile-friendly website. Features below marked with 🚧 are planned, not built yet.

## Features

**Version 1 (built)**
- Browse cafe suggestions as cards
- Each cafe shows its **price range**, **environment/vibe** (quiet, aesthetic, good for groups, etc.) and **rating**
- Filter by spend per person, vibe and rating
- Sort by highest rated, lowest price, or nearest to you (uses your device's location)
- Photo on every card (a brown placeholder until a cafe has a real photo)
- Tap a card to open that cafe's own page with all the details and a link to the area on a map

**Version 2 (planned)**
- 🚧 User accounts
- 🚧 Post your experience at a cafe and join discussions
- 🚧 Photos and reviews

**Later**
- 🚧 Other kinds of places (restaurants, dessert spots, activities)
- 🚧 Installable app for Android and iOS (Play Store / TestFlight)

## Tech stack

- HTML, CSS and JavaScript (no framework for now)
- Cafe data stored in a JavaScript file (`data/cafes.js`) for v1
- Planned: Leaflet + OpenStreetMap for maps, and Supabase or Firebase for accounts and posts

## Getting started

1. Clone the repository:
   ```bash
   git clone https://github.com/Pie0625/yumcha.git
   cd yumcha
   ```
2. Open `index.html` in your browser. To test "Use my location", run a simple local server instead, because browsers only allow location on `localhost` or `https`:
   ```bash
   python3 -m http.server 8000
   ```
   Then visit `http://localhost:8000`.

The cafes in `data/cafes.js` are made-up samples for testing, not real places.

### Adding a real photo to a cafe

1. Put the image in an `images/` folder, for example `images/kopi-kawan.jpg`. Landscape photos around 1200 px wide work best.
2. In `data/cafes.js`, add a `photo` line to that cafe:
   ```js
   id: 'kopi-kawan',
   photo: 'images/kopi-kawan.jpg',
   ```
Only use photos you took yourself or have permission to use. Cafes without a `photo` line keep the placeholder.

## Project structure

```
yumcha/
├── index.html      # list of cafes
├── cafe.html       # one cafe's page (cafe.html?id=...)
├── css/styles.css  # styles
├── js/app.js       # list page: filters, sorting, location
├── js/detail.js    # cafe page
├── js/common.js    # shared helpers (photos, escaping)
├── data/cafes.js   # sample cafe data
└── README.md
```

## Roadmap

- [x] Cafe list with cards and sample data
- [x] Filters (spend, vibe, rating)
- [x] "Nearest" sorting
- [x] Cafe detail page
- [ ] Map view
- [ ] Accounts, posts and discussions
- [ ] Package as a mobile app

## Contributing

This is a personal learning project. Ideas and suggestions are welcome. Open an issue to share one.

## Author

Made by [@Pie0625](https://github.com/Pie0625).
