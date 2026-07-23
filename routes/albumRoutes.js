const express = require('express');
const router = express.Router();
const Album = require('../models/Album');
const auth = require('../middleware/auth');
const Photo = require('../models/Photo');
const multer = require('../middleware/multer-config'); // 👈 Ajout pour le téléversement d'image
const fs = require('fs'); 
const path = require('path'); 
const crypto = require('crypto');

// Fonction helper pour construire le Fil d'Ariane
async function getAlbumHierarchy(albumId, userId) {
    let breadcrumb = [];
    let currId = albumId;
    while (currId) {
        const album = await Album.findOne({ _id: currId, createur: userId });
        if (!album) break;
        breadcrumb.unshift({ _id: album._id, titre: album.titre });
        currId = album.parentAlbum;
    }
    return breadcrumb;
}

// 📊 0. STATISTIQUES POUR LE DASHBOARD
router.get('/stats', auth, async (req, res) => {
    try {
        const userId = req.auth.userId;
        const nombreAlbums = await Album.countDocuments({ createur: userId });
        const mesAlbums = await Album.find({ createur: userId });
        const albumIds = mesAlbums.map(album => album._id);

        const nombrePhotos = await Photo.countDocuments({ album: { $in: albumIds } });
        const stockageUtiliseMo = parseFloat((nombrePhotos * 2.5).toFixed(1)); 
        const limiteStockageMo = 15000;

        res.status(200).json({
            albums: nombreAlbums,
            photos: nombrePhotos,
            stockageUtilise: stockageUtiliseMo,
            stockageLimite: limiteStockageMo
        });
    } catch (error) {
        res.status(500).json({ message: "Erreur calcul stats", error: error.message });
    }
});

// 1. CRÉER UN ALBUM OU UN SOUS-ALBUM
router.post('/create', auth, async (req, res) => {
    try {
        const { titre, description, parentAlbum } = req.body;
        const parentId = (parentAlbum && parentAlbum !== "null" && parentAlbum !== "undefined" && parentAlbum.trim() !== "") ? parentAlbum : null;

        const nouvelAlbum = new Album({
            titre,
            description,
            parentAlbum: parentId,
            createur: req.auth.userId
        });

        await nouvelAlbum.save();
        res.status(201).json({ message: "Album créé avec succès !", album: nouvelAlbum });
    } catch (error) {
        res.status(400).json({ message: "Erreur lors de la création de l'album", error: error.message });
    }
});

// 2. RÉCUPÉRER UNIQUEMENT LES ALBUMS RACINES (Mes Albums)
router.get('/my-albums', auth, async (req, res) => {
    try {
        const userId = req.auth.userId;
        const albums = await Album.find({ 
            createur: userId, 
            $or: [{ parentAlbum: null }, { parentAlbum: { $exists: false } }] 
        }).sort({ updatedAt: -1 });
        
        res.status(200).json(albums);
    } catch (error) {
        res.status(500).json({ message: "Erreur lors de la récupération des albums" });
    }
});

// 3. RÉCUPÉRER LE CONTENU UNIFIÉ (Album, Fil d'Ariane, Sous-albums & Photos récentes en haut)
router.get('/:id/content', auth, async (req, res) => {
    try {
        const albumId = req.params.id;
        const userId = req.auth.userId;

        const currentAlbum = await Album.findOne({ _id: albumId, createur: userId });
        if (!currentAlbum) return res.status(404).json({ message: "Album introuvable" });

        const subAlbums = await Album.find({ parentAlbum: albumId, createur: userId }).sort({ updatedAt: -1 });
        
        // 🌟 Les photos les plus récentes s'affichent TOUT EN HAUT (_id: -1)
        const photos = await Photo.find({ album: albumId }).sort({ _id: -1 });

        // 🗺️ Arborescence complète
        const breadcrumb = await getAlbumHierarchy(albumId, userId);

        res.status(200).json({
            album: currentAlbum,
            subAlbums,
            photos,
            breadcrumb
        });
    } catch (error) {
        res.status(500).json({ message: "Erreur chargement contenu album", error: error.message });
    }
});

// 4. RÉCUPÉRER LES SOUS-ALBUMS D'UN ALBUM
router.get('/:id/subalbums', auth, async (req, res) => {
    try {
        const parentId = req.params.id;
        const userId = req.auth.userId;
        const subAlbums = await Album.find({ createur: userId, parentAlbum: parentId }).sort({ updatedAt: -1 });
        res.status(200).json(subAlbums);
    } catch (error) {
        res.status(500).json({ message: "Erreur sous-albums", error: error.message });
    }
});

// 5. CHANGER LA PHOTO DE COUVERTURE / FOND VIA URL
router.put('/:id/cover', auth, async (req, res) => {
    try {
        const { urlImage } = req.body;
        const album = await Album.findOne({ _id: req.params.id, createur: req.auth.userId });
        if (!album) return res.status(404).json({ message: "Album introuvable" });

        album.photoCouverture = urlImage;
        await album.save();
        res.status(200).json({ message: "Image de fond mise à jour !", photoCouverture: album.photoCouverture });
    } catch (error) {
        res.status(500).json({ message: "Erreur mise à jour fond", error: error.message });
    }
});

// 📸 5b. CHANGER LA PHOTO DE COUVERTURE VIA UN FICHIER DEPUIS L'ORDINATEUR
router.put('/:id/cover-upload', auth, multer, async (req, res) => {
    try {
        if (!req.files || req.files.length === 0) {
            return res.status(400).json({ message: "Aucun fichier envoyé" });
        }
        const file = req.files[0];
        const urlMedia = `${req.protocol}://${req.get('host')}/uploads/${file.filename}`;

        const album = await Album.findOne({ _id: req.params.id, createur: req.auth.userId });
        if (!album) return res.status(404).json({ message: "Album introuvable" });

        album.photoCouverture = urlMedia;
        await album.save();

        res.status(200).json({ message: "Fond mis à jour avec succès !", photoCouverture: urlMedia });
    } catch (error) {
        res.status(500).json({ message: "Erreur lors du changement de fond", error: error.message });
    }
});

// 6. BASCULER PRIVÉ / PUBLIC
router.put('/:id/toggle-share', auth, async (req, res) => {
    try {
        const album = await Album.findOne({ _id: req.params.id, createur: req.auth.userId });
        if (!album) return res.status(404).json({ message: "Album introuvable." });

        album.statut = album.statut === "prive" ? "public" : "prive";
        if (album.statut === "public" && !album.codePartage) {
            album.codePartage = crypto.randomBytes(8).toString('hex');
        }

        await album.save();
        res.status(200).json({ message: `Album passé en mode ${album.statut} !`, statut: album.statut, codePartage: album.codePartage });
    } catch (error) {
        res.status(500).json({ message: "Erreur changement de statut", error: error.message });
    }
});

// 7. SUPPRESSION D'UN ALBUM
router.delete('/:id', auth, async (req, res) => {
    try {
        const albumId = req.params.id;
        const album = await Album.findOne({ _id: albumId, createur: req.auth.userId });
        if (!album) return res.status(404).json({ message: "Album introuvable." });

        const photos = await Photo.find({ album: albumId });
        photos.forEach(photo => {
            const nomFichier = photo.urlImage.split('/uploads/')[1];
            if (nomFichier) {
                const cheminFichier = path.join(__dirname, '../uploads', nomFichier);
                fs.unlink(cheminFichier, () => {});
            }
        });

        await Photo.deleteMany({ album: albumId });
        await Album.findByIdAndDelete(albumId);
        res.status(200).json({ message: "Album supprimé avec succès !" });
    } catch (error) {
        res.status(500).json({ message: "Erreur suppression album", error: error.message });
    }
});

module.exports = router;