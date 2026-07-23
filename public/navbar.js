// 🧭 Composant Navigation Universel (Boho-Tech)
document.addEventListener('DOMContentLoaded', () => {
    // 1. Vérification de sécurité Token
    const token = localStorage.getItem('monBadgePhoto');
    const pageActuelle = window.location.pathname;

    // Redirection automatique si pas connecté (sauf sur login/register/pricing)
    const pagesPubliques = ['/index.html', '/', '/register.html', '/pricing.html', '/client-gallery.html'];
    if (!token && !pagesPubliques.includes(pageActuelle)) {
        window.location.replace('/index.html');
        return;
    }

    // 2. Création HTML de la Navbar
    const navbarHTML = `
    <nav class="navbar-standard">
        <div class="nav-brand" onclick="window.location.href='/dashboard.html'">
            🌾 Mon SaaS Média
        </div>
        <div class="nav-links-container">
            <a href="/dashboard.html" class="nav-link ${pageActuelle.includes('dashboard') ? 'active' : ''}">
                🏠 Dashboard
            </a>
            <a href="/my-albums.html" class="nav-link ${pageActuelle.includes('albums') || pageActuelle.includes('gallery') ? 'active' : ''}">
                📁 Mes Albums
            </a>
            <a href="/all-photos.html" class="nav-link ${pageActuelle.includes('all-photos') ? 'active' : ''}">
                🖼️ Pellicule
            </a>
            <a href="/editor.html" class="nav-link studio ${pageActuelle.includes('editor') ? 'active' : ''}">
                ✨ Studio Retouche
            </a>
            <a href="/profile.html" class="nav-link ${pageActuelle.includes('profile') ? 'active' : ''}">
                👤 Mon Compte
            </a>
            <button id="globalLogoutBtn" class="nav-btn-logout">
                🚪 Déconnexion
            </button>
        </div>
    </nav>
    `;

    // 3. CSS de la Navbar Universelle
    const navbarCSS = `
    <style>
        .navbar-standard {
            position: fixed; top: 0; left: 0; right: 0; height: 75px;
            background: rgba(255, 255, 255, 0.85);
            backdrop-filter: blur(16px); -webkit-backdrop-filter: blur(16px);
            display: flex; justify-content: space-between; align-items: center;
            padding: 0 40px;
            border-bottom: 1px solid rgba(201, 122, 99, 0.12);
            z-index: 9999;
            box-sizing: border-box;
            font-family: 'Plus Jakarta Sans', sans-serif;
        }
        .nav-brand {
            font-family: 'Playfair Display', serif;
            font-size: 22px; font-weight: 700; color: #2D2A26;
            cursor: pointer; user-select: none;
        }
        .nav-links-container { display: flex; align-items: center; gap: 8px; }
        .nav-link {
            color: #766E65; text-decoration: none; font-weight: 600; font-size: 13.5px;
            padding: 9px 15px; border-radius: 10px; transition: all 0.3s ease;
            display: flex; align-items: center; gap: 6px;
        }
        .nav-link:hover { color: #2D2A26; background: rgba(118, 110, 101, 0.06); }
        .nav-link.active { color: #C97A63; background: rgba(201, 122, 99, 0.08); font-weight: 700; }
        .nav-link.studio { color: #8A65B2; background: rgba(138, 101, 178, 0.06); }
        .nav-link.studio:hover { background: rgba(138, 101, 178, 0.12); }
        .nav-btn-logout {
            background: transparent; border: 1px solid rgba(201, 99, 99, 0.2);
            color: #C96363; font-weight: 600; font-size: 13px;
            padding: 8px 14px; border-radius: 10px; cursor: pointer;
            transition: all 0.3s ease; margin-left: 8px;
            font-family: inherit;
        }
        .nav-btn-logout:hover { background: #C96363; color: white; border-color: #C96363; }
        
        @media (max-width: 900px) {
            .navbar-standard { padding: 0 16px; height: auto; flex-direction: column; padding-bottom: 12px; }
            .nav-brand { margin-top: 12px; margin-bottom: 8px; }
            .nav-links-container { flex-wrap: wrap; justify-content: center; gap: 4px; }
            .nav-link { font-size: 12px; padding: 6px 10px; }
        }
    </style>
    `;

    // 4. Injection dans le body de la page
    document.head.insertAdjacentHTML('beforeend', navbarCSS);
    document.body.insertAdjacentHTML('afterbegin', navbarHTML);

    // 5. Gestionnaire de Déconnexion
    const logoutBtn = document.getElementById('globalLogoutBtn');
    if (logoutBtn) {
        logoutBtn.addEventListener('click', () => {
            localStorage.clear();
            window.location.replace('/index.html');
        });
    }
});