const express = require('express');
const router = express.Router();
const bcrypt = require('bcrypt');
const jwt = require('jsonwebtoken');
const User = require('../models/user');

// 1. 🔑 ROUTE D'INSCRIPTION (S'aligne sur pricing.html et register.html)
router.post('/register', async (req, res) => {
    try {
        const { email, password, forfait, stockageMaxMo } = req.body;

        // Vérifier si l'utilisateur existe déjà
        const userExists = await User.findOne({ email: email.toLowerCase() });
        if (userExists) return res.status(400).json({ message: "Cet e-mail est déjà utilisé." });

        // Crypter le mot de passe
        const hashedPassword = await bcrypt.hash(password, 10);

        // Créer le nouvel utilisateur
        const newUser = new User({
            email: email.toLowerCase(),
            password: hashedPassword,   // Stocké dans 'password'
            motDePasse: hashedPassword, // Doublé dans 'motDePasse' par sécurité pour ton login existant
            forfait: forfait || "Gratuit",
            stockageMaxMo: stockageMaxMo || 15360
        });

        await newUser.save();
        res.status(201).json({ message: "Utilisateur créé avec succès !" });
    } catch (error) {
        console.error("❌ Erreur lors de l'inscription :", error);
        res.status(500).json({ message: "Erreur serveur lors de l'inscription", error: error.message });
    }
});

// 2. 🔑 ROUTE DE CONNEXION (Reprend exactement ton fonctionnement d'origine)
router.post('/login', async (req, res) => {
    try {
        const { email, motDePasse } = req.body;
        
        // Recherche de l'utilisateur
        const utilisateurTrouve = await User.findOne({ email: email.toLowerCase() });

        if (!utilisateurTrouve) {
            return res.status(404).json({ message: "Utilisateur non trouvé..." });
        }

        // On vérifie le mot de passe (utilise 'motDePasse' ou 'password' selon ce qui est rempli)
        const passEnBase = utilisateurTrouve.motDePasse || utilisateurTrouve.password;
        const motDePasseCorrect = await bcrypt.compare(motDePasse, passEnBase);
        
        if (!motDePasseCorrect) {
            return res.status(400).json({ message: "Mot de passe incorrect !" });
        }

        // Génération du Token (Badge) sécurisé qui fonctionne avec tous tes middlewares
        const token = jwt.sign(
            { id: utilisateurTrouve._id, userId: utilisateurTrouve._id }, 
            'NOTRE_CLE_SECRETE_SUPER_CACHEE', 
            { expiresIn: '24h' }
        );

        res.status(200).json({ 
            message: "Connexion réussie ! Bienvenue !", 
            token: token, 
            user: { id: utilisateurTrouve._id, email: utilisateurTrouve.email, nom: utilisateurTrouve.email.split('@')[0] }
        });

    } catch (error) {
        console.error("❌ Erreur de connexion :", error);
        res.status(500).json({ message: "Erreur de connexion", error: error.message });
    }
});

// 📥 ROUTE 1 : SÉCURITÉ POUR FORCER LE TÉLÉCHARGEMENT D'UNE PHOTO UNIQUE
router.get('/download-file', async (req, res) => {
    try {
        const { url } = req.query;
        if (!url) return res.status(400).send("URL manquante");
        
        // On force le navigateur à le traiter comme un fichier physique téléchargeable
        res.attachment(url.split('/').pop());
        res.redirect(url);
    } catch (error) {
        res.status(500).send("Erreur de téléchargement");
    }
});

// 🌐 ROUTE 2 : FOURNIR L'ALBUM ET LES PHOTOS AU PUBLIC (SANS CODE PIN POUR L'INSTANT)
router.get('/public-album/:code', async (req, res) => {
    try {
        const Album = require('../models/Album'); // On charge le modèle au cas où
        const Photo = require('../models/Photo');

        // On cherche l'album public grâce au code de partage unique
        const album = await Album.findOne({ codePartage: req.params.code, statut: "public" });
        if (!album) return res.status(404).json({ message: "Cet album n'existe pas ou est privé." });

        // On va chercher toutes les photos associées à cet album
        const photos = await Photo.find({ album: album._id });

        // On renvoie le tout proprement au format attendu par le frontend
        res.status(200).json({ album, photos });
    } catch (error) {
        res.status(500).json({ message: "Erreur serveur", error: error.message });
    }
});

module.exports = router;