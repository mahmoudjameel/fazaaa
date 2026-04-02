# فزّاعين – Fzaeen Admin Dashboard

## Overview
A React + Vite web application serving as the admin dashboard for the Fzaeen roadside assistance platform, with a public-facing landing page.

## Architecture

### Tech Stack
- **Frontend**: React 18, React Router v6, Tailwind CSS
- **Backend / DB**: Firebase (Firestore, Auth, Storage)
- **Build tool**: Vite 5
- **Package manager**: npm

### Route Structure
| Path | Description | Access |
|------|-------------|--------|
| `/` | Landing page | Public |
| `/privacy` | Privacy policy | Public |
| `/terms` | Terms & conditions | Public |
| `/login` | Admin login | Public |
| `/admin` | Admin dashboard index | Auth required |
| `/admin/*` | All admin sections | Auth required |

### Key Files
- `src/App.jsx` – Route definitions
- `src/pages/Landing.jsx` – Public landing page
- `src/pages/PrivacyPolicy.jsx` – Privacy policy
- `src/pages/Terms.jsx` – Terms & conditions
- `src/pages/Login.jsx` – Admin authentication
- `src/components/Layout.jsx` – Admin sidebar layout
- `src/services/firebase.js` – Firebase configuration

## Development
- Run: `npm run dev` (serves on port 5000)
- The dev server binds to `0.0.0.0:5000` for Replit compatibility

## Firebase
- Project: `fazaproject-c5059`
- Auth, Firestore, Storage, and Realtime Database are all configured
- Admin accounts stored in `app_admins` Firestore collection
