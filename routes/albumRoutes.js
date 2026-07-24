const express = require('express');
const router = express.Router();
const Album = require('../models/Album');
const auth = require('../middleware/auth');
const Photo = require('../models/Photo');
const User = require('../models/User');
const multer = require('../middleware/multer-config');
const fs = require('fs'); 
const path = require('path'); 
const crypto = require('crypto');

// Helper pour Fil d'Ariane
async function getAlbumHierarchy(albumId, userId) {
    let breadcrumb = [];
    let currId = albumId;
    while (currId) {
        const album = await Album.findById(currId);
        if (!album) break;
        breadcrumb.unshift({ _id: album._id, titre: album.titre });
        currId = album.parentAlbum;
    }
    return breadcrumb;
}

// 📊 STATS DASHBOARD
router.get('/stats', auth, async (req, res) => {
    try {
        const userId = req.auth.userId;
        const user = await User.findById(userId);

        // Compte les albums créés + les albums partagés avec cet utilisateur
        const mesAlbums = await Album.find({
            $or: [
                { createur: userId },
                { collaborateurs: user ? user.email : "" }
            ]
        });

        const albumIds = mesAlbums.map(album => album._id);
        const nombrePhotos = await Photo.countDocuments({ album: { $in: albumIds } });
        const stockageUtiliseMo = parseFloat((nombrePhotos * 2.5).toFixed(1)); 
        const limiteStockageMo = 15000;

        res.status(200).json({
            albums: mesAlbums.length,
            photos: nombrePhotos,
            stockageUtilise: stockageUtiliseMo,
            stockageLimite: limiteStockageMo
        });
    } catch (error) {
        res.status(500).json({ message: "Erreur calcul stats", error: error.message });
    }
});

// 1. CRÉER ALBUM OU SOUS-ALBUM
router.post('/create', auth, async (req, res) => {
    try {
        const { titre, description, parentAlbum } = req.body;
        const parentId = (parentAlbum && parentAlbum !== "null" && parentAlbum !== "undefined" && parentAlbum.trim() !== "") ? parentAlbum : null;

        const nouvelAlbum = new Album({
            titre,
            description,
            parentAlbum: parentId,
            createur: req.auth.userId,
            collaborateurs: []
        });

        await nouvelAlbum.save();
        res.status(201).json({ message: "Album créé avec succès !", album: nouvelAlbum });
    } catch (error) {
        res.status(400).json({ message: "Erreur lors de la création", error: error.message });
    }
});

// 2. RÉCUPÉRER MES ALBUMS ET LES ALBUMS PARTAGÉS AVEC MOI
router.get('/my-albums', auth, async (req, res) => {
    try {
        const userId = req.auth.userId;
        const currentUser = await User.findById(userId);
        const userEmail = currentUser ? currentUser.email : "";

        // Récupère les albums racines créés par l'utilisateur OU partagés avec lui via son email
        const albums = await Album.find({
            $and: [
                { $or: [{ parentAlbum: null }, { parentAlbum: { $exists: false } }] },
                { $or: [{ createur: userId }, { collaborateurs: userEmail }] }
            ]
        }).sort({ updatedAt: -1 });

        res.status(200).json(albums);
    } catch (error) {
        res.status(500).json({ message: "Erreur récupération des albums", error: error.message });
    }
});

// 3. INVITER UN COLLABORATEUR PAR EMAIL
router.post('/:id/invite', auth, async (req, res) => {
    try {
        const { emailInvite } = req.body;
        if (!emailInvite || emailInvite.trim() === "") {
            return res.status(400).json({ message: "L'adresse email est requise." });
        }

        const album = await Album.findOne({ _id: req.params.id, createur: req.auth.userId });
        if (!album) {
            return res.status(404).json({ message: "Album introuvable ou vous n'êtes pas le propriétaire." });
        }

        const emailNettoye = emailInvite.trim().toLowerCase();

        // Vérifier si l'utilisateur invité existe dans la base de données
        const userCible = await User.findOne({ email: emailNettoye });
        if (!userCible) {
            return res.status(404).json({ message: `L'utilisateur ${emailNettoye} n'a pas encore de compte sur la plateforme.` });
        }

        // Éviter les doublons dans la liste des collaborateurs
        if (!album.collaborateurs.includes(emailNettoye)) {
            album.collaborateurs.push(emailNettoye);
            await album.save();
        }

        res.status(200).json({ 
            message: `✨ Succès ! L'album a été partagé avec ${emailNettoye}.`,
            collaborateurs: album.collaborateurs 
        });

    } catch (error) {
        res.status(500).json({ message: "Erreur lors de l'invitation", error: error.message });
    }
});

// 4. RÉCUPÉRER CONTENU ALBUM (Si Propriétaire OU Collaborateur)
router.get('/:id/content', auth, async (req, res) => {
    try {
        const albumId = req.params.id;
        const userId = req.auth.userId;
        const user = await User.findById(userId);
        const userEmail = user ? user.email : "";

        const currentAlbum = await Album.findById(albumId);
        if (!currentAlbum) return res.status(404).json({ message: "Album introuvable" });

        // Vérifier les droits d'accès
        const estCreateur = currentAlbum.createur.toString() === userId;
        const estCollaborateur = currentAlbum.collaborateurs && currentAlbum.collaborateurs.includes(userEmail);

        if (!estCreateur && !estCollaborateur && currentAlbum.statut !== 'public') {
            return res.status(403).json({ message: "Accès refusé à cet album." });
        }

        const createurUser = await User.findById(currentAlbum.createur).select('nom email');
        const subAlbums = await Album.find({ parentAlbum: albumId }).sort({ updatedAt: -1 });
        const photos = await Photo.find({ album: albumId }).sort({ _id: -1 });
        const breadcrumb = await getAlbumHierarchy(albumId, userId);

        res.status(200).json({
            album: currentAlbum,
            createur: createurUser ? (createurUser.nom || createurUser.email) : "Créateur",
            collaborateurs: currentAlbum.collaborateurs || [],
            subAlbums,
            photos,
            breadcrumb
        });
    } catch (error) {
        res.status(500).json({ message: "Erreur chargement contenu album", error: error.message });
    }
});

// 5. ACCÈS PUBLIC
router.get('/shared/:code', async (req, res) => {
    try {
        const album = await Album.findOne({ codePartage: req.params.code });
        if (!album || album.statut !== "public") {
            return res.status(404).json({ message: "Album privé ou inexistant." });
        }

        if (album.codePIN && album.codePIN.trim() !== "") {
            return res.status(200).json({
                pinRequis: true,
                album: { titre: album.titre, description: album.description }
            });
        }

        const photos = await Photo.find({ album: album._id }).sort({ _id: -1 });
        res.status(200).json({ pinRequis: false, album, photos });
    } catch (error) {
        res.status(500).json({ message: "Erreur accès public", error: error.message });
    }
});

// 6. VÉRIFIER PIN PUBLIC
router.post('/shared/:code/verify-pin', async (req, res) => {
    try {
        const { pin } = req.body;
        const album = await Album.findOne({ codePartage: req.params.code });

        if (!album || album.codePIN !== pin) {
            return res.status(401).json({ message: "Code PIN incorrect !" });
        }

        const photos = await Photo.find({ album: album._id }).sort({ _id: -1 });
        res.status(200).json({ album, photos });
    } catch (error) {
        res.status(500).json({ message: "Erreur vérification PIN", error: error.message });
    }
});

// 7. DÉFINIR / MODIFIER PIN
router.put('/:id/set-pin', auth, async (req, res) => {
    try {
        const { pin } = req.body;
        const album = await Album.findOne({ _id: req.params.id, createur: req.auth.userId });
        if (!album) return res.status(404).json({ message: "Album introuvable." });

        album.codePIN = pin ? pin.trim() : "";
        await album.save();
        res.status(200).json({ message: "Code PIN mis à jour !", codePIN: album.codePIN });
    } catch (error) {
        res.status(500).json({ message: "Erreur mise à jour PIN", error: error.message });
    }
});

// 8. FOND PAR URL OU UPLOAD
router.put('/:id/cover', auth, async (req, res) => {
    try {
        const album = await Album.findOne({ _id: req.params.id, createur: req.auth.userId });
        if (!album) return res.status(404).json({ message: "Album introuvable" });

        album.photoCouverture = req.body.urlImage;
        await album.save();
        res.status(200).json({ message: "Fond mis à jour !" });
    } catch (error) {
        res.status(500).json({ message: "Erreur mise à jour fond", error: error.message });
    }
});

router.put('/:id/cover-upload', auth, multer, async (req, res) => {
    try {
        if (!req.files || req.files.length === 0) return res.status(400).json({ message: "Aucun fichier" });
        const file = req.files[0];
        const urlMedia = `${req.protocol}://${req.get('host')}/uploads/${file.filename}`;

        const album = await Album.findOne({ _id: req.params.id, createur: req.auth.userId });
        if (!album) return res.status(404).json({ message: "Album introuvable" });

        album.photoCouverture = urlMedia;
        await album.save();
        res.status(200).json({ message: "Fond mis à jour avec succès !" });
    } catch (error) {
        res.status(500).json({ message: "Erreur changement de fond", error: error.message });
    }
});

// 9. BASCULER PRIVÉ / PUBLIC
router.put('/:id/toggle-share', auth, async (req, res) => {
    try {
        const album = await Album.findOne({ _id: req.params.id, createur: req.auth.userId });
        if (!album) return res.status(404).json({ message: "Album introuvable." });

        album.statut = album.statut === "prive" ? "public" : "prive";
        if (album.statut === "public" && !album.codePartage) {
            album.codePartage = crypto.randomBytes(8).toString('hex');
        }

        await album.save();
        res.status(200).json({ message: `Mode ${album.statut} activé !` });
    } catch (error) {
        res.status(500).json({ message: "Erreur changement de statut", error: error.message });
    }
});

// 10. SUPPRESSION
router.delete('/:id', auth, async (req, res) => {
    try {
        const album = await Album.findOne({ _id: req.params.id, createur: req.auth.userId });
        if (!album) return res.status(404).json({ message: "Album introuvable." });

        const photos = await Photo.find({ album: req.params.id });
        photos.forEach(photo => {
            const nomFichier = photo.urlImage.split('/uploads/')[1];
            if (nomFichier) {
                const cheminFichier = path.join(__dirname, '../uploads', nomFichier);
                fs.unlink(cheminFichier, () => {});
            }
        });

        await Photo.deleteMany({ album: req.params.id });
        await Album.findByIdAndDelete(req.params.id);
        res.status(200).json({ message: "Album supprimé !" });
    } catch (error) {
        res.status(500).json({ message: "Erreur suppression", error: error.message });
    }
});

module.exports = router;