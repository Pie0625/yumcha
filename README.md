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

**Version 2 (built, needs one-time setup: see "Set up the community" below)**
- Sign in with Google or with email and password
- Share an experience on a cafe's page: a 1 to 5 rating and a short text (one per person per cafe)
- Everyone sees the posts and the community average rating
- Delete your own post; report anyone else's
- Password reset by email

**Next**
- 🚧 Photos in posts
- 🚧 Replies and discussion threads

**Later**
- 🚧 Other kinds of places (restaurants, dessert spots, activities)
- 🚧 Installable app for Android and iOS (Play Store / TestFlight)

## Tech stack

- HTML, CSS and JavaScript (no framework for now)
- Cafe data stored in a JavaScript file (`data/cafes.js`) for v1
- [Supabase](https://supabase.com) for accounts, posts and reports (a copy of its browser library is in `js/vendor/`, version 2.117.3, MIT licence)
- Planned: Leaflet + OpenStreetMap for maps

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

## Set up the community (Supabase)

The community needs a free Supabase project. Until you do this, cafe pages just say "coming soon". You only do it once.

1. **Create a project** at [supabase.com](https://supabase.com) (free plan). Pick a region near you, for example Singapore. Save the database password somewhere safe.
2. **Create the tables.** In the project, open **SQL Editor**, paste all of `supabase/schema.sql`, and press **Run**. This also switches on the security rules, so please don't skip it.
3. **Add your project's details.** Open **Project Settings, then API** (or **Data API**). Copy the **Project URL** and the **anon / publishable key** into `js/config.js`. These two are public and are meant to be in the website. **Never** copy the `service_role` or `secret` key into this repository.
4. **Tell Supabase where your site lives.** Open **Authentication, then URL Configuration**. Set **Site URL** to `https://pie0625.github.io/yumcha/` and add these under **Redirect URLs**:
   - `https://pie0625.github.io/yumcha/**`
   - `http://localhost:8000/**` (for testing on your computer)
5. **Email sign-in works straight away.** By default Supabase asks people to confirm their email. The built-in email sender has a low hourly limit, so for real use add your own email service under **Authentication, then SMTP Settings**.
6. **Optional: Google sign-in.**
   1. In the [Google Cloud console](https://console.cloud.google.com), create a project, then an **OAuth client ID** of type **Web application**.
   2. Add this **Authorized redirect URI**: `https://YOUR-PROJECT-REF.supabase.co/auth/v1/callback` (Supabase shows the exact address on the Google provider page).
   3. In Supabase, open **Authentication, then Sign In / Providers, then Google**, switch it on, and paste the Client ID and Client secret.
   4. In `js/config.js`, set `enableGoogle: true`.
7. Commit the `js/config.js` change, merge it into `main`, and open a cafe page on your site.

### Looking after the community

- **Read reports and remove bad posts:** in Supabase, open **Table Editor**. The `reports` table lists what people reported. To remove a post, delete its row from `experiences`.
- **Posts and names are public.** People choose the name shown with their posts, and emails are never shown. Consider adding a short privacy note and community rules before you share the site widely, because you will be holding other people's emails.
- **Editing a post:** there is no edit button on purpose. People delete a post and write a new one.

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
├── js/community.js # sign in, posts, reports on the cafe pages
├── js/config.js    # your Supabase project URL and public key
├── js/vendor/      # Supabase browser library (a copy, so no outside download)
├── supabase/       # schema.sql: the tables and security rules to run once
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
- [x] Accounts, posts and reports (needs the Supabase setup)
- [ ] Replies and photos in posts
- [ ] Package as a mobile app

## Contributing

This is a personal learning project. Ideas and suggestions are welcome. Open an issue to share one.

## Author

Made by [@Pie0625](https://github.com/Pie0625).
