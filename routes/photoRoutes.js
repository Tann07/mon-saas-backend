const express = require('express');
const router = express.Router();
const auth = require('../middleware/auth');
const multer = require('../middleware/multer-config');
const fs = require('fs');
const path = require('path');

const Photo = require('../models/Photo'); 
const User = require('../models/User'); 
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

// 📸 ROUTE PELLICULE COMPLETE (ALL PHOTOS & MY-PHOTOS)
const getToutesLesPhotosUser = async (req, res) => {
    try {
        const userId = req.auth.userId;

        // 1. Récupérer tous les albums créés par l'utilisateur
        const tousLesAlbums = await Album.find({ createur: userId });
        const albumIds = tousLesAlbums.map(album => album._id);

        // 2. Recherche élargie : Photos associées aux albums DE L'UTILISATEUR 
        // OR photos directement liées au créateur si le champ existe
        const photos = await Photo.find({
            $or: [
                { album: { $in: albumIds } },
                { createur: userId }
            ]
        }).sort({ _id: -1 });

        res.status(200).json(photos);
    } catch (error) {
        console.error("❌ Erreur récupération Pellicule :", error.message);
        res.status(500).json({ message: "Erreur récupération de la pellicule", error: error.message });
    }
};

router.get('/all', auth, getToutesLesPhotosUser);
router.get('/my-photos', auth, getToutesLesPhotosUser);

// Alias my-photos
router.get('/my-photos', auth, async (req, res) => {
    try {
        const userId = req.auth.userId;
        const tousLesAlbums = await Album.find({ createur: userId });
        const albumIds = tousLesAlbums.map(album => album._id);
        const photos = await Photo.find({ album: { $in: albumIds } }).sort({ _id: -1 });
        res.status(200).json(photos);
    } catch (error) {
        res.status(500).json({ message: "Erreur serveur", error: error.message });
    }
});

// ➕ AJOUT DE MÉDIAS
router.post('/add', auth, multer, async (req, res) => {
    try {
        const { titre, description, albumId, tags } = req.body;
        
        if (!req.files || req.files.length === 0) {
            return res.status(400).json({ message: "Veuillez sélectionner au moins un fichier !" });
        }

        const userId = req.auth.userId;
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
            }
            idAlbumFinal = albumAuto._id;
        }

        const utilisateur = await User.findById(userId);
        if (!utilisateur) return res.status(404).json({ message: "Utilisateur introuvable" });

        const mesAlbums = await Album.find({ createur: userId });
        const albumIds = mesAlbums.map(a => a._id);
        const mesPhotosActuelles = await Photo.find({ album: { $in: albumIds } });
        const stockageActuelMo = mesPhotosActuelles.length * 2.5; 

        let poidsNouveauLotMo = 0;
        req.files.forEach(file => { poidsNouveauLotMo += file.size / (1024 * 1024); });

        if (stockageActuelMo + poidsNouveauLotMo > utilisateur.stockageMaxMo) {
            req.files.forEach(file => fs.unlink(file.path, () => {}));
            const limiteEnGo = (utilisateur.stockageMaxMo / 1024).toFixed(0);
            return res.status(403).json({ message: `Espace saturé ! Limité à ${limiteEnGo} Go.` });
        }

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
                typeMedia: estVideo ? 'video' : 'image',
                album: idAlbumFinal,
                tags: tousLesTags,
                suggestionInstagram: resultatIA.instagram
            });

            await nouveauMedia.save();
            mediasEnregistres.push(nouveauMedia);
        }

        res.status(201).json({ message: `${req.files.length} média(s) ajouté(s) !`, photos: mediasEnregistres });
    } catch (error) {
        res.status(500).json({ message: "Erreur lors de l'ajout", error: error.message });
    }
});

// 🗑️ SUPPRESSION
router.delete('/:id', auth, async (req, res) => {
    try {
        const photo = await Photo.findById(req.params.id);
        if (!photo) return res.status(404).json({ message: "Média introuvable..." });

        const nomFichier = photo.urlImage.split('/uploads/')[1];
        if (nomFichier) {
            const cheminFichier = path.join(__dirname, '../uploads', nomFichier);
            fs.unlink(cheminFichier, () => {});
        }

        await Photo.findByIdAndDelete(req.params.id);
        res.status(200).json({ message: "Média supprimé !" });
    } catch (error) {
        res.status(500).json({ message: "Erreur suppression", error: error.message });
    }
});

// 📂 MÉDIAS D'UN ALBUM (RÉCENTS EN HAUT)
router.get('/album/:albumId', auth, async (req, res) => {
    try {
        const photos = await Photo.find({ album: req.params.albumId }).sort({ _id: -1 });
        res.status(200).json(photos);
    } catch (error) {
        res.status(500).json({ message: "Erreur récupération médias", error: error.message });
    }
});

// ❤️ TOGGLE LIKE / FAVORI D'UNE PHOTO
router.put('/:id/like', auth, async (req, res) => {
    try {
        const photo = await Photo.findById(req.params.id);
        if (!photo) return res.status(404).json({ message: "Photo introuvable" });

        const userId = req.auth.userId;
        const index = photo.likes.indexOf(userId);

        if (index === -1) {
            photo.likes.push(userId); // Ajoute le like
        } else {
            photo.likes.splice(index, 1); // Retire le like
        }

        await photo.save();
        res.status(200).json({ likesCount: photo.likes.length, isLiked: index === -1, likes: photo.likes });
    } catch (error) {
        res.status(500).json({ message: "Erreur toggle like", error: error.message });
    }
});

// 💬 AJOUTER UN COMMENTAIRE
router.post('/:id/comment', auth, async (req, res) => {
    try {
        const { texte } = req.body;
        if (!texte || texte.trim() === "") return res.status(400).json({ message: "Commentaire vide." });

        const User = require('../models/User');
        const user = await User.findById(req.auth.userId);
        const photo = await Photo.findById(req.params.id);

        if (!photo) return res.status(404).json({ message: "Photo introuvable" });

        const nouveauCommentaire = {
            auteur: user ? (user.nom || user.email.split('@')[0]) : "Collaborateur",
            auteurId: req.auth.userId,
            texte: texte.trim(),
            date: new Date()
        };

        photo.commentaires.push(nouveauCommentaire);
        await photo.save();

        res.status(201).json({ message: "Commentaire ajouté !", commentaires: photo.commentaires });
    } catch (error) {
        res.status(500).json({ message: "Erreur ajout commentaire", error: error.message });
    }
});

module.exports = router;