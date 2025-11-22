# Had To Be There

Had To Be There is a social map app for the greater Montreal area (McGill-focused).  
Users drop shareable “location pings” with descriptions, see what’s happening nearby on an interactive map, and browse a simple social feed.

> **Stack:** React Native · Node.js / Express · PostgreSQL (geospatial) · Maps SDK · Firebase

---

## ✨ Features

- 🗺️ **Interactive map**
  - Users drop pings with descriptions.
  - Clustering / “nearby” queries to keep dense areas readable.

- 👥 **Friends**
  - Add friends and see their pings more prominently.
  - Friend-filtered views of the map / feed.

- 💬 **Comments & activity feed**
  - Comment on pings.
  - Feed of recent pings and interactions.

- 🔒 **Basic privacy & moderation**
  - Sensible default visibility for new pings.
  - Report / hide tools for problematic content.

- 📱 **Mobile-first**
  - Built for mid-range phones with responsive map interactions and batched API requests.

---

## 🏗️ Architecture

The project is split into a mobile client and a backend API.

> Folder names here are examples – adjust them to match your actual structure.

```text
.
├── mobile/              # React Native app
│   ├── src/
│   │   ├── components/
│   │   ├── screens/
│   │   ├── navigation/
│   │   └── api/
│   └── package.json
└── server/              # Node.js / Express backend
    ├── src/
    │   ├── routes/
    │   ├── controllers/
    │   ├── models/
    │   └── config/
    ├── migrations/ or prisma/
    └── package.json
