# Yumcha ☕ — Where to Lepak?

Yumcha helps you and your friends find a good place to *lepak* (hang out). Start with cafes near you, see what they're like before you go, and read or share real experiences from other people.

> **Status:** early development. Version 1 is a mobile-friendly website. Features below marked with 🚧 are planned, not built yet.

## Features

**Version 1 (in progress)**
- Browse cafe suggestions as cards
- Each cafe shows its **price range**, **environment/vibe** (quiet, aesthetic, good for groups, etc.) and **rating**
- Filter by price, vibe and rating
- "Near me" sorting using your device's location 🚧

**Version 2 (planned)**
- 🚧 User accounts
- 🚧 Post your experience at a cafe and join discussions
- 🚧 Photos and reviews

**Later**
- 🚧 Other kinds of places (restaurants, dessert spots, activities)
- 🚧 Installable app for Android and iOS (Play Store / TestFlight)

## Tech stack

- HTML, CSS and JavaScript (no framework for now)
- Cafe data stored in a JSON file for v1
- Planned: Leaflet + OpenStreetMap for maps, and Supabase or Firebase for accounts and posts

## Getting started

1. Clone the repository:
   ```bash
   git clone https://github.com/Pie0625/yumcha.git
   cd yumcha
   ```
2. Open `index.html` in your browser. If the page loads data from a JSON file, run a simple local server instead:
   ```bash
   python3 -m http.server 8000
   ```
   Then visit `http://localhost:8000`.

> `index.html` will be added with the first version of the app.

## Project structure (planned)

```
yumcha/
├── index.html      # main page
├── css/            # styles
├── js/             # app logic
├── data/           # cafes.json (sample cafe data)
└── README.md
```

## Roadmap

- [ ] Cafe list with cards and sample data
- [ ] Filters (price, vibe, rating)
- [ ] "Near me" sorting
- [ ] Cafe detail page
- [ ] Map view
- [ ] Accounts, posts and discussions
- [ ] Package as a mobile app

## Contributing

This is a personal learning project. Ideas and suggestions are welcome. Open an issue to share one.

## Author

Made by [@Pie0625](https://github.com/Pie0625).
