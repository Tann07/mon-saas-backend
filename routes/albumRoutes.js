const express = require('express');
const router = express.Router();
const Album = require('../models/Album');
const auth = require('../middleware/auth');
const Photo = require('../models/Photo');
const fs = require('fs'); 
const path = require('path'); 
const crypto = require('crypto');
const User = require('../models/User'); 

// 1. ROUTE POUR CRÉER UN ALBUM (Protégée)
router.post('/create', auth, async (req, res) => {
    try {
        const { titre, description } = req.body;

        const nouvelAlbum = new Album({
            titre,
            description,
            createur: req.auth.userId
        });

        await nouvelAlbum.save();
        res.status(201).json({ message: "Album créé avec succès !", album: nouvelAlbum });
    } catch (error) {
        res.status(400).json({ message: "Erreur lors de la création de l'album", error: error.message });
    }
});

// 2. ROUTE POUR RÉCUPÉRER LES ALBUMS DE L'UTILISATEUR CONNECTÉ
router.get('/my-albums', auth, async (req, res) => {
    try {
        const userId = req.auth.userId;
        const albums = await Album.find({ createur: userId }).sort({ updatedAt: -1 });
        res.status(200).json(albums);
    } catch (error) {
        console.error("Erreur sur /my-albums :", error);
        res.status(500).json({ message: "Erreur lors de la récupération des albums" });
    }
});

// 🔗 3. GENERATION DE LIEN DE PARTAGE DYNAMIQUE (Fix IP/Localhost)
router.post('/:id/share', auth, async (req, res) => {
    try {
        const album = await Album.findOne({ _id: req.params.id, createur: req.auth.userId });
        if (!album) return res.status(404).json({ message: "Album introuvable ou accès refusé." });

        if (!album.codePartage) {
            album.codePartage = crypto.randomBytes(8).toString('hex');
            album.statut = "public";
            await album.save();
        }

        // On extrait l'hôte exact de la requête (IP locale ou domaine Prod)
        const host = req.get('host');
        const protocol = req.protocol;
        const shareUrl = `${protocol}://${host}/client-gallery.html?code=${album.codePartage}`;

        res.status(200).json({ 
            message: "Lien de partage généré avec succès !", 
            shareUrl,
            codePartage: album.codePartage 
        });
    } catch (error) {
        res.status(500).json({ message: "Erreur lors de la génération du lien de partage", error: error.message });
    }
});

// 🌐 4. ACCÈS PUBLIC A UN ALBUM PARTAGÉ (Pour Mobile & Client Web sans Auth)
router.get('/shared/:code', async (req, res) => {
    try {
        const album = await Album.findOne({ codePartage: req.params.code });
        if (!album) return res.status(404).json({ message: "Cet album est privé ou n'existe pas." });

        const photos = await Photo.find({ album: album._id }).sort({ _id: -1 });

        res.status(200).json({
            album: {
                _id: album._id,
                titre: album.titre,
                description: album.description,
                urlCouverture: album.urlCouverture
            },
            photos
        });
    } catch (error) {
        res.status(500).json({ message: "Erreur récupération album partagé", error: error.message });
    }
});

// 📈 5. STATISTIQUES DU TABLEAU DE BORD
router.get('/stats', auth, async (req, res) => {
    try {
        const userId = req.auth.userId;
        const nombreAlbums = await Album.countDocuments({ createur: userId });
        const mesAlbums = await Album.find({ createur: userId });
        const albumIds = mesAlbums.map(album => album._id);

        const nombrePhotos = await Photo.countDocuments({ album: { $in: albumIds } });
        const stockageUtiliseMo = nombrePhotos * 2.5; 
        const limiteStockageMo = 15000; // Pack Gratuit 15 Go

        res.status(200).json({
            albums: nombreAlbums,
            photos: nombrePhotos,
            stockageUtilise: stockageUtiliseMo,
            stockageLimite: limiteStockageMo
        });
    } catch (error) {
        res.status(500).json({ message: "Erreur lors du calcul des stats", error: error.message });
    }
});

// 🗑️ 6. SUPPRESSION D'UN ALBUM (CASCADE)
router.delete('/:id', auth, async (req, res) => {
    try {
        const albumId = req.params.id;
        const album = await Album.findOne({ _id: albumId, createur: req.auth.userId });
        if (!album) {
            return res.status(404).json({ message: "Album introuvable ou vous n'avez pas les droits." });
        }

        const photos = await Photo.find({ album: albumId });

        photos.forEach(photo => {
            const nomFichier = photo.urlImage.split('/uploads/')[1];
            if (nomFichier) {
                const cheminFichier = path.join(__dirname, '../uploads', nomFichier);
                fs.unlink(cheminFichier, (err) => {
                    if (err) console.log("⚠️ Fichier physique déjà supprimé :", nomFichier);
                });
            }
        });

        await Photo.deleteMany({ album: albumId });
        await Album.findByIdAndDelete(albumId);

        res.status(200).json({ message: "L'album et toutes ses photos ont été définitivement supprimés !" });
    } catch (error) {
        res.status(500).json({ message: "Erreur lors de la suppression de l'album", error: error.message });
    }
});

// 🔒 7. BASCULER LE STATUT PRIVÉ / PUBLIC
router.put('/:id/toggle-share', auth, async (req, res) => {
    try {
        const album = await Album.findOne({ _id: req.params.id, createur: req.auth.userId });
        if (!album) return res.status(404).json({ message: "Album introuvable ou accès refusé." });

        album.statut = album.statut === "prive" ? "public" : "prive";
        if (album.statut === "public" && !album.codePartage) {
            album.codePartage = crypto.randomBytes(8).toString('hex');
        }

        await album.save();
        res.status(200).json({ 
            message: `Album passé en mode ${album.statut} !`, 
            statut: album.statut,
            codePartage: album.codePartage 
        });
    } catch (error) {
        res.status(500).json({ message: "Erreur lors du changement de statut", error: error.message });
    }
});

// 📝 8. MODIFIER TITRE ET DESCRIPTION
router.put('/:id', auth, async (req, res) => {
    try {
        const { titre, description } = req.body;
        const album = await Album.findOne({ _id: req.params.id, createur: req.auth.userId });
        if (!album) return res.status(404).json({ message: "Album introuvable." });

        if (titre) album.titre = titre;
        if (description !== undefined) album.description = description;

        await album.save();
        res.status(200).json({ message: "Album mis à jour avec succès !", album });
    } catch (error) {
        res.status(500).json({ message: "Erreur modification album", error: error.message });
    }
});

// 🖼️ 9. MODIFIER COUVERTURE
router.put('/:id/cover', auth, async (req, res) => {
    try {
        const { urlImage } = req.body;
        const album = await Album.findOne({ _id: req.params.id, createur: req.auth.userId });
        if (!album) return res.status(404).json({ message: "Album introuvable" });

        album.urlCouverture = urlImage;
        await album.save();
        res.status(200).json({ message: "Couverture mise à jour !" });
    } catch (error) {
        res.status(500).json({ message: "Erreur couverture", error: error.message });
    }
});

module.exports = router;