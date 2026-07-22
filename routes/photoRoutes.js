const express = require('express');
const router = express.Router();
const auth = require('../middleware/auth');
const multer = require('../middleware/multer-config');
const fs = require('fs');
const path = require('path');

// Importations sécurisées des modèles
const Photo = require('../models/Photo'); 
const User = require('../models/user'); 
const Album = require('../models/Album');

// 🤖 SIMULATEUR MISTRAL AI
function simulerMistralAI(nomFichierBrut, titreFourni) {
    const contexte = (titreFourni + " " + nomFichierBrut).toLowerCase();
    let tagsIntelligents = ["media", "galerie"];
    let suggestionInstagram = "";

    if (contexte.includes("mariage") || contexte.includes("wedding") || contexte.includes("robe")) {
        tagsIntelligents.push("mariage", "evenement", "amour", "fete");
        suggestionInstagram = "Le plus beau jour d'une vie, capturé à jamais. ✨ Félicitations aux mariés ! ❤️ #Mariage #Love #WeddingDay";
    } else if (contexte.includes("vacances") || contexte.includes("plage") || contexte.includes("mer") || contexte.includes("voyage")) {
        tagsIntelligents.push("vacances", "voyage", "nature", "evasion");
        suggestionInstagram = "Prendre le large et oublier le reste... 🌊 #Vacances #Voyage #Evasion #BeachLife";
    } else if (contexte.includes("chat") || contexte.includes("chien") || contexte.includes("animal")) {
        tagsIntelligents.push("animal", "compagnon", "mignon");
        suggestionInstagram = "Le roi de la maison a encore frappé. 🐾 #Animaux #Cute #InstaPet";
    } else {
        tagsIntelligents.push("souvenir", "interne");
        suggestionInstagram = "Chaque instant mérite d'être immortalise. 📸 #InstaPhoto #Moments #Souvenirs";
    }
    return { tags: tagsIntelligents, instagram: suggestionInstagram };
}

// ➕ ROUTE POUR AJOUTER DES MÉDIAS (PHOTOS ET VIDÉOS)
router.post('/add', auth, multer, async (req, res) => {
    try {
        const { titre, description, albumId, tags } = req.body;
        
        if (!req.files || req.files.length === 0) {
            return res.status(400).json({ message: "Veuillez sélectionner au moins un fichier !" });
        }

        const userId = req.auth.userId;

        // 📁 STRATÉGIE DE L'ALBUM AUTOMATIQUE (Pour le Flux Mobile sans dossier spécifié)
        let idAlbumFinal = albumId;

        if (!idAlbumFinal || idAlbumFinal === "undefined" || idAlbumFinal === "") {
            const dateAujourdhui = new Date().toLocaleDateString('fr-FR');
            const nomAlbumAuto = `Flux Mobile - ${dateAujourdhui}`;

            let albumAuto = await Album.findOne({ titre: nomAlbumAuto, createur: userId });

            if (!albumAuto) {
                albumAuto = new Album({
                    titre: nomAlbumAuto,
                    description: "Médias synchronisés automatiquement depuis le smartphone.",
                    createur: userId
                });
                await albumAuto.save();
                console.log(`✨ Nouvel album automatique créé : ${nomAlbumAuto}`);
            }
            
            idAlbumFinal = albumAuto._id;
        }

        // 1. Récupérer l'utilisateur
        const utilisateur = await User.findById(userId);
        if (!utilisateur) {
            return res.status(404).json({ message: "Utilisateur introuvable" });
        }

        // 2. Trouver tous les albums de l'utilisateur pour calculer son stockage RÉEL
        const mesAlbums = await Album.find({ createur: userId });
        const albumIds = mesAlbums.map(a => a._id);
        
        const mesPhotosActuelles = await Photo.find({ album: { $in: albumIds } });
        const stockageActuelMo = mesPhotosActuelles.length * 2.5; 

        // 3. Calculer le poids précis du nouveau lot téléversé
        let poidsNouveauLotMo = 0;
        req.files.forEach(file => {
            poidsNouveauLotMo += file.size / (1024 * 1024);
        });

        // 4. VERROU DU FORFAIT (15 Go pour Gratuit / 1 To pour Premium / 5 To pour Pro)
        if (stockageActuelMo + poidsNouveauLotMo > utilisateur.stockageMaxMo) {
            req.files.forEach(file => fs.unlink(file.path, () => {}));

            const limiteEnGo = (utilisateur.stockageMaxMo / 1024).toFixed(0);
            return res.status(403).json({ 
                message: `Espace saturé ! Votre forfait '${utilisateur.forfait}' est limité à ${limiteEnGo} Go. Passez à la formule supérieure (1 To ou 5 To) !` 
            });
        }

        // 5. Enregistrement des photos/vidéos si le stockage est OK
        const tagsManuels = tags ? tags.split(',').map(tag => tag.trim().toLowerCase()) : [];
        const mediasEnregistres = [];

        for (let i = 0; i < req.files.length; i++) {
            const file = req.files[i];
            const urlMedia = `${req.protocol}://${req.get('host')}/uploads/${file.filename}`;
            const titreMedia = titre ? `${titre} (${i + 1})` : file.originalname.split('.')[0];
            const estVideo = file.mimetype ? file.mimetype.startsWith('video/') : false;

            const resultatIA = simulerMistralAI(file.originalname, titreMedia);
            const tousLesTags = [...new Set([...tagsManuels, ...resultatIA.tags, estVideo ? 'video' : 'photo'])];

            const nouveauMedia = new Photo({
                titre: titreMedia,
                description: description || "",
                urlImage: urlMedia,
                typeMedia: estVideo ? 'video' : 'image', // 👈 Détection automatique du type de fichier
                album: idAlbumFinal,
                tags: tousLesTags,
                suggestionInstagram: resultatIA.instagram
            });

            await nouveauMedia.save();
            mediasEnregistres.push(nouveauMedia);
        }

        res.status(201).json({ 
            message: `${req.files.length} média(s) ajouté(s) avec succès !`, 
            photos: mediasEnregistres 
        });

    } catch (error) {
        console.error("❌ CRASH DANS LA ROUTE ADD-MEDIA :", error.message);
        res.status(500).json({ message: "Erreur interne lors de l'ajout", error: error.message });
    }
});

// 🗑️ ROUTE SUPPRESSION RÉELLE D'UN MÉDIA (BASE DE DONNÉES ET DISQUE DU PC)
router.delete('/:id', auth, async (req, res) => {
    try {
        const photo = await Photo.findById(req.params.id);
        if (!photo) return res.status(404).json({ message: "Média introuvable..." });

        const nomFichier = photo.urlImage.split('/uploads/')[1];
        if (nomFichier) {
            const cheminFichier = path.join(__dirname, '../uploads', nomFichier);
            fs.unlink(cheminFichier, (err) => { 
                if (err) console.log("Fichier physique déjà absent ou introuvable sur le disque"); 
            });
        }

        await Photo.findByIdAndDelete(req.params.id);
        res.status(200).json({ message: "Média supprimé avec succès !" });
    } catch (error) {
        res.status(500).json({ message: "Erreur lors de la suppression", error: error.message });
    }
});

// 📂 ROUTE RÉCUPÉRER LES MÉDIAS D'UN ALBUM SPECIFIQUE
router.get('/album/:albumId', auth, async (req, res) => {
    try {
        const photos = await Photo.find({ album: req.params.albumId }).sort({ _id: -1 });
        res.status(200).json(photos);
    } catch (error) {
        console.error("❌ Erreur récupération médias album :", error.message);
        res.status(500).json({ message: "Erreur récupération des médias", error: error.message });
    }
});

// 📥 ROUTE POUR FORCER LE TÉLÉCHARGEMENT D'UN FICHIER
router.get('/download-file', async (req, res) => {
    try {
        const { url } = req.query;
        if (!url) return res.status(400).send("URL manquante");
        
        res.attachment(url.split('/').pop());
        res.redirect(url);
    } catch (error) {
        res.status(500).send("Erreur de téléchargement");
    }
});

// 🔄 ROUTE STUDIO A : MODIFIER ET REMPLACER L'IMAGE ORIGINALE
router.put('/:id/edit-replace', auth, async (req, res) => {
    try {
        const { imageBase64 } = req.body;
        if (!imageBase64) return res.status(400).json({ message: "Données de l'image manquantes." });

        const photo = await Photo.findById(req.params.id);
        if (!photo) return res.status(404).json({ message: "Photo introuvable." });

        const nomFichier = photo.urlImage.split('/uploads/')[1];
        if (!nomFichier) return res.status(400).json({ message: "Impossible de localiser le fichier d'origine." });

        const cheminFichier = path.join(__dirname, '../uploads', nomFichier);
        const base64Data = imageBase64.replace(/^data:image\/jpeg;base64,/, "").replace(/^data:image\/png;base64,/, "");

        fs.writeFileSync(cheminFichier, base64Data, 'base64');
        res.status(200).json({ message: "Fichier d'origine écrasé avec succès !", urlImage: photo.urlImage });
    } catch (error) {
        console.error("❌ Erreur Studio (Replace) :", error.message);
        res.status(500).json({ message: "Erreur lors du remplacement de la photo.", error: error.message });
    }
});

// 🌿 ROUTE STUDIO B : DUPLIQUER LA PHOTO RETOUCHÉE DANS UN NOUVEL ALBUM
router.post('/edit-copy-album', auth, async (req, res) => {
    try {
        const { imageBase64, albumOrigineId, nomNouvelAlbum, titrePhoto } = req.body;
        const userId = req.auth ? req.auth.userId : (req.user ? req.user.id : null);

        if (!imageBase64 || !albumOrigineId) {
            return res.status(400).json({ message: "Données d'édition incomplètes." });
        }

        let albumCible = await Album.findOne({ titre: nomNouvelAlbum, createur: userId });

        if (!albumCible) {
            albumCible = new Album({
                titre: nomNouvelAlbum,
                description: `Contient les déclinaisons et retouches issues de l'album d'origine.`,
                createur: userId
            });
            await albumCible.save();
        }

        const nouveauNomFichier = `retouche_${Date.now()}_${Math.floor(Math.random() * 1000)}.jpg`;
        const cheminFichier = path.join(__dirname, '../uploads', nouveauNomFichier);

        const base64Data = imageBase64.replace(/^data:image\/jpeg;base64,/, "").replace(/^data:image\/png;base64,/, "");
        fs.writeFileSync(cheminFichier, base64Data, 'base64');

        const urlImage = `${req.protocol}://${req.get('host')}/uploads/${nouveauNomFichier}`;

        const nouvellePhoto = new Photo({
            titre: titrePhoto || "Retouche Studio",
            description: "Générée depuis l'atelier créatif.",
            urlImage,
            typeMedia: 'image',
            album: albumCible._id,
            tags: ["studio", "retouche"]
        });

        await nouvellePhoto.save();
        res.status(201).json({ message: "Copie créée et enregistrée avec succès !", photo: nouvellePhoto });
    } catch (error) {
        console.error("❌ Erreur Studio (Copy Album) :", error.message);
        res.status(500).json({ message: "Erreur lors de la création de la copie.", error: error.message });
    }
});

// 📸 RÉCUPÉRER TOUS LES MÉDIAS DE L'UTILISATEUR (POUR LE DASHBOARD LIVE)
router.get('/my-photos', auth, async (req, res) => {
    try {
        const userId = req.auth.userId;

        // 1. Trouver tous les albums créés par cet utilisateur
        const mesAlbums = await Album.find({ createur: userId });
        const albumIds = mesAlbums.map(album => album._id);

        // 2. Récupérer toutes les photos/vidéos associées (triées par date récente)
        const photos = await Photo.find({ album: { $in: albumIds } }).sort({ _id: -1 });

        res.status(200).json(photos);
    } catch (error) {
        console.error("❌ Erreur lors de la récupération des médias du Dashboard :", error.message);
        res.status(500).json({ message: "Erreur serveur lors de la récupération des médias", error: error.message });
    }
});

module.exports = router;