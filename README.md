# Yumcha ☕ — Where to Lepak?

Yumcha helps you and your friends find a good place to *lepak* (hang out). Start with cafes near you, see what they're like before you go, and read or share real experiences from other people.

> **Status:** early development. Version 1 is a mobile-friendly website. Features below marked with 🚧 are planned, not built yet.

## Features

**Version 1 (built)**
- Browse cafe suggestions as cards
- Each cafe shows its **price range**, **environment/vibe** (quiet, aesthetic, good for groups, etc.) and **rating**
- Filter by spend per person, vibe and rating
- Sort by highest rated, lowest price, or nearest to you (uses your device's location)
- A picture on every card, and a swipeable photo gallery on each cafe's page (drawn sample illustrations for now; swap in real photos any time)
- Tap a card to open that cafe's own page (like `/kopi-kawan/`) with all the details and a link to the area on a map

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
2. Start a simple local server (needed because each cafe has its own folder address, and browsers only allow location on `localhost` or `https`):
   ```bash
   python3 -m http.server 8000
   ```
   Then visit `http://localhost:8000`. It forwards to `/home/`, and each cafe lives at an address like `/kopi-kawan/`.

The cafes in `data/cafes.js` are made-up samples for testing, not real places.

### Adding or changing a cafe

Each cafe has its own page address (`/kopi-kawan/`), made from its `id` in `data/cafes.js`. After you add, rename or remove a cafe, regenerate the pages (needs [Node.js](https://nodejs.org)):

```bash
node tools/build-pages.js
```

Use lowercase letters, numbers and dashes in the `id`. Then commit the new folder along with the data change.

### Adding photos to a cafe

A cafe can have one photo or several. In `data/cafes.js`:

```js
id: 'kopi-kawan',
photos: [
  'https://res.cloudinary.com/your-name/image/upload/kopi-kawan-1.jpg',
  'https://res.cloudinary.com/your-name/image/upload/kopi-kawan-2.jpg',
],
```

- **Links (recommended):** upload photos to an image host (such as Cloudinary or Supabase Storage) and paste each link. Nothing is added to this repository.
- **Files:** or put images in the `images/` folder and write the path (`'images/kopi-kawan-1.jpg'`).
- The cafe list shows the first photo. The cafe page shows all of them as a swipeable gallery.
- Landscape photos around 1200 px wide work best.
- Only use photos you took yourself or have permission to use. Cafes with no photo get a brown placeholder, and a link that fails to load falls back to the placeholder too.

The pictures in `images/` right now are drawn sample illustrations (`.svg`) that stand in for photos of the made-up cafes.

## Project structure

```
yumcha/
├── index.html      # forwards to /home/
├── home/           # the list of cafes (yumcha/home/)
├── kopi-kawan/ ... # one folder per cafe, made by the script (yumcha/kopi-kawan/)
├── tools/          # build-pages.js and the cafe page template
├── css/styles.css  # styles
├── js/app.js       # list page: filters, sorting, location
├── js/detail.js    # cafe page
├── js/common.js    # shared helpers (photos, escaping)
├── data/cafes.js   # sample cafe data
├── images/         # cafe pictures (sample illustrations for now)
├── icons/          # logo and favicons (logo.svg is the master)
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
