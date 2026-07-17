# System autobusowy 🚌

System zarządzania przewozami pasażerskimi.

## Funkcjonalności

- **Strona publiczna**: rozkład jazdy, cennik, aktualności, FAQ, kontakt
- **Panel admina**: zarządzanie kursami, przystankami, cenami, aktualnościami, FAQ
- **System plików**: upload rozkładu (obraz), regulaminu (PDF), obrazków do aktualności
- **SEO**: Schema.org, meta tagi, sitemap, robots.txt, czyste URL-e

## Stack technologiczny

| Komponent | Technologia |
|-----------|-------------|
| **Serwer** | Node.js 20 + Express 5 |
| **Baza danych** | SQLite (better-sqlite3, WAL mode) |
| **Szablony** | EJS |
| **Sesje** | express-session + connect-sqlite3 |
| **Bezpieczeństwo** | Helmet, bcrypt, rate-limiter, httpOnly cookies |
| **Frontend** | Vanilla JS (ES Modules), Quill editor, SortableJS |

## Struktura projektu

```
twojanazwa/
├── src/                          # Backend (Node.js)
│   ├── server.js                 # Entry point
│   ├── app.js                    # Konfiguracja Express
│   ├── config/
│   │   ├── index.js              # Zmienne środowiskowe
│   │   └── database.js           # Inicjalizacja SQLite
│   ├── middleware/
│   │   ├── auth.js               # Autoryzacja admin
│   │   ├── errorHandler.js       # Obsługa błędów
│   │   └── upload.js             # Konfiguracja Multer
│   ├── routes/
│   │   ├── index.js              # Agregator tras
│   │   ├── pages.js              # Strony (/, /cennik, /rozklad, ...)
│   │   ├── auth.js               # Login / Logout / Check-auth
│   │   ├── news.js               # Aktualności API
│   │   ├── schedule.js           # Rozkład jazdy API
│   │   ├── pricing.js            # Cennik + Przystanki API
│   │   ├── faq.js                # FAQ API
│   │   └── attributes.js         # Oznaczenia kursów API + Regulamin upload
│   └── services/
│       ├── fileService.js         # Asynchroniczne operacje na plikach
│       ├── newsService.js         # Logika aktualności
│       ├── scheduleService.js     # Logika rozkładu
│       ├── pricingService.js      # Logika cennika
│       ├── faqService.js          # Logika FAQ
│       └── attributeService.js    # Logika oznaczeń kursów
├── public/                       # Pliki statyczne
│   ├── js/admin/                 # Panel admina (ES Modules)
│   │   ├── main.js               # Entry point
│   │   ├── state.js              # Centralny stan
│   │   ├── ui.js                 # Toast, zakładki, mobile
│   │   ├── auth.js               # Login/logout
│   │   ├── imageEditor.js        # Quill + optymalizacja obrazów
│   │   ├── news.js               # CRUD aktualności
│   │   ├── schedule.js           # Edytor rozkładu
│   │   ├── pricing.js            # Cennik + przystanki
│   │   ├── faq.js                # CRUD FAQ
│   │   └── attributes.js         # Oznaczenia kursów
│   ├── style.css                 # Style publiczne
│   ├── admin.css                 # Style panelu admina
│   ├── calculator.js             # Kalkulator cen
│   ├── schedule.js               # Rozkład (frontend publiczny)
│   ├── news.js                   # Aktualności (frontend publiczny)
│   └── faq.js                    # FAQ (frontend publiczny)
├── views/                        # Szablony EJS
│   ├── partials/
│   │   ├── header.ejs
│   │   └── footer.ejs
│   ├── index.ejs
│   ├── cennik.ejs
│   ├── rozklad.ejs
│   ├── kontakt.ejs
│   ├── prywatnosc.ejs
│   └── admin.ejs
├── data/                         # Baza danych SQLite (gitignored)
├── uploads/                      # Wgrane pliki (gitignored)
├── .env                          # Zmienne środowiskowe (gitignored)
├── .env.example                  # Szablon zmiennych
├── package.json
└── start.bat                     # Szybkie uruchomienie (Windows)
```

## Instalacja

```bash
# 1. Sklonuj repozytorium
git clone <repo-url>
cd twojanazwa

# 2. Zainstaluj zależności
npm install

# 3. Skopiuj i skonfiguruj zmienne środowiskowe
cp .env.example .env
# Edytuj .env — ustaw SESSION_SECRET, ADMIN_USER, ADMIN_HASH_B64

# 4. Uruchom serwer
npm start
# lub: node src/server.js
# lub: start.bat (Windows)
```

Serwer startuje na `http://localhost:3000`.

## Konfiguracja (.env)

| Zmienna | Opis |
|---------|------|
| `NODE_ENV` | `production` lub `development` |
| `PORT` | Port serwera (domyślnie 3000) |
| `SESSION_SECRET` | Klucz szyfrowania sesji |
| `ADMIN_USER` | Login administratora |
| `ADMIN_HASH_B64` | Zahashowane hasło (bcrypt, base64) |

### Generowanie nowego hasła admin

```bash
node -e "const bcrypt=require('bcryptjs'); const h=bcrypt.hashSync('TWOJE_HASLO',10); console.log(Buffer.from(h).toString('base64'))"
```

Wklej wynik jako `ADMIN_HASH_B64` w `.env`.

## API Endpoints

### Publiczne

| Metoda | URL | Opis |
|--------|-----|------|
| GET | `/api/schedule` | Rozkład jazdy (JSON) |
| GET | `/api/news?page=1&limit=10` | Aktualności (paginowane) |
| GET | `/api/pricing-data` | Przystanki + ceny |
| GET | `/api/stops` | Lista przystanków |
| GET | `/api/price?stop1=X&stop2=Y` | Cena relacji |
| GET | `/api/faq` | Lista FAQ |
| GET | `/api/attributes` | Oznaczenia kursów |

### Admin (wymaga sesji)

| Metoda | URL | Opis |
|--------|-----|------|
| POST | `/api/login` | Logowanie |
| GET | `/api/logout` | Wylogowanie |
| POST | `/api/admin/schedule` | Aktualizacja rozkładu |
| POST | `/api/admin/upload-image` | Upload obrazu rozkładu |
| POST | `/api/admin/upload-regulamin` | Upload PDF regulaminu |
| POST/PUT/DELETE | `/api/admin/news/:id` | CRUD aktualności |
| POST | `/api/admin/upload-news-image` | Upload obrazka do newsa |
| POST/PUT/DELETE | `/api/admin/stops/:id` | CRUD przystanków |
| POST | `/api/admin/stops/reorder` | Zmiana kolejności |
| POST | `/api/admin/pricing` | Zapis ceny relacji |
| POST | `/api/admin/pricing/bulk` | Masowa zmiana cen |
| POST | `/api/admin/pricing/recalculate-monthly` | Przeliczenie miesięcznych |
| POST/PUT/DELETE | `/api/admin/faq/:id` | CRUD FAQ |
| POST | `/api/admin/faq/reorder` | Zmiana kolejności FAQ |
| POST/PUT/DELETE | `/api/admin/attributes/:symbol` | CRUD oznaczeń |
