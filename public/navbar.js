// 🧭 Composant Navigation Universel (Boho-Tech Modernisé)
document.addEventListener('DOMContentLoaded', () => {
    // 1. Vérification de sécurité Token
    const token = localStorage.getItem('monBadgePhoto');
    const pageActuelle = window.location.pathname;

    // Redirection automatique si pas connecté (sauf pages publiques)
    const pagesPubliques = ['/index.html', '/', '/register.html', '/pricing.html', '/client-gallery.html', '/view-share.html'];
    if (!token && !pagesPubliques.some(page => pageActuelle.endsWith(page))) {
        window.location.replace('/index.html');
        return;
    }

    // 2. Création HTML de la Navbar avec Icônes SVG Inline
    const navbarHTML = `
    <nav class="navbar-standard">
        <div class="nav-brand" onclick="window.location.href='/dashboard.html'">
            <span class="brand-logo-symbol">
                <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M23 19a2 2 0 0 1-2 2H3a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h4l2-3h6l2 3h4a2 2 0 0 1 2 2z"/><circle cx="12" cy="13" r="4"/></svg>
            </span>
            <span class="brand-name">Mon SaaS Média</span>
        </div>

        <div class="nav-links-container">
            <a href="/dashboard.html" class="nav-link ${pageActuelle.includes('dashboard') ? 'active' : ''}">
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect x="3" y="3" width="7" height="9"/><rect x="14" y="3" width="7" height="5"/><rect x="14" y="12" width="7" height="9"/><rect x="3" y="16" width="7" height="5"/></svg>
                <span>Dashboard</span>
            </a>

            <a href="/my-albums.html" class="nav-link ${pageActuelle.includes('albums') || pageActuelle.includes('gallery') ? 'active' : ''}">
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M22 19a2 2 0 0 1-2 2H4a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h5l2 3h9a2 2 0 0 1 2 2z"/></svg>
                <span>Collections</span>
            </a>

            <a href="/all-photos.html" class="nav-link ${pageActuelle.includes('all-photos') ? 'active' : ''}">
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect x="3" y="3" width="18" height="18" rx="2" ry="2"/><circle cx="8.5" cy="8.5" r="1.5"/><polyline points="21 15 16 10 5 21"/></svg>
                <span>Pellicule</span>
            </a>

            <a href="/editor.html" class="nav-link studio ${pageActuelle.includes('editor') ? 'active' : ''}">
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="m12 3-1.912 5.813a2 2 0 0 1-1.275 1.275L3 12l5.813 1.912a2 2 0 0 1 1.275 1.275L12 21l1.912-5.813a2 2 0 0 1 1.275-1.275L21 12l-5.813-1.912a2 2 0 0 1-1.275-1.275L12 3Z"/></svg>
                <span>Studio</span>
            </a>

            <a href="/profile.html" class="nav-link ${pageActuelle.includes('profile') ? 'active' : ''}">
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2"/><circle cx="12" cy="7" r="4"/></svg>
                <span>Compte</span>
            </a>

            <button id="globalLogoutBtn" class="nav-btn-logout" title="Déconnexion">
                <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4"/><polyline points="16 17 21 12 16 7"/><line x1="21" y1="12" x2="9" y2="12"/></svg>
                <span>Sortir</span>
            </button>
        </div>
    </nav>
    `;

    // 3. CSS de la Navbar
    const navbarCSS = `
    <style>
        .navbar-standard {
            position: fixed; top: 0; left: 0; right: 0; height: 64px;
            background: rgba(255, 255, 255, 0.88);
            backdrop-filter: blur(12px); -webkit-backdrop-filter: blur(12px);
            display: flex; justify-content: space-between; align-items: center;
            padding: 0 32px;
            border-bottom: 1px solid rgba(229, 220, 211, 0.6);
            box-shadow: 0 4px 20px rgba(45, 42, 38, 0.03);
            z-index: 99999;
            box-sizing: border-box;
            font-family: 'Plus Jakarta Sans', sans-serif;
        }

        .nav-brand {
            display: flex; align-items: center; gap: 10px;
            cursor: pointer; user-select: none; transition: opacity 0.2s ease;
        }
        .nav-brand:hover { opacity: 0.85; }
        
        .brand-logo-symbol {
            width: 34px; height: 34px; background: rgba(201, 122, 99, 0.12);
            color: #C97A63; border-radius: 10px;
            display: flex; align-items: center; justify-content: center;
        }

        .brand-name {
            font-family: 'Playfair Display', serif;
            font-size: 19px; font-weight: 700; color: #2D2A26;
            letter-spacing: -0.2px;
        }

        .nav-links-container { display: flex; align-items: center; gap: 6px; }

        .nav-link {
            color: #766E65; text-decoration: none; font-weight: 600; font-size: 13px;
            padding: 8px 14px; border-radius: 8px; transition: all 0.2s ease;
            display: flex; align-items: center; gap: 8px; position: relative;
        }
        .nav-link svg { stroke: #766E65; transition: stroke 0.2s ease; }

        .nav-link:hover { color: #2D2A26; background: rgba(45, 42, 38, 0.04); }
        .nav-link:hover svg { stroke: #2D2A26; }

        /* Lien Actif */
        .nav-link.active {
            color: #C97A63; background: rgba(201, 122, 99, 0.08); font-weight: 700;
        }
        .nav-link.active svg { stroke: #C97A63; }
        .nav-link.active::after {
            content: ''; position: absolute; bottom: -2px; left: 14px; right: 14px;
            height: 2px; background: #C97A63; border-radius: 2px;
        }

        /* Style Spécial Studio Retouche */
        .nav-link.studio {
            color: #7C5295; background: rgba(124, 82, 149, 0.08);
            border: 1px solid rgba(124, 82, 149, 0.15);
        }
        .nav-link.studio svg { stroke: #7C5295; }
        .nav-link.studio:hover {
            background: rgba(124, 82, 149, 0.14); color: #5D3774;
        }
        .nav-link.studio.active::after { background: #7C5295; }

        /* Bouton Déconnexion */
        .nav-btn-logout {
            background: transparent; border: 1px solid rgba(201, 99, 99, 0.25);
            color: #C96363; font-weight: 600; font-size: 12.5px;
            padding: 7px 12px; border-radius: 8px; cursor: pointer;
            transition: all 0.2s ease; margin-left: 10px;
            display: flex; align-items: center; gap: 6px; font-family: inherit;
        }
        .nav-btn-logout svg { stroke: #C96363; transition: stroke 0.2s ease; }
        
        .nav-btn-logout:hover {
            background: #C96363; color: #FFFFFF; border-color: #C96363;
        }
        .nav-btn-logout:hover svg { stroke: #FFFFFF; }

        /* Responsive Mobile & Tablette */
        @media (max-width: 820px) {
            .navbar-standard { padding: 0 16px; height: 58px; }
            .brand-name { font-size: 17px; }
            .brand-logo-symbol { width: 30px; height: 30px; }
            .nav-link span, .nav-btn-logout span { display: none; } /* N'affiche que les icônes sur petit écran */
            .nav-link { padding: 8px 10px; }
            .nav-btn-logout { margin-left: 4px; padding: 7px 9px; }
        }
    </style>
    `;

    // 4. Injection dans la page
    document.head.insertAdjacentHTML('beforeend', navbarCSS);
    document.body.insertAdjacentHTML('afterbegin', navbarHTML);

    // 5. Gestionnaire de Déconnexion
    const logoutBtn = document.getElementById('globalLogoutBtn');
    if (logoutBtn) {
        logoutBtn.addEventListener('click', () => {
            if (confirm("Se déconnecter de votre espace ?")) {
                localStorage.clear();
                window.location.replace('/index.html');
            }
        });
    }
});