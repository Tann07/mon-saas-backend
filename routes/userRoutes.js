const express = require('express');
const router = express.Router();
const bcrypt = require('bcrypt');
const jwt = require('jsonwebtoken');
const crypto = require('crypto');
const nodemailer = require('nodemailer');
const User = require('../models/User');

// 📧 CONFIGURATION DU TRANSPORTEUR D'E-MAIL (Nodemailer)
// Tu pourras ajuster les variables d'environnement dans Render / fichier .env
const transporter = nodemailer.createTransport({
    service: 'gmail',
    auth: {
        user: process.env.EMAIL_USER || 'ton.email@gmail.com', // Ton email pour l'envoi
        pass: process.env.EMAIL_PASS || 'ton_mot_de_passe_application' // Ton mot de passe d'application Gmail
    }
});

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
            motDePasse: hashedPassword, // Doublé dans 'motDePasse' par sécurité
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

        // Génération du Token (Badge) sécurisé
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

//3 📩 ROUTE MOT DE PASSE OUBLIÉ
router.post('/forgot-password', async (req, res) => {
    try {
        const { email } = req.body;
        if (!email || email.trim() === "") {
            return res.status(400).json({ message: "Veuillez saisir une adresse email valide." });
        }

        const user = await User.findOne({ email: email.toLowerCase().trim() });
        if (!user) {
            return res.status(404).json({ message: "Aucun compte associé à cette adresse e-mail." });
        }

        // Génération du token
        const token = crypto.randomBytes(32).toString('hex');
        user.resetPasswordToken = token;
        user.resetPasswordExpires = Date.now() + 3600000; // Valable 1h
        await user.save();

        const resetUrl = `${req.protocol}://${req.get('host')}/reset-password.html?token=${token}`;

        // Affichage du lien dans le terminal pour tester instantanément sans envoi de vrai mail
        console.log("🔗 LIEN DE RÉINITIALISATION GÉNÉRÉ :", resetUrl);

        // Tentative d'envoi d'email
        try {
            const mailOptions = {
                from: '"Mon SaaS Média" <noreply@monsaasmedia.com>',
                to: user.email,
                subject: '🔑 Réinitialisation de votre mot de passe',
                html: `<p>Cliquez ici pour réinitialiser votre mot de passe : <a href="${resetUrl}">${resetUrl}</a></p>`
            };
            await transporter.sendMail(mailOptions);
            return res.status(200).json({ message: "Un e-mail de réinitialisation vous a été envoyé !" });
        } catch (emailErr) {
            console.log("⚠️ Email non envoyé (Mode dev/Test) : Utilisez le lien affiché dans le terminal !");
            // On renvoie quand même du succès pour ne pas bloquer l'utilisateur en test
            return res.status(200).json({ message: "Lien de réinitialisation généré ! (Vérifiez les logs serveur en dev)." });
        }

    } catch (error) {
        console.error("❌ Erreur backend forgot-password :", error);
        res.status(500).json({ message: "Erreur serveur lors de la réinitialisation.", error: error.message });
    }
});

// 4. 🔒 ROUTE VALIDER LE NOUVEAU MOT DE PASSE
router.post('/reset-password', async (req, res) => {
    try {
        const { token, newPassword } = req.body;

        if (!token || !newPassword) {
            return res.status(400).json({ message: "Jeton de sécurité ou mot de passe manquant." });
        }

        // Trouver l'utilisateur correspondant au token non expiré
        const user = await User.findOne({
            resetPasswordToken: token,
            resetPasswordExpires: { $gt: Date.now() }
        });

        if (!user) {
            return res.status(400).json({ message: "Le lien de réinitialisation est invalide ou a expiré." });
        }

        // Hacher le nouveau mot de passe
        const hashedPassword = await bcrypt.hash(newPassword, 10);
        user.password = hashedPassword;
        user.motDePasse = hashedPassword; // Mettre à jour les deux champs par cohérence
        user.resetPasswordToken = undefined;
        user.resetPasswordExpires = undefined;

        await user.save();
        res.status(200).json({ message: "Mot de passe modifié avec succès ! Vous pouvez maintenant vous connecter." });

    } catch (error) {
        console.error("❌ Erreur reset-password :", error);
        res.status(500).json({ message: "Erreur lors du changement de mot de passe", error: error.message });
    }
});

// 📥 ROUTE 1 : SÉCURITÉ POUR FORCER LE TÉLÉCHARGEMENT D'UNE PHOTO UNIQUE
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

// 🌐 ROUTE 2 : FOURNIR L'ALBUM ET LES PHOTOS AU PUBLIC
router.get('/public-album/:code', async (req, res) => {
    try {
        const Album = require('../models/Album');
        const Photo = require('../models/Photo');

        const album = await Album.findOne({ codePartage: req.params.code, statut: "public" });
        if (!album) return res.status(404).json({ message: "Cet album n'existe pas ou est privé." });

        const photos = await Photo.find({ album: album._id });
        res.status(200).json({ album, photos });
    } catch (error) {
        res.status(500).json({ message: "Erreur serveur", error: error.message });
    }
});

module.exports = router;